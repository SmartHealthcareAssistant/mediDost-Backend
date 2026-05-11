import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Appointment from "../models/Appointment.js";

const router = express.Router();

// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

/* =====================================================
   0. LOCK SLOT (BEFORE PAYMENT)
===================================================== */
router.post("/lock-slot", async (req, res) => {
  const { doctorId, patientId, slotStart, slotEnd } = req.body;

  console.log("LOCK REQUEST:", { doctorId, slotStart, slotEnd });

  try {
    const conflict = await Appointment.findOne({
      doctor: doctorId,
      slotStart: { $lt: new Date(slotEnd) },
      slotEnd: { $gt: new Date(slotStart) },
      status: { $in: ["Pending Payment", "Confirmed", "Locked"] },
      $or: [
        { slotLockedUntil: { $gt: new Date() } },
        { status: "Confirmed" },
      ],
    });

    if (conflict) {
      return res.status(400).json({ message: "This slot is already booked. Please choose another slot."});
    }

    const appointment = await Appointment.create({
      doctor: doctorId,
      patient: patientId,
      slotStart,
      slotEnd,
      slotLockedUntil: new Date(Date.now() + 5 * 60 * 1000),
      status: "Locked",
      paymentStatus: "Pending",
    });

    if (req.io) {
      req.io.to(doctorId.toString()).emit("slotBooked", {
        doctorId,
        slotStart,
        slotEnd,
      });
    }

    res.json({ appointmentId: appointment._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lock failed" });
  }
});

/* =====================================================
   1. CREATE ORDER
===================================================== */
router.post("/create-order", async (req, res) => {
  try {
    console.log("BODY:", req.body);
    const { doctorId, patientId, amount } = req.body;

    if (!doctorId || !patientId || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    const appointment = await Appointment.findByIdAndUpdate(
      req.body.appointmentId,
      {
        amount,
        razorpayOrderId: order.id,
        status: "Pending Payment",
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      order,
      appointmentId: appointment._id,
    });
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ message: "Order creation failed" });
  }
});

/* =====================================================
   2. VERIFY PAYMENT
===================================================== */
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      appointmentId,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      const updated = await Appointment.findByIdAndUpdate(
        appointmentId,
        {
          paymentStatus: "Failed",
          status: "Cancelled",
          slotLockedUntil: null,
        },
        { new: true }
      );

      if (req.io) {
        req.io.emit("slotReleased", {
          doctorId: updated.doctor,
          slotStart: updated.slotStart,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(
  appointmentId,
  {
    paymentStatus: "Paid",
    status: "Confirmed",
    slotLockedUntil: null,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  },
  { new: true }
).populate("patient", "name email");

if (req.io) {
  req.io
    .to(appointment.doctor.toString())
    .emit("appointmentUpdate", appointment);
}

    res.status(200).json({
      success: true,
      message: "Payment verified & appointment confirmed",
      appointment,
    });
  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

/* =====================================================
   RELEASE SLOT
===================================================== */
router.post("/release-slot", async (req, res) => {
  const { slotStart, doctorId } = req.body;

  try {
    await Appointment.findOneAndUpdate(
      await Appointment.findOneAndDelete(
  {
    doctor: doctorId,
    slotStart: new Date(slotStart),
    status: { $in: ["Locked", "Pending Payment"] }
  }
),
      {
        status: "Cancelled",
        slotLockedUntil: null,
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Release slot error:", err);
    res.status(500).json({ message: "Release failed" });
  }
});

/* =====================================================
   GET USER APPOINTMENTS
===================================================== */
router.get("/appointments/:patientId", async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patient: req.params.patientId,
    }).populate("doctor", "name specialization");

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

export default router;