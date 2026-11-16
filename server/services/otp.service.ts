import Otp from "../models/Otp";
import User from "../models/User";
import Tenant from "../models/Tenant";
import Store from "../models/Store";
import { generateOtp } from "../utils/otp";
import {
  hashOtp,
  safeEqualHex,
  signPasswordResetToken,
  signRegistrationToken,
} from "../utils/tokens";
import { sendOtpEmail, sendPasswordResetOtpEmail } from "./email.service";
import { AppError } from "../utils/AppError";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

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

/* ----------------------------- forgot password ---------------------------- */

export type ForgotPasswordLookup =
  | { email: string }
  | { storeCode: string; userName: string };

async function resolveUserForPasswordReset(lookup: ForgotPasswordLookup) {
  let user = null;
  let fallbackStoreEmail: string | undefined;

  if ("email" in lookup) {
    user = await User.findOne({ email: lookup.email.trim().toLowerCase() });
  } else {
    const store = await Store.findOne({
      storeCode: lookup.storeCode.trim().toUpperCase(),
      isActive: true,
    });
    if (store) {
      fallbackStoreEmail = store.email;
      user = await User.findOne({
        tenantId: store.tenantId,
        userName: lookup.userName.trim(),
        storeIds: store._id,
      });
    }
  }

  if (!user) {
    throw new AppError(404, "No account found with the provided details", "USER_NOT_FOUND");
  }
  if (!user.isActive) {
    throw new AppError(403, "This account has been deactivated. Contact your administrator.", "USER_INACTIVE");
  }

  const targetEmail = user.email ?? fallbackStoreEmail;
  if (!targetEmail) {
    throw new AppError(
      400,
      "No email address is linked to this account. Ask your administrator to reset your password.",
      "NO_EMAIL_LINKED"
    );
  }

  return { user, targetEmail };
}

export async function requestForgotPasswordOtp(lookup: ForgotPasswordLookup) {
  const { user, targetEmail } = await resolveUserForPasswordReset(lookup);

  const existing = await Otp.findOne({ email: targetEmail, purpose: "forgotPassword" });
  if (existing?.createdAt && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError(429, "Please wait a minute before requesting another OTP", "OTP_COOLDOWN");
  }

  const otp = generateOtp();
  await Otp.deleteMany({ email: targetEmail, purpose: "forgotPassword" });
  await Otp.create({
    email: targetEmail,
    purpose: "forgotPassword",
    otpHash: hashOtp(targetEmail, otp),
    expireAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  });

  try {
    await sendPasswordResetOtpEmail(targetEmail, otp, user.userName);
  } catch {
    await Otp.deleteMany({ email: targetEmail, purpose: "forgotPassword" });
    throw new AppError(502, "Could not send the OTP email. Please try again.", "EMAIL_SEND_FAILED");
  }

  return {
    maskedEmail: maskEmail(targetEmail),
  };
}

export async function verifyForgotPasswordOtp(
  lookup: ForgotPasswordLookup,
  otp: string
): Promise<string> {
  const { user, targetEmail } = await resolveUserForPasswordReset(lookup);

  const record = await Otp.findOne({ email: targetEmail, purpose: "forgotPassword" });
  if (!record || record.expireAt.getTime() < Date.now()) {
    throw new AppError(400, "OTP expired or not requested", "OTP_INVALID");
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    throw new AppError(429, "Too many incorrect attempts. Request a new OTP.", "OTP_ATTEMPTS_EXCEEDED");
  }

  if (!safeEqualHex(record.otpHash, hashOtp(targetEmail, otp))) {
    record.attempts += 1;
    await record.save();
    throw new AppError(400, "Incorrect OTP", "OTP_INVALID");
  }

  await record.deleteOne();
  return signPasswordResetToken(user._id.toString(), targetEmail);
}
