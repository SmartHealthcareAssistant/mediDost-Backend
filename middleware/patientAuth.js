import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-secret-change-this-in-prod";

const patientAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("patientAuth error:", err);
        return res.status(401).json({ message: "Token is not valid" });
      }

      req.patient = { id: decoded.id, role: decoded.role };
      next();
    });
  } catch (err) {
    console.error("patientAuth unexpected error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export default patientAuth;