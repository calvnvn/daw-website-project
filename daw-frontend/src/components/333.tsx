const rateLimit = require("express-rate-limit");

// 1. Limiter Umum (Untuk semua API publik)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // Maksimal 100 request per IP per 15 menit
  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Limiter Khusus Inquiry/Contact Form (Sangat Ketat)
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5, // Maksimal hanya 5 pesan per jam per orang (IP)
  message: {
    message:
      "Too many messages sent. Please wait an hour before sending another inquiry.",
  },
});

// 3. Limiter Khusus Login (Mencegah Brute Force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan login per 15 menit
  message: {
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

module.exports = { generalLimiter, inquiryLimiter, loginLimiter };
