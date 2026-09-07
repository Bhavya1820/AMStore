import mongoose from "mongoose";
import {paymentSchema, IPayment} from "./paymentSchema";

interface Ipayment {
  type: "payment_out" | "payment_in";
  date: Date;
  party?: mongoose.Types.ObjectId;
  invoice?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;
  payments: IPayment;
  amount: number;
  notes: string;
}

const payment_Schema = new mongoose.Schema<Ipayment>({
  type: {type: String, enum:["payment_out", "payment_in"], required: true},
  date: {type: Date, default: Date.now},
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party"},
  invoice: {type: mongoose.Schema.Types.ObjectId, ref: "Purchase"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  payments: [paymentSchema],
  amount: {type: Number, required: true},
  notes: {type: String}, 
}, {timestamps: true});

const Payments = mongoose.model<Ipayment>("Payments", payment_Schema);
export default Payments;