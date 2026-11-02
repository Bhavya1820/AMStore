import Otp from "../models/Otp";
import User from "../models/User";
import Tenant from "../models/Tenant";
import { generateOtp } from "../utils/otp";
import { hashOtp, safeEqualHex, signRegistrationToken } from "../utils/tokens";
import { sendOtpEmail } from "./email.service";
import { AppError } from "../utils/AppError";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function requestRegistrationOtp(email: string): Promise<void> {
  const taken = (await User.exists({ email })) || (await Tenant.exists({ ownerEmail: email }));
  if (taken) throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");

  const existing = await Otp.findOne({ email, purpose: "registration" });
  if (existing?.createdAt && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError(429, "Please wait a minute before requesting another OTP", "OTP_COOLDOWN");
  }

  const otp = generateOtp();
  await Otp.deleteMany({ email, purpose: "registration" });
  await Otp.create({
    email,
    purpose: "registration",
    otpHash: hashOtp(email, otp),
    expireAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  });

  try {
    await sendOtpEmail(email, otp);
  } catch {
    await Otp.deleteMany({ email, purpose: "registration" });
    throw new AppError(502, "Could not send the OTP email. Please try again.", "EMAIL_SEND_FAILED");
  }
}

// Returns a short-lived registration token proving the email is verified
export async function verifyRegistrationOtp(email: string, otp: string): Promise<string> {
  const record = await Otp.findOne({ email, purpose: "registration" });
  if (!record || record.expireAt.getTime() < Date.now()) {
    throw new AppError(400, "OTP expired or not requested", "OTP_INVALID");
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    throw new AppError(429, "Too many incorrect attempts. Request a new OTP.", "OTP_ATTEMPTS_EXCEEDED");
  }

  if (!safeEqualHex(record.otpHash, hashOtp(email, otp))) {
    record.attempts += 1;
    await record.save();
    throw new AppError(400, "Incorrect OTP", "OTP_INVALID");
  }

  await record.deleteOne();
  return signRegistrationToken(email);
}
