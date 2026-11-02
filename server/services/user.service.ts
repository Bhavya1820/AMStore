import mongoose from "mongoose";
import User from "../models/User";
import Role, { RoleName } from "../models/Role";
import Store from "../models/Store";
import { AuthContext } from "../types/auth";
import { AppError } from "../utils/AppError";
import { ALL_PERMISSION_KEYS, DELEGABLE_PERMISSION_KEYS } from "../config/permissions";
import { resolvePermissions } from "./permission.service";
import { revokeAllSessions } from "./auth.service";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const STAFF_ROLES: RoleName[] = ["sales", "purchase"];

type UserDoc = InstanceType<typeof User>;

export const toUserDto = (user: UserDoc, role: RoleName) => ({
  id: user._id.toString(),
  tenantId: user.tenantId.toString(),
  userName: user.userName,
  email: user.email ?? null,
  role,
  storeIds: user.storeIds.map((s) => s.toString()),
  isOwner: user.isOwner,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  grantedPermissions: user.grantedPermissions,
  revokedPermissions: user.revokedPermissions,
  lastLoginAt: user.lastLoginAt ?? null,
});

function assertCanManageUsers(ctx: AuthContext): void {
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new AppError(403, "You are not allowed to manage users", "FORBIDDEN");
  }
}

// Owner can touch anyone but themselves-as-owner; an admin only staff in their own stores
function canManageTarget(ctx: AuthContext, targetRole: RoleName, targetStoreIds: string[]): boolean {
  if (ctx.role === "owner") return true;
  if (ctx.role === "admin") {
    return STAFF_ROLES.includes(targetRole) && targetStoreIds.some((s) => ctx.storeIds.includes(s));
  }
  return false;
}

async function validateStores(ctx: AuthContext, storeIds: string[]): Promise<void> {
  const count = await Store.countDocuments({ _id: { $in: storeIds }, tenantId: ctx.tenantId, isActive: true });
  if (count !== storeIds.length) throw new AppError(400, "One or more stores are invalid", "INVALID_STORE");
  if (ctx.role === "admin" && !storeIds.every((s) => ctx.storeIds.includes(s))) {
    throw new AppError(403, "You can only manage users of your own facilities", "FORBIDDEN");
  }
}

// Nobody can hand out access they don't have themselves
function validateGrantable(ctx: AuthContext, keys: string[]): string[] {
  const unique = [...new Set(keys)];
  for (const key of unique) {
    if (!DELEGABLE_PERMISSION_KEYS.includes(key)) {
      throw new AppError(400, `Permission "${key}" cannot be assigned to staff`, "INVALID_PERMISSION");
    }
    if (!ctx.permissions.has(key)) {
      throw new AppError(403, `You cannot grant "${key}" because you don't have it`, "FORBIDDEN");
    }
  }
  return unique;
}

async function loadTarget(ctx: AuthContext, id: string) {
  const notFound = new AppError(404, "User not found");
  if (!OBJECT_ID.test(id)) throw notFound;

  const user = await User.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!user) throw notFound;
  const role = await Role.findById(user.roleId).select("name");
  if (!role) throw notFound;

  const storeIds = user.storeIds.map((s) => s.toString());
  // Out-of-scope users look the same as missing ones
  if (!canManageTarget(ctx, role.name, storeIds)) throw notFound;
  return { user, role: role.name };
}

// For mutations: the owner account is protected and nobody edits themselves through this API
function assertMutable(ctx: AuthContext, user: UserDoc): void {
  if (user.isOwner) throw new AppError(403, "The owner account cannot be modified", "FORBIDDEN");
  if (user._id.toString() === ctx.userId) {
    throw new AppError(400, "Use the change-password endpoint for your own account");
  }
}

/* --------------------------------- create ---------------------------------- */

export interface CreateUserInput {
  role: "admin" | "sales" | "purchase";
  userName: string;
  email?: string;
  password: string;
  storeIds?: string[];
  storeId?: string;
  permissions?: string[];
}

export async function createUser(ctx: AuthContext, input: CreateUserInput) {
  assertCanManageUsers(ctx);
  if (input.role === "admin" && ctx.role !== "owner") {
    throw new AppError(403, "Only the owner can create facility admins", "FORBIDDEN");
  }

  let storeIds: string[];
  if (input.role === "admin") {
    storeIds = [...new Set(input.storeIds ?? [])];
    if (storeIds.length === 0) throw new AppError(400, "A facility admin needs at least one store");
    if (!input.email) throw new AppError(400, "A facility admin needs an email");
  } else {
    const storeId = input.storeId ?? input.storeIds?.[0];
    if (!storeId) throw new AppError(400, "Staff must be assigned to a store");
    storeIds = [storeId];
  }
  await validateStores(ctx, storeIds);

  const granted = input.role === "admin" ? [] : validateGrantable(ctx, input.permissions ?? []);

  const role = await Role.findOne({ tenantId: ctx.tenantId, name: input.role });
  if (!role) throw new AppError(500, "Role is not configured for this tenant");

  const user = await User.create({
    tenantId: ctx.tenantId,
    storeIds,
    roleId: role._id,
    userName: input.userName,
    email: input.email,
    password: input.password,
    mustChangePassword: true,
    grantedPermissions: granted,
    createdBy: ctx.userId,
  });

  return toUserDto(user, input.role);
}

