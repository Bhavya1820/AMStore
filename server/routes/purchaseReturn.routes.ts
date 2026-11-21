import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorizeAny,
  requireStoreAccess,
} from "../middleware/authMiddleware";
import {
  listFacilityPurchaseUsers,
  searchPartiesForPurchase,
  searchItemsForPurchase,
  getItemByBarcodeForPurchase,
} from "../services/purchase.service";
import {
  searchPartyPurchasesForReturn,
  createPurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturnById,
} from "../services/purchaseReturn.service";
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
  authorizeAny("purchase_return:view", "purchase_return:create", "user:view"),
  async (req, res) => {
    const users = await listFacilityPurchaseUsers(req.auth!, req.storeId!);
    res.json({ users });
  }
);

router.get(
  "/parties",
  authorizeAny("purchase_return:view", "purchase_return:create", "party:view"),
  async (req, res) => {
    const query = asyncSearchQuerySchema.parse(req.query);
    const result = await searchPartiesForPurchase(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/items",
  authorizeAny("purchase_return:view", "purchase_return:create", "item:view"),
  async (req, res) => {
    const query = asyncSearchQuerySchema.parse(req.query);
    const result = await searchItemsForPurchase(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/items/barcode/:barcode",
  authorizeAny("purchase_return:view", "purchase_return:create", "item:view"),
  async (req, res) => {
    const barcode = param(req.params.barcode);
    const item = await getItemByBarcodeForPurchase(req.auth!, req.storeId!, barcode);
    res.json({ item });
  }
);

router.get(
  "/invoices",
  authorizeAny("purchase_return:view", "purchase_return:create"),
  async (req, res) => {
    const query = z
      .object({
        partyId: z.string().optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const result = await searchPartyPurchasesForReturn(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

/* ---------------------------- purchase returns ---------------------------- */

router.get(
  "/",
  authorizeAny("purchase_return:view", "purchase_return:create"),
  async (req, res) => {
    const query = z
      .object({
        partyId: z.string().optional(),
        userId: z.string().optional(),
        q: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(req.query);

    const result = await listPurchaseReturns(req.auth!, req.storeId!, query);
    res.json(result);
  }
);

router.get(
  "/:id",
  authorizeAny("purchase_return:view", "purchase_return:create"),
  async (req, res) => {
    const purchaseReturn = await getPurchaseReturnById(
      req.auth!,
      req.storeId!,
      param(req.params.id)
    );
    res.json({ purchaseReturn });
  }
);

router.post(
  "/",
  authorizeAny("purchase_return:create"),
  async (req, res) => {
    const body = z
      .object({
        partyId: z.string().min(1, "Party is required"),
        invoiceId: z.string().optional(),
        purchaseReturnNumber: z
          .string()
          .trim()
          .min(1, "Purchase return number is required")
          .max(80),
        purchaseReturnDate: z.string().optional(),
        items: z
          .array(
            z.object({
              itemId: z.string().min(1),
              quantity: z.coerce.number().positive("Quantity must be greater than 0"),
              rate: z.coerce.number().min(0, "Rate cannot be negative"),
              priceIncludesTax: z.boolean().optional(),
              discount: z.coerce.number().min(0).default(0),
              gst: z.coerce.number().min(0).max(100).optional(),
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

    const purchaseReturn = await createPurchaseReturn(req.auth!, req.storeId!, body);
    res.status(201).json({ purchaseReturn });
  }
);

export default router;
