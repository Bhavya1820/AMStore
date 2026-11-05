import mongoose from "mongoose";
import Item from "../models/Item";
import Category from "../models/Category";
import Ledger from "../models/Ledger";
import { MeasuringUnit, LedgerType } from "../models/Common";
import { AuthContext } from "../types/auth";
import { AppError } from "../utils/AppError";

const OBJECT_ID = /^[a-f\d]{24}$/i;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------- categories ------------------------------- */

export async function listCategories(ctx: AuthContext, storeId: string) {
  const categories = await Category.find({
    tenantId: ctx.tenantId,
    storeId,
  }).sort({ name: 1 });

  const counts = await Item.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
        storeId: new mongoose.Types.ObjectId(storeId),
        category: { $ne: null },
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return categories.map((cat) => ({
    id: cat._id.toString(),
    name: cat.name,
    storeId: cat.storeId.toString(),
    itemCount: countMap.get(cat._id.toString()) ?? 0,
  }));
}

export async function createCategory(ctx: AuthContext, storeId: string, name: string) {
  const trimmed = name.trim();
  const existing = await Category.findOne({
    tenantId: ctx.tenantId,
    storeId,
    name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
  });
  if (existing) {
    throw new AppError(409, `Category "${trimmed}" already exists in this facility`, "DUPLICATE");
  }

  const cat = await Category.create({
    tenantId: ctx.tenantId,
    storeId,
    name: trimmed,
  });

  return {
    id: cat._id.toString(),
    name: cat.name,
    storeId: cat.storeId.toString(),
    itemCount: 0,
  };
}

/* ---------------------------------- items --------------------------------- */

export interface CreateItemInput {
  name: string;
  category?: string;
  salePrice: number;
  salePriceWithTax: boolean;
  purchasePrice: number;
  purchasePriceWithTax: boolean;
  gst: number;
  measuringUnit: MeasuringUnit;
  currentStock: number;
  lowStock: number;
  barcode: string;
  hsn: string;
  remarks?: string;
}

export interface UpdateItemInput {
  name?: string;
  category?: string | null;
  salePrice?: number;
  salePriceWithTax?: boolean;
  purchasePrice?: number;
  purchasePriceWithTax?: boolean;
  gst?: number;
  measuringUnit?: MeasuringUnit;
  lowStock?: number;
  barcode?: string;
  hsn?: string;
  isActive?: boolean;
}

export interface ListItemsQuery {
  q?: string;
  category?: string;
  measuringUnit?: MeasuringUnit;
  stockStatus?: "all" | "in" | "low" | "out";
  isActive?: "all" | "true" | "false";
  sortBy?: "createdAt" | "name" | "currentStock" | "salePrice" | "purchasePrice";
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}

type PopulatedCategory = { _id: mongoose.Types.ObjectId; name: string } | mongoose.Types.ObjectId | null | undefined;

