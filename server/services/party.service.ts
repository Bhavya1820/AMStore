import mongoose, { ClientSession } from "mongoose";
import Party from "../models/Party";
import Ledger from "../models/Ledger";
import Purchase from "../models/purchaseInvoice";
import PurchaseReturn from "../models/purchaseReturn";
import Payments from "../models/Payment";
import { LedgerType, PartyPaymentMethod } from "../models/Common";
import { AuthContext } from "../types/auth";
import { AppError } from "../utils/AppError";
import { runAtomic } from "../utils/transaction";

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type PartyDoc = InstanceType<typeof Party>;

export const toPartyDto = (p: PartyDoc) => ({
  id: p._id.toString(),
  storeId: p.storeId.toString(),
  name: p.name,
  mobileNumber: p.mobileNumber ?? null,
  email: p.email ?? null,
  gstIn: p.gstIn ?? null,
  address: p.address ?? null,
  openingBalance: p.openingBalance ?? 0,
  balance: money(p.balance ?? 0),
  isActive: p.isActive,
  createdAt: p.createdAt ?? null,
  updatedAt: p.updatedAt ?? null,
});

async function loadParty(ctx: AuthContext, storeId: string, id: string, session?: ClientSession) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Party not found");
  const party = await Party.findOne({ _id: id, tenantId: ctx.tenantId, storeId }).session(session ?? null);
  if (!party) throw new AppError(404, "Party not found");
  return party;
}

/* ------------------------------ ledger posting ----------------------------- */

export interface PartyEntryInput {
  partyId: mongoose.Types.ObjectId | string;
  type: LedgerType;
  // credit: store owes more (purchase, opening payable)
  // debit:  store owes less (payment out, purchase return, advance)
  credit?: number;
  debit?: number;
  date?: Date;
  invoiceId?: mongoose.Types.ObjectId;
  payment?: { amount: number; method: PartyPaymentMethod; date: Date }[];
  remarks?: string;
}

/**
 * Appends one entry to a party's ledger and moves its balance atomically.
 * The running balance stored on the entry comes from the same $inc, so concurrent
 * postings can never produce a wrong running balance.
 */
export async function postPartyEntry(
  ctx: AuthContext,
  storeId: string,
  input: PartyEntryInput,
  session?: ClientSession
) {
  const credit = money(input.credit ?? 0);
  const debit = money(input.debit ?? 0);

  const party = await Party.findOneAndUpdate(
    { _id: input.partyId, tenantId: ctx.tenantId, storeId },
    { $inc: { balance: money(credit - debit) } },
    { new: true, session }
  );
  if (!party) throw new AppError(404, "Party not found");

  const [entry] = await Ledger.create(
    [
      {
        tenantId: ctx.tenantId,
        storeId,
        account: "party",
        accountId: party._id,
        party: party._id,
        userId: ctx.userId,
        date: input.date ?? new Date(),
        type: input.type,
        invoiceId: input.invoiceId,
        amount: money(credit || debit),
        credit,
        debit,
        balanceAmount: money(party.balance),
        partyBalance: money(party.balance),
        payment: input.payment ?? [],
        remarks: input.remarks,
      },
    ],
    { session }
  );

  return { party, entry };
}

/* --------------------------------- CRUD ----------------------------------- */

export interface PartyInput {
  name: string;
  mobileNumber?: string;
  email?: string;
  gstIn?: string;
  address?: string;
}

async function assertUniqueName(ctx: AuthContext, storeId: string, name: string, excludeId?: string) {
  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    isActive: true,
    name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Party.exists(filter)) {
    throw new AppError(409, `A party named "${name.trim()}" already exists in this facility`, "DUPLICATE");
  }
}

export async function createParty(
  ctx: AuthContext,
  storeId: string,
  input: PartyInput & { openingBalance?: number }
) {
  await assertUniqueName(ctx, storeId, input.name);
  const opening = money(input.openingBalance ?? 0);

  return runAtomic(async (session) => {
    const [party] = await Party.create(
      [
        {
          tenantId: ctx.tenantId,
          storeId,
          name: input.name.trim(),
          mobileNumber: input.mobileNumber,
          email: input.email,
          gstIn: input.gstIn,
          address: input.address,
          openingBalance: opening,
          balance: 0,
          createdBy: ctx.userId,
        },
      ],
      { session }
    );

    if (opening !== 0) {
      const { party: updated } = await postPartyEntry(
        ctx,
        storeId,
        {
          partyId: party._id,
          type: "opening_balance",
          credit: opening > 0 ? opening : 0,
          debit: opening < 0 ? -opening : 0,
          remarks: opening > 0 ? "Opening balance (payable to party)" : "Opening balance (advance paid to party)",
        },
        session
      );
      return toPartyDto(updated);
    }
    return toPartyDto(party);
  });
}

