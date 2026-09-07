import mongoose from "mongoose"
import {MeasuringUnit} from "./Common";

interface IItem {
  name: string;
  category: mongoose.Types.ObjectId;
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
  storeId: mongoose.Types.ObjectId;
}

const itemSchema = new mongoose.Schema<IItem>({
  name: {type: String, required: true},
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  salePrice: {type: Number, required: true},
  salePriceWithTax: {type: Boolean, default: false},
  purchasePrice: {type: Number, required: true},
  purchasePriceWithTax: {type: Boolean, default: false},
  gst: {type: Number, required: true},
  measuringUnit: {
    type: String,
    enum: ["gram", "millilitre", "kilogram", "litre", "piece"],
    required: true
  },
  currentStock: {type: Number, default: 0},
  lowStock: {type: Number, default: 0},
  barcode: {type: String, required: true},
  hsn: {type: String, required: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true});

const Item = mongoose.model<IItem>("Item", itemSchema);
export default Item;