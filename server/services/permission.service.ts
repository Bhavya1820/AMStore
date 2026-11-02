import Permission from "../models/Permission";
import Role, { RoleName, ROLE_NAMES } from "../models/Role";
import mongoose from "mongoose";
import {
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
} from "../config/permissions";

// Idempotent: run on every startup so new catalogue entries appear automatically
export async function seedPermissions(): Promise<void> {
  await Permission.bulkWrite(
    PERMISSION_CATALOG.map((p) => {
      const [module, action] = p.key.split(":");
      return {
        updateOne: {
          filter: { key: p.key },
          update: { $set: { module, action, description: p.description, isActive: true } },
          upsert: true,
        },
      };
    })
  );
}

// Creates the four system roles for a new tenant
export async function createDefaultRoles(tenantId: mongoose.Types.ObjectId) {
  const perms = await Permission.find({ isActive: true }).select("key");
  const idByKey = new Map(perms.map((p) => [p.key, p._id]));

  const docs = ROLE_NAMES.map((name) => ({
    tenantId,
    name,
    isSystemRole: true,
    permissions: DEFAULT_ROLE_PERMISSIONS[name]
      .map((key) => idByKey.get(key))
      .filter((id): id is NonNullable<typeof id> => Boolean(id)),
  }));

  const roles = await Role.insertMany(docs);
  const byName = {} as Record<RoleName, (typeof roles)[number]>;
  for (const role of roles) byName[role.name] = role;
  return byName;
}

// Effective permissions = role defaults + user grants - user revocations
export async function resolvePermissions(user: {
  isOwner: boolean;
  roleId: mongoose.Types.ObjectId;
  grantedPermissions: string[];
  revokedPermissions: string[];
}): Promise<Set<string>> {
  if (user.isOwner) return new Set(ALL_PERMISSION_KEYS);

  const role = await Role.findById(user.roleId).select("permissions");
  const perms = role
    ? await Permission.find({ _id: { $in: role.permissions }, isActive: true }).select("key")
    : [];

  const effective = new Set(perms.map((p) => p.key));
  for (const key of user.grantedPermissions) {
    if (ALL_PERMISSION_KEYS.includes(key)) effective.add(key);
  }
  for (const key of user.revokedPermissions) effective.delete(key);
  return effective;
}
