import { Router } from "express";
import { z } from "zod";
import Store from "../models/Store";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { emailSchema, nameSchema, param } from "../utils/validation";
import { generateStoreCode } from "../utils/storeCode";
import { AppError } from "../utils/AppError";

const router = Router();

router.use(authenticate);

// Stores the caller may access: the owner sees every store in the tenant,
// everyone else only the stores they are assigned to
router.get("/", async (req, res) => {
  const { tenantId, storeIds } = req.auth!;
  const filter: Record<string, unknown> = { tenantId, isActive: true };
  if (storeIds.length > 0) filter._id = { $in: storeIds };

  const stores = await Store.find(filter).sort({ name: 1 });
  res.json({
    stores: stores.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      storeCode: s.storeCode,
      email: s.email,
      phone: s.phone ?? null,
      address: s.address ?? null,
      gstIn: s.gstIn ?? null,
      isActive: s.isActive,
    })),
  });
});

// Owner can create another facility/store (requires store:manage permission)
router.post("/", authorize("store:manage"), async (req, res) => {
  const body = z
    .object({
      name: nameSchema,
      email: emailSchema,
      phone: z.string().trim().min(7).max(20).optional(),
      address: z.string().trim().max(300).optional(),
      gstIn: z.string().trim().length(15, "GSTIN must be 15 characters").optional(),
    })
    .parse(req.body);

  const { tenantId } = req.auth!;

  let store = null;
  for (let attempt = 0; attempt < 5 && !store; attempt++) {
    try {
      store = await Store.create({
        tenantId,
        name: body.name,
        email: body.email,
        storeCode: generateStoreCode(),
        phone: body.phone,
        address: body.address,
        gstIn: body.gstIn,
      });
    } catch (err: unknown) {
      const isDuplicate = typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
      if (!isDuplicate || attempt === 4) throw err;
    }
  }

  if (!store) {
    throw new AppError(500, "Could not allocate a store code. Please try again.");
  }

  res.status(201).json({
    store: {
      id: store._id.toString(),
      name: store.name,
      storeCode: store.storeCode,
      email: store.email,
      phone: store.phone ?? null,
      address: store.address ?? null,
      gstIn: store.gstIn ?? null,
      isActive: store.isActive,
    },
  });
});

// Update store details
router.patch("/:id", authorize("store:manage"), async (req, res) => {
  const storeId = param(req.params.id);
  const body = z
    .object({
      name: nameSchema.optional(),
      email: emailSchema.optional(),
      phone: z.string().trim().min(7).max(20).optional(),
      address: z.string().trim().max(300).optional(),
      gstIn: z.string().trim().length(15, "GSTIN must be 15 characters").optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, "No fields to update")
    .parse(req.body);

  const { tenantId } = req.auth!;

  const store = await Store.findOne({ _id: storeId, tenantId });
  if (!store) {
    throw new AppError(404, "Store not found");
  }

  if (body.name !== undefined) store.name = body.name;
  if (body.email !== undefined) store.email = body.email;
  if (body.phone !== undefined) store.phone = body.phone;
  if (body.address !== undefined) store.address = body.address;
  if (body.gstIn !== undefined) store.gstIn = body.gstIn;
  if (body.isActive !== undefined) store.isActive = body.isActive;

  await store.save();

  res.json({
    store: {
      id: store._id.toString(),
      name: store.name,
      storeCode: store.storeCode,
      email: store.email,
      phone: store.phone ?? null,
      address: store.address ?? null,
      gstIn: store.gstIn ?? null,
      isActive: store.isActive,
    },
  });
});

export default router;
