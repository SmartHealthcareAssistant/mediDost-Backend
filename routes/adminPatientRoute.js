import express from "express";
import Patient from "../models/Patient.js";
import sendPatientEmail from "../utils/patientEmail.js";

const router = express.Router();

// ========================================
// FETCH ALL PATIENTS
// ========================================
router.get("/patients", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });

    const mapped = patients.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      email: p.email,
      active: p.active,
      identifier: "PT-" + p._id.toString().slice(-4).toUpperCase(),
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Patient Fetch Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// TOGGLE PATIENT (ACTIVATE/DEACTIVATE)
// ========================================
router.put("/patient/toggle/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    patient.active = !patient.active;
    await patient.save();

    // 🔥 Emit analytics update
    req.io.emit("analyticsUpdated");

    // 🔥 Socket.io notification
    req.io.emit("patientStatusChanged", {
      id: patient._id.toString(),
      name: patient.name,
      email: patient.email,
      active: patient.active,
    });

    // 🔥 Send email
    await sendPatientEmail({
      name: patient.name,
      email: patient.email,
      status: patient.active ? "Activated" : "Deactivated",
    });

    res.json({ success: true, active: patient.active });
  } catch (err) {
    console.error("Toggle Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;