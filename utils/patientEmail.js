import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env file
dotenv.config({ path: path.join(__dirname, "../.env") });

// 🕒 Prevent duplicate email within 1 minute
const lastSent = new Map();

async function sendPatientEmail({ name, email, status }) {
  const now = Date.now();

  if (lastSent.has(email) && now - lastSent.get(email) < 60000) {
    console.log(`⏳ Skipping duplicate email to ${email}`);
    return;
  }

  lastSent.set(email, now);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let subject, html;

  if (status === "Activated") {
    subject = "Your Patient Portal Is Activated";

    html = `
      <div style="font-family:Arial; line-height:1.6;">
        <h2 style="color:#2e7d32;">Account Activated</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your Smart Health patient account is now <b>activated</b>.</p>
        <a href="http://localhost:3000/patient/login" 
          style="background:#4CAF50;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">
          Login Now
        </a>
        <p>Regards,<br/>Smart Health Portal Team</p>
      </div>
    `;
  } else {
    subject = "Your Patient Portal Is Deactivated";

    html = `
      <div style="font-family:Arial; line-height:1.6;">
        <h2 style="color:#c62828;">Account Deactivated</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your patient account has been <b>deactivated</b> due to inactivity or admin review.</p>
        <p>Please contact admin for help.</p>
        <p>Regards,<br/>Smart Health Portal Team</p>
      </div>
    `;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Smart Health Portal" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    console.log(`📨 Patient Email Sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("❌ Email Error:", error);
  }
}

export default sendPatientEmail;