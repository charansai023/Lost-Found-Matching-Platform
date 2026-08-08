const ApiError = require('../utils/ApiError');

const isEmailAllowed = (email) => {
  const restrictDomain = process.env.RESTRICT_EMAIL_DOMAIN === 'true';
  if (!restrictDomain) return true;

  const allowedDomainsStr = process.env.ALLOWED_EMAIL_DOMAINS || '';
  const allowedDomains = allowedDomainsStr
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0) return true;

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;

  return allowedDomains.some((domain) => emailDomain === domain || emailDomain.endsWith('.' + domain));
};

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  if (!isEmailAllowed(email)) {
    const allowedDomainsStr = process.env.ALLOWED_EMAIL_DOMAINS || '';
    throw new ApiError(
      400,
      `Registration is restricted to college email addresses only. Allowed domains: ${allowedDomainsStr}`
    );
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long');
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  next();
};

const validateForgotPasswordEmail = (req, res, next) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  next();
};

const validateVerifyOTP = (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }

  if (!otp || !otp.trim()) {
    throw new ApiError(400, 'OTP is required');
  }

  if (!/^\d{6}$/.test(otp.trim())) {
    throw new ApiError(400, 'OTP must be a 6-digit number');
  }

  next();
};

const validateResetPassword = (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }

  if (!otp || !otp.trim()) {
    throw new ApiError(400, 'OTP is required');
  }

  if (!/^\d{6}$/.test(otp.trim())) {
    throw new ApiError(400, 'OTP must be a 6-digit number');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);

  if (!hasLetter || !hasNumber || !hasSymbol) {
    throw new ApiError(400, 'Password must include alphabets, numbers, and symbols');
  }

  next();
};

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

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPasswordEmail,
  validateVerifyOTP,
  validateResetPassword,
  validateItem,
};
