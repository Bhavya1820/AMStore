import mongoose from "mongoose";
import {itemSchema, IItem} from "./itemSchema";
import {PaymentMethod, PAYMENT_METHODS} from "./Common"

interface IPurchaseReturn {
  tenantId: mongoose.Types.ObjectId;
  party: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  purchaseReturnNumber: string;
  purchaseReturnDate: Date;
  items: IItem[];
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountReceived: number;
  paymentMethod?: PaymentMethod;
  balanceAmount: number;
}

const purchaseReturn = new mongoose.Schema<IPurchaseReturn>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  invoiceId: {type: mongoose.Schema.Types.ObjectId, ref: "Purchase"},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  purchaseReturnNumber: {type: String, required: true, trim: true},
  purchaseReturnDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number, default: 0},
  sgst: {type: Number, default: 0},
  cgst: {type: Number, default: 0},
  totalAmount: {type: Number, default: 0},
  amountReceived: {type: Number, default: 0},
  paymentMethod: {type: String, enum: PAYMENT_METHODS},
  balanceAmount:{type: Number, default: 0}
}, {timestamps: true});

purchaseReturn.index({storeId: 1, purchaseReturnNumber: 1}, {unique: true});

const PurchaseReturn = mongoose.model<IPurchaseReturn>("PurchaseReturn", purchaseReturn);
export default PurchaseReturn;