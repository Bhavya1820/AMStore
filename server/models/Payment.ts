import mongoose from "mongoose";
import {paymentSchema, IPayment} from "./paymentSchema";

interface Ipayment {
  tenantId: mongoose.Types.ObjectId;
  type: "payment_out" | "payment_in";
  date: Date;
  party?: mongoose.Types.ObjectId;
  invoice?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  payments: IPayment[];
  amount: number;
  notes?: string;
}

const payment_Schema = new mongoose.Schema<Ipayment>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  type: {type: String, enum:["payment_out", "payment_in"], required: true},
  date: {type: Date, default: Date.now},
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party"},
  invoice: {type: mongoose.Schema.Types.ObjectId, ref: "Purchase"},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  payments: [paymentSchema],
  amount: {type: Number, required: true, min: 0},
  notes: {type: String}, 
}, {timestamps: true});

payment_Schema.index({storeId: 1, party: 1, date: -1});

const Payments = mongoose.model<Ipayment>("Payments", payment_Schema);
export default Payments;