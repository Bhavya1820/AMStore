import mongoose from "mongoose"
import {itemSchema, IItem} from "./itemSchema";
import {PaymentMethod} from "./Common";

interface ISalesReturn {
  customerName?: string;
  customerPhoneNumber?: string;
  salesReturnNumber: string;
  salesReturnDate: Date;
  storeId: mongoose.Types.ObjectId;
  items: IItem;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  balanceAmount: number;
}

const salesReturn = new mongoose.Schema<ISalesReturn>({
  customerName: {type: String},
  customerPhoneNumber: {type: String},
  salesReturnNumber: {type: String, required: true},
  salesReturnDate: {type: Date, required: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountPaid: {type: Number},
  paymentMethod: {type: String, enum: ["cash", "upi", "card"]},
  balanceAmount: {type: Number},
}, {timestamps: true});

const SalesReturn = mongoose.model<ISalesReturn>("SalesReturn", salesReturn);
export default SalesReturn;

