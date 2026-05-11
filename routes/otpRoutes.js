import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

import redisClient from "../config/redis.js";
import transporter from "../config/mailer.js";

const router = express.Router();

const otpExpire = Number(process.env.OTP_EXPIRE_SECONDS) || 300;

// 🚨 Rate limiter (anti spam)
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many OTP requests. Try again later.",
});

// 🔢 Generate secure OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ===============================
//  SEND OTP
// ===============================
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    // ✅ Validate email
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const otp = generateOTP();

    // Hash OTP
    const hashedOtp = await bcrypt.hash(otp, 10);

    // ✅ Store in Redis safely
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(`otp:${email}`, otpExpire, hashedOtp);
      } else {
        console.log("⚠️ Redis not connected");
      }
    } catch (err) {
      console.log("❌ Redis error:", err.message);
    }

    console.log("📩 Sending OTP email...");

    // ✅ Send Email (FIXED BLOCK)
    try {
      await transporter.sendMail({
        from: `"MediDost" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your OTP Code",
        html: `
          <h2>Email Verification</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This OTP will expire in ${otpExpire / 60} minutes</p>
        `,
      });

      console.log("✅ Email sent successfully");
    } catch (err) {
      console.error("❌ EMAIL ERROR FULL:", err);

      // 🔥 fallback (optional debug)
      console.log("⚠️ OTP (fallback):", otp);

      return res.status(500).json({
        success: false,
        message: "Email sending failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (err) {
    console.error("❌ OTP error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

// ===============================
// ✅ VERIFY OTP
// ===============================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const blocked = await redisClient.get(`otp-block:${email}`);
    if (blocked) {
      return res
        .status(403)
        .json({ message: "Too many attempts. Try later." });
    }

    const storedHashedOtp = await redisClient.get(`otp:${email}`);

    if (!storedHashedOtp) {
      return res
        .status(400)
        .json({ message: "OTP expired or not found" });
    }

    const isMatch = await bcrypt.compare(otp, storedHashedOtp);

    if (!isMatch) {
      const attempts = await redisClient.incr(`otp-attempts:${email}`);
      await redisClient.expire(`otp-attempts:${email}`, 600);

      if (attempts >= 5) {
        await redisClient.setEx(`otp-block:${email}`, 600, "1");
        return res.status(403).json({
          message: "Too many attempts. Blocked for 10 minutes.",
        });
      }

      return res.status(400).json({
        message: `Invalid OTP. Attempts left: ${5 - attempts}`,
      });
    }

    // Success
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`otp-attempts:${email}`);
    await redisClient.del(`otp-block:${email}`);

    return res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ===============================
// 🔁 RESEND OTP
// ===============================
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const cooldown = await redisClient.get(`otp-cooldown:${email}`);
    if (cooldown) {
      return res.status(429).json({
        message: "Wait 30 seconds before resending OTP",
      });
    }

    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await redisClient.setEx(`otp:${email}`, otpExpire, hashedOtp);
    await redisClient.setEx(`otp-cooldown:${email}`, 30, "1");

    // ✅ Send Email safely
    try {
      await transporter.sendMail({
        from: `"MediDost" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Resend OTP Code",
        html: `
          <h2>Email Verification</h2>
          <h1>${otp}</h1>
          <p>Expires in ${otpExpire / 60} minutes.</p>
        `,
      });
    } catch (err) {
      console.error("❌ RESEND EMAIL ERROR:", err);
      console.log("⚠️ OTP fallback:", otp);

      return res.status(500).json({
        message: "Failed to resend OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    console.error("❌ RESEND ERROR:", err);
    res.status(500).json({ message: "Failed to resend OTP" });
  }
});

export default router;