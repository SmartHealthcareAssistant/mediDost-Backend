import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

import Prescription from "../models/Prescription.js";
import { fileURLToPath } from "url";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ================= __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= TOKEN VERIFY =================
const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authorization Denied: Token Missing" });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);

    req.user = verified;
    req.doctorId = verified.role === "doctor" ? verified.id : null;

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

// ================= MULTER SETUP =================
const uploadDir = path.join(__dirname, "../prescriptionUploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ================= CREATE PRESCRIPTION =================
router.post(
  "/",
  verifyToken,
  upload.single("additionalFile"),
  async (req, res) => {
    if (req.user.role !== "doctor" || !req.user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not authorized as a doctor." });
    }

    try {
      const { patient, notes, title, medicines: medicinesJson } = req.body;

      console.log("BODY:", req.body);

      let medicines = [];
      try {
        medicines = medicinesJson ? JSON.parse(medicinesJson) : [];
      } catch (err) {
        return res
          .status(400)
          .json({ message: "Invalid medicines format" });
      }

      const filePath = req.file
        ? `http://localhost:5000/api/prescriptionUploads/${req.file.filename}`
        : null;

      const newPrescription = new Prescription({
        patient,
        doctor: req.user.id,
        medicines,
        notes,
        title,
        files: filePath ? [filePath] : [],
      });

      await newPrescription.save();

      res.status(201).json({
        message: "Prescription saved successfully",
        data: newPrescription,
      });
    } catch (error) {
      console.error("FULL ERROR:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

// ================= GET PRESCRIPTIONS =================
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const prescriptions = await Prescription.find({
      patient: req.user.id,
    })
      .populate("doctor", "name specialization")
      .sort({ createdAt: -1 });

    res.status(200).json(prescriptions);
  } catch (err) {
    console.error("Fetch prescription error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;