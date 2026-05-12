import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const lastSent = new Map();

/**
 * Sends approval or rejection email to doctor
 */
async function sendVerificationEmail({
  name,
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

  let subject, htmlContent;

  if (status === "Approved") {
    subject = "✅ Your Smart Healthcare Portal is Activated";

    htmlContent = `
      <div style="font-family:Arial, sans-serif; line-height:1.5;">
        <h2 style="color:#2e7d32;">Smart Healthcare Portal Activated</h2>

        <p>Dear <strong>Dr. ${name}</strong>,</p>

        <p>Your portal has been <b>successfully activated</b>.</p>

        <p>
          <a 
            href="https://your-frontend.vercel.app/login"
            style="
              background:#4CAF50;
              color:white;
              padding:10px 15px;
              text-decoration:none;
              border-radius:5px;
              display:inline-block;
            "
          >
            Login Now
          </a>
        </p>

        <p>Regards,<br/>Smart Healthcare Admin Team</p>
      </div>
    `;
  } else {
    subject = "❌ Smart Healthcare Portal Registration Rejected";

    htmlContent = `
      <div style="font-family:Arial, sans-serif; line-height:1.5;">
        <h2 style="color:#c62828;">Smart Healthcare Registration Update</h2>

        <p>Dear <strong>Dr. ${name}</strong>,</p>

        <p>Your portal registration has been <b>rejected</b>.</p>

        <p><b>Reason:</b> ${reason || "Not specified by admin."}</p>

        <p>Please contact admin for clarification.</p>

        <p>Regards,<br/>Smart Healthcare Admin Team</p>
      </div>
    `;
  }

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",

      {
        sender: {
          name: "Smart Healthcare",
          email: "smarthealthcareteam2025@gmail.com",
        },

        to: [
          {
            email,
          },
        ],

        subject,
        htmlContent,
      },

      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    console.log(`✅ Doctor email sent to ${email}`);
    console.log(response.data);

  } catch (error) {
    console.error(
      `❌ Error sending doctor email to ${email}:`,
      error.response?.data || error.message
    );
  }
}

export default sendVerificationEmail;