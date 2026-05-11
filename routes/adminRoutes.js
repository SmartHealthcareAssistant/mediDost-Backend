import express from "express";
import Doctor from "../models/Doctor.js";
import sendVerificationEmail from "../utils/sendEmail.js";

const router = express.Router();

// =============================
// GET ALL DOCTORS
// =============================
router.get("/doctor", async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ createdAt: -1 });

    const mapped = doctors.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      specialization: doc.specialization,
      license: doc.license,
      location: doc.location,
      phone: doc.phone,

      status: doc.verified
        ? "Approved"
        : doc.profileCompleted
        ? doc.rejectionReason
          ? "Rejected"
          : "Pending"
        : "Incomplete",

      image: doc.image,
      idProof: doc.idProof,
      degree: doc.degree,
      certificates: doc.certificates,
      rejectionReason: doc.rejectionReason,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =============================
// APPROVE / REJECT DOCTOR
// =============================
router.put("/verify/:id", async (req, res) => {
  try {
    const { status, reason } = req.body;
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor)
      return res.status(404).json({ message: "Doctor not found" });

    // Prevent duplicate action
    if (
      (status === "Approved" && doctor.verified) ||
      (status === "Rejected" && doctor.rejectionReason)
    ) {
      return res.json({ message: "Already updated. Email not sent again." });
    }

    if (status === "Approved") {
      doctor.verified = true;
      doctor.rejectionReason = "";
    } else {
      doctor.verified = false;
      doctor.rejectionReason = reason || "Not specified";
    }

    await doctor.save();

    // 🔥 Safe socket emit
    if (req.io) {
      req.io.emit("analyticsUpdated");
    }

    // 🔥 Send email
    await sendVerificationEmail({
      name: doctor.name,
      email: doctor.email,
      status,
      reason,
    });

    // 🔥 Socket update
    if (req.io) {
      req.io
        .to(doctor._id.toString())
        .emit("verificationStatusUpdate", {
          status,
          message:
            status === "Approved"
              ? "✅ Your account is approved. Please login."
              : `❌ Your profile was rejected: ${reason}`,
        });
    }

    res.json({
      success: true,
      message: `Doctor ${status.toLowerCase()} successfully`,
    });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;