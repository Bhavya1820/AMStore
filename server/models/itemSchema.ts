import mongoose from "mongoose";
import {MeasuringUnit, MEASURING_UNITS} from "./Common";

// Invoice line, shared by sale/purchase invoices and returns.
// Item details are snapshotted so old invoices stay correct after the item is edited.
export interface IItem {
  item: mongoose.Types.ObjectId;
  name: string;
  hsn?: string;
  barcode?: string;
  quantity: number;
  measuringUnit: MeasuringUnit;
  // Item's selling price at the time of the invoice
  salePrice: number;
  // Unit price charged on this invoice (purchase cost for purchases)
  rate?: number;
  // Flat discount amount on the line (₹)
  discount?: number;
  gst: number;
  priceIncludesTax?: boolean;
  taxableAmount?: number;
  gstAmount?: number;
  totalAmount: number;
  // Item stock right after this line was posted
  closingStock?: number;
}

export const itemSchema = new mongoose.Schema<IItem>({
  item: {type: mongoose.Schema.Types.ObjectId, ref:"Item", required: true},
  name: {type: String, required: true},
  hsn: {type: String},
  barcode: {type: String},
  quantity: {type: Number, required: true},
  measuringUnit: {type: String, enum: MEASURING_UNITS, required: true},
  salePrice: {type: Number, default: 0},
  rate: {type: Number},
  discount: {type: Number, default: 0},
  gst: {type: Number, required: true},
  priceIncludesTax: {type: Boolean, default: false},
  taxableAmount: {type: Number},
  gstAmount: {type: Number},
  totalAmount: {type: Number, required: true},
  closingStock: {type: Number},
});
