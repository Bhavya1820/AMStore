import mongoose from "mongoose";
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

    // Validate all item IDs exist in this store
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

    for (const line of input.items) {
      const itemDoc = itemMap.get(line.itemId)!;
      const qty = Number(line.quantity);
      const rate = money(line.rate);
      const discount = money(line.discount ?? 0);
      const gstRate = line.gst !== undefined ? Number(line.gst) : itemDoc.gst;
      const includesTax = Boolean(line.priceIncludesTax ?? itemDoc.purchasePriceWithTax);

      if (qty <= 0) throw new AppError(400, `Quantity for "${itemDoc.name}" must be greater than 0`);
      if (rate < 0) throw new AppError(400, `Price for "${itemDoc.name}" cannot be negative`);

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

      // Atomically increment item stock and optionally update purchasePrice
      const updateFields: Record<string, unknown> = {};
      if (line.updateItemPurchasePrice !== false && rate > 0) {
        updateFields.purchasePrice = rate;
        updateFields.purchasePriceWithTax = includesTax;
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

    // Payments made at the time of purchase
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

export interface ListPurchasesQuery {
  partyId?: string;
  q?: string;
  status?: "all" | "paid" | "unpaid" | "partial";
  page: number;
  limit: number;
}

export async function listPurchaseInvoices(
  ctx: AuthContext,
  storeId: string,
  query: ListPurchasesQuery
) {
  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    cancelled: false,
  };

  if (query.partyId) {
    if (!OBJECT_ID.test(query.partyId)) throw new AppError(400, "Invalid partyId");
    filter.party = query.partyId;
  }

  if (query.q?.trim()) {
    const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.invoiceNumber = rx;
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

  const [invoices, total] = await Promise.all([
    Purchase.find(filter)
      .populate("party", "name mobileNumber gstIn")
      .populate("userId", "userName")
      .sort({ invoiceDate: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Purchase.countDocuments(filter),
  ]);

  return {
    invoices: invoices.map((inv) => {
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
        party:
          p && typeof p === "object" && "name" in p
            ? { id: p._id.toString(), name: p.name, mobileNumber: p.mobileNumber ?? null, gstIn: p.gstIn ?? null }
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
    }),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

