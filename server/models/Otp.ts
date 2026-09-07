import mongoose from "mongoose";

interface IOtp {
  email: string;
  otpHash: string;
  purpose: "registration" | "login" | "forgotPassword";
  expireAt: Date;
  attempts: number;
}

const otpSchema = new mongoose.Schema<IOtp>({
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

const Otp = mongoose.model<IOtp>("Otp", otpSchema);
export default Otp;