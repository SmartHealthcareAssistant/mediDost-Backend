import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },

    // date: Date,
    // time: String,

    status: {
      type: String,
      enum: ["Pending Payment", "Confirmed", "Cancelled", "Locked"],
      default: "Pending Payment",
    },

    amount: Number,

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },

    slotLockedUntil: Date, // temporary lock

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
  },
  { timestamps: true }
);

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;