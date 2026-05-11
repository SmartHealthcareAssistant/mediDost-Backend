import express from "express";
import Doctor from "../models/Doctor.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";

const router = express.Router();

router.get("/analytics", async (req, res) => {
  try {
    // =============================
    // BASIC COUNTS
    // =============================
    const totalDoctors = await Doctor.countDocuments();
    const totalPharmacies = await Pharmacy.countDocuments();
    const totalPatients = await Patient.countDocuments();

    const verifiedDoctors = await Doctor.countDocuments({ verified: true });
    const pendingDoctors = await Doctor.countDocuments({
      verified: false,
      rejectionReason: "",
    });
    const rejectedDoctors = await Doctor.countDocuments({
      rejectionReason: { $ne: "" },
    });

    const verifiedPharmacies = await Pharmacy.countDocuments({
      verified: true,
    });
    const pendingPharmacies = await Pharmacy.countDocuments({
      verified: false,
      rejectionReason: "",
    });
    const rejectedPharmacies = await Pharmacy.countDocuments({
      rejectionReason: { $ne: "" },
    });

    const activePatients = await Patient.countDocuments({ active: true });
    const inactivePatients = await Patient.countDocuments({ active: false });

    // =============================
    // RESPONSE
    // =============================
    res.json({
      totalUsers: totalDoctors + totalPharmacies + totalPatients,
      verifiedUsers: verifiedDoctors + verifiedPharmacies,
      activeSessions: activePatients,
      newRegistrations: totalPatients,

      verificationStatus: [
        {
          name: "Verified",
          value: verifiedDoctors + verifiedPharmacies,
          color: "#28a745",
        },
        {
          name: "Pending",
          value: pendingDoctors + pendingPharmacies,
          color: "#ffc107",
        },
        {
          name: "Rejected",
          value: rejectedDoctors + rejectedPharmacies,
          color: "#dc3545",
        },
      ],

      monthlyActiveUsers: [
        { month: "Jan", active: 20 },
        { month: "Feb", active: 45 },
        { month: "Mar", active: 60 },
        { month: "Apr", active: 80 },
        { month: "May", active: 100 },
      ],

      registrationsByDept: [
        { name: "Doctors", count: totalDoctors },
        { name: "Pharmacy", count: totalPharmacies },
        { name: "Patients", count: totalPatients },
      ],
    });
  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;