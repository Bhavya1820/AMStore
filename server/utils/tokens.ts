import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AccessTokenPayload, RegistrationTokenPayload } from "../types/auth";
import { AppError } from "./AppError";

export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TOKEN_TTL_DAYS = 7;

const secret = (name: "JWT_SECRET" | "REGISTRATION_TOKEN_SECRET"): string => {
  const value = process.env[name];
  if (!value) throw new AppError(500, `${name} is not configured`);
  return value;
};

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, secret("JWT_SECRET"), { expiresIn: "15m", subject: payload.userId, algorithm: "HS256" });

export const verifyAccessToken = (token: string): AccessTokenPayload & jwt.JwtPayload => {
  const decoded = jwt.verify(token, secret("JWT_SECRET"), { algorithms: ["HS256"] });
  if (typeof decoded === "string" || !decoded.userId) {
    throw new Error("Malformed token");
  }
  return decoded as AccessTokenPayload & jwt.JwtPayload;
};

export const signRegistrationToken = (email: string): string => {
  const payload: RegistrationTokenPayload = { email, purpose: "registration" };
  return jwt.sign(payload, secret("REGISTRATION_TOKEN_SECRET"), { expiresIn: "15m", algorithm: "HS256" });
};

export const verifyRegistrationToken = (token: string): RegistrationTokenPayload => {
  try {
    const decoded = jwt.verify(token, secret("REGISTRATION_TOKEN_SECRET"), { algorithms: ["HS256"] });
    if (typeof decoded === "string" || decoded.purpose !== "registration" || !decoded.email) {
      throw new Error("bad purpose");
    }
    return { email: decoded.email as string, purpose: "registration" };
  } catch {
    throw new AppError(401, "Registration session expired. Please verify your email again.", "REGISTRATION_TOKEN_INVALID");
  }
};

// Refresh tokens are opaque random strings; only their hash is stored
export const generateRefreshToken = (): string => crypto.randomBytes(48).toString("base64url");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const hashOtp = (email: string, otp: string): string =>
  crypto.createHmac("sha256", secret("REGISTRATION_TOKEN_SECRET")).update(`${email}:${otp}`).digest("hex");

export const safeEqualHex = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};
