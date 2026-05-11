import express from "express";
import Pharmacy from "../models/Pharmacy.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";

import pharmacyAuth from "../middleware/pharmacyAuth.js";
import { fileURLToPath } from "url";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const router = express.Router();

// ================= __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= UPLOAD DIR =================
const uploadDir = path.join(__dirname, "../pharmacyUploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ----------------------------------------
   MULTER CONFIG
----------------------------------------- */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
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

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    const pharmacy = new Pharmacy({
      name,
      email,
      password: hashed,
    });

    await pharmacy.save();

    if (req.io) {
      req.io.emit("analyticsUpdated");
    }

    res.status(201).send("Pharmacy registered successfully");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const pharmacy = await Pharmacy.findOne({ email });

    if (!pharmacy)
      return res.status(400).send("Invalid email or password");

    const match = await bcrypt.compare(password, pharmacy.password);

    if (!match)
      return res.status(400).send("Invalid email or password");

    const token = jwt.sign(
      { id: pharmacy._id, role: "pharmacy" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    if (!pharmacy.profileCompleted) {
      return res.json({
        token,
        role: "pharmacy",
        name: pharmacy.name,
        id: pharmacy._id,
        profileCompleted: pharmacy.profileCompleted,
        verified: pharmacy.verified,
        redirectTo: "/pharmacy/complete-profile",
      });
    }

    if (!pharmacy.verified) {
      return res.json({
        token,
        role: "pharmacy",
        name: pharmacy.name,
        id: pharmacy._id,
        profileCompleted: pharmacy.profileCompleted,
        verified: pharmacy.verified,
        redirectTo: "/pharmacy/pending-verification",
      });
    }

    return res.json({
      token,
      role: "pharmacy",
      name: pharmacy.name,
      id: pharmacy._id,
      profileCompleted: pharmacy.profileCompleted,
      verified: pharmacy.verified,
      redirectTo: "/pharmacy",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= GET BY ID =================
router.get("/:id", async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy)
      return res.status(404).json({ message: "Pharmacy not found" });

    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------------------------------
   COMPLETE PROFILE
----------------------------------------- */
router.put(
  "/complete-profile/:id",
  pharmacyAuth,
  upload.fields([
    { name: "pharmacistAadharCard", maxCount: 1 },
    { name: "pharmacistCertificate", maxCount: 1 },
    { name: "pharmacistPhoto", maxCount: 1 },
    { name: "licenseCertificateImage", maxCount: 1 },
    { name: "storeImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        pharmacistName,
        pharmacistRegistrationNo,
        pharmacistPhone,
        gender,
        pincode,
        state,
        district,
        city,
        pharmacyName,
        pharmaPhone,
        pharmacyAddress,
        licenseNumber,
        gstNumber,
        timings,
      } = req.body;

      const files = req.files;

      // VALIDATION
      if (
        !pharmacistName ||
        !pharmacistRegistrationNo ||
        !pharmacistPhone ||
        !gender ||
        !pincode ||
        !state ||
        !city
      ) {
        return res
          .status(400)
          .json({ message: "Pharmacist details missing" });
      }

      if (
        !pharmacyName ||
        !pharmaPhone ||
        !pharmacyAddress ||
        !licenseNumber
      ) {
        return res
          .status(400)
          .json({ message: "Pharmacy details missing" });
      }

      const updateData = {
        name: pharmacistName,
        pharmacistRegistrationNo,
        pharmacistPhone,
        gender,
        pincode,
        state,
        district,
        city,

        pharmacistAadhar: files.pharmacistAadharCard
          ? `/pharmacyUploads/${files.pharmacistAadharCard[0].filename}`
          : undefined,

        pharmacistCertificate: files.pharmacistCertificate
          ? `/pharmacyUploads/${files.pharmacistCertificate[0].filename}`
          : undefined,

        pharmacistPhoto: files.pharmacistPhoto
          ? `/pharmacyUploads/${files.pharmacistPhoto[0].filename}`
          : undefined,

        pharmacyName,
        pharmaPhone,
        pharmacyAddress,
        licenseNumber,
        gstNumber,
        timings,

        licenseCertificateImage: files.licenseCertificateImage
          ? `/pharmacyUploads/${files.licenseCertificateImage[0].filename}`
          : undefined,

        storeImage: files.storeImage
          ? `/pharmacyUploads/${files.storeImage[0].filename}`
          : undefined,

        profileCompleted: true,
        verified: false,
      };

      const updated = await Pharmacy.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      if (!updated)
        return res.status(404).json({ message: "Pharmacy not found" });

      return res.status(200).json({
        message: "Profile submitted successfully!",
        redirectTo: "/pharmacy/pending-verification",
      });
    } catch (err) {
      console.error("Error updating pharmacy profile:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ================= MY PROFILE =================
router.get("/my-profile", pharmacyAuth, async (req, res) => {
  try {
    const id = req.user.id;

    const pharmacy = await Pharmacy.findById(id);

    if (!pharmacy) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});



// ================= GET ALL PHARMACIES =================
router.get("/", async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      verified: true,
      profileCompleted: true
    })
    .select("pharmacyName pharmaPhone pharmacyAddress city state")
    .sort({ createdAt: -1 });

    res.status(200).json({
      pharmacies   
    });

  } catch (error) {
    console.error("Error fetching pharmacies:", error);
    res.status(500).json({ message: "Failed to fetch pharmacies" });
  }
});

export default router;