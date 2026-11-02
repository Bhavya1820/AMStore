import mongoose from "mongoose"
import {MeasuringUnit, MEASURING_UNITS} from "./Common";

interface IItem {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  category?: mongoose.Types.ObjectId;
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
  isActive: boolean;
  storeId: mongoose.Types.ObjectId;
}

const itemSchema = new mongoose.Schema<IItem>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  name: {type: String, required: true, trim: true},
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  salePrice: {type: Number, required: true, min: 0},
  salePriceWithTax: {type: Boolean, default: false},
  purchasePrice: {type: Number, required: true, min: 0},
  purchasePriceWithTax: {type: Boolean, default: false},
  gst: {type: Number, required: true, min: 0},
  measuringUnit: {
    type: String,
    enum: MEASURING_UNITS,
    required: true
  },
  currentStock: {type: Number, default: 0},
  lowStock: {type: Number, default: 0},
  barcode: {type: String, required: true, trim: true},
  hsn: {type: String, required: true, trim: true},
  isActive: {type: Boolean, default: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true});

itemSchema.index({storeId: 1, barcode: 1}, {unique: true});
itemSchema.index({storeId: 1, name: 1});
itemSchema.index({storeId: 1, category: 1});

const Item = mongoose.model<IItem>("Item", itemSchema);
export default Item;