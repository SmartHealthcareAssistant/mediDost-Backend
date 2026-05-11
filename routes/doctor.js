import express from "express";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";

import doctorAuth from "../middleware/doctorAuth.js";
import generateSlots from "../utils/slotGenerator.js";

import { fileURLToPath } from "url";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ================= __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= UPLOAD DIR =================
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ================= MULTER =================
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

// ================= APPOINTMENTS =================

router.get("/appointments", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.doctor.id;

    const appointments = await Appointment.find({ doctor: doctorId })
      .populate("patient", "name email phone address")
      .sort({ slotStart: 1 })
      .lean();

    res.status(200).json(appointments);
  } catch (err) {
    console.error("GET appointments error:", err);
    res.status(500).json({ message: "Failed to fetch doctor appointments" });
  }
});

router.put("/appointments/:id/accept", doctorAuth, async (req, res) => {
  try {
    const updatedAppt = await Appointment.findOneAndUpdate(
      {
        _id: req.params.id,
        doctor: req.doctor.id,
        status: { $in: ["Scheduled", "Pending"] },
      },
      { status: "Confirmed" },
      { new: true }
    ).populate("patient", "name email");

    if (!updatedAppt) {
      return res.status(404).json({
        message: "Appointment not found or already confirmed/cancelled.",
      });
    }

    if (req.io) {
      req.io
        .to(updatedAppt.patient._id.toString())
        .emit("appointmentUpdate", updatedAppt);
    }

    res.status(200).json({
      message: "Appointment confirmed",
      appointment: updatedAppt,
    });
  } catch (err) {
    console.error("Accept error:", err);
    res.status(500).json({ message: "Server error during acceptance" });
  }
});

router.put("/appointments/:id/reject", doctorAuth, async (req, res) => {
  try {
    const updatedAppt = await Appointment.findOneAndUpdate(
      {
        _id: req.params.id,
        doctor: req.doctor.id,
        status: { $in: ["Scheduled", "Pending"] },
      },
      { status: "Rejected" },
      { new: true }
    ).populate("patient", "name email");

    if (!updatedAppt) {
      return res.status(404).json({
        message: "Appointment not found or already processed.",
      });
    }

    if (req.io) {
      req.io
        .to(updatedAppt.patient._id.toString())
        .emit("appointmentUpdate", updatedAppt);
    }

    res.status(200).json({
      message: "Appointment rejected",
      appointment: updatedAppt,
    });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ message: "Server error during rejection" });
  }
});

