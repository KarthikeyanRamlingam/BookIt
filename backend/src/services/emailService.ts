import nodemailer from "nodemailer";

// Reused across the app. If SMTP env vars are missing (e.g. local dev
// without a mail provider configured), we log instead of throwing, so the
// booking flow never breaks just because notifications aren't set up yet.
const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transporter) {
    console.log(`[email:skipped, no SMTP configured] to=${to} subject="${subject}"`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Appointment Platform <no-reply@example.com>",
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}