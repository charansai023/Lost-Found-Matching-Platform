const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  forgotPasswordSendOTP,
  verifyForgotPasswordOTP,
  resetPasswordWithOTP,
  getMyProfile,
  updateMyProfile,
  completeProfile,
} = require('../controllers/authController');
const {
  validateRegister,
  validateLogin,
  validateForgotPasswordEmail,
  validateVerifyOTP,
  validateResetPassword,
} = require('../middleware/validate');
const { protect } = require('../middleware/auth');
// Phase 1: abuse protection on auth endpoints. Generous limits because many
// students share one campus IP (X-Forwarded-For based per-client buckets).
const { createRateLimiter } = require('../middleware/rateLimiter');

// Login: 20 attempts / 15 min per client. Blocks credential stuffing while
// letting a whole class of users log in during a shared-IP session.
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
// Registration: 10 accounts / hour per client.
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
// OTP endpoints exist but email delivery is intentionally NOT a project
// feature (no SMTP configured). Same generous limiter pattern: 10/hour.
const otpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

router.post('/register', registerLimiter, validateRegister, registerUser);
router.post('/login', loginLimiter, validateLogin, loginUser);

router.post('/forgot-password/send-otp', otpLimiter, validateForgotPasswordEmail, forgotPasswordSendOTP);
router.post('/forgot-password/verify-otp', otpLimiter, validateVerifyOTP, verifyForgotPasswordOTP);
router.post('/forgot-password/reset', otpLimiter, validateResetPassword, resetPasswordWithOTP);

router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.put('/complete-profile', protect, completeProfile);

module.exports = router;
