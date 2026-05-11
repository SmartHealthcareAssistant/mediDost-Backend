import jwt from "jsonwebtoken";

// Use env secret (fallback for dev)
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * Doctor Authentication Middleware
 */
const doctorAuth = (req, res, next) => {
  const authHeader = req.header("Authorization");

  // Check header format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("Auth failed: Missing or invalid Authorization header.");
    return res
      .status(401)
      .json({ message: "Authorization denied: Token format invalid." });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check role
    if (decoded.role !== "doctor") {
      console.warn("Auth failed: Token is not for a doctor role.");
      return res
        .status(403)
        .json({ message: "Access forbidden: Token not for doctor role." });
    }

    // Attach doctor id to request
    req.doctor = { id: decoded.id };

    next();
  } catch (err) {
    console.error("JWT Verification failed:", err.message);
    res
      .status(401)
      .json({ message: "Authorization denied: Invalid or expired token." });
  }
};

export default doctorAuth;