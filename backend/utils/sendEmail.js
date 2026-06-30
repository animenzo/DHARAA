const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (to, resetUrl) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev", // default test sender
      to: to,
      subject: "Reset Your Password",
      html: `
        <div style="font-family:sans-serif">
          <h2>Password Reset 🔐</h2>
          <p>Click the button below to reset your password:</p>

          <a href="${resetUrl}"
             style="background:#000;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
             Reset Password
          </a>

          <p>This link expires in 10 minutes.</p>
        </div>
      `
    });

    console.log("✅ Email sent via Resend");

  } catch (err) {
    console.error("❌ Resend error:", err);
    throw err;
  }
};
