import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent folder
dotenv.config({ path: path.join(__dirname, "../.env") });

// 🕒 Track recently sent emails
const lastSent = new Map();

/**
 * Sends approval or rejection email to Pharmacy
 */
async function sendPharmacyEmail({
  pharmacyName,
  ownerName,
  email,
  status,
  reason = "",
}) {
  const now = Date.now();

  // Prevent duplicate emails within 1 minute
  if (lastSent.has(email) && now - lastSent.get(email) < 60000) {
    console.log(`⏳ Skipping duplicate email to ${email} within 1 minute`);
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

  if (status === "Approved") {
    subject = "✅ Your Pharmacy Portal is Activated";

    html = `
      <div style="font-family:Arial, sans-serif; line-height:1.5;">
        <h2 style="color:#2e7d32;">Pharmacy Portal Activated</h2>

        <p>Dear <strong>${ownerName}</strong>,</p>

        <p>Your pharmacy <strong>${pharmacyName}</strong> has been 
        <b>successfully approved</b> on the Smart Healthcare Platform.</p>

        <p>You can now log in and access your dashboard:</p>

        <p>
          <a href="http://localhost:3000/pharmacy/login" 
            style="background:#4CAF50;color:white;padding:10px 15px;
            text-decoration:none;border-radius:5px;display:inline-block;margin-top:8px;">
            Login Now
          </a>
        </p>

        <p>Regards,<br/>Smart Healthcare Admin Team</p>
      </div>
    `;
  } else {
    subject = "❌ Pharmacy Registration Rejected";

    html = `
      <div style="font-family:Arial, sans-serif; line-height:1.5;">
        <h2 style="color:#c62828;">Pharmacy Registration Update</h2>

        <p>Dear <strong>${ownerName}</strong>,</p>

        <p>Your registration for <strong>${pharmacyName}</strong> has been <b>rejected</b>.</p>

        <p><b>Reason:</b> ${reason || "Not specified by admin."}</p>

        <p>If you believe this is a mistake, please contact the admin.</p>

        <p>Regards,<br/>Smart Healthcare Admin Team</p>
      </div>
    `;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Smart Healthcare" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error(`❌ Error sending pharmacy email to ${email}:`, error);
  }
}

export default sendPharmacyEmail;