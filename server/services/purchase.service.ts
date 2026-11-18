import mongoose from "mongoose";
import Purchase from "../models/purchaseInvoice";
import Party from "../models/Party";
import Item from "../models/Item";
import Ledger from "../models/Ledger";
import Payments from "../models/Payment";
import User from "../models/User";
import Role, { RoleName } from "../models/Role";
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

/* --------------------- async search & barcode lookup ---------------------- */

export async function listFacilityPurchaseUsers(
  ctx: AuthContext,
  storeId: string
) {
  const roles = await Role.find({ tenantId: ctx.tenantId }).select("name");
  const roleNameById = new Map<string, RoleName>(
    roles.map((r) => [r._id.toString(), r.name])
  );
  const purchaseAndManagerRoleIds = roles
    .filter((r) => r.name === "purchase" || r.name === "admin" || r.name === "owner")
    .map((r) => r._id);

  const users = await User.find({
    tenantId: ctx.tenantId,
    roleId: { $in: purchaseAndManagerRoleIds },
    $or: [{ storeIds: new mongoose.Types.ObjectId(storeId) }, { isOwner: true }],
  })
    .sort({ userName: 1 })
    .select("userName roleId isActive isOwner");

  return users.map((u) => ({
    id: u._id.toString(),
    userName: u.userName,
    role: roleNameById.get(u.roleId.toString()) ?? "purchase",
    isActive: u.isActive,
  }));
}

export async function searchPartiesForPurchase(
  ctx: AuthContext,
  storeId: string,
  query: { q?: string; page: number; limit: number }
) {
  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    isActive: true,
  };
  if (query.q?.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ name: rx }, { mobileNumber: rx }, { gstIn: rx }];
  }

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    Party.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(query.limit + 1)
      .select("name mobileNumber email gstIn address balance"),
    Party.countDocuments(filter),
  ]);

  const hasMore = docs.length > query.limit;
  const parties = (hasMore ? docs.slice(0, query.limit) : docs).map((p) => ({
    id: p._id.toString(),
    name: p.name,
    mobileNumber: p.mobileNumber ?? null,
    email: p.email ?? null,
    gstIn: p.gstIn ?? null,
    address: p.address ?? null,
    balance: money(p.balance ?? 0),
  }));

  return {
    parties,
    page: query.page,
    limit: query.limit,
    total,
    hasMore,
  };
}

export async function searchItemsForPurchase(
  ctx: AuthContext,
  storeId: string,
  query: { q?: string; page: number; limit: number }
) {
  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    isActive: true,
  };
  if (query.q?.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ name: rx }, { barcode: rx }, { hsn: rx }];
  }

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    Item.find(filter)
      .populate("category", "name")
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(query.limit + 1),
    Item.countDocuments(filter),
  ]);

  const hasMore = docs.length > query.limit;
  const items = (hasMore ? docs.slice(0, query.limit) : docs).map((it) => {
    const cat = it.category as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
    return {
      id: it._id.toString(),
      name: it.name,
      barcode: it.barcode,
      hsn: it.hsn,
      category: cat && typeof cat === "object" && "name" in cat ? cat.name : null,
      measuringUnit: it.measuringUnit,
      purchasePrice: it.purchasePrice,
      purchasePriceWithTax: it.purchasePriceWithTax,
      salePrice: it.salePrice,
      salePriceWithTax: it.salePriceWithTax,
      gst: it.gst,
      currentStock: it.currentStock,
      lowStock: it.lowStock,
    };
  });

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    hasMore,
  };
}

