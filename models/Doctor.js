import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    // Basic info
    name: { type: String, required: true },

    email: {
      type: String,
      unique: true,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    // Profile info
    phone: {
      type: Number,
      default: "",
    },

    specialization: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    experience: {
      type: Number,
      default: 0,
    },

    consultationFee: {
      type: Number,
      default: 0,
    },

    available: {
      type: Boolean,
      default: true,
    },

    image: {
      type: String,
      default:
        "https://via.placeholder.com/400x250?text=Doctor",
    },

    unavailableDates: [
      {
        type: String,
      },
    ],

    // Reviews
    reviews: [
      {
        patient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Patient",
          required: true,
        },

        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },

        comment: {
          type: String,
          default: "",
        },
      },
    ],

    rating: {
      type: Number,
      default: 0,
    },

    numReviews: {
      type: Number,
      default: 0,
    },

    // Documents
    idProof: {
      type: String,
      default: "",
    },

    license: {
      type: String,
      default: "",
    },

    degree: {
      type: String,
      default: "",
    },

    certificates: {
      type: String,
      default: "",
    },

    // Status flags
    profileCompleted: {
      type: Boolean,
      default: false,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    rejectionReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite in dev
const Doctor =
  mongoose.models.Doctor ||
  mongoose.model("Doctor", doctorSchema);

export default Doctor;