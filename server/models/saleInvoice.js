import mongoose from "mongoose"
import paymentSchema from "./paymentSchema";
import itemSchema from "./itemSchema";

const saleInvoice = new mongoose.Schema({
  customerName: {type: String},
  customerPhoneNumber: {type: String},
  invoiceNumber: {type: String, required: true},
  invoiceDate: {type: Date, required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountReceived: {type: Number},
  payments: [paymentSchema],
  cancelled: {type: Boolean, default: false}
}, {timestamps: true});

const Sale = mongoose.model("Sale", saleInvoice);
export default Sale;