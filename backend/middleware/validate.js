const ApiError = require('../utils/ApiError');

// ═══════════════════════════════════════════════════════════════
// Shared security/validation helpers (Phase 1)
// Single source of truth so controllers don't duplicate logic.
// ═══════════════════════════════════════════════════════════════

// Escapes user input before it is used inside a MongoDB $regex so that
// special characters like [ ] ( ) * + ? . \ ^ $ | are treated literally.
// Without this, `search=[` crashes the endpoint and crafted patterns can
// trigger expensive regex scans (regex injection).
const escapeRegex = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// True only when the value is a well-formed 24-char hex MongoDB ObjectId.
const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// Throws 400 early for malformed :id params instead of letting Mongoose
// raise a CastError deeper in the query pipeline.
const assertValidObjectId = (id, label = 'ID') => {
  if (!isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${label} format`);
  }
};

// Rejects dates that fall on a FUTURE CALENDAR DAY using local calendar
// semantics. Business rule: today → allowed, any previous calendar date →
// allowed, any future calendar date → rejected.
//
// Why not simply `new Date(value) > new Date()`:
// `YYYY-MM-DD` strings are parsed by JS as UTC *midnight*. For users ahead
// of UTC (e.g. UTC+5:30) "today" can parse to an instant later than `new
// Date()` in the early local morning, wrongly rejecting legitimate today
// reports (the UTC-midnight bug). Conversely, on servers behind UTC the
// parse can shift the intended day backwards and let "tomorrow" slip
// through. So the calendar day is read directly from the string when it is
// in YYYY-MM-DD form (what the frontend date pickers always send), and only
// falls back to Date components for other formats. The current date is
// never hardcoded.
const rejectFutureDate = (value, label = 'Date') => {
  if (!value) {
    throw new ApiError(400, `${label} is required`);
  }

  const valueStr = String(value);
  let year, month, day;

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(valueStr);
  if (ymdMatch) {
    // Frontend always sends YYYY-MM-DD — use the user's intended calendar
    // day directly, with no timezone interpretation at all.
    [, year, month, day] = ymdMatch;
  } else {
    const parsed = new Date(valueStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, `${label} is not a valid date`);
    }
    year = String(parsed.getFullYear());
    month = String(parsed.getMonth() + 1).padStart(2, '0');
    day = String(parsed.getDate()).padStart(2, '0');
  }

  const now = new Date();
  const inputKey = Number(year) * 10000 + Number(month) * 100 + Number(day);
  const todayKey =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

  if (inputKey > todayKey) {
    throw new ApiError(400, `${label} cannot be in the future.`);
  }
  return true;
};

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
  // Shared helpers (Phase 1)
  escapeRegex,
  isValidObjectId,
  assertValidObjectId,
  rejectFutureDate,
};
