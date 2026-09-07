import mongoose from "mongoose";
import {paymentSchema, IPayment} from "./paymentSchema";
import {itemSchema, IItem} from "./itemSchema";

interface IPurchase {
  party: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  items: IItem;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  payments: IPayment;
  balanceAmount: number;
}

const purchaseInvoice = new mongoose.Schema<IPurchase>({
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  invoiceNumber: {type: String, required: true},
  invoiceDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  gstAmount: {type: Number},
  totalAmount: {type: Number},
  amountPaid: {type: Number},
  payments: [paymentSchema],
  balanceAmount: {type: Number}
}, {timestamps: true});

const Purchase = mongoose.model<IPurchase>("Purchase", purchaseInvoice);
export default Purchase;