export async function getItemByBarcodeForPurchase(
  ctx: AuthContext,
  storeId: string,
  barcode: string
) {
  const trimmed = barcode.trim();
  if (!trimmed) throw new AppError(400, "Barcode is required");

  const item = await Item.findOne({
    tenantId: ctx.tenantId,
    storeId,
    isActive: true,
    barcode: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
  }).populate("category", "name");

  if (!item) {
    throw new AppError(404, `No active inventory item found with barcode "${trimmed}"`, "ITEM_NOT_FOUND");
  }

  const cat = item.category as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
  return {
    id: item._id.toString(),
    name: item.name,
    barcode: item.barcode,
    hsn: item.hsn,
    category: cat && typeof cat === "object" && "name" in cat ? cat.name : null,
    measuringUnit: item.measuringUnit,
    purchasePrice: item.purchasePrice,
    purchasePriceWithTax: item.purchasePriceWithTax,
    salePrice: item.salePrice,
    salePriceWithTax: item.salePriceWithTax,
    gst: item.gst,
    currentStock: item.currentStock,
    lowStock: item.lowStock,
  };
}

/* ------------------------ create purchase invoice ------------------------- */

export interface PurchaseLineInput {
  itemId: string;
  quantity: number;
  rate: number;
  priceIncludesTax?: boolean;
  discount?: number;
  gst?: number;
  updateItemPurchasePrice?: boolean;
}

export interface PurchasePaymentLine {
  amount: number;
  method: PartyPaymentMethod;
}

export interface CreatePurchaseInput {
  partyId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  items: PurchaseLineInput[];
  payments?: PurchasePaymentLine[];
  notes?: string;
}

