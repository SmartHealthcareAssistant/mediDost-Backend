import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "3d" });

// REGISTER ADMIN
export const registerAdmin = async (req, res) => {
  try {
    console.log("📩 Register request received:", req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existing = await Admin.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Admin already registered" });

    const admin = await Admin.create({ name, email, password });
    console.log("✅ New Admin Created:", admin.email);

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// LOGIN ADMIN
export const loginAdmin = async (req, res) => {
  try {
    console.log("📩 Login request:", req.body);
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin)
      return res.status(400).json({ message: "Invalid credentials" });

    const match = await admin.matchPassword(password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(admin._id);

    res.json({
      message: "Login successful",
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};