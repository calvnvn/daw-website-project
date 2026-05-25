const rateLimit = require("express-rate-limit");

// Global Limiter (Prevents DDoS and generic API spamming)
const globalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === "development" ? 2000 : 150, // Generous limit in development, strict 150 in production
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Auth Limiter (Prevents login brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message:
      "Too many login attempts. Access temporarily blocked for 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Inquiry Limiter (Prevents contact form spamming)
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 contact form submissions per windowMs
  message: {
    success: false,
    message: "Too many submissions. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  authLimiter,
  inquiryLimiter,
};
