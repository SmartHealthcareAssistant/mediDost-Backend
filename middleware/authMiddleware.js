import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Not an admin" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
}

export default adminAuth;