export async function createPurchaseInvoice(
  ctx: AuthContext,
  storeId: string,
  input: CreatePurchaseInput
) {
  if (!OBJECT_ID.test(input.partyId)) throw new AppError(400, "Invalid party ID");
  if (!input.items.length) throw new AppError(400, "At least one item is required on a purchase invoice");

  const invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
  if (isNaN(invoiceDate.getTime())) throw new AppError(400, "Invalid invoice date");

  const { end: endOfToday } = getTodayRange();
  if (invoiceDate.getTime() > endOfToday.getTime()) {
    throw new AppError(
      400,
      "Future dates are not allowed for purchase invoices",
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
      throw new AppError(400, "Cannot create a purchase invoice for an archived party");
    }

    const dup = await Purchase.exists({
      tenantId: ctx.tenantId,
      storeId,
      party: party._id,
      invoiceNumber: input.invoiceNumber.trim(),
    }).session(session ?? null);

    if (dup) {
      throw new AppError(
        409,
        `Invoice number "${input.invoiceNumber.trim()}" already exists for ${party.name}`,
        "DUPLICATE"
      );
    }

    const uniqueItemIds = [...new Set(input.items.map((l) => l.itemId))];
    for (const id of uniqueItemIds) {
      if (!OBJECT_ID.test(id)) throw new AppError(400, "Invalid item ID in purchase lines");
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

    const invoiceId = new mongoose.Types.ObjectId();
    const invoiceLines = [];
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

      // Only users with pricing edit permission (Owner, Facility Admin, or authorized Purchase Staff)
      // can modify purchase price, GST %, or tax-inclusive setting; otherwise use inventory values.
      const rate = canEditPricing ? money(line.rate) : money(itemDoc.purchasePrice);
      const gstRate = canEditPricing
        ? line.gst !== undefined
          ? Number(line.gst)
          : itemDoc.gst
        : Number(itemDoc.gst);
      const includesTax = canEditPricing
        ? Boolean(line.priceIncludesTax ?? itemDoc.purchasePriceWithTax)
        : Boolean(itemDoc.purchasePriceWithTax);

      if (qty <= 0) throw new AppError(400, `Quantity for "${itemDoc.name}" must be greater than 0`);
      if (rate < 0) throw new AppError(400, `Price for "${itemDoc.name}" cannot be negative`);
      if (gstRate < 0 || gstRate > 100) {
        throw new AppError(400, `GST for "${itemDoc.name}" must be between 0 and 100%`);
      }

      const gross = money(qty * rate - discount);
      if (gross < 0) throw new AppError(400, `Discount exceeds line amount for "${itemDoc.name}"`);

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

      // If an authorized user changed purchasePrice, purchasePriceWithTax, or gst on the invoice line,
      // sync those updated values back to the Item document in Inventory.
      const updateFields: Record<string, unknown> = {};
      if (canEditPricing) {
        if (rate !== itemDoc.purchasePrice) updateFields.purchasePrice = rate;
        if (includesTax !== itemDoc.purchasePriceWithTax) updateFields.purchasePriceWithTax = includesTax;
        if (gstRate !== itemDoc.gst) updateFields.gst = gstRate;
      }

      const updatedItem = await Item.findOneAndUpdate(
        { _id: itemDoc._id, tenantId: ctx.tenantId, storeId },
        {
          $inc: { currentStock: qty },
          ...(Object.keys(updateFields).length ? { $set: updateFields } : {}),
        },
        { new: true, session }
      );
      if (!updatedItem) throw new AppError(404, `Item "${itemDoc.name}" not found`);

      const closingStock = Number(updatedItem.currentStock.toFixed(4));

      invoiceLines.push({
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
        invoiceId,
        userId: ctx.userId,
        date: invoiceDate,
        type: "purchase_item",
        quantity: qty,
        measuringUnit: itemDoc.measuringUnit,
        rate,
        gstRate,
        gstAmount: lineGst,
        amount: lineTotal,
        closingStock,
        debit: qty,
        credit: 0,
        remarks: `Purchased from ${party.name} (Inv #${input.invoiceNumber.trim()})`,
      });

      totalTaxable = money(totalTaxable + lineTaxable);
      totalDiscount = money(totalDiscount + discount);
      totalGst = money(totalGst + lineGst);
      grandTotal = money(grandTotal + lineTotal);
    }

    const validPayments = (input.payments ?? [])
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        amount: money(p.amount),
        method: p.method,
        date: invoiceDate,
      }));

    const amountPaid = money(validPayments.reduce((sum, p) => sum + p.amount, 0));
    if (amountPaid > grandTotal + 0.004) {
      throw new AppError(400, "Amount paid cannot exceed the invoice total amount");
    }
    const balanceAmount = money(Math.max(0, grandTotal - amountPaid));

    // 1. Create Purchase Invoice
    const [invoice] = await Purchase.create(
      [
        {
          _id: invoiceId,
          tenantId: ctx.tenantId,
          storeId,
          party: party._id,
          userId: ctx.userId,
          invoiceNumber: input.invoiceNumber.trim(),
          invoiceDate,
          items: invoiceLines,
          taxableAmount: totalTaxable,
          discountAmount: totalDiscount,
          gstAmount: totalGst,
          totalAmount: grandTotal,
          amountPaid,
          payments: validPayments,
          balanceAmount,
          notes: input.notes?.trim(),
          cancelled: false,
        },
      ],
      { session }
    );

    // 2. Insert Item Ledger entries for all purchased lines
    await Ledger.insertMany(itemLedgerDocs, { session });

    // 3. Post Purchase Invoice entry to the Party Ledger (increases payable balance)
    const itemSummary = invoiceLines
      .slice(0, 3)
      .map((l) => `${l.name} (${l.quantity} ${l.measuringUnit} @ ₹${l.rate})`)
      .join(", ");
    const moreCount = invoiceLines.length > 3 ? ` +${invoiceLines.length - 3} more` : "";

    await postPartyEntry(
      ctx,
      storeId,
      {
        partyId: party._id,
        type: "purchase_invoice",
        credit: grandTotal,
        debit: 0,
        date: invoiceDate,
        invoiceId: invoice._id,
        remarks:
          input.notes?.trim() ||
          `Purchase Invoice #${invoice.invoiceNumber}: ${itemSummary}${moreCount}`,
      },
      session
    );

    // 4. If payment was made with the invoice, record Payment Out & Party Ledger debit
    if (amountPaid > 0) {
      await Payments.create(
        [
          {
            tenantId: ctx.tenantId,
            storeId,
            type: "payment_out",
            date: invoiceDate,
            party: party._id,
            invoice: invoice._id,
            userId: ctx.userId,
            payments: validPayments,
            amount: amountPaid,
            notes: `Paid with Purchase Invoice #${invoice.invoiceNumber}`,
          },
        ],
        { session }
      );

      await postPartyEntry(
        ctx,
        storeId,
        {
          partyId: party._id,
          type: "payment_out",
          debit: amountPaid,
          credit: 0,
          date: invoiceDate,
          invoiceId: invoice._id,
          payment: validPayments,
          remarks: `Paid against Purchase Invoice #${invoice.invoiceNumber} (${validPayments
            .map((p) => p.method.toUpperCase())
            .join(", ")})`,
        },
        session
      );
    }

    return {
      id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      party: { id: party._id.toString(), name: party.name },
      taxableAmount: invoice.taxableAmount,
      discountAmount: invoice.discountAmount,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      balanceAmount: invoice.balanceAmount,
      items: invoiceLines.map((l) => ({
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

/* ------------------------- list purchase invoices ------------------------- */

export interface ListPurchasesQuery {
  partyId?: string;
  userId?: string;
  q?: string;
  status?: "all" | "paid" | "unpaid" | "partial";
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
}

function toInvoiceDto(inv: InstanceType<typeof Purchase>) {
  const p = inv.party as unknown as {
    _id: mongoose.Types.ObjectId;
    name: string;
    mobileNumber?: string;
    gstIn?: string;
  } | null;
  const u = inv.userId as unknown as { _id: mongoose.Types.ObjectId; userName: string } | null;

  return {
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    createdAt: inv.createdAt ?? inv.invoiceDate,
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
    taxableAmount: inv.taxableAmount,
    discountAmount: inv.discountAmount ?? 0,
    gstAmount: inv.gstAmount,
    totalAmount: inv.totalAmount,
    amountPaid: inv.amountPaid,
    balanceAmount: inv.balanceAmount,
    payments: (inv.payments ?? []).map((pay) => ({
      amount: pay.amount,
      method: pay.method,
      date: pay.date,
    })),
    notes: inv.notes ?? "",
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
      closingStock: it.closingStock ?? null,
    })),
  };
}

export async function listPurchaseInvoices(
  ctx: AuthContext,
  storeId: string,
  query: ListPurchasesQuery
) {
  const isPurchaseStaff = ctx.role === "purchase";

  const baseMatch: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    storeId: new mongoose.Types.ObjectId(storeId),
    cancelled: false,
  };

  // Purchase staff only see their own purchase invoices created today
  if (isPurchaseStaff) {
    const { start, end } = getTodayRange();
    baseMatch.userId = new mongoose.Types.ObjectId(ctx.userId);
    baseMatch.$or = [
      { invoiceDate: { $gte: start, $lte: end } },
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
    filter.invoiceNumber = rx;
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
      filter.invoiceDate = dateRange;
    }
  }

  if (query.status === "paid") {
    filter.balanceAmount = { $lte: 0.004 };
  } else if (query.status === "unpaid") {
    filter.amountPaid = { $lte: 0.004 };
    filter.balanceAmount = { $gt: 0.004 };
  } else if (query.status === "partial") {
    filter.amountPaid = { $gt: 0.004 };
    filter.balanceAmount = { $gt: 0.004 };
  }

  const [invoices, total, summaryAgg] = await Promise.all([
    Purchase.find(filter)
      .populate("party", "name mobileNumber gstIn")
      .populate("userId", "userName")
      .sort({ invoiceDate: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Purchase.countDocuments(filter),
    Purchase.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalPurchaseAmount: { $sum: "$totalAmount" },
          totalPaidAmount: { $sum: "$amountPaid" },
          totalBalanceDue: { $sum: "$balanceAmount" },
        },
      },
    ]),
  ]);

  const s = summaryAgg[0] ?? {
    totalInvoices: 0,
    totalPurchaseAmount: 0,
    totalPaidAmount: 0,
    totalBalanceDue: 0,
  };

  return {
    scope: isPurchaseStaff ? ("today" as const) : ("all" as const),
    invoices: invoices.map(toInvoiceDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    summary: {
      totalInvoices: s.totalInvoices,
      totalPurchaseAmount: money(s.totalPurchaseAmount),
      totalPaidAmount: money(s.totalPaidAmount),
      totalBalanceDue: money(s.totalBalanceDue),
    },
  };
}

