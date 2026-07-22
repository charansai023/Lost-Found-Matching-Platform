const ApiError = require('../utils/ApiError');

// Validates the fields required when a user registers
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long');
  }

  next();
};

// Validates the fields required when a user logs in
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  next();
};

// Validates the fields required when reporting a lost or found item
const validateItem = (req, res, next) => {
  const { itemType, category, location } = req.body;

  if (!itemType || !itemType.trim()) {
    throw new ApiError(400, 'Item type is required');
  }

  if (!category || !category.trim()) {
    throw new ApiError(400, 'Category is required');
  }

  if (!location || !location.trim()) {
    throw new ApiError(400, 'Location is required');
  }

  next();
};

module.exports = { validateRegister, validateLogin, validateItem };
