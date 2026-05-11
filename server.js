import "dotenv/config";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

// ================= ROUTES =================
import otpRoutes from "./routes/otpRoutes.js";
import patientRoutes from "./routes/patient.js";
import doctorRoutes from "./routes/doctor.js";
import pharmacyRoutes from "./routes/pharmacy.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminPharmacyRoutes from "./routes/adminPharmacyRoute.js";
import adminPatientRoutes from "./routes/adminPatientRoute.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import patientPortalRoutes from "./routes/patientPortalRoutes.js";
import prescriptionsRoutes from "./routes/prescriptions.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoute.js";
import paymentRoutes from "./routes/payment.js";
import reviewRoutes from "./routes/review.js";

// ================= MIDDLEWARE =================
import logger from "./middleware/loggerMiddleware.js";
import errorHandler from "./middleware/errorMiddleware.js";

// ================= MODELS =================
import Appointment from "./models/Appointment.js";

const app = express();
const server = http.createServer(app);

// ================= __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});
// attach io globally
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.set("trust proxy", 1);

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(logger);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/pharmacyUploads", express.static("pharmacyUploads"));

// ================= TEST =================
app.get("/test", (req, res) => {
  res.send("✅ Server is running perfectly on port 5000!");
});

// ================= DB CONNECT =================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// ================= START SERVER =================
const startServer = async () => {
  await connectDB();
const PORT = process.env.PORT;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
};

startServer();

// ================= ROUTES =================
app.use("/", otpRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/admin", adminPatientRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminPharmacyRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/patient", patientPortalRoutes);
app.use("/api/admin", adminAnalyticsRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/reviews", reviewRoutes);

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= SLOT CLEANUP CRON =================
setInterval(async () => {
  try {
    const expired = await Appointment.find({
      status: "Locked",
      slotLockedUntil: { $lt: new Date() },
    });

    for (let appt of expired) {
      if (io) {
        io.emit("slotReleased", {
          doctorId: appt.doctor,
          slotStart: appt.slotStart,
        });
      }
    }

    await Appointment.updateMany(
      {
        status: "Locked",
        slotLockedUntil: { $lt: new Date() },
      },
      {
        status: "Cancelled",
        slotLockedUntil: null,
      }
    );

    console.log("🧹 Expired slots cleaned");
  } catch (err) {
    console.error("Slot cleanup error:", err);
  }
}, 60000);

// ================= AI SESSION =================
app.get("/api/session", (req, res) => {
  const sessionId = uuidv4();
  res.json({ sessionId });
});

// ================= AI CHAT =================
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are MediDost AI, a medical triage assistant.

When user gives symptoms:
- Identify possible condition (non-diagnostic).
- Suggest correct doctor specialization.
- Provide short safe advice.
- Assess severity (low | medium | high).

Return ONLY valid JSON in this format:

{
  "condition": "...",
  "specialist": "...",
  "advice": "...",
  "severity": "low | medium | high"
}
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let aiData;

    try {
      aiData = JSON.parse(response.data.choices[0].message.content);
    } catch (err) {
      console.error("JSON Parse Error:", err);
      return res.status(500).json({
        reply: "Sorry, I couldn't understand the AI response properly.",
      });
    }

    const formattedReply = `
Based on your symptoms, you may be experiencing ${aiData.condition}.

It is recommended that you consult a ${aiData.specialist} for proper evaluation.

Advice: ${aiData.advice}

Severity Level: ${aiData.severity.toUpperCase()}
`;

    res.json({
      reply: formattedReply,
      specialist: aiData.specialist,
      severity: aiData.severity,
    });
  } catch (error) {
    console.error("AI Error:", error.response?.data || error.message);

    res.status(500).json({
      reply: "AI service temporarily unavailable. Please try again later.",
    });
  }
});

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("send_message", (data) => {
    socket.broadcast.emit("receive_message", data);
  });

  socket.on("registerDoctor", (doctorId) => {
    socket.join(doctorId);
    console.log(`Doctor joined room: ${doctorId}`);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});
