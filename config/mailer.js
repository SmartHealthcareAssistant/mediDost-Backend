// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
//   connectionTimeout: 10000,
//   greetingTimeout: 10000,
//   socketTimeout: 10000,
// });

// export default transporter;


// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   host: "smtp-relay.brevo.com",
//   port: 465,
//   secure: true,

//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },

//   tls: {
//     rejectUnauthorized: false,
//   },
// });

// transporter.verify((error, success) => {
//   if (error) {
//     console.log("SMTP VERIFY ERROR:", error);
//   } else {
//     console.log("SMTP SERVER READY");
//   }
// });

// export default transporter;




import axios from "axios";

const sendMail = async ({ to, subject, htmlContent }) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "MediDost",
          email: "smarthealthcareteam2025@gmail.com",
        },

        to: [
          {
            email: to,
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

    console.log("✅ Email sent:", response.data);
  } catch (error) {
    console.error(
      "❌ Brevo Email Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export default sendMail;