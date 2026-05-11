import express from "express";
import Doctor from "../models/Doctor.js";
import patientAuth from "../middleware/patientAuth.js";

const router = express.Router();

// ================= ADD / UPDATE REVIEW =================
router.post("/:doctorId", patientAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const doctorId = req.params.doctorId;
    const patientId = req.patient.id;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor)
      return res.status(404).json({ message: "Doctor not found" });

    const existingReview = doctor.reviews.find(
      (r) => r.patient.toString() === patientId
    );

    if (existingReview) {
      // 🔁 UPDATE
      existingReview.rating = rating;
      existingReview.comment = comment;
    } else {
      // ➕ NEW
      doctor.reviews.push({
        patient: patientId,
        rating,
        comment,
      });
    }

    // ⭐ Recalculate
    doctor.numReviews = doctor.reviews.length;
    doctor.rating =
      doctor.reviews.reduce((acc, item) => acc + item.rating, 0) /
      doctor.reviews.length;

    await doctor.save();

    res.json({
      message: "Review submitted",
      rating: doctor.rating,
      numReviews: doctor.numReviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;