import express from "express";
import mongoose from "mongoose";

import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import patientAuth from "../middleware/patientAuth.js";

const router = express.Router();

// ================= GET /api/patient/me =================
router.get("/me", patientAuth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.patient.id)
      .select("-password -__v")
      .lean();

    res.json(patient);
  } catch (err) {
    console.error("GET /api/patient/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= PUT /api/patient/me =================
router.put("/me", patientAuth, async (req, res) => {
  try {
    const updates = {};

    if (req.body.name) updates.name = req.body.name;
    if (req.body.phone)
      updates.phone = String(req.body.phone).replace(/\D/g, "");
    if (req.body.address) updates.address = req.body.address;

    const patient = await Patient.findByIdAndUpdate(
      req.patient.id,
      updates,
      { new: true }
    ).select("-password -__v");

    res.json({ message: "Updated", patient });
  } catch (err) {
    console.error("PUT /api/patient/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= GET /appointments =================
router.get("/appointments", patientAuth, async (req, res) => {
  try {
    const { address } = req.query;

    const match = { patient: req.patient.id };

    let appts = await Appointment.find(match)
      .populate("doctor", "name specialization location phone image")
      .sort({ time: -1 })
      .lean();

    if (address) {
      appts = appts.filter((a) =>
        (a.doctor?.location || "")
          .toLowerCase()
          .includes(address.toLowerCase())
      );
    }

    res.json(appts);
  } catch (err) {
    console.error("GET /api/patient/appointments error:", err);
    console.error("500 ERROR DETAILS:", err);
    res
      .status(500)
      .json({ message: "Server error during appointment fetch" });
  }
});

// ================= POST /appointments =================
router.post("/appointments", patientAuth, async (req, res) => {
  try {
    const { doctor, time, title, notes } = req.body;

    if (!doctor)
      return res.status(400).json({ message: "doctor is required" });

    // const appt = new Appointment({
    //   doctor,
    //   patient: req.patient.id,
    //   time: time ? new Date(time) : Date.now(),
    //   title: title || "",
    //   notes: notes || "",
    //   status: "Scheduled",
    // });

    // await appt.save();
    // await appt.populate(
    //   "doctor",
    //   "name specialization location phone image"
    // );



const appt = await Appointment.findOneAndUpdate(
  {
    doctor,
    patient: req.patient.id,
    status: { $in: ["Locked", "Pending Payment"] }
  },
  {
    notes: notes || "",
  },
  { new: true }
).populate(
  "doctor",
  "name specialization location phone image"
);

    if (!appt) {
      return res.status(404).json({
        message: "No locked appointment found"
      });
    }



    res.status(201).json(appt);

    // optional socket
    // if (req.io) req.io.to(doctor.toString()).emit("newAppointment", appt);
  } catch (err) {
    console.error("POST /api/patient/appointments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= GET /prescriptions =================
router.get("/prescriptions", patientAuth, async (req, res) => {
  try {
    const pres = await Prescription.find({
      patient: req.patient.id,
    })
      .populate("doctor", "name specialization")
      .sort({ createdAt: -1 })
      .lean();

    res.json(pres);
  } catch (err) {
    console.error("GET /api/patient/prescriptions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;