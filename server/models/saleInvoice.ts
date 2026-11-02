import mongoose from "mongoose"
import {paymentSchema, IPayment} from "./paymentSchema";
import {itemSchema, IItem} from "./itemSchema";

interface ISale {
  tenantId: mongoose.Types.ObjectId;
  customerName?: string;
  customerPhoneNumber?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  items: IItem[];
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountReceived: number;
  payments: IPayment[];
  cancelled: boolean;
}

const saleInvoice = new mongoose.Schema<ISale>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  customerName: {type: String, trim: true},
  customerPhoneNumber: {type: String, trim: true},
  invoiceNumber: {type: String, required: true, trim: true},
  invoiceDate: {type: Date, required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  items: [itemSchema],
  taxableAmount: {type: Number, default: 0},
  sgst: {type: Number, default: 0},
  cgst: {type: Number, default: 0},
  totalAmount: {type: Number, default: 0},
  amountReceived: {type: Number, default: 0},
  payments: [paymentSchema],
  cancelled: {type: Boolean, default: false}
}, {timestamps: true});

saleInvoice.index({storeId: 1, invoiceNumber: 1}, {unique: true});
saleInvoice.index({storeId: 1, invoiceDate: -1});
saleInvoice.index({storeId: 1, userId: 1, invoiceDate: -1});

const Sale = mongoose.model<ISale>("Sale", saleInvoice);
export default Sale;