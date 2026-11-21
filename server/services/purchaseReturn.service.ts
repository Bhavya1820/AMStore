import mongoose from "mongoose";
import PurchaseReturn from "../models/purchaseReturn";
import Purchase from "../models/purchaseInvoice";
import Party from "../models/Party";
import Item from "../models/Item";
import Ledger from "../models/Ledger";
import Payments from "../models/Payment";
import { PartyPaymentMethod } from "../models/Common";
import { AuthContext } from "../types/auth";
import { AppError } from "../utils/AppError";
import { runAtomic } from "../utils/transaction";
import { money, postPartyEntry } from "./party.service";

const OBJECT_ID = /^[a-f\d]{24}$/i;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTodayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/* ---------------- Search Purchase Invoices for Return Link ---------------- */

export async function searchPartyPurchasesForReturn(
  ctx: AuthContext,
  storeId: string,
  query: { partyId?: string; q?: string; page: number; limit: number }
) {
  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    cancelled: false,
  };

  if (query.partyId) {
    if (!OBJECT_ID.test(query.partyId)) throw new AppError(400, "Invalid partyId");
    filter.party = new mongoose.Types.ObjectId(query.partyId);
  }

  if (query.q?.trim()) {
    filter.invoiceNumber = new RegExp(escapeRegex(query.q.trim()), "i");
  }

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    Purchase.find(filter)
      .populate("party", "name mobileNumber gstIn")
      .sort({ invoiceDate: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit + 1),
    Purchase.countDocuments(filter),
  ]);

  const hasMore = docs.length > query.limit;
  const invoices = (hasMore ? docs.slice(0, query.limit) : docs).map((inv) => {
    const p = inv.party as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      mobileNumber?: string;
      gstIn?: string;
    } | null;

    return {
      id: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      party:
        p && typeof p === "object" && "name" in p
          ? {
              id: p._id.toString(),
              name: p.name,
              mobileNumber: p.mobileNumber ?? null,
              gstIn: p.gstIn ?? null,
            }
          : null,
      taxableAmount: inv.taxableAmount,
      discountAmount: inv.discountAmount ?? 0,
      gstAmount: inv.gstAmount,
      totalAmount: inv.totalAmount,
      amountPaid: inv.amountPaid,
      balanceAmount: inv.balanceAmount,
      items: inv.items.map((it) => ({
        itemId: it.item.toString(),
        name: it.name,
        barcode: it.barcode ?? null,
        hsn: it.hsn ?? null,
        quantity: it.quantity,
        measuringUnit: it.measuringUnit,
        rate: it.rate ?? 0,
        discount: it.discount ?? 0,
        gst: it.gst,
        priceIncludesTax: it.priceIncludesTax ?? false,
        taxableAmount: it.taxableAmount ?? 0,
        gstAmount: it.gstAmount ?? 0,
        totalAmount: it.totalAmount,
      })),
    };
  });

  return {
    invoices,
    page: query.page,
    limit: query.limit,
    total,
    hasMore,
  };
}

/* ------------------------- Create Purchase Return ------------------------- */

export interface PurchaseReturnLineInput {
  itemId: string;
  quantity: number;
  rate: number;
  priceIncludesTax?: boolean;
  discount?: number;
  gst?: number;
}

export interface PurchaseReturnRefundLine {
  amount: number;
  method: PartyPaymentMethod;
}

export interface CreatePurchaseReturnInput {
  partyId: string;
  invoiceId?: string;
  purchaseReturnNumber: string;
  purchaseReturnDate?: string;
  items: PurchaseReturnLineInput[];
  payments?: PurchaseReturnRefundLine[];
  notes?: string;
}

