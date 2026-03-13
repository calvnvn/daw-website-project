const rateLimit = require("express-rate-limit");

// General Limiter for Public API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Max 100 Req per IP every 15 minutes
  message: {
    message:
      " Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for Inq/Contact Form
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // an hour
  max: 5, // Max 5 messages per hour per IP
  message: {
    message:
      "Too many messages sent, please wait an hour before sending another inquiry",
  },
});

// Limiter for Login (Brute Form Mitigation)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  max: 10, // Maximum 10 login attempts per 15 Minutes
  message: {
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

module.exports = { generalLimiter, inquiryLimiter, loginLimiter };
