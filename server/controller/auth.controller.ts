import jwt from "jsonwebtoken"
import User from "../models/User"
import Otp from "../models/Otp"
import { Request, Response } from "express"
import bcrypt from "bcryptjs";
import { generateOtp } from "../utils/otp"
import { sendOtpEmail } from "../services/email.service"

export const sendRegistrationOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    const normalizedEmail = email.toLowercase().trim();

    //Checking existing account
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(409).json({ message: "An Account with this email is already exists" });
    }

    //Generate OTP
    const otp = generateOtp();

    //Hash otp
    const otpHash = await bcrypt.hash(otp, 10);

    //Remove previous registration otp
    await Otp.deleteMany({
      email: normalizedEmail,
      purpose: "registration"
    });

    //Save Otp
    await Otp.create({
      email: normalizedEmail,
      otpHash,
      purpose: "registration",
      expireAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0
    })

    //Send Email
    await sendOtpEmail(normalizedEmail, otp);

    return res.status(200).json({ messsage: "OTP sent successfully" });
  } catch (error) {
    console.error("Send registration OTP error:", error);
    return res.status(500).json({ message: "Failed to send otp" })
  }
}



