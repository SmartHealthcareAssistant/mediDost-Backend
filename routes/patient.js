import express from "express";
import Patient from "../models/Patient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  try {
    const existing = await Patient.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const patient = new Patient({ name, email, password: hashed });
    await patient.save();

    // 🔥 analytics update (preserved)
    if (req.io) {
      req.io.emit("analyticsUpdated");
    }

    // 🔔 notify admin via socket.io
    if (req.io) {
      req.io.emit("newPatientRegistered", {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
      });
    }

    return res.status(201).json({
      message: "Patient registered successfully",
      id: patient._id,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const patient = await Patient.findOne({ email });
    if (!patient)
      return res.status(400).send("Invalid email or password");

    // ❗ block if deactivated
    if (!patient.active) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact admin.",
      });
    }

    const match = await bcrypt.compare(password, patient.password);
    if (!match)
      return res.status(400).send("Invalid email or password");

    const token = jwt.sign(
      { id: patient._id, role: "patient" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      role: "patient",
      name: patient.name,
      id: patient._id,
      redirectTo: "/patient",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;