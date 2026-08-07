import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  amount: {type: Number},
  method: {type: String, enum: ["cash", "upi", "card", "unpaid", "personalupi"]},
  date: {type: Date, default: Date.now},
},{
  _id: false,
});

export default paymentSchema;