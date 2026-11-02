import { Router, Request, Response, CookieOptions } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  registerOwner,
  login,
  refreshSession,
  logout,
  changePassword,
  getProfile,
  Session,
  SessionMeta,
} from "../services/auth.service";
import { requestRegistrationOtp, verifyRegistrationOtp } from "../services/otp.service";
import { toUserDto } from "../services/user.service";
import { authenticateAllowPasswordChange } from "../middleware/authMiddleware";
import { emailSchema, passwordSchema, nameSchema } from "../utils/validation";
import { AppError } from "../utils/AppError";
import { REFRESH_TOKEN_TTL_DAYS } from "../utils/tokens";

const router = Router();

const limiter = (windowMinutes: number, limit: number) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
  });

const otpLimiter = limiter(15, 10);
const loginLimiter = limiter(15, 30);

const REFRESH_COOKIE = "refreshToken";
const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
});

const meta = (req: Request): SessionMeta => ({ ip: req.ip, userAgent: req.get("user-agent") });

function sendSession(res: Response, session: Session) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...refreshCookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  return {
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresInSeconds,
  };
}

/* ------------------------------- registration ------------------------------ */

router.post("/register/send-otp", otpLimiter, async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  await requestRegistrationOtp(email);
  res.json({ message: "OTP sent to your email" });
});

router.post("/register/verify-otp", otpLimiter, async (req, res) => {
  const { email, otp } = z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const registrationToken = await verifyRegistrationOtp(email, otp);
  res.json({ registrationToken });
});

router.post("/register", otpLimiter, async (req, res) => {
  const body = z
    .object({
      registrationToken: z.string().min(1),
      ownerName: nameSchema,
      password: passwordSchema,
      tenantName: nameSchema,
      storeName: nameSchema,
      storeEmail: emailSchema.optional(),
      phone: z.string().trim().min(7).max(20).optional(),
      address: z.string().trim().max(300).optional(),
      gstIn: z.string().trim().length(15, "GSTIN must be 15 characters").optional(),
    })
    .parse(req.body);

  const { session, user, role, store } = await registerOwner(body, meta(req));
  res.status(201).json({
    ...sendSession(res, session),
    user: toUserDto(user, role),
    store: { id: store._id.toString(), name: store.name, storeCode: store.storeCode },
  });
});

/* ----------------------------------- login ---------------------------------- */

const loginSchema = z.union([
  z.object({ email: emailSchema, password: z.string().min(1).max(72) }),
  z.object({
    storeCode: z.string().trim().min(1).max(30),
    userName: z.string().trim().min(1).max(100),
    password: z.string().min(1).max(72),
  }),
]);

router.post("/login", loginLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const { session, user, role } = await login(body, meta(req));
  res.json({
    ...sendSession(res, session),
    mustChangePassword: user.mustChangePassword,
    user: toUserDto(user, role),
  });
});

/* --------------------------------- sessions --------------------------------- */

router.post("/refresh", loginLimiter, async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token || typeof token !== "string") {
    throw new AppError(401, "No refresh token", "REFRESH_INVALID");
  }
  try {
    const session = await refreshSession(token, meta(req));
    res.json(sendSession(res, session));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    throw err;
  }
});

router.post("/logout", async (req, res) => {
  await logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ message: "Logged out" });
});

router.get("/me", authenticateAllowPasswordChange, async (req, res) => {
  const { user, role, permissions } = await getProfile(req.auth!.userId);
  res.json({ user: toUserDto(user, role), permissions });
});

router.post("/change-password", authenticateAllowPasswordChange, loginLimiter, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1).max(72), newPassword: passwordSchema })
    .parse(req.body);
  const session = await changePassword(req.auth!.userId, currentPassword, newPassword, meta(req));
  res.json({ message: "Password changed", ...sendSession(res, session) });
});

export default router;
