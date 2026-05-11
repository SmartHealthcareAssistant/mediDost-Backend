import express from "express";
import Pharmacy from "../models/Pharmacy.js";

const router = express.Router();

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
      pharmacies   // ✅ important
    });

  } catch (error) {
    console.error("Error fetching pharmacies:", error);
    res.status(500).json({ message: "Failed to fetch pharmacies" });
  }
});

export default router;