function toItemDto(doc: InstanceType<typeof Item> & { createdAt?: Date; updatedAt?: Date }) {
  const cat = doc.category as PopulatedCategory;
  let category: { id: string; name: string } | null = null;
  if (cat && typeof cat === "object" && "name" in cat) {
    category = { id: cat._id.toString(), name: cat.name };
  } else if (cat) {
    category = { id: cat.toString(), name: "" };
  }

  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    storeId: doc.storeId.toString(),
    name: doc.name,
    category,
    salePrice: doc.salePrice,
    salePriceWithTax: doc.salePriceWithTax,
    purchasePrice: doc.purchasePrice,
    purchasePriceWithTax: doc.purchasePriceWithTax,
    gst: doc.gst,
    measuringUnit: doc.measuringUnit,
    currentStock: doc.currentStock,
    lowStock: doc.lowStock,
    barcode: doc.barcode,
    hsn: doc.hsn,
    isActive: doc.isActive,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function createItem(ctx: AuthContext, storeId: string, input: CreateItemInput) {
  let categoryId: mongoose.Types.ObjectId | undefined;
  if (input.category) {
    if (!OBJECT_ID.test(input.category)) {
      throw new AppError(400, "Invalid category ID", "INVALID_CATEGORY");
    }
    const cat = await Category.findOne({
      _id: input.category,
      tenantId: ctx.tenantId,
      storeId,
    });
    if (!cat) {
      throw new AppError(400, "Selected category does not exist in this facility", "INVALID_CATEGORY");
    }
    categoryId = cat._id;
  }

  const item = await Item.create({
    tenantId: ctx.tenantId,
    storeId,
    name: input.name.trim(),
    category: categoryId,
    salePrice: input.salePrice,
    salePriceWithTax: input.salePriceWithTax,
    purchasePrice: input.purchasePrice,
    purchasePriceWithTax: input.purchasePriceWithTax,
    gst: input.gst,
    measuringUnit: input.measuringUnit,
    currentStock: input.currentStock,
    lowStock: input.lowStock,
    barcode: input.barcode.trim(),
    hsn: input.hsn.trim(),
    isActive: true,
  });

  // Record opening stock entry in the append-only Ledger
  const stockVal = Number((item.currentStock * item.purchasePrice).toFixed(2));
  await Ledger.create({
    tenantId: ctx.tenantId,
    storeId,
    account: "item",
    accountId: item._id,
    item: item._id,
    userId: ctx.userId,
    date: new Date(),
    type: "add_new_item",
    quantity: item.currentStock,
    measuringUnit: item.measuringUnit,
    rate: item.purchasePrice,
    gstRate: item.gst,
    amount: stockVal,
    closingStock: item.currentStock,
    debit: item.currentStock > 0 ? item.currentStock : 0,
    credit: 0,
    remarks: input.remarks?.trim() || "Opening stock on item creation",
  });

  const populated = await Item.findById(item._id).populate("category", "name");
  return toItemDto(populated ?? item);
}

/* ------------------------------- bulk import ------------------------------ */

export interface BulkItemRowInput extends CreateItemInput {
  rowNumber?: number;
}

export async function bulkCreateItems(
  ctx: AuthContext,
  storeId: string,
  rows: BulkItemRowInput[]
) {
  if (!rows.length) {
    throw new AppError(400, "No items provided for bulk import");
  }
  if (rows.length > 10000) {
    throw new AppError(400, "Maximum 10,000 items can be imported at once");
  }

  // 1. Load existing categories in this store and map by lowercase name & ID
  const existingCategories = await Category.find({ tenantId: ctx.tenantId, storeId });
  const catByName = new Map<string, mongoose.Types.ObjectId>();
  const catById = new Map<string, mongoose.Types.ObjectId>();

  for (const c of existingCategories) {
    catByName.set(c.name.trim().toLowerCase(), c._id);
    catById.set(c._id.toString(), c._id);
  }

  // 2. Auto-create any new categories referenced by name in the Excel sheet
  let createdCategoriesCount = 0;
  const newCategoryNames = new Map<string, string>();
  for (const row of rows) {
    const rawCat = row.category?.trim();
    if (!rawCat) continue;
    if (OBJECT_ID.test(rawCat) && catById.has(rawCat)) continue;
    const lower = rawCat.toLowerCase();
    if (!catByName.has(lower) && !newCategoryNames.has(lower)) {
      newCategoryNames.set(lower, rawCat);
    }
  }

  for (const [lower, displayName] of newCategoryNames.entries()) {
    try {
      const created = await Category.create({
        tenantId: ctx.tenantId,
        storeId,
        name: displayName,
      });
      catByName.set(lower, created._id);
      catById.set(created._id.toString(), created._id);
      createdCategoriesCount++;
    } catch {
      const found = await Category.findOne({
        tenantId: ctx.tenantId,
        storeId,
        name: { $regex: `^${escapeRegex(displayName)}$`, $options: "i" },
      });
      if (found) {
        catByName.set(lower, found._id);
        catById.set(found._id.toString(), found._id);
      }
    }
  }

  // 3. Check barcodes against existing items in this store
  const candidateBarcodes = rows.map((r) => r.barcode.trim()).filter(Boolean);
  const existingItems = await Item.find({
    storeId,
    barcode: { $in: candidateBarcodes },
  }).select("barcode");

  const existingBarcodeSet = new Set(existingItems.map((i) => i.barcode));
  const seenInBatch = new Set<string>();

  const errors: Array<{ row: number; name: string; barcode: string; message: string }> = [];
  const itemsToInsert: Array<Record<string, unknown>> = [];
  const ledgersToInsert: Array<Record<string, unknown>> = [];
  const now = new Date();

  rows.forEach((row, idx) => {
    const rowNum = row.rowNumber ?? idx + 2;
    const barcode = row.barcode.trim();
    const name = row.name.trim();

    if (existingBarcodeSet.has(barcode)) {
      errors.push({
        row: rowNum,
        name,
        barcode,
        message: `Barcode "${barcode}" already exists in this store`,
      });
      return;
    }

    if (seenInBatch.has(barcode)) {
      errors.push({
        row: rowNum,
        name,
        barcode,
        message: `Duplicate barcode "${barcode}" found within the uploaded sheet`,
      });
      return;
    }

    seenInBatch.add(barcode);

    let categoryId: mongoose.Types.ObjectId | undefined;
    if (row.category?.trim()) {
      const rawCat = row.category.trim();
      categoryId = catById.get(rawCat) ?? catByName.get(rawCat.toLowerCase());
    }

    const itemId = new mongoose.Types.ObjectId();
    const currentStock = Number(row.currentStock) || 0;
    const purchasePrice = Number(row.purchasePrice) || 0;
    const salePrice = Number(row.salePrice) || 0;
    const gst = Number(row.gst) || 0;
    const lowStock = Number(row.lowStock) || 0;

    itemsToInsert.push({
      _id: itemId,
      tenantId: ctx.tenantId,
      storeId,
      name,
      category: categoryId,
      salePrice,
      salePriceWithTax: Boolean(row.salePriceWithTax),
      purchasePrice,
      purchasePriceWithTax: Boolean(row.purchasePriceWithTax),
      gst,
      measuringUnit: row.measuringUnit,
      currentStock,
      lowStock,
      barcode,
      hsn: row.hsn.trim(),
      isActive: true,
    });

    ledgersToInsert.push({
      tenantId: ctx.tenantId,
      storeId,
      account: "item",
      accountId: itemId,
      item: itemId,
      userId: ctx.userId,
      date: now,
      type: "add_new_item",
      quantity: currentStock,
      measuringUnit: row.measuringUnit,
      rate: purchasePrice,
      gstRate: gst,
      amount: Number((currentStock * purchasePrice).toFixed(2)),
      closingStock: currentStock,
      debit: currentStock > 0 ? currentStock : 0,
      credit: 0,
      remarks: row.remarks?.trim() || "Bulk Excel import — opening stock",
    });
  });

  if (itemsToInsert.length > 0) {
    await Item.insertMany(itemsToInsert, { ordered: false });
    await Ledger.insertMany(ledgersToInsert, { ordered: false });
  }

  return {
    importedCount: itemsToInsert.length,
    skippedCount: errors.length,
    createdCategoriesCount,
    errors,
  };
}

export async function listItems(ctx: AuthContext, storeId: string, query: ListItemsQuery) {
  const baseMatch: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    storeId: new mongoose.Types.ObjectId(storeId),
  };

  const filter: Record<string, unknown> = { ...baseMatch };

  if (query.isActive === "true") filter.isActive = true;
  else if (query.isActive === "false") filter.isActive = false;

  if (query.category) {
    if (query.category === "uncategorized") {
      filter.category = { $exists: false };
    } else if (OBJECT_ID.test(query.category)) {
      filter.category = new mongoose.Types.ObjectId(query.category);
    }
  }

  if (query.measuringUnit) {
    filter.measuringUnit = query.measuringUnit;
  }

  if (query.q && query.q.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ name: rx }, { barcode: rx }, { hsn: rx }];
  }

  if (query.stockStatus === "out") {
    filter.currentStock = { $lte: 0 };
  } else if (query.stockStatus === "low") {
    filter.$expr = {
      $and: [{ $gt: ["$currentStock", 0] }, { $lte: ["$currentStock", "$lowStock"] }],
    };
  } else if (query.stockStatus === "in") {
    filter.$expr = {
      $and: [{ $gt: ["$currentStock", 0] }, { $gt: ["$currentStock", "$lowStock"] }],
    };
  }

  const sortField = query.sortBy ?? "createdAt";
  const sortDir = query.sortOrder === "asc" ? 1 : -1;
  const sortSpec: Record<string, 1 | -1> = { [sortField]: sortDir, _id: -1 };

  const [items, total, summaryAgg] = await Promise.all([
    Item.find(filter)
      .populate("category", "name")
      .sort(sortSpec)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Item.countDocuments(filter),
    Item.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          activeItems: { $sum: { $cond: ["$isActive", 1, 0] } },
          outOfStockCount: {
            $sum: { $cond: [{ $lte: ["$currentStock", 0] }, 1, 0] },
          },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$currentStock", 0] },
                    { $lte: ["$currentStock", "$lowStock"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalStockValue: {
            $sum: {
              $cond: [
                { $gt: ["$currentStock", 0] },
                { $multiply: ["$currentStock", "$purchasePrice"] },
                0,
              ],
            },
          },
          totalRetailValue: {
            $sum: {
              $cond: [
                { $gt: ["$currentStock", 0] },
                { $multiply: ["$currentStock", "$salePrice"] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const stats = summaryAgg[0] ?? {
    totalItems: 0,
    activeItems: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    totalStockValue: 0,
    totalRetailValue: 0,
  };

  return {
    items: items.map(toItemDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    summary: {
      totalItems: stats.totalItems,
      activeItems: stats.activeItems,
      outOfStockCount: stats.outOfStockCount,
      lowStockCount: stats.lowStockCount,
      totalStockValue: Number((stats.totalStockValue ?? 0).toFixed(2)),
      totalRetailValue: Number((stats.totalRetailValue ?? 0).toFixed(2)),
    },
  };
}

export async function getItemById(ctx: AuthContext, storeId: string, id: string) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Item not found");
  const item = await Item.findOne({ _id: id, tenantId: ctx.tenantId, storeId }).populate("category", "name");
  if (!item) throw new AppError(404, "Item not found");
  return toItemDto(item);
}

export async function updateItem(ctx: AuthContext, storeId: string, id: string, input: UpdateItemInput) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Item not found");
  const item = await Item.findOne({ _id: id, tenantId: ctx.tenantId, storeId });
  if (!item) throw new AppError(404, "Item not found");

  if (input.category !== undefined) {
    if (input.category === null || input.category === "") {
      item.category = undefined;
    } else {
      if (!OBJECT_ID.test(input.category)) {
        throw new AppError(400, "Invalid category ID", "INVALID_CATEGORY");
      }
      const cat = await Category.findOne({ _id: input.category, tenantId: ctx.tenantId, storeId });
      if (!cat) throw new AppError(400, "Category not found in this facility", "INVALID_CATEGORY");
      item.category = cat._id;
    }
  }

  if (input.name !== undefined) item.name = input.name.trim();
  if (input.salePrice !== undefined) item.salePrice = input.salePrice;
  if (input.salePriceWithTax !== undefined) item.salePriceWithTax = input.salePriceWithTax;
  if (input.purchasePrice !== undefined) item.purchasePrice = input.purchasePrice;
  if (input.purchasePriceWithTax !== undefined) item.purchasePriceWithTax = input.purchasePriceWithTax;
  if (input.gst !== undefined) item.gst = input.gst;
  if (input.measuringUnit !== undefined) item.measuringUnit = input.measuringUnit;
  if (input.lowStock !== undefined) item.lowStock = input.lowStock;
  if (input.barcode !== undefined) item.barcode = input.barcode.trim();
  if (input.hsn !== undefined) item.hsn = input.hsn.trim();
  if (input.isActive !== undefined) item.isActive = input.isActive;

  await item.save();
  const populated = await Item.findById(item._id).populate("category", "name");
  return toItemDto(populated ?? item);
}

/* ---------------------------- stock adjustment ---------------------------- */

export interface AdjustStockInput {
  mode: "add" | "reduce" | "set";
  quantity: number;
  rate?: number;
  remarks?: string;
}

export async function adjustItemStock(
  ctx: AuthContext,
  storeId: string,
  id: string,
  input: AdjustStockInput
) {
  if (!OBJECT_ID.test(id)) throw new AppError(404, "Item not found");
  const item = await Item.findOne({ _id: id, tenantId: ctx.tenantId, storeId });
  if (!item) throw new AppError(404, "Item not found");

  const previousStock = item.currentStock;
  let closingStock = previousStock;

  if (input.mode === "add") {
    if (input.quantity <= 0) throw new AppError(400, "Quantity to add must be greater than 0");
    closingStock = Number((previousStock + input.quantity).toFixed(4));
  } else if (input.mode === "reduce") {
    if (input.quantity <= 0) throw new AppError(400, "Quantity to reduce must be greater than 0");
    if (previousStock - input.quantity < 0) {
      throw new AppError(400, `Cannot reduce stock below 0 (current stock: ${previousStock})`);
    }
    closingStock = Number((previousStock - input.quantity).toFixed(4));
  } else {
    if (input.quantity < 0) throw new AppError(400, "Stock cannot be negative");
    closingStock = Number(input.quantity.toFixed(4));
  }

  const delta = Number((closingStock - previousStock).toFixed(4));
  if (delta === 0) {
    throw new AppError(400, "Stock level is already at the specified quantity");
  }

  const unitRate = input.rate ?? item.purchasePrice;
  const absDelta = Math.abs(delta);

  item.currentStock = closingStock;
  await item.save();

  await Ledger.create({
    tenantId: ctx.tenantId,
    storeId,
    account: "item",
    accountId: item._id,
    item: item._id,
    userId: ctx.userId,
    date: new Date(),
    type: "stock_adjustment",
    quantity: absDelta,
    measuringUnit: item.measuringUnit,
    rate: unitRate,
    gstRate: item.gst,
    amount: Number((absDelta * unitRate).toFixed(2)),
    closingStock,
    debit: delta > 0 ? absDelta : 0,
    credit: delta < 0 ? absDelta : 0,
    remarks:
      input.remarks?.trim() ||
      (delta > 0
        ? `Manual stock addition (+${absDelta} ${item.measuringUnit})`
        : `Manual stock reduction (-${absDelta} ${item.measuringUnit})`),
  });

  const populated = await Item.findById(item._id).populate("category", "name");
  return toItemDto(populated ?? item);
}

/* ------------------------------ item ledgers ------------------------------ */

export interface ListItemLedgerQuery {
  itemId: string;
  type?: LedgerType;
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
}

export async function listItemLedgers(ctx: AuthContext, storeId: string, query: ListItemLedgerQuery) {
  if (!OBJECT_ID.test(query.itemId)) throw new AppError(400, "Invalid itemId");

  const filter: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    storeId,
    account: "item",
    accountId: query.itemId,
  };

  if (query.type) {
    filter.type = query.type;
  }

  if (query.fromDate || query.toDate) {
    const dateFilter: Record<string, Date> = {};
    if (query.fromDate) {
      const from = new Date(query.fromDate);
      if (!isNaN(from.getTime())) dateFilter.$gte = from;
    }
    if (query.toDate) {
      const to = new Date(query.toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      filter.date = dateFilter;
    }
  }

  const [entries, total] = await Promise.all([
    Ledger.find(filter)
      .populate("item", "name barcode measuringUnit hsn currentStock")
      .populate("party", "name")
      .populate("userId", "userName")
      .sort({ date: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Ledger.countDocuments(filter),
  ]);

  return {
    entries: entries.map((e) => {
      const itemPop = e.item as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        barcode: string;
        measuringUnit: MeasuringUnit;
        hsn: string;
        currentStock: number;
      } | null;
      const partyPop = e.party as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
      const userPop = e.userId as unknown as { _id: mongoose.Types.ObjectId; userName: string } | null;

      return {
        id: e._id.toString(),
        date: e.date,
        type: e.type,
        accountId: e.accountId.toString(),
        item: itemPop && typeof itemPop === "object" && "name" in itemPop
          ? {
              id: itemPop._id.toString(),
              name: itemPop.name,
              barcode: itemPop.barcode,
              measuringUnit: itemPop.measuringUnit,
              hsn: itemPop.hsn,
              currentStock: itemPop.currentStock,
            }
          : null,
        party: partyPop && typeof partyPop === "object" && "name" in partyPop
          ? { id: partyPop._id.toString(), name: partyPop.name }
          : null,
        user: userPop && typeof userPop === "object" && "userName" in userPop
          ? { id: userPop._id.toString(), userName: userPop.userName }
          : null,
        quantity: e.quantity ?? 0,
        measuringUnit: e.measuringUnit ?? itemPop?.measuringUnit ?? "piece",
        rate: e.rate ?? 0,
        amount: e.amount ?? 0,
        gstRate: e.gstRate ?? 0,
        closingStock: e.closingStock ?? 0,
        debit: e.debit ?? 0,
        credit: e.credit ?? 0,
        remarks: e.remarks ?? "",
      };
    }),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
