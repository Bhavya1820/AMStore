import mongoose from "mongoose";
import itemSchema from "./itemSchema";

const purchaseReturn = new mongoose.Schema({
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  invoiceId: {type: mongoose.Schema.Types.ObjectId, ref: "Purchase"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  purchaseReturnNumber: {type: String, required: true},
  purchaseReturnDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountRecieved: {type: Number},
  paymentMethod: {type: String, enum: ["cash", "upi", "card"]},
  balanceAmount:{type: Number}
}, {timestamps: true});

const PurchaseReturn = mongoose.model("PurchaseReturn", purchaseReturn);
export default PurchaseReturn;