export async function getPurchaseInvoiceById(
  ctx: AuthContext,
  storeId: string,
  id: string
) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Purchase invoice not found");

  const filter: Record<string, unknown> = {
    _id: id,
    tenantId: ctx.tenantId,
    storeId,
  };

  if (ctx.role === "purchase") {
    const { start, end } = getTodayRange();
    filter.userId = ctx.userId;
    filter.$or = [
      { invoiceDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } },
    ];
  }

  const invoice = await Purchase.findOne(filter)
    .populate("party", "name mobileNumber gstIn")
    .populate("userId", "userName");

  if (!invoice) throw new AppError(404, "Purchase invoice not found");
  return toInvoiceDto(invoice);
}

export async function cancelPurchaseInvoice(
  ctx: AuthContext,
  storeId: string,
  id: string
) {
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new AppError(403, "Only Super Admin and Facility Admin can cancel purchase invoices", "FORBIDDEN");
  }
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Purchase invoice not found");

  return runAtomic(async (session) => {
    const invoice = await Purchase.findOne({
      _id: id,
      tenantId: ctx.tenantId,
      storeId,
    }).session(session ?? null);

    if (!invoice) throw new AppError(404, "Purchase invoice not found");
    if (invoice.cancelled) throw new AppError(400, "This purchase invoice is already cancelled");

    // 1. Reverse item stock additions & write Item Ledger reversal entries
    const itemLedgerDocs = [];
    for (const line of invoice.items) {
      const updatedItem = await Item.findOneAndUpdate(
        { _id: line.item, tenantId: ctx.tenantId, storeId },
        { $inc: { currentStock: -line.quantity } },
        { new: true, session }
      );
      const closingStock = updatedItem ? Number(updatedItem.currentStock.toFixed(4)) : 0;

      itemLedgerDocs.push({
        tenantId: ctx.tenantId,
        storeId,
        account: "item",
        accountId: line.item,
        item: line.item,
        party: invoice.party,
        invoiceId: invoice._id,
        userId: ctx.userId,
        date: new Date(),
        type: "purchase_item_return",
        quantity: line.quantity,
        measuringUnit: line.measuringUnit,
        rate: line.rate ?? 0,
        gstRate: line.gst,
        gstAmount: line.gstAmount ?? 0,
        amount: line.totalAmount,
        closingStock,
        debit: 0,
        credit: line.quantity,
        remarks: `Cancelled Purchase Invoice #${invoice.invoiceNumber}`,
      });
    }

    if (itemLedgerDocs.length > 0) {
      await Ledger.insertMany(itemLedgerDocs, { session });
    }

    // 2. Reverse net unpaid balance on Party Ledger
    const netPayableAdded = money(invoice.totalAmount - invoice.amountPaid);
    if (netPayableAdded > 0) {
      await postPartyEntry(
        ctx,
        storeId,
        {
          partyId: invoice.party,
          type: "purchase_return",
          debit: netPayableAdded,
          credit: 0,
          invoiceId: invoice._id,
          remarks: `Cancelled Purchase Invoice #${invoice.invoiceNumber} (reversed unpaid balance)`,
        },
        session
      );
    }

    invoice.cancelled = true;
    invoice.balanceAmount = 0;
    await invoice.save({ session });

    return { id: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber };
  });
}
