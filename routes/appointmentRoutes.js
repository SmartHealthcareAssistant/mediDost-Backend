import express from "express";
import Appointment from "../models/Appointment.js";

const router = express.Router();

// =============================
// GET PATIENT APPOINTMENTS
// =============================
router.get("/appointments", async (req, res) => {
  try {
    // ⚠️ Ensure req.user exists (from auth middleware)
    const patientId = req.user?.id;

    if (!patientId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const appointments = await Appointment.find({ patient: patientId })
      .populate("doctor") // 🔥 important for doctor details
      .sort({ time: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error(
      "CRITICAL 500 ERROR IN APPOINTMENT ROUTE:",
      error
    );
    res.status(500).json({
      message: "Internal server error while fetching appointments",
    });
  }
});

export default router;