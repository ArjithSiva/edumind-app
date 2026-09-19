export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  // res.statusCode is still 200 unless a handler changed it, so fall back to 500.
  const status = err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  if (process.env.NODE_ENV !== "production") console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({ message: "That email is already registered" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  res.status(status || 500).json({ message: err.message || "Something went wrong on the server" });
}

/** Wraps async route handlers so rejected promises reach errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