export async function createPurchaseReturn(
  ctx: AuthContext,
  storeId: string,
  input: CreatePurchaseReturnInput
) {
  if (!OBJECT_ID.test(input.partyId)) throw new AppError(400, "Invalid party ID");
  if (input.invoiceId && !OBJECT_ID.test(input.invoiceId)) {
    throw new AppError(400, "Invalid purchase invoice ID");
  }
  if (!input.items.length) {
    throw new AppError(400, "At least one item is required on a purchase return");
  }

  const returnDate = input.purchaseReturnDate
    ? new Date(input.purchaseReturnDate)
    : new Date();
  if (isNaN(returnDate.getTime())) {
    throw new AppError(400, "Invalid purchase return date");
  }

  const { end: endOfToday } = getTodayRange();
  if (returnDate.getTime() > endOfToday.getTime()) {
    throw new AppError(
      400,
      "Future dates are not allowed for purchase returns",
      "FUTURE_DATE_NOT_ALLOWED"
    );
  }

  return runAtomic(async (session) => {
    const party = await Party.findOne({
      _id: input.partyId,
      tenantId: ctx.tenantId,
      storeId,
    }).session(session ?? null);

    if (!party) throw new AppError(404, "Party not found in this facility");
    if (!party.isActive) {
      throw new AppError(400, "Cannot create a purchase return for an archived party");
    }

    const returnNum = input.purchaseReturnNumber.trim();
    const dup = await PurchaseReturn.exists({
      tenantId: ctx.tenantId,
      storeId,
      purchaseReturnNumber: returnNum,
    }).session(session ?? null);

    if (dup) {
      throw new AppError(
        409,
        `Purchase return number "${returnNum}" already exists in this facility`,
        "DUPLICATE"
      );
    }

    let linkedInvoice: InstanceType<typeof Purchase> | null = null;
    if (input.invoiceId) {
      linkedInvoice = await Purchase.findOne({
        _id: input.invoiceId,
        tenantId: ctx.tenantId,
        storeId,
        party: party._id,
        cancelled: false,
      }).session(session ?? null);
      if (!linkedInvoice) {
        throw new AppError(404, "Linked purchase invoice not found for this party");
      }
    }

    const uniqueItemIds = [...new Set(input.items.map((l) => l.itemId))];
    for (const id of uniqueItemIds) {
      if (!OBJECT_ID.test(id)) throw new AppError(400, "Invalid item ID in return lines");
    }

    const storeItems = await Item.find({
      _id: { $in: uniqueItemIds },
      tenantId: ctx.tenantId,
      storeId,
    }).session(session ?? null);

    const itemMap = new Map(storeItems.map((it) => [it._id.toString(), it]));
    if (itemMap.size !== uniqueItemIds.length) {
      throw new AppError(400, "One or more items were not found in this facility");
    }

    const returnId = new mongoose.Types.ObjectId();
    const returnLines = [];
    const itemLedgerDocs = [];

    let totalTaxable = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    let grandTotal = 0;

    const canEditPricing =
      ctx.role === "owner" ||
      ctx.role === "admin" ||
      ctx.permissions.has("purchase:edit_pricing");

    for (const line of input.items) {
      const itemDoc = itemMap.get(line.itemId)!;
      const qty = Number(line.quantity);
      const discount = money(line.discount ?? 0);

      // Find original invoice line if linked to an invoice
      const origLine = linkedInvoice?.items.find(
        (li) => li.item.toString() === itemDoc._id.toString()
      );

      const defaultRate = origLine?.rate ?? itemDoc.purchasePrice;
      const defaultGst = origLine?.gst ?? itemDoc.gst;
      const defaultIncludesTax =
        origLine?.priceIncludesTax ?? itemDoc.purchasePriceWithTax;

      const rate = canEditPricing ? money(line.rate) : money(defaultRate);
      const gstRate = canEditPricing
        ? line.gst !== undefined
          ? Number(line.gst)
          : Number(defaultGst)
        : Number(defaultGst);
      const includesTax = canEditPricing
        ? Boolean(line.priceIncludesTax ?? defaultIncludesTax)
        : Boolean(defaultIncludesTax);

      if (qty <= 0) {
        throw new AppError(400, `Return quantity for "${itemDoc.name}" must be greater than 0`);
      }
      if (origLine && qty > origLine.quantity + 0.0001) {
        throw new AppError(
          400,
          `Return quantity (${qty}) for "${itemDoc.name}" exceeds the purchased quantity (${origLine.quantity}) on Invoice #${linkedInvoice!.invoiceNumber}`
        );
      }
      if (rate < 0) {
        throw new AppError(400, `Rate for "${itemDoc.name}" cannot be negative`);
      }
      if (gstRate < 0 || gstRate > 100) {
        throw new AppError(400, `GST for "${itemDoc.name}" must be between 0 and 100%`);
      }

      const gross = money(qty * rate - discount);
      if (gross < 0) {
        throw new AppError(400, `Discount exceeds line amount for "${itemDoc.name}"`);
      }

      let lineTaxable = gross;
      let lineGst = 0;
      let lineTotal = gross;

      if (includesTax && gstRate > 0) {
        lineTaxable = money(gross / (1 + gstRate / 100));
        lineGst = money(gross - lineTaxable);
        lineTotal = gross;
      } else {
        lineTaxable = gross;
        lineGst = money((gross * gstRate) / 100);
        lineTotal = money(lineTaxable + lineGst);
      }

      // 1. Reverse / Deduct stock in Inventory
      const updatedItem = await Item.findOneAndUpdate(
        { _id: itemDoc._id, tenantId: ctx.tenantId, storeId },
        { $inc: { currentStock: -qty } },
        { new: true, session }
      );
      if (!updatedItem) throw new AppError(404, `Item "${itemDoc.name}" not found`);

      const closingStock = Number(updatedItem.currentStock.toFixed(4));

      returnLines.push({
        item: itemDoc._id,
        name: itemDoc.name,
        hsn: itemDoc.hsn,
        barcode: itemDoc.barcode,
        quantity: qty,
        measuringUnit: itemDoc.measuringUnit,
        salePrice: itemDoc.salePrice,
        rate,
        discount,
        gst: gstRate,
        priceIncludesTax: includesTax,
        taxableAmount: lineTaxable,
        gstAmount: lineGst,
        totalAmount: lineTotal,
        closingStock,
      });

      itemLedgerDocs.push({
        tenantId: ctx.tenantId,
        storeId,
        account: "item",
        accountId: itemDoc._id,
        item: itemDoc._id,
        party: party._id,
        invoiceId: returnId,
        userId: ctx.userId,
        date: returnDate,
        type: "purchase_item_return",
        quantity: qty,
        measuringUnit: itemDoc.measuringUnit,
        rate,
        gstRate,
        gstAmount: lineGst,
        amount: lineTotal,
        closingStock,
        debit: 0,
        credit: qty,
        remarks: `Returned to ${party.name} (Return #${returnNum}${
          linkedInvoice ? `, against Inv #${linkedInvoice.invoiceNumber}` : ""
        })`,
      });

      totalTaxable = money(totalTaxable + lineTaxable);
      totalDiscount = money(totalDiscount + discount);
      totalGst = money(totalGst + lineGst);
      grandTotal = money(grandTotal + lineTotal);
    }

    const validRefunds = (input.payments ?? [])
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        amount: money(p.amount),
        method: p.method,
        date: returnDate,
      }));

    const amountReceived = money(validRefunds.reduce((sum, p) => sum + p.amount, 0));
    if (amountReceived > grandTotal + 0.004) {
      throw new AppError(400, "Refund amount received cannot exceed the total return amount");
    }

    // Net balance adjusted on the vendor's account (reduces what store owes vendor)
    const balanceAmount = money(Math.max(0, grandTotal - amountReceived));
    const halfGst = money(totalGst / 2);

    // 2. Create PurchaseReturn document
    const [purchaseReturnDoc] = await PurchaseReturn.create(
      [
        {
          _id: returnId,
          tenantId: ctx.tenantId,
          storeId,
          party: party._id,
          invoiceId: linkedInvoice?._id,
          userId: ctx.userId,
          purchaseReturnNumber: returnNum,
          purchaseReturnDate: returnDate,
          items: returnLines,
          taxableAmount: totalTaxable,
          discountAmount: totalDiscount,
          gstAmount: totalGst,
          sgst: halfGst,
          cgst: money(totalGst - halfGst),
          totalAmount: grandTotal,
          amountReceived,
          paymentMethod: validRefunds[0]?.method,
          payments: validRefunds,
          balanceAmount,
          notes: input.notes?.trim(),
          cancelled: false,
        },
      ],
      { session }
    );

    // 3. Insert Item Ledger stock-reversal entries
    await Ledger.insertMany(itemLedgerDocs, { session });

    // 4. Post Purchase Return entry to Party Ledger (Debit: reduces payable balance to vendor)
    const itemSummary = returnLines
      .slice(0, 3)
      .map((l) => `${l.name} (-${l.quantity} ${l.measuringUnit} @ ₹${l.rate})`)
      .join(", ");
    const moreCount = returnLines.length > 3 ? ` +${returnLines.length - 3} more` : "";

    await postPartyEntry(
      ctx,
      storeId,
      {
        partyId: party._id,
        type: "purchase_return",
        debit: grandTotal,
        credit: 0,
        date: returnDate,
        invoiceId: purchaseReturnDoc._id,
        remarks:
          input.notes?.trim() ||
          `Purchase Return #${returnNum}${
            linkedInvoice ? ` (against Inv #${linkedInvoice.invoiceNumber})` : ""
          }: ${itemSummary}${moreCount}`,
      },
      session
    );

    // 5. If linked to an unpaid/partially-paid purchase invoice, reduce its outstanding balanceAmount
    //    by the credit-note adjustment (balanceAmount = grandTotal - amountReceived)
    if (linkedInvoice && balanceAmount > 0 && linkedInvoice.balanceAmount > 0) {
      const reduction = money(Math.min(linkedInvoice.balanceAmount, balanceAmount));
      if (reduction > 0) {
        await Purchase.updateOne(
          { _id: linkedInvoice._id, tenantId: ctx.tenantId, storeId },
          { $inc: { balanceAmount: -reduction } },
          { session }
        );
      }
    }

    // 6. If the vendor refunded cash/UPI/bank immediately, record Payment In & Party Ledger credit
    //    (because the full return amount was debited above, and cash refund settles that credit)
    if (amountReceived > 0) {
      await Payments.create(
        [
          {
            tenantId: ctx.tenantId,
            storeId,
            type: "payment_in",
            date: returnDate,
            party: party._id,
            invoice: purchaseReturnDoc._id,
            userId: ctx.userId,
            payments: validRefunds,
            amount: amountReceived,
            notes: `Refund received against Purchase Return #${returnNum}`,
          },
        ],
        { session }
      );

      await postPartyEntry(
        ctx,
        storeId,
        {
          partyId: party._id,
          type: "payment_in",
          credit: amountReceived,
          debit: 0,
          date: returnDate,
          invoiceId: purchaseReturnDoc._id,
          payment: validRefunds,
          remarks: `Refund received for Purchase Return #${returnNum} (${validRefunds
            .map((p) => p.method.toUpperCase())
            .join(", ")})`,
        },
        session
      );
    }

    return {
      id: purchaseReturnDoc._id.toString(),
      purchaseReturnNumber: purchaseReturnDoc.purchaseReturnNumber,
      purchaseReturnDate: purchaseReturnDoc.purchaseReturnDate,
      party: { id: party._id.toString(), name: party.name },
      linkedInvoice: linkedInvoice
        ? { id: linkedInvoice._id.toString(), invoiceNumber: linkedInvoice.invoiceNumber }
        : null,
      taxableAmount: purchaseReturnDoc.taxableAmount,
      discountAmount: purchaseReturnDoc.discountAmount,
      gstAmount: purchaseReturnDoc.gstAmount,
      totalAmount: purchaseReturnDoc.totalAmount,
      amountReceived: purchaseReturnDoc.amountReceived,
      balanceAmount: purchaseReturnDoc.balanceAmount,
      items: returnLines.map((l) => ({
        itemId: l.item.toString(),
        name: l.name,
        barcode: l.barcode,
        hsn: l.hsn,
        quantity: l.quantity,
        measuringUnit: l.measuringUnit,
        rate: l.rate,
        discount: l.discount,
        gst: l.gst,
        priceIncludesTax: l.priceIncludesTax,
        taxableAmount: l.taxableAmount,
        gstAmount: l.gstAmount,
        totalAmount: l.totalAmount,
        closingStock: l.closingStock,
      })),
    };
  });
}

