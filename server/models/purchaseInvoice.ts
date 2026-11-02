import mongoose from "mongoose";
import {paymentSchema, IPayment} from "./paymentSchema";
import {itemSchema, IItem} from "./itemSchema";

interface IPurchase {
  tenantId: mongoose.Types.ObjectId;
  party: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  items: IItem[];
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  payments: IPayment[];
  balanceAmount: number;
  cancelled: boolean;
}

const purchaseInvoice = new mongoose.Schema<IPurchase>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  invoiceNumber: {type: String, required: true, trim: true},
  invoiceDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number, default: 0},
  gstAmount: {type: Number, default: 0},
  totalAmount: {type: Number, default: 0},
  amountPaid: {type: Number, default: 0},
  payments: [paymentSchema],
  balanceAmount: {type: Number, default: 0},
  cancelled: {type: Boolean, default: false}
}, {timestamps: true});

// Same party may reuse a vendor's invoice number across stores, but not within one store
purchaseInvoice.index({storeId: 1, party: 1, invoiceNumber: 1}, {unique: true});
purchaseInvoice.index({storeId: 1, invoiceDate: -1});

const Purchase = mongoose.model<IPurchase>("Purchase", purchaseInvoice);
export default Purchase;
