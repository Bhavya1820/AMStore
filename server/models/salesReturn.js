import mongoose from "mongoose"

const itemSchema = new mongoose.Schema({
  objectId: {type: mongoose.Schema.Types.ObjectId},
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

const salesReturn = new mongoose.Schema({
  customerName: {type: String},
  customerPhoneNumber: {type: String},
  salesReturnNumber: {type: String, required: true},
  salesReturnDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountPaid: {type: Number},
  paymentMethod: {type: String, enum: ["cash", "upi", "card"]},
  balanceAmount: {type: Number},
}, {timestamps: true});

const SalesReturn = mongoose.model("SalesReturn", salesReturn);
export default SalesReturn;