// ================= SLOT =================
router.get("/:doctorId/slots", async (req, res) => {
  try {
    const slots = generateSlots(req.query.date);

    const doctor = await Doctor.findById(
  req.params.doctorId
);

const selectedDate = req.query.date;

if (
  doctor.unavailableDates?.includes(selectedDate)
) {
  return res.json({
    unavailable: true,
    slots: [],
    message:
      "Doctor is unavailable on this date",
  });
}


    const appointments = await Appointment.find({
      doctor: req.params.doctorId,
      date: new Date(req.query.date),
    });

    const availableSlots = slots.filter((slot) => {
      return !appointments.some(
        (appt) =>
          slot.slotStart < appt.slotEnd &&
          slot.slotEnd > appt.slotStart
      );
    });

    res.json(availableSlots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching slots" });
  }
});

// ================= PUBLIC =================

router.get("/", async (req, res) => {
  try {
    const { q, location } = req.query;
    const filter = {};

    if (location) filter.location = new RegExp(location, "i");

    if (q) {
      const re = new RegExp(q, "i");
      filter.$or = [
        { name: re },
        { specialization: re },
        { location: re },
      ];
    }

    const doctors = await Doctor.find(filter)
      .select(
        "name specialization experience location consultationFee phone available image verified rating numReviews"
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json(doctors);
  } catch (err) {
    console.error("Doctor fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// SEARCH
router.get("/search", async (req, res) => {
  try {
    const { location, specialization } = req.query;

    const filter = {};
    if (location) filter.location = new RegExp(location, "i");
    if (specialization)
      filter.specialization = new RegExp(specialization, "i");

    const doctors = await Doctor.find(filter).select(
      "name specialization experience location consultationFee phone available image rating numReviews"
    );

    res.json({ success: true, doctors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// REVIEWS
router.get("/reviews", doctorAuth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctor.id)
      .populate("reviews.patient", "name")
      .select("reviews rating numReviews");

    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET BY ID
router.get("/:id", async (req, res) => {
  try {
    const doc = await Doctor.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Doctor not found" });

    res.json(doc);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const existing = await Doctor.findOne({ email: req.body.email });
    if (existing)
      return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(req.body.password, 10);

    const doctor = await Doctor.create({
      ...req.body,
      password: hashed,
      profileCompleted: false,
      verified: false,
    });

    if (req.io) req.io.emit("analyticsUpdated");

    const token = jwt.sign(
      { id: doctor._id, role: "doctor" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Doctor registered successfully",
      id: doctor._id,
      token,
      role: "doctor",
      redirectTo: "/doctor/complete-profile",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ email: req.body.email }).select(
      "+password +profileCompleted +verified +name"
    );

    if (!doctor)
      return res.status(400).json({ message: "Invalid email or password" });

    const match = await bcrypt.compare(req.body.password, doctor.password);

    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: doctor._id, role: "doctor" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    let redirectTo = "/doctor";
    if (!doctor.profileCompleted) redirectTo = "/doctor/complete-profile";
    else if (!doctor.verified)
      redirectTo = "/doctor/pending-verification";

    res.json({
      token,
      role: "doctor",
      name: doctor.name,
      id: doctor._id,
      profileCompleted: doctor.profileCompleted,
      verified: doctor.verified,
      redirectTo,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= COMPLETE PROFILE =================
router.put(
  "/complete-profile/:id",
  upload.fields([
    { name: "image" },
    { name: "idProof" },
    { name: "license" },
    { name: "degree" },
    { name: "certificates" },
  ]),
  async (req, res) => {
    try {
      const files = req.files;

      const updatedDoctor = await Doctor.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          image: files.image
            ? `/uploads/${files.image[0].filename}`
            : undefined,
          idProof: files.idProof
            ? `/uploads/${files.idProof[0].filename}`
            : undefined,
          license: files.license
            ? `/uploads/${files.license[0].filename}`
            : undefined,
          degree: files.degree
            ? `/uploads/${files.degree[0].filename}`
            : undefined,
          certificates: files.certificates
            ? `/uploads/${files.certificates[0].filename}`
            : undefined,
          profileCompleted: true,
          verified: false,
        },
        { new: true }
      );

      if (req.io) {
        req.io.emit("doctorProfileCompleted", {
          id: updatedDoctor._id,
          name: updatedDoctor.name,
          email: updatedDoctor.email,
          specialization: updatedDoctor.specialization,
        });
      }

      res.json({
        message: "Profile submitted successfully",
        redirectTo: "/doctor/pending-verification",
      });
    } catch (err) {
      console.error("Profile error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);



// ================= DOCTOR AVAILABILITY =================

// Mark unavailable date
router.put(
  "/availability/unavailable",
  doctorAuth,
  async (req, res) => {
    try {
      const { date } = req.body;

      if (!date) {
        return res
          .status(400)
          .json({ message: "Date required" });
      }

      const doctor = await Doctor.findById(req.doctor.id);

      if (!doctor.unavailableDates) {
        doctor.unavailableDates = [];
      }

      if (!doctor.unavailableDates.includes(date)) {
        doctor.unavailableDates.push(date);
      }

      await doctor.save();

      res.json({
        message: "Doctor marked unavailable",
        unavailableDates: doctor.unavailableDates,
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// Mark available again
router.put(
  "/availability/available",
  doctorAuth,
  async (req, res) => {
    try {
      const { date } = req.body;

      const doctor = await Doctor.findById(req.doctor.id);

      doctor.unavailableDates =
        doctor.unavailableDates.filter(
          (d) => d !== date
        );

      await doctor.save();

      res.json({
        message: "Doctor available again",
        unavailableDates: doctor.unavailableDates,
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

export default router;