import transporter from "../config/mail";

export const sendOtpEmail = async (
  email: string,
  otp: string
) => {
  await transporter.sendMail({
    from: `"Your SaaS" <${process.env.MAIL_USER}>`,
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
  })
}