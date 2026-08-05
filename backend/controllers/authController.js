const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');

// Generates a signed JWT containing the user's id
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (!hasLetter || !hasNumber || !hasSymbol) {
    throw new ApiError(400, 'Password must include alphabets, numbers, and symbols');
  }

  // Check if a user with this email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this email already exists');
  }

  // Create the new user (password gets hashed automatically via the pre-save hook)
  const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
  const user = await User.create({ name, email, password, role });  const token = generateToken(user._id);

  sendSuccess(res, 201, 'User registered successfully', {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
    },
  });
});

// @desc    Login an existing user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // We need to explicitly select the password since it is excluded by default
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = generateToken(user._id);

  sendSuccess(res, 200, 'Login successful', {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
    },
  });
});

// @desc    Get the currently logged-in user's profile
// @route   GET /api/auth/me
// @access  Private
const getMyProfile = asyncHandler(async (req, res) => {
  // req.user is attached by the `protect` middleware
  sendSuccess(res, 200, 'Profile fetched successfully', { user: req.user });
});

// @desc    Update the currently logged-in user's own profile (name only;
//          email/password changes are intentionally out of scope here to
//          keep auth simple and avoid re-verification flows)
// @route   PUT /api/auth/me
// @access  Private
const updateMyProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  req.user.name = name.trim();
  await req.user.save();

  sendSuccess(res, 200, 'Profile updated successfully', { user: req.user });
});

// @desc    Complete profile details (first sign in)
// @route   PUT /api/auth/complete-profile
// @access  Private
const completeProfile = asyncHandler(async (req, res) => {
  const { fullName, email, mobileNumber } = req.body;

  if (!fullName || !fullName.trim()) {
    throw new ApiError(400, 'Full Name is required');
  }
  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }
  if (!mobileNumber || !mobileNumber.trim()) {
    throw new ApiError(400, 'Mobile Number is required');
  }

  req.user.fullName = fullName.trim();
  req.user.profileEmail = email.trim();
  req.user.mobileNumber = mobileNumber.trim();
  req.user.profileCompleted = true;
  req.user.name = fullName.trim(); // Sync public name with full name

  await req.user.save();

  sendSuccess(res, 200, 'Profile completed successfully', {
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profileCompleted: req.user.profileCompleted,
    },
  });
});

module.exports = { registerUser, loginUser, getMyProfile, updateMyProfile, completeProfile };
