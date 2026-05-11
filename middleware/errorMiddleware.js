function errorHandler(err, req, res, next) {
  console.error("Server error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
}

export default errorHandler;