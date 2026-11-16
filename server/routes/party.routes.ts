import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorize,
  authorizeAny,
  requireStoreAccess,
} from "../middleware/authMiddleware";
import {
  createParty,
  bulkCreateParties,
  updateParty,
  deleteParty,
  getParty,
  listParties,
  listPartyOptions,
  recordPartyPayment,
  getPartyLedger,
  listOpenInvoices,
} from "../services/party.service";
import { LEDGER_TYPES, PARTY_PAYMENT_METHODS } from "../models/Common";
import { emailSchema, nameSchema, param } from "../utils/validation";

const router = Router();

router.use(authenticate);
router.use(requireStoreAccess);

/* ----------------------------- party options ------------------------------ */

router.get(
  "/options",
  authorizeAny("party:view", "party:manage", "purchase:create"),
  async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const parties = await listPartyOptions(req.auth!, req.storeId!, q);
    res.json({ parties });
  }
);

/* ------------------------------- party CRUD ------------------------------- */

router.get("/", authorizeAny("party:view", "party:manage"), async (req, res) => {
  const query = z
    .object({
      q: z.string().optional(),
      status: z.enum(["active", "archived", "all"]).default("active"),
      balance: z.enum(["all", "payable", "advance", "settled"]).default("all"),
      sortBy: z.enum(["name", "balance", "createdAt"]).default("name"),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(25),
    })
    .parse(req.query);

  const result = await listParties(req.auth!, req.storeId!, query);
  res.json(result);
});

router.post("/", authorize("party:manage"), async (req, res) => {
  const body = z
    .object({
      name: nameSchema,
      mobileNumber: z.string().trim().min(7).max(20).optional(),
      email: emailSchema.optional(),
      gstIn: z.string().trim().length(15, "GSTIN must be 15 characters").optional(),
      address: z.string().trim().max(300).optional(),
      openingBalance: z.coerce.number().default(0),
    })
    .parse(req.body);

  const party = await createParty(req.auth!, req.storeId!, body);
  res.status(201).json({ party });
});

const bulkPartyRowSchema = z.object({
  rowNumber: z.coerce.number().int().optional(),
  name: nameSchema,
  mobileNumber: z.union([z.string().trim().min(7).max(20), z.literal("")]).optional(),
  email: z.union([emailSchema, z.literal("")]).optional(),
  gstIn: z.union([z.string().trim().length(15, "GSTIN must be 15 characters"), z.literal("")]).optional(),
  address: z.string().trim().max(300).optional(),
  openingBalance: z.coerce.number().default(0),
  openingType: z.enum(["payable", "advance"]).optional(),
  remarks: z.string().trim().max(300).optional(),
});

router.post("/bulk", authorize("party:manage"), async (req, res) => {
  const { parties } = z
    .object({
      parties: z.array(bulkPartyRowSchema).min(1, "At least one party is required").max(10000),
    })
    .parse(req.body);

  const result = await bulkCreateParties(req.auth!, req.storeId!, parties);
  res.status(201).json(result);
});

router.get("/:id", authorizeAny("party:view", "party:manage"), async (req, res) => {
  const party = await getParty(req.auth!, req.storeId!, param(req.params.id));
  res.json({ party });
});

router.patch("/:id", authorize("party:manage"), async (req, res) => {
  const body = z
    .object({
      name: nameSchema.optional(),
      mobileNumber: z.string().trim().max(20).optional(),
      email: z.union([emailSchema, z.literal("")]).optional(),
      gstIn: z.union([z.string().trim().length(15, "GSTIN must be 15 characters"), z.literal("")]).optional(),
      address: z.string().trim().max(300).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, "Nothing to update")
    .parse(req.body);

  const party = await updateParty(req.auth!, req.storeId!, param(req.params.id), body);
  res.json({ party });
});

router.delete("/:id", authorize("party:manage"), async (req, res) => {
  const result = await deleteParty(req.auth!, req.storeId!, param(req.params.id));
  res.json(result);
});

/* -------------------------- party ledger & payments ----------------------- */

router.get(
  "/:id/ledger",
  authorizeAny("party:manage", "ledger:view", "party:view"),
  async (req, res) => {
    const query = z
      .object({
        type: z.enum(LEDGER_TYPES).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(req.query);

    const result = await getPartyLedger(req.auth!, req.storeId!, param(req.params.id), query);
    res.json(result);
  }
);

router.get(
  "/:id/open-invoices",
  authorizeAny("party:manage", "payment:create", "party:view"),
  async (req, res) => {
    const invoices = await listOpenInvoices(req.auth!, req.storeId!, param(req.params.id));
    res.json({ invoices });
  }
);

router.post(
  "/:id/payments",
  authorizeAny("party:manage", "payment:create"),
  async (req, res) => {
    const body = z
      .object({
        amount: z.coerce.number().positive("Payment amount must be greater than 0"),
        method: z.enum(PARTY_PAYMENT_METHODS),
        date: z.string().optional(),
        invoiceId: z.string().optional(),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(req.body);

    const result = await recordPartyPayment(req.auth!, req.storeId!, param(req.params.id), body);
    res.status(201).json(result);
  }
);

export default router;
