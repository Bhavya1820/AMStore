import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorize,
  authorizeAny,
  requireStoreAccess,
} from "../middleware/authMiddleware";
import {
  listFacilityPurchaseUsers,
  searchPartiesForPurchase,
  searchItemsForPurchase,
  getItemByBarcodeForPurchase,
  createPurchaseInvoice,
  listPurchaseInvoices,
  getPurchaseInvoiceById,
  cancelPurchaseInvoice,
} from "../services/purchase.service";
import { PARTY_PAYMENT_METHODS } from "../models/Common";
import { param } from "../utils/validation";

const router = Router();

router.use(authenticate);
router.use(requireStoreAccess);

/* -------------------- async dropdowns & barcode lookup -------------------- */

const asyncSearchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  "/staff",
  authorizeAny("purchase:view", "user:view"),
  async (req, res) => {
    const users = await listFacilityPurchaseUsers(req.auth!, req.storeId!);
    res.json({ users });
  }
);

router.get(
  "/parties",
  authorizeAny("purchase:view", "purchase:create", "party:view"),
  async (req, res) => {
    const query = asyncSearchQuerySchema.parse(req.query);
    const result = await searchPartiesForPurchase(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/items",
  authorizeAny("purchase:view", "purchase:create", "item:view"),
  async (req, res) => {
    const query = asyncSearchQuerySchema.parse(req.query);
    const result = await searchItemsForPurchase(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/items/barcode/:barcode",
  authorizeAny("purchase:view", "purchase:create", "item:view"),
  async (req, res) => {
    const barcode = param(req.params.barcode);
    const item = await getItemByBarcodeForPurchase(req.auth!, req.storeId!, barcode);
    res.json({ item });
  }
);

/* ---------------------------- purchase invoices --------------------------- */

router.get(
  "/",
  authorizeAny("purchase:view", "purchase:create"),
  async (req, res) => {
    const query = z
      .object({
        partyId: z.string().optional(),
        userId: z.string().optional(),
        q: z.string().optional(),
        status: z.enum(["all", "paid", "unpaid", "partial"]).default("all"),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(req.query);

    const result = await listPurchaseInvoices(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/:id",
  authorizeAny("purchase:view", "purchase:create"),
  async (req, res) => {
    const invoice = await getPurchaseInvoiceById(
      req.auth!,
      req.storeId!,
      param(req.params.id)
    );
    res.json({ invoice });
  }
);

router.post(
  "/",
  authorize("purchase:create"),
  async (req, res) => {
    const body = z
      .object({
        partyId: z.string().min(1, "Party is required"),
        invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(80),
        invoiceDate: z.string().optional(),
        items: z
          .array(
            z.object({
              itemId: z.string().min(1),
              quantity: z.coerce.number().positive("Quantity must be greater than 0"),
              rate: z.coerce.number().min(0, "Rate cannot be negative"),
              priceIncludesTax: z.boolean().optional(),
              discount: z.coerce.number().min(0).default(0),
              gst: z.coerce.number().min(0).max(100).optional(),
              updateItemPurchasePrice: z.boolean().optional(),
            })
          )
          .min(1, "At least one item is required"),
        payments: z
          .array(
            z.object({
              amount: z.coerce.number().min(0),
              method: z.enum(PARTY_PAYMENT_METHODS),
            })
          )
          .optional(),
        notes: z.string().trim().max(400).optional(),
      })
      .parse(req.body);

    const invoice = await createPurchaseInvoice(req.auth!, req.storeId!, body);
    res.status(201).json({ invoice });
  }
);

router.post(
  "/:id/cancel",
  authorize("purchase:cancel"),
  async (req, res) => {
    const result = await cancelPurchaseInvoice(req.auth!, req.storeId!, param(req.params.id));
    res.json({
      message: `Purchase Invoice #${result.invoiceNumber} cancelled and stock/ledger reversed`,
      ...result,
    });
  }
);

export default router;
