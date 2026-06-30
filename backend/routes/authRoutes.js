const router = require("express").Router();
const { signup, login, forgotPassword, resetPassword, getMe } = require("../controllers/authController");
const auth = require("../middleware/auth");
const { signupLimiter, loginLimiter, forgotLimiter, resetLimiter } = require("../middleware/rateLimit");

router.post("/signup",signupLimiter, signup);
router.post("/login",loginLimiter, login);
router.post("/forgot-password",forgotLimiter, forgotPassword);
router.post("/reset-password/:token",resetLimiter, resetPassword);
router.get('/profile', auth, getMe);

module.exports = router;