const rateLimit = require("express-rate-limit");

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests
  message: {
    message: "Too many attempts. Try again later."
  }
});

exports.otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    message: "OTP requests limit exceeded"
  }
});

exports.loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Try again later."
});

// 📧 Forgot password (email spam protection)
exports.forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many reset requests. Check your email."
});


// 🔁 Reset attempts
exports.resetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many attempts. Try later."
});


exports.signupLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: "Too many accounts created from this IP."
});
