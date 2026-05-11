import express from "express";
import Pharmacy from "../models/Pharmacy.js";
import sendVerificationEmail from "../utils/sendPharmacyEmail.js";

const router = express.Router();

// =============================
// GET ALL PHARMACIES
// =============================
router.get("/pharmacy", async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().sort({ createdAt: -1 });

    const mapped = pharmacies.map((p) => ({
      id: p._id.toString(), // 🔥 important fix
      name: p.pharmacyName || p.name,
      owner: p.name,
      license: p.licenseNumber,
      phone: p.pharmaPhone,

      status: p.verified
        ? "Approved"
        : p.profileCompleted
        ? p.rejectionReason
          ? "Rejected"
          : "Pending"
        : "Incomplete",

      pharmacistAadhar: p.pharmacistAadhar,
      pharmacistCertificate: p.pharmacistCertificate,
      pharmacistPhoto: p.pharmacistPhoto,
      storeImage: p.storeImage,
      licenseCertificateImage: p.licenseCertificateImage,
      rejectionReason: p.rejectionReason,
    }));

    res.json(mapped);
  } catch (error) {
    console.log("Error fetching pharmacies:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// =============================
// APPROVE / REJECT PHARMACY
// =============================
router.put("/verify-pharmacy/:id", async (req, res) => {
  try {
    const { status, reason } = req.body;
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy)
      return res.status(404).json({ message: "Not found" });

    if (status === "Approved") {
      pharmacy.verified = true;
      pharmacy.rejectionReason = "";
    } else {
      pharmacy.verified = false;
      pharmacy.rejectionReason = reason || "Not specified";
    }

    await pharmacy.save();

    // 🔥 Safe socket emit
    if (req.io) {
      req.io.emit("analyticsUpdated");
    }

    // 🔥 Send email
    await sendVerificationEmail({
      pharmacyName: pharmacy.pharmacyName || pharmacy.name,
      ownerName: pharmacy.name,
      email: pharmacy.email,
      status,
      reason,
    });

    // 🔥 Socket notify pharmacy
    if (req.io) {
      req.io
        .to(pharmacy._id.toString())
        .emit("pharmacyVerificationUpdate", {
          status,
          message:
            status === "Approved"
              ? "✅ Your account is approved. Please login."
              : `❌ Your profile was rejected: ${reason}`,
        });
    }

    res.json({
      success: true,
      message: `Pharmacy ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.log("Verify error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;