import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User";
import Role from "../models/Role";
import Tenant from "../models/Tenant";
import Store from "../models/Store";
import RefreshToken from "../models/RefreshToken";
import { createDefaultRoles, resolvePermissions } from "./permission.service";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRegistrationToken,
  ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
} from "../utils/tokens";
import { generateStoreCode } from "../utils/storeCode";
import { AppError } from "../utils/AppError";
import { Role as RoleName } from "../types/auth";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// Used to burn the same CPU time when the user does not exist (prevents account enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
}

const isDuplicateKey = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;

async function assertTenantUsable(tenantId: mongoose.Types.ObjectId | string): Promise<void> {
  const tenant = await Tenant.findById(tenantId).select("status");
  if (!tenant || (tenant.status !== "trial" && tenant.status !== "active")) {
    throw new AppError(403, "This account is suspended. Please contact support.", "TENANT_INACTIVE");
  }
}

async function roleNameOf(roleId: mongoose.Types.ObjectId): Promise<RoleName> {
  const role = await Role.findById(roleId).select("name");
  if (!role) throw new AppError(500, "User role is missing");
  return role.name;
}

async function createSession(
  user: { _id: mongoose.Types.ObjectId; tenantId: mongoose.Types.ObjectId; roleId: mongoose.Types.ObjectId; storeIds: mongoose.Types.ObjectId[] },
  meta: SessionMeta,
  family: string = crypto.randomUUID()
): Promise<Session> {
  const role = await roleNameOf(user.roleId);
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
    storeIds: user.storeIds.map((s) => s.toString()),
    role,
  });

  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    tenantId: user.tenantId,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { accessToken, accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_MINUTES * 60, refreshToken };
}

export const revokeAllSessions = (userId: mongoose.Types.ObjectId | string) =>
  RefreshToken.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });

/* ------------------------------- registration ------------------------------ */

export interface RegisterInput {
  registrationToken: string;
  ownerName: string;
  password: string;
  tenantName: string;
  storeName: string;
  storeEmail?: string;
  phone?: string;
  address?: string;
  gstIn?: string;
}

export async function registerOwner(input: RegisterInput, meta: SessionMeta) {
  const { email } = verifyRegistrationToken(input.registrationToken);

  if ((await User.exists({ email })) || (await Tenant.exists({ ownerEmail: email }))) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
  }

  let tenantId: mongoose.Types.ObjectId | undefined;
  try {
    const tenant = await Tenant.create({ name: input.tenantName, ownerEmail: email, status: "trial" });
    tenantId = tenant._id;

    const roles = await createDefaultRoles(tenant._id);

    let store = null;
    for (let attempt = 0; attempt < 5 && !store; attempt++) {
      try {
        store = await Store.create({
          tenantId: tenant._id,
          name: input.storeName,
          email: input.storeEmail ?? email,
          storeCode: generateStoreCode(),
          phone: input.phone,
          address: input.address,
          gstIn: input.gstIn,
        });
      } catch (err) {
        // storeCode collision: retry with a fresh code
        if (!isDuplicateKey(err) || attempt === 4) throw err;
      }
    }
    if (!store) throw new AppError(500, "Could not allocate a store code");

    const owner = await User.create({
      tenantId: tenant._id,
      storeIds: [], // empty = every store in the tenant
      roleId: roles.owner._id,
      isOwner: true,
      userName: input.ownerName,
      email,
      password: input.password,
    });

    const session = await createSession(owner, meta);
    return { session, user: owner, role: "owner" as RoleName, store, tenant };
  } catch (err) {
    // Standalone MongoDB has no transactions, so undo partial writes manually
    if (tenantId) {
      await Promise.allSettled([
        User.deleteMany({ tenantId }),
        Store.deleteMany({ tenantId }),
        Role.deleteMany({ tenantId }),
        Tenant.deleteOne({ _id: tenantId }),
      ]);
    }
    if (isDuplicateKey(err)) {
      throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
    }
    throw err;
  }
}

/* ---------------------------------- login ---------------------------------- */

export type LoginInput =
  | { email: string; password: string }
  | { storeCode: string; userName: string; password: string };

export async function login(input: LoginInput, meta: SessionMeta) {
  let user = null;
  if ("email" in input) {
    user = await User.findOne({ email: input.email }).select("+password");
  } else {
    const store = await Store.findOne({ storeCode: input.storeCode.toUpperCase() });
    if (store) {
      user = await User.findOne({
        tenantId: store.tenantId,
        userName: input.userName,
        storeIds: store._id,
      }).select("+password");
    }
  }

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw new AppError(423, "Too many failed attempts. Try again later.", "ACCOUNT_LOCKED");
  }

  if (!(await user.comparePassword(input.password))) {
    const failed = user.failedLoginCount + 1;
    const update: Record<string, unknown> = { failedLoginCount: failed };
    if (failed >= MAX_FAILED_LOGINS) {
      update.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      update.failedLoginCount = 0;
    }
    await User.updateOne({ _id: user._id }, { $set: update });
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  // Checked after the password so these states aren't revealed to someone who doesn't know it
  if (!user.isActive) throw new AppError(403, "This account has been deactivated", "USER_INACTIVE");
  await assertTenantUsable(user.tenantId);

  await User.updateOne(
    { _id: user._id },
    { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockUntil: "" } }
  );

  const session = await createSession(user, meta);
  const role = await roleNameOf(user.roleId);
  return { session, user, role };
}

/* --------------------------------- refresh --------------------------------- */

export async function refreshSession(rawToken: string, meta: SessionMeta) {
  const tokenHash = hashToken(rawToken);

  // Atomic claim: only one concurrent request can rotate a given token
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }
  );

  if (!claimed) {
    // A revoked token being presented again means it was likely stolen: kill the whole chain
    const reused = await RefreshToken.findOne({ tokenHash });
    if (reused) {
      await RefreshToken.updateMany(
        { family: reused.family, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
    }
    throw new AppError(401, "Session expired. Please log in again.", "REFRESH_INVALID");
  }

  const user = await User.findById(claimed.userId);
  if (!user || !user.isActive) throw new AppError(401, "Session expired. Please log in again.", "REFRESH_INVALID");
  await assertTenantUsable(user.tenantId);

  const session = await createSession(user, meta, claimed.family);
  claimed.replacedByHash = hashToken(session.refreshToken);
  await claimed.save();
  return session;
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

/* ----------------------------- change password ----------------------------- */

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: SessionMeta
): Promise<Session> {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError(404, "User not found");

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError(401, "Current password is incorrect", "INVALID_CREDENTIALS");
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, "New password must be different from the current one");
  }

  user.password = newPassword; // hashed by the pre-save hook
  user.mustChangePassword = false;
  user.failedLoginCount = 0;
  await user.save();

  // Sign out every other device, then start a fresh session for this one
  await revokeAllSessions(user._id);
  return createSession(user, meta);
}

/* ---------------------------------- profile -------------------------------- */

export async function getProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  const role = await roleNameOf(user.roleId);
  const permissions = [...(await resolvePermissions(user))].sort();
  return { user, role, permissions };
}
