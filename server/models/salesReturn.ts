import mongoose from "mongoose"
import {itemSchema, IItem} from "./itemSchema";
import {PaymentMethod, PAYMENT_METHODS} from "./Common";

interface ISalesReturn {
  tenantId: mongoose.Types.ObjectId;
  customerName?: string;
  customerPhoneNumber?: string;
  salesReturnNumber: string;
  salesReturnDate: Date;
  invoiceId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  items: IItem[];
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: PaymentMethod;
  balanceAmount: number;
}

const salesReturn = new mongoose.Schema<ISalesReturn>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  customerName: {type: String, trim: true},
  customerPhoneNumber: {type: String, trim: true},
  salesReturnNumber: {type: String, required: true, trim: true},
  salesReturnDate: {type: Date, required: true},
  invoiceId: {type: mongoose.Schema.Types.ObjectId, ref: "Sale"},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  items: [itemSchema],
  taxableAmount: {type: Number, default: 0},
  sgst: {type: Number, default: 0},
  cgst: {type: Number, default: 0},
  totalAmount: {type: Number, default: 0},
  amountPaid: {type: Number, default: 0},
  paymentMethod: {type: String, enum: PAYMENT_METHODS},
  balanceAmount: {type: Number, default: 0},
}, {timestamps: true});

salesReturn.index({storeId: 1, salesReturnNumber: 1}, {unique: true});

const SalesReturn = mongoose.model<ISalesReturn>("SalesReturn", salesReturn);
export default SalesReturn;
