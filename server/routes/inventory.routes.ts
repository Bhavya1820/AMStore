import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorize,
  authorizeAny,
  requireStoreAccess,
} from "../middleware/authMiddleware";
import {
  listCategories,
  createCategory,
  createItem,
  bulkCreateItems,
  listItems,
  getItemById,
  updateItem,
  adjustItemStock,
  listItemLedgers,
} from "../services/inventory.service";
import { MEASURING_UNITS, LEDGER_TYPES } from "../models/Common";
import { nameSchema, param } from "../utils/validation";

const router = Router();

router.use(authenticate);
router.use(requireStoreAccess);

/* ------------------------------- categories ------------------------------- */

router.get("/categories", authorizeAny("item:view", "category:view"), async (req, res) => {
  const categories = await listCategories(req.auth!, req.storeId!);
  res.json({ categories });
});

router.post("/categories", authorizeAny("item:manage", "category:manage"), async (req, res) => {
  const { name } = z.object({ name: nameSchema }).parse(req.body);
  const category = await createCategory(req.auth!, req.storeId!, name);
  res.status(201).json({ category });
});

/* ---------------------------------- items --------------------------------- */

router.get("/items", authorize("item:view"), async (req, res) => {
  const query = z
    .object({
      q: z.string().optional(),
      category: z.string().optional(),
      measuringUnit: z.enum(MEASURING_UNITS).optional(),
      stockStatus: z.enum(["all", "in", "low", "out"]).default("all"),
      isActive: z.enum(["all", "true", "false"]).default("all"),
      sortBy: z
        .enum(["createdAt", "name", "currentStock", "salePrice", "purchasePrice"])
        .default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(50),
    })
    .parse(req.query);

  const result = await listItems(req.auth!, req.storeId!, query);
  res.json(result);
});

const itemRowSchema = z.object({
  rowNumber: z.coerce.number().int().optional(),
  name: nameSchema,
  category: z.string().trim().optional(),
  salePrice: z.coerce.number().min(0, "Sale price cannot be negative"),
  salePriceWithTax: z.boolean().default(false),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  purchasePriceWithTax: z.boolean().default(false),
  gst: z.coerce.number().min(0, "GST cannot be negative").max(100, "GST cannot exceed 100%"),
  measuringUnit: z.enum(MEASURING_UNITS),
  currentStock: z.coerce.number().min(0, "Opening stock cannot be negative").default(0),
  lowStock: z.coerce.number().min(0, "Low stock threshold cannot be negative").default(0),
  barcode: z.string().trim().min(1, "Barcode is required").max(80),
  hsn: z.string().trim().min(1, "HSN code is required").max(40),
  remarks: z.string().trim().max(300).optional(),
});

router.post("/items", authorize("item:manage"), async (req, res) => {
  const body = itemRowSchema.parse(req.body);
  const item = await createItem(req.auth!, req.storeId!, body);
  res.status(201).json({ item });
});

router.post("/items/bulk", authorize("item:manage"), async (req, res) => {
  const { items } = z
    .object({
      items: z.array(itemRowSchema).min(1, "At least one item is required").max(10000),
    })
    .parse(req.body);

  const result = await bulkCreateItems(req.auth!, req.storeId!, items);
  res.status(201).json(result);
});

router.get("/items/:id", authorize("item:view"), async (req, res) => {
  const item = await getItemById(req.auth!, req.storeId!, param(req.params.id));
  res.json({ item });
});

router.patch("/items/:id", authorize("item:manage"), async (req, res) => {
  const body = z
    .object({
      name: nameSchema.optional(),
      category: z.string().trim().nullable().optional(),
      salePrice: z.coerce.number().min(0).optional(),
      salePriceWithTax: z.boolean().optional(),
      purchasePrice: z.coerce.number().min(0).optional(),
      purchasePriceWithTax: z.boolean().optional(),
      gst: z.coerce.number().min(0).max(100).optional(),
      measuringUnit: z.enum(MEASURING_UNITS).optional(),
      lowStock: z.coerce.number().min(0).optional(),
      barcode: z.string().trim().min(1).max(80).optional(),
      hsn: z.string().trim().min(1).max(40).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, "Nothing to update")
    .parse(req.body);

  const item = await updateItem(req.auth!, req.storeId!, param(req.params.id), body);
  res.json({ item });
});

router.post(
  "/items/:id/adjust-stock",
  authorizeAny("item:manage", "stock:adjust"),
  async (req, res) => {
    const body = z
      .object({
        mode: z.enum(["add", "reduce", "set"]),
        quantity: z.coerce.number().min(0),
        rate: z.coerce.number().min(0).optional(),
        remarks: z.string().trim().max(300).optional(),
      })
      .parse(req.body);

    const item = await adjustItemStock(req.auth!, req.storeId!, param(req.params.id), body);
    res.json({ item });
  }
);

/* --------------------------- single item ledger --------------------------- */

router.get("/items/:id/ledger", authorizeAny("item:view", "ledger:view"), async (req, res) => {
  const query = z
    .object({
      type: z.enum(LEDGER_TYPES).optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    .parse(req.query);

  const result = await listItemLedgers(req.auth!, req.storeId!, {
    ...query,
    itemId: param(req.params.id),
  });
  res.json(result);
});

export default router;