/* ---------------------------------- read ----------------------------------- */

export async function listUsers(
  ctx: AuthContext,
  query: { storeId?: string; role?: RoleName; page: number; limit: number }
) {
  assertCanManageUsers(ctx);

  const roles = await Role.find({ tenantId: ctx.tenantId }).select("name");
  const nameById = new Map(roles.map((r) => [r._id.toString(), r.name]));
  const filter: Record<string, unknown> = { tenantId: ctx.tenantId };

  let roleNames: RoleName[] | undefined = ctx.role === "admin" ? STAFF_ROLES : undefined;
  if (query.role) {
    roleNames = roleNames ? roleNames.filter((r) => r === query.role) : [query.role];
  }
  if (roleNames) {
    filter.roleId = { $in: roles.filter((r) => roleNames!.includes(r.name)).map((r) => r._id) };
  }

  if (ctx.role === "admin") {
    const allowed = query.storeId ? [query.storeId].filter((s) => ctx.storeIds.includes(s)) : ctx.storeIds;
    filter.storeIds = { $in: allowed };
  } else if (query.storeId) {
    filter.storeIds = query.storeId;
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    User.countDocuments(filter),
  ]);

  return {
    total,
    page: query.page,
    users: users.map((u) => toUserDto(u, nameById.get(u.roleId.toString()) as RoleName)),
  };
}

export async function getUser(ctx: AuthContext, id: string) {
  assertCanManageUsers(ctx);
  const { user, role } = await loadTarget(ctx, id);
  return {
    ...toUserDto(user, role),
    effectivePermissions: [...(await resolvePermissions(user))].sort(),
  };
}

/* --------------------------------- update ---------------------------------- */

export interface UpdateUserInput {
  isActive?: boolean;
  userName?: string;
  storeIds?: string[];
}

export async function updateUser(ctx: AuthContext, id: string, input: UpdateUserInput) {
  assertCanManageUsers(ctx);
  const { user, role } = await loadTarget(ctx, id);
  assertMutable(ctx, user);

  if (input.userName !== undefined) user.userName = input.userName;

  if (input.storeIds !== undefined) {
    if (ctx.role !== "owner") throw new AppError(403, "Only the owner can move users between stores", "FORBIDDEN");
    const storeIds = [...new Set(input.storeIds)];
    if (storeIds.length === 0 || (role !== "admin" && storeIds.length !== 1)) {
      throw new AppError(400, role === "admin" ? "At least one store is required" : "Staff must belong to exactly one store");
    }
    await validateStores(ctx, storeIds);
    user.storeIds = storeIds.map((s) => new mongoose.Types.ObjectId(s));
  }

  if (input.isActive !== undefined) user.isActive = input.isActive;
  await user.save();

  // Deactivated or moved users must not keep working sessions
  if (input.isActive === false || input.storeIds !== undefined) await revokeAllSessions(user._id);

  return toUserDto(user, role);
}

export async function resetUserPassword(ctx: AuthContext, id: string, newPassword: string) {
  assertCanManageUsers(ctx);
  const { user } = await loadTarget(ctx, id);
  assertMutable(ctx, user);

  user.password = newPassword;
  user.mustChangePassword = true;
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  await user.save();
  await revokeAllSessions(user._id);
}

export async function setUserPermissions(
  ctx: AuthContext,
  id: string,
  input: { grant: string[]; revoke: string[] }
) {
  assertCanManageUsers(ctx);
  const { user, role } = await loadTarget(ctx, id);
  assertMutable(ctx, user);

  if (!STAFF_ROLES.includes(role)) {
    throw new AppError(400, "Feature access can only be customised for sales and purchase staff");
  }

  const grant = validateGrantable(ctx, input.grant);
  const revoke = [...new Set(input.revoke)];
  const unknown = revoke.find((k) => !ALL_PERMISSION_KEYS.includes(k));
  if (unknown) throw new AppError(400, `Unknown permission "${unknown}"`, "INVALID_PERMISSION");
  if (grant.some((k) => revoke.includes(k))) {
    throw new AppError(400, "A permission cannot be granted and revoked at the same time");
  }

  user.grantedPermissions = grant;
  user.revokedPermissions = revoke;
  await user.save();

  return {
    ...toUserDto(user, role),
    effectivePermissions: [...(await resolvePermissions(user))].sort(),
  };
}