/* ------------------------- List Purchase Returns -------------------------- */

export interface ListPurchaseReturnsQuery {
  partyId?: string;
  userId?: string;
  q?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
}

function toPurchaseReturnDto(ret: InstanceType<typeof PurchaseReturn>) {
  const p = ret.party as unknown as {
    _id: mongoose.Types.ObjectId;
    name: string;
    mobileNumber?: string;
    gstIn?: string;
  } | null;
  const u = ret.userId as unknown as {
    _id: mongoose.Types.ObjectId;
    userName: string;
  } | null;
  const inv = ret.invoiceId as unknown as {
    _id: mongoose.Types.ObjectId;
    invoiceNumber: string;
    invoiceDate?: Date;
  } | null;

  return {
    id: ret._id.toString(),
    purchaseReturnNumber: ret.purchaseReturnNumber,
    purchaseReturnDate: ret.purchaseReturnDate,
    createdAt: ret.createdAt ?? ret.purchaseReturnDate,
    party:
      p && typeof p === "object" && "name" in p
        ? {
            id: p._id.toString(),
            name: p.name,
            mobileNumber: p.mobileNumber ?? null,
            gstIn: p.gstIn ?? null,
          }
        : null,
    user:
      u && typeof u === "object" && "userName" in u
        ? { id: u._id.toString(), userName: u.userName }
        : null,
    linkedInvoice:
      inv && typeof inv === "object" && "invoiceNumber" in inv
        ? {
            id: inv._id.toString(),
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate ?? null,
          }
        : null,
    taxableAmount: ret.taxableAmount,
    discountAmount: ret.discountAmount ?? 0,
    gstAmount: ret.gstAmount ?? money((ret.sgst ?? 0) + (ret.cgst ?? 0)),
    sgst: ret.sgst ?? 0,
    cgst: ret.cgst ?? 0,
    totalAmount: ret.totalAmount,
    amountReceived: ret.amountReceived ?? 0,
    balanceAmount: ret.balanceAmount ?? 0,
    payments: (ret.payments ?? []).map((pay) => ({
      amount: pay.amount,
      method: pay.method,
      date: pay.date,
    })),
    notes: ret.notes ?? "",
    items: ret.items.map((it) => ({
      itemId: it.item.toString(),
      name: it.name,
      barcode: it.barcode ?? null,
      hsn: it.hsn ?? null,
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
    })),
  };
}

