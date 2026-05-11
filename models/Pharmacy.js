import mongoose from "mongoose";

const pharmacySchema = new mongoose.Schema(
  {
    // Basic info
    email: { type: String, unique: true },
    password: { type: String, required: true },

    // Pharmacist Details
    name: { type: String, required: true },
    gender: { type: String, default: "" },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    pincode: { type: String, default: "" },
    city: { type: String, default: "" },
    pharmacistRegistrationNo: { type: String, default: "" },
    pharmacistPhone: { type: String, default: "" },
    pharmacistCertificate: { type: String, default: "" },
    pharmacistAadhar: { type: String, default: "" },
    pharmacistPhoto: { type: String, default: "" },

    // Pharmacy Details
    pharmacyName: { type: String, default: "" },
    pharmaPhone: { type: String, default: "" },
    pharmacyAddress: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    licenseCertificateImage: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    timings: { type: String, default: "" },
    storeImage: { type: String, default: "" },

    // Status flags
    profileCompleted: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Prevent model overwrite
const Pharmacy =
  mongoose.models.Pharmacy || mongoose.model("Pharmacy", pharmacySchema);

export default Pharmacy;