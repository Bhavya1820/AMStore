import { Router } from "express";
import Store from "../models/Store";
import { authenticate } from "../middleware/authMiddleware";

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
    })),
  });
});

export default router;
