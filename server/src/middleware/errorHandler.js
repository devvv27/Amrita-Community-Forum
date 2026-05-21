export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  const statusCode =
    error.statusCode ||
    (error.message === "Origin not allowed by CORS" ? 403 : 500);
  const message = error.message || "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  res.status(statusCode).json({ message });
}
