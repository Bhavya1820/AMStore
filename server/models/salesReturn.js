import mongoose from "mongoose"
import itemSchema from "./itemSchema";

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

