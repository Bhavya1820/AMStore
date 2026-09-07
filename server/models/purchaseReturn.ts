import mongoose from "mongoose";
import {itemSchema, IItem} from "./itemSchema";
import {PaymentMethod} from "./Common"

interface IPurchaseReturn {
  party: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  purchaseReturnNumber: string;
  purchaseReturnDate: Date;
  items: IItem;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountRecieved: number;
  paymentMethod: PaymentMethod;
  balanceAmount: number;
}

const purchaseReturn = new mongoose.Schema<IPurchaseReturn>({
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

const PurchaseReturn = mongoose.model<IPurchaseReturn>("PurchaseReturn", purchaseReturn);
export default PurchaseReturn;