/* ------------------------------- bulk import ------------------------------ */

export interface BulkPartyRowInput extends PartyInput {
  rowNumber?: number;
  openingBalance?: number;
  openingType?: "payable" | "advance";
  remarks?: string;
}

export async function bulkCreateParties(
  ctx: AuthContext,
  storeId: string,
  rows: BulkPartyRowInput[]
) {
  if (!rows.length) {
    throw new AppError(400, "No parties provided for bulk import");
  }
  if (rows.length > 10000) {
    throw new AppError(400, "Maximum 10,000 parties can be imported at once");
  }

  // Load existing active party names in this store (case-insensitive)
  const existingParties = await Party.find({
    tenantId: ctx.tenantId,
    storeId,
    isActive: true,
  }).select("name");

  const existingNameSet = new Set(existingParties.map((p) => p.name.trim().toLowerCase()));
  const seenInBatch = new Set<string>();

  const errors: Array<{ row: number; name: string; message: string }> = [];
  const partiesToInsert: Array<Record<string, unknown>> = [];
  const ledgersToInsert: Array<Record<string, unknown>> = [];
  const now = new Date();

  rows.forEach((row, idx) => {
    const rowNum = row.rowNumber ?? idx + 2;
    const name = row.name.trim();
    const lowerName = name.toLowerCase();

    if (existingNameSet.has(lowerName)) {
      errors.push({
        row: rowNum,
        name,
        message: `Party "${name}" already exists in this facility`,
      });
      return;
    }

    if (seenInBatch.has(lowerName)) {
      errors.push({
        row: rowNum,
        name,
        message: `Duplicate party name "${name}" found within the uploaded file`,
      });
      return;
    }

    seenInBatch.add(lowerName);

    const rawOpening = money(Number(row.openingBalance) || 0);
    const signedOpening =
      row.openingType === "advance" && rawOpening > 0 ? -rawOpening : rawOpening;

    const partyId = new mongoose.Types.ObjectId();

    partiesToInsert.push({
      _id: partyId,
      tenantId: ctx.tenantId,
      storeId,
      name,
      ...(row.mobileNumber?.trim() ? { mobileNumber: row.mobileNumber.trim() } : {}),
      ...(row.email?.trim() ? { email: row.email.trim().toLowerCase() } : {}),
      ...(row.gstIn?.trim() ? { gstIn: row.gstIn.trim().toUpperCase() } : {}),
      ...(row.address?.trim() ? { address: row.address.trim() } : {}),
      openingBalance: signedOpening,
      balance: signedOpening,
      isActive: true,
      createdBy: ctx.userId,
    });

    if (signedOpening !== 0) {
      ledgersToInsert.push({
        tenantId: ctx.tenantId,
        storeId,
        account: "party",
        accountId: partyId,
        party: partyId,
        userId: ctx.userId,
        date: now,
        type: "opening_balance",
        amount: Math.abs(signedOpening),
        credit: signedOpening > 0 ? signedOpening : 0,
        debit: signedOpening < 0 ? Math.abs(signedOpening) : 0,
        balanceAmount: signedOpening,
        partyBalance: signedOpening,
        payment: [],
        remarks:
          row.remarks?.trim() ||
          (signedOpening > 0
            ? "Bulk import — opening balance (payable to party)"
            : "Bulk import — opening balance (advance paid to party)"),
      });
    }
  });

  if (partiesToInsert.length > 0) {
    await Party.insertMany(partiesToInsert, { ordered: false });
  }
  if (ledgersToInsert.length > 0) {
    await Ledger.insertMany(ledgersToInsert, { ordered: false });
  }

  return {
    importedCount: partiesToInsert.length,
    skippedCount: errors.length,
    errors,
  };
}

export async function updateParty(
  ctx: AuthContext,
  storeId: string,
  id: string,
  input: Partial<PartyInput> & { isActive?: boolean }
) {
  const party = await loadParty(ctx, storeId, id);

  const willBeActive = input.isActive ?? party.isActive;
  const name = input.name ?? party.name;
  if (willBeActive && (input.name !== undefined || (input.isActive === true && !party.isActive))) {
    await assertUniqueName(ctx, storeId, name, id);
  }

  if (input.name !== undefined) party.name = input.name.trim();
  if (input.mobileNumber !== undefined) party.mobileNumber = input.mobileNumber || undefined;
  if (input.email !== undefined) party.email = input.email || undefined;
  if (input.gstIn !== undefined) party.gstIn = input.gstIn || undefined;
  if (input.address !== undefined) party.address = input.address || undefined;
  if (input.isActive !== undefined) party.isActive = input.isActive;

  await party.save();
  return toPartyDto(party);
}

