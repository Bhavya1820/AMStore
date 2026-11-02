import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Role from "../models/Role";
import Tenant from "../models/Tenant";
import Store from "../models/Store";
import { verifyAccessToken } from "../utils/tokens";
import { resolvePermissions } from "../services/permission.service";
import { AppError } from "../utils/AppError";

const OBJECT_ID = /^[a-f\d]{24}$/i;

function buildAuthenticate(allowPasswordChangePending: boolean) {
  return async function authenticate(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(401, "No token provided", "NO_TOKEN");
    }

    let payload;
    try {
      payload = verifyAccessToken(header.slice(7));
    } catch {
      throw new AppError(401, "Invalid or expired token", "INVALID_TOKEN");
    }

    // Always re-read from the database so deactivation / permission changes apply instantly
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) throw new AppError(401, "Account is not active", "USER_INACTIVE");

    // Tokens issued before a password change are no longer valid
    if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > (payload.iat ?? 0)) {
      throw new AppError(401, "Password changed. Please log in again.", "INVALID_TOKEN");
    }

    const [tenant, role, permissions] = await Promise.all([
      Tenant.findById(user.tenantId).select("status"),
      Role.findById(user.roleId).select("name"),
      resolvePermissions(user),
    ]);
    if (!tenant || (tenant.status !== "trial" && tenant.status !== "active")) {
      throw new AppError(403, "This account is suspended", "TENANT_INACTIVE");
    }
    if (!role) throw new AppError(500, "User role is missing");

    if (user.mustChangePassword && !allowPasswordChangePending) {
      throw new AppError(403, "You must change your password first", "PASSWORD_CHANGE_REQUIRED");
    }

    req.auth = {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: role.name,
      isOwner: user.isOwner,
      storeIds: user.storeIds.map((s) => s.toString()),
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  };
}

// Standard guard for business routes: blocks users who still have a temporary password
export const authenticate = buildAuthenticate(false);
// Only for /me and /change-password so a user with a temporary password can fix it
export const authenticateAllowPasswordChange = buildAuthenticate(true);

export const requireRole = (...roles: Array<"owner" | "admin" | "sales" | "purchase">) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new AppError(403, "You do not have access to this resource", "FORBIDDEN");
    }
    next();
  };

// Requires ALL listed permissions
export const authorize = (...permissions: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new AppError(401, "Not authenticated", "NO_TOKEN");
    const missing = permissions.filter((p) => !req.auth!.permissions.has(p));
    if (missing.length) {
      throw new AppError(403, "You do not have permission to do this", "FORBIDDEN");
    }
    next();
  };

/**
 * Resolves which store a request acts on (param, query, `x-store-id` header or body)
 * and verifies the tenant owns it and the user may access it.
 * Staff with a single store don't need to send one.
 */
export async function requireStoreAccess(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) throw new AppError(401, "Not authenticated", "NO_TOKEN");

  const header = req.headers["x-store-id"];
  const candidate =
    (typeof req.params.storeId === "string" ? req.params.storeId : undefined) ??
    (typeof req.query.storeId === "string" ? req.query.storeId : undefined) ??
    (typeof header === "string" ? header : undefined) ??
    (typeof req.body?.storeId === "string" ? req.body.storeId : undefined) ??
    (auth.storeIds.length === 1 ? auth.storeIds[0] : undefined);

  if (!candidate) throw new AppError(400, "storeId is required", "STORE_REQUIRED");
  if (!OBJECT_ID.test(candidate)) throw new AppError(400, "Invalid storeId", "INVALID_STORE");

  // Empty storeIds means the owner, who may use any store of the tenant
  if (auth.storeIds.length > 0 && !auth.storeIds.includes(candidate)) {
    throw new AppError(403, "You do not have access to this store", "FORBIDDEN");
  }

  const store = await Store.findOne({ _id: new mongoose.Types.ObjectId(candidate), tenantId: auth.tenantId });
  if (!store || !store.isActive) throw new AppError(404, "Store not found", "INVALID_STORE");

  req.storeId = candidate;
  next();
}