import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    title: {
      type: String,
      default: "Prescription",
    },

    medicines: [
      {
        name: { type: String, required: true },
        dosage: { type: String },     // e.g. 500mg
        timing: { type: String },     // e.g. morning/evening
        duration: { type: String },   // e.g. 5 days
      },
    ],

    notes: {
      type: String,
      default: "",
    },

    files: [{ type: String }], // file URLs
  },
  { timestamps: true }
);

const Prescription = mongoose.model("Prescription", prescriptionSchema);

export default Prescription;