/**
 * Ledger entries are append-only, so a party with any history is archived (hidden from
 * new purchases, history kept). A party with no history at all is removed permanently.
 */
export async function deleteParty(ctx: AuthContext, storeId: string, id: string) {
  const party = await loadParty(ctx, storeId, id);

  const hasHistory =
    (await Ledger.exists({ tenantId: ctx.tenantId, storeId, account: "party", accountId: party._id })) ||
    (await Purchase.exists({ tenantId: ctx.tenantId, storeId, party: party._id }));

  if (hasHistory) {
    party.isActive = false;
    await party.save();
    return { mode: "archived" as const, party: toPartyDto(party) };
  }

  await Party.deleteOne({ _id: party._id });
  return { mode: "deleted" as const, party: toPartyDto(party) };
}

export async function getParty(ctx: AuthContext, storeId: string, id: string) {
  return toPartyDto(await loadParty(ctx, storeId, id));
}

/* --------------------------------- listing -------------------------------- */

export interface ListPartiesQuery {
  q?: string;
  status: "active" | "archived" | "all";
  balance: "all" | "payable" | "advance" | "settled";
  sortBy: "name" | "balance" | "createdAt";
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

export async function listParties(ctx: AuthContext, storeId: string, query: ListPartiesQuery) {
  const base = {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    storeId: new mongoose.Types.ObjectId(storeId),
  };
  const filter: Record<string, unknown> = { ...base };

  if (query.status === "active") filter.isActive = true;
  else if (query.status === "archived") filter.isActive = false;

  if (query.balance === "payable") filter.balance = { $gt: 0.004 };
  else if (query.balance === "advance") filter.balance = { $lt: -0.004 };
  else if (query.balance === "settled") filter.balance = { $gte: -0.004, $lte: 0.004 };

  if (query.q?.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ name: rx }, { mobileNumber: rx }, { gstIn: rx }, { email: rx }];
  }

  const sort: Record<string, 1 | -1> = { [query.sortBy]: query.sortOrder === "asc" ? 1 : -1, _id: -1 };

  const [parties, total, summary] = await Promise.all([
    Party.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit),
    Party.countDocuments(filter),
    Party.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          totalParties: { $sum: 1 },
          activeParties: { $sum: { $cond: ["$isActive", 1, 0] } },
          totalPayable: { $sum: { $cond: [{ $gt: ["$balance", 0] }, "$balance", 0] } },
          totalAdvance: { $sum: { $cond: [{ $lt: ["$balance", 0] }, { $abs: "$balance" }, 0] } },
          payableCount: { $sum: { $cond: [{ $gt: ["$balance", 0.004] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const s = summary[0] ?? { totalParties: 0, activeParties: 0, totalPayable: 0, totalAdvance: 0, payableCount: 0 };

  return {
    parties: parties.map(toPartyDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    summary: {
      totalParties: s.totalParties,
      activeParties: s.activeParties,
      payableCount: s.payableCount,
      totalPayable: money(s.totalPayable),
      totalAdvance: money(s.totalAdvance),
    },
  };
}

// Lightweight list for pickers (e.g. purchase invoice form). No balances exposed.
export async function listPartyOptions(ctx: AuthContext, storeId: string, q?: string) {
  const filter: Record<string, unknown> = { tenantId: ctx.tenantId, storeId, isActive: true };
  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ name: rx }, { mobileNumber: rx }, { gstIn: rx }];
  }
  const parties = await Party.find(filter).sort({ name: 1 }).limit(30).select("name mobileNumber gstIn");
  return parties.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    mobileNumber: p.mobileNumber ?? null,
    gstIn: p.gstIn ?? null,
  }));
}

/* -------------------------------- payments -------------------------------- */

export interface PartyPaymentInput {
  amount: number;
  method: PartyPaymentMethod;
  date?: string;
  invoiceId?: string;
  notes?: string;
}

