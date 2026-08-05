const express = require('express');
const router = express.Router();

const { registerUser, loginUser, getMyProfile, updateMyProfile, completeProfile } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.put('/complete-profile', protect, completeProfile);

module.exports = router;
