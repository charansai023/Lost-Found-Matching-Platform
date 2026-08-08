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

router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);

router.post('/forgot-password/send-otp', validateForgotPasswordEmail, forgotPasswordSendOTP);
router.post('/forgot-password/verify-otp', validateVerifyOTP, verifyForgotPasswordOTP);
router.post('/forgot-password/reset', validateResetPassword, resetPasswordWithOTP);

router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.put('/complete-profile', protect, completeProfile);

module.exports = router;
