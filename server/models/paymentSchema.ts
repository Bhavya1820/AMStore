import mongoose from "mongoose";
import {PaymentMethod, PAYMENT_METHODS} from "./Common";

export interface IPayment {
  amount: number;
  method: PaymentMethod;
  date: Date;
}

export const paymentSchema = new mongoose.Schema<IPayment>({
  amount: {type: Number, required: true, min: 0},
  method: {type: String, enum: PAYMENT_METHODS, required: true},
  date: {type: Date, default: Date.now},
},{
  _id: false,
});