export async function listPurchaseReturns(
  ctx: AuthContext,
  storeId: string,
  query: ListPurchaseReturnsQuery
) {
  const isPurchaseStaff = ctx.role === "purchase";

  const baseMatch: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    storeId: new mongoose.Types.ObjectId(storeId),
    cancelled: { $ne: true },
  };

  // Purchase staff only see their own purchase returns created today
  if (isPurchaseStaff) {
    const { start, end } = getTodayRange();
    baseMatch.userId = new mongoose.Types.ObjectId(ctx.userId);
    baseMatch.$or = [
      { purchaseReturnDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } },
    ];
  }

  const filter: Record<string, unknown> = { ...baseMatch };

  if (!isPurchaseStaff && query.userId) {
    if (!OBJECT_ID.test(query.userId)) throw new AppError(400, "Invalid userId");
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }

  if (query.partyId) {
    if (!OBJECT_ID.test(query.partyId)) throw new AppError(400, "Invalid partyId");
    filter.party = new mongoose.Types.ObjectId(query.partyId);
  }

  if (query.q?.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.purchaseReturnNumber = rx;
  }

  if (!isPurchaseStaff && (query.fromDate || query.toDate)) {
    const dateRange: Record<string, Date> = {};
    if (query.fromDate) {
      const from = new Date(query.fromDate);
      if (!isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        dateRange.$gte = from;
      }
    }
    if (query.toDate) {
      const to = new Date(query.toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        dateRange.$lte = to;
      }
    }
    if (Object.keys(dateRange).length > 0) {
      filter.purchaseReturnDate = dateRange;
    }
  }

  const [returns, total, summaryAgg] = await Promise.all([
    PurchaseReturn.find(filter)
      .populate("party", "name mobileNumber gstIn")
      .populate("userId", "userName")
      .populate("invoiceId", "invoiceNumber invoiceDate")
      .sort({ purchaseReturnDate: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    PurchaseReturn.countDocuments(filter),
    PurchaseReturn.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalReturnAmount: { $sum: "$totalAmount" },
          totalRefundReceived: { $sum: "$amountReceived" },
          totalBalanceAdjusted: { $sum: "$balanceAmount" },
        },
      },
    ]),
  ]);

  const s = summaryAgg[0] ?? {
    totalReturns: 0,
    totalReturnAmount: 0,
    totalRefundReceived: 0,
    totalBalanceAdjusted: 0,
  };

  return {
    scope: isPurchaseStaff ? ("today" as const) : ("all" as const),
    returns: returns.map(toPurchaseReturnDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    summary: {
      totalReturns: s.totalReturns,
      totalReturnAmount: money(s.totalReturnAmount),
      totalRefundReceived: money(s.totalRefundReceived),
      totalBalanceAdjusted: money(s.totalBalanceAdjusted),
    },
  };
}

export async function getPurchaseReturnById(
  ctx: AuthContext,
  storeId: string,
  id: string
) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Purchase return not found");

  const filter: Record<string, unknown> = {
    _id: id,
    tenantId: ctx.tenantId,
    storeId,
  };

  if (ctx.role === "purchase") {
    const { start, end } = getTodayRange();
    filter.userId = ctx.userId;
    filter.$or = [
      { purchaseReturnDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } },
    ];
  }

  const doc = await PurchaseReturn.findOne(filter)
    .populate("party", "name mobileNumber gstIn")
    .populate("userId", "userName")
    .populate("invoiceId", "invoiceNumber invoiceDate");

  if (!doc) throw new AppError(404, "Purchase return not found");
  return toPurchaseReturnDto(doc);
}
