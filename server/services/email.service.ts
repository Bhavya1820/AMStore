import transporter from "../config/mail";

export const sendOtpEmail = async (
  email: string,
  otp: string
) => {
  await transporter.sendMail({
    from: `"AM Store" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Your Registration OTP",
    html: `
      <div>
        <h2>Verify your email</h2>

        <p>Your OTP is:</p>

        <h1>${otp}</h1>

        <p>
          This OTP will expire in 5 minutes.
        </p>

        <p>
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `,
  });
};

export const sendPasswordResetOtpEmail = async (
  email: string,
  otp: string,
  userName?: string
) => {
  await transporter.sendMail({
    from: `"AM Store" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Password Reset OTP - AM Store",
    html: `
      <div>
        <h2>Reset your password</h2>
        ${userName ? `<p>Hello <strong>${userName}</strong>,</p>` : ""}
        <p>Use the following OTP to reset your AM Store password:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
};
