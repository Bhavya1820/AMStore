import mongoose from "mongoose";
import {PaymentMethod} from "./Common";

export interface IPayment {
  amount: number;
  method: PaymentMethod;
  date: Date;
}

export const paymentSchema = new mongoose.Schema<IPayment>({
  amount: {type: Number},
  method: {type: String, enum: ["cash", "upi", "card", "unpaid", "personalupi"]},
  date: {type: Date, default: Date.now},
},{
  _id: false,
});