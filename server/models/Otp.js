import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
 email: {type: String, required: true, lowercase: true, trim: true, index: true},
 otpHash: {type: String, required: true},
 purpose: {type: String, enum: ['registration', 'login', 'forgotPassword']},
 expireAt: {type: Date, required: true},
 attempts: {type: Number, default: 0}, 
}, {timestamps: true});

otpSchema.index(
  {expireAt: 1},
  {expireAfterSeconds: 0},
)

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;