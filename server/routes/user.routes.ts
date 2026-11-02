import { Router } from "express";
import { z } from "zod";
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  resetUserPassword,
  setUserPermissions,
} from "../services/user.service";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { DELEGABLE_PERMISSION_KEYS, PERMISSION_CATALOG } from "../config/permissions";
import { ROLE_NAMES } from "../models/Role";
import { emailSchema, nameSchema, objectId, param, passwordSchema } from "../utils/validation";

const router = Router();

router.use(authenticate);

const permissionKey = z.string().trim().min(1).max(60);

// Which permissions the caller is allowed to hand out (i.e. delegable AND held by the caller)
router.get("/permissions/catalog", authorize("user:view"), (req, res) => {
  const held = req.auth!.permissions;
  res.json({
    permissions: PERMISSION_CATALOG.filter((p) => DELEGABLE_PERMISSION_KEYS.includes(p.key)).map((p) => ({
      ...p,
      grantable: held.has(p.key),
    })),
  });
});

router.post("/", authorize("user:manage"), async (req, res) => {
  const body = z
    .object({
      role: z.enum(["admin", "sales", "purchase"]),
      userName: nameSchema,
      email: emailSchema.optional(),
      // Initial password chosen by the owner/admin; the user must change it on first login
      password: passwordSchema,
      storeIds: z.array(objectId).max(100).optional(),
      storeId: objectId.optional(),
      permissions: z.array(permissionKey).max(100).optional(),
    })
    .parse(req.body);

  const user = await createUser(req.auth!, body);
  res.status(201).json({ user });
});

router.get("/", authorize("user:view"), async (req, res) => {
  const query = z
    .object({
      storeId: objectId.optional(),
      role: z.enum(ROLE_NAMES).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .parse(req.query);
  res.json(await listUsers(req.auth!, query));
});

router.get("/:id", authorize("user:view"), async (req, res) => {
  res.json({ user: await getUser(req.auth!, param(req.params.id)) });
});

router.patch("/:id", authorize("user:manage"), async (req, res) => {
  const body = z
    .object({
      isActive: z.boolean().optional(),
      userName: nameSchema.optional(),
      storeIds: z.array(objectId).max(100).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, "Nothing to update")
    .parse(req.body);
  res.json({ user: await updateUser(req.auth!, param(req.params.id), body) });
});

// Owner/admin sets a new temporary password; the user must change it at next login
router.post("/:id/reset-password", authorize("user:manage"), async (req, res) => {
  const { newPassword } = z.object({ newPassword: passwordSchema }).parse(req.body);
  await resetUserPassword(req.auth!, param(req.params.id), newPassword);
  res.json({ message: "Password reset. The user must change it at next login." });
});

// Replaces the user's per-feature overrides on top of their role defaults
router.put("/:id/permissions", authorize("user:manage"), async (req, res) => {
  const body = z
    .object({
      grant: z.array(permissionKey).max(100).default([]),
      revoke: z.array(permissionKey).max(100).default([]),
    })
    .parse(req.body);
  res.json({ user: await setUserPermissions(req.auth!, param(req.params.id), body) });
});

export default router;
