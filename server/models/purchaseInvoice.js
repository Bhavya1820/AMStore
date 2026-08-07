import mongoose from "mongoose";
import paymentSchema from "./paymentSchema";
import itemSchema from "./itemSchema";

const purchaseInvoice = new mongoose.Schema({
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  invoiceNumber: {type: Number, required: true},
  invoiceDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  gstAmount: {type: Number},
  totalAmount: {type: Number},
  amountPaid: {type: Number},
  payments: [paymentSchema],
  balanceAmount: {type: Number}
}, {timestamps: true});

const Purchase = mongoose.model("Purchase", purchaseInvoice);
export default Purchase;

