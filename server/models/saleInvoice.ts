import mongoose from "mongoose"
import {paymentSchema, IPayment} from "./paymentSchema";
import {itemSchema, IItem} from "./itemSchema";

interface ISale {
  customerName?: string;
  customerPhoneNumber?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  items: IItem;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountReceived: number;
  payments: IPayment;
  cancelled: boolean;
}

const saleInvoice = new mongoose.Schema<ISale>({
  customerName: {type: String},
  customerPhoneNumber: {type: String},
  invoiceNumber: {type: String, required: true},
  invoiceDate: {type: Date, required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountReceived: {type: Number},
  payments: [paymentSchema],
  cancelled: {type: Boolean, default: false}
}, {timestamps: true});

const Sale = mongoose.model<ISale>("Sale", saleInvoice);
export default Sale;