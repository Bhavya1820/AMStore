import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  objectId: {type: mongoose.Schema.Types.ObjectId, ref:"Item"},
  name: {type: String, required: true},
  hsn: {type: String},
  barcode: {type: String},
  quantity: {type: Number, required: true},
  measuringUnit: {type: String, enum: ["gram", "kilogram", "litre", "millilitre", "piece"]},
  salePrice: {type: Number},
  discount: {type: Number},
  gst: {type: Number},
  totalAmount: {type: Number}
});

export default itemSchema;