// Money paid by the store to a party. Optionally settles a specific purchase invoice.
export async function recordPartyPayment(
  ctx: AuthContext,
  storeId: string,
  partyId: string,
  input: PartyPaymentInput
) {
  const party = await loadParty(ctx, storeId, partyId);
  if (!party.isActive) throw new AppError(400, "This party is archived. Restore it before recording payments.");

  const amount = money(input.amount);
  if (amount <= 0) throw new AppError(400, "Payment amount must be greater than 0");
  const date = input.date ? new Date(input.date) : new Date();
  if (isNaN(date.getTime())) throw new AppError(400, "Invalid payment date");

  return runAtomic(async (session) => {
    let invoiceRef: { _id: mongoose.Types.ObjectId; invoiceNumber: string } | null = null;

    if (input.invoiceId) {
      if (!OBJECT_ID.test(input.invoiceId)) throw new AppError(400, "Invalid invoice");
      // Atomic guard: only succeeds if the invoice still has enough balance left
      const invoice = await Purchase.findOneAndUpdate(
        {
          _id: input.invoiceId,
          tenantId: ctx.tenantId,
          storeId,
          party: party._id,
          cancelled: false,
          balanceAmount: { $gte: amount - 0.004 },
        },
        {
          $inc: { amountPaid: amount, balanceAmount: -amount },
          $push: { payments: { amount, method: input.method, date } },
        },
        { new: true, session }
      );
      if (!invoice) {
        throw new AppError(400, "Payment exceeds the invoice's outstanding balance, or the invoice was not found");
      }
      invoiceRef = { _id: invoice._id, invoiceNumber: invoice.invoiceNumber };
    }

    const [payment] = await Payments.create(
      [
        {
          tenantId: ctx.tenantId,
          storeId,
          type: "payment_out",
          date,
          party: party._id,
          invoice: invoiceRef?._id,
          userId: ctx.userId,
          payments: [{ amount, method: input.method, date }],
          amount,
          notes: input.notes,
        },
      ],
      { session }
    );

    const { party: updated } = await postPartyEntry(
      ctx,
      storeId,
      {
        partyId: party._id,
        type: "payment_out",
        debit: amount,
        date,
        invoiceId: invoiceRef?._id,
        payment: [{ amount, method: input.method, date }],
        remarks:
          input.notes?.trim() ||
          (invoiceRef ? `Payment against invoice ${invoiceRef.invoiceNumber}` : "Payment to party"),
      },
      session
    );

    return { paymentId: payment._id.toString(), party: toPartyDto(updated) };
  });
}

/* ------------------------------- party ledger ------------------------------ */

export interface PartyLedgerQuery {
  type?: LedgerType;
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
}

export async function getPartyLedger(ctx: AuthContext, storeId: string, partyId: string, query: PartyLedgerQuery) {
  const party = await loadParty(ctx, storeId, partyId);
  const base = {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    storeId: new mongoose.Types.ObjectId(storeId),
    account: "party",
    accountId: party._id,
  };
  const filter: Record<string, unknown> = { ...base };
  if (query.type) filter.type = query.type;

  const date: Record<string, Date> = {};
  if (query.fromDate) {
    const d = new Date(query.fromDate);
    if (!isNaN(d.getTime())) date.$gte = d;
  }
  if (query.toDate) {
    const d = new Date(query.toDate);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      date.$lte = d;
    }
  }
  if (Object.keys(date).length) filter.date = date;

  // Posting order (_id) keeps the stored running balance readable top-to-bottom
  const [entries, total, totals] = await Promise.all([
    Ledger.find(filter)
      .populate("userId", "userName")
      .sort({ _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Ledger.countDocuments(filter),
    Ledger.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" },
          totalPurchases: { $sum: { $cond: [{ $eq: ["$type", "purchase_invoice"] }, "$credit", 0] } },
          totalPaid: { $sum: { $cond: [{ $eq: ["$type", "payment_out"] }, "$debit", 0] } },
          purchaseCount: { $sum: { $cond: [{ $eq: ["$type", "purchase_invoice"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  // Attach the purchased / returned items (qty, rate, GST, total, stock after transaction) to invoice & return entries
  const invoiceIds = [...new Set(entries.filter((e) => e.invoiceId).map((e) => e.invoiceId!.toString()))];
  const [invoices, purchaseReturns] = invoiceIds.length
    ? await Promise.all([
        Purchase.find({ _id: { $in: invoiceIds }, tenantId: ctx.tenantId, storeId }),
        PurchaseReturn.find({ _id: { $in: invoiceIds }, tenantId: ctx.tenantId, storeId }),
      ])
    : [[], []];
  const invoiceById = new Map(invoices.map((inv) => [inv._id.toString(), inv]));
  const returnById = new Map(purchaseReturns.map((ret) => [ret._id.toString(), ret]));

  const t = totals[0] ?? { totalCredit: 0, totalDebit: 0, totalPurchases: 0, totalPaid: 0, purchaseCount: 0 };

  return {
    party: toPartyDto(party),
    totals: {
      totalPurchases: money(t.totalPurchases),
      totalPaid: money(t.totalPaid),
      totalCredit: money(t.totalCredit),
      totalDebit: money(t.totalDebit),
      purchaseCount: t.purchaseCount,
    },
    entries: entries.map((e) => {
      const inv = e.invoiceId ? invoiceById.get(e.invoiceId.toString()) : undefined;
      const ret = e.invoiceId ? returnById.get(e.invoiceId.toString()) : undefined;
      const user = e.userId as unknown as { _id: mongoose.Types.ObjectId; userName: string } | null;
      return {
        id: e._id.toString(),
        date: e.date,
        postedAt: (e as unknown as { createdAt?: Date }).createdAt ?? e.date,
        type: e.type,
        debit: money(e.debit ?? 0),
        credit: money(e.credit ?? 0),
        balance: money(e.balanceAmount ?? 0),
        remarks: e.remarks ?? "",
        user: user && typeof user === "object" && "userName" in user ? { id: user._id.toString(), userName: user.userName } : null,
        payment: (e.payment ?? []).map((p) => ({ amount: p.amount, method: p.method })),
        invoice: inv
          ? {
              id: inv._id.toString(),
              invoiceNumber: inv.invoiceNumber,
              invoiceDate: inv.invoiceDate,
              taxableAmount: inv.taxableAmount,
              discountAmount: inv.discountAmount ?? 0,
              gstAmount: inv.gstAmount,
              totalAmount: inv.totalAmount,
              amountPaid: inv.amountPaid,
              balanceAmount: inv.balanceAmount,
              items:
                e.type === "purchase_invoice"
                  ? inv.items.map((it) => ({
                      itemId: it.item.toString(),
                      name: it.name,
                      barcode: it.barcode ?? null,
                      quantity: it.quantity,
                      measuringUnit: it.measuringUnit,
                      rate: it.rate ?? 0,
                      discount: it.discount ?? 0,
                      gst: it.gst,
                      priceIncludesTax: it.priceIncludesTax ?? false,
                      taxableAmount: it.taxableAmount ?? 0,
                      gstAmount: it.gstAmount ?? 0,
                      totalAmount: it.totalAmount,
                      closingStock: it.closingStock ?? null,
                    }))
                  : [],
            }
          : ret
          ? {
              id: ret._id.toString(),
              invoiceNumber: ret.purchaseReturnNumber,
              invoiceDate: ret.purchaseReturnDate,
              taxableAmount: ret.taxableAmount,
              discountAmount: ret.discountAmount ?? 0,
              gstAmount: ret.gstAmount ?? money((ret.sgst ?? 0) + (ret.cgst ?? 0)),
              totalAmount: ret.totalAmount,
              amountPaid: ret.amountReceived ?? 0,
              balanceAmount: ret.balanceAmount ?? 0,
              items:
                e.type === "purchase_return"
                  ? ret.items.map((it) => ({
                      itemId: it.item.toString(),
                      name: it.name,
                      barcode: it.barcode ?? null,
                      quantity: it.quantity,
                      measuringUnit: it.measuringUnit,
                      rate: it.rate ?? 0,
                      discount: it.discount ?? 0,
                      gst: it.gst,
                      priceIncludesTax: it.priceIncludesTax ?? false,
                      taxableAmount: it.taxableAmount ?? 0,
                      gstAmount: it.gstAmount ?? 0,
                      totalAmount: it.totalAmount,
                      closingStock: it.closingStock ?? null,
                    }))
                  : [],
            }
          : null,
      };
    }),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

// Unpaid/partially paid invoices of a party, for the "pay against invoice" picker
export async function listOpenInvoices(ctx: AuthContext, storeId: string, partyId: string) {
  const party = await loadParty(ctx, storeId, partyId);
  const invoices = await Purchase.find({
    tenantId: ctx.tenantId,
    storeId,
    party: party._id,
    cancelled: false,
    balanceAmount: { $gt: 0.004 },
  })
    .sort({ invoiceDate: 1 })
    .limit(100)
    .select("invoiceNumber invoiceDate totalAmount amountPaid balanceAmount");

  return invoices.map((i) => ({
    id: i._id.toString(),
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate,
    totalAmount: i.totalAmount,
    amountPaid: i.amountPaid,
    balanceAmount: money(i.balanceAmount),
  }));
}

