import mongoose from "mongoose";
import {MeasuringUnit} from "./Common";

export interface IItem {
  item: mongoose.Types.ObjectId;
  name: string;
  hsn?: string;
  barcode?: string;
  quantity: number;
  measuringUnit: MeasuringUnit;
  salePrice: number;
  discount?: number;
  gst: number;
  totalAmount: number; 
}

export const itemSchema = new mongoose.Schema<IItem>({
  item: {type: mongoose.Schema.Types.ObjectId, ref:"Item", required: true},
  name: {type: String, required: true},
  hsn: {type: String},
  barcode: {type: String},
  quantity: {type: Number, required: true},
  measuringUnit: {type: String, enum: ["gram", "kilogram", "litre", "millilitre", "piece"], required: true},
  salePrice: {type: Number, required: true},
  discount: {type: Number},
  gst: {type: Number, required: true},
  totalAmount: {type: Number, required: true}
});

// export default itemSchema;