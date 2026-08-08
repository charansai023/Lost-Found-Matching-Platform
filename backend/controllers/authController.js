const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordOTP = require('../models/PasswordOTP');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { sendForgotPasswordOTPEmail } = require('../utils/emailService');

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const isDevMode = () => (process.env.NODE_ENV || 'development').toLowerCase() === 'development';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generate6DigitOTP = () => {
  const bytes = crypto.randomBytes(3);
  const otp = bytes.readUIntBE(0, 3) % 1000000;
  return otp.toString().padStart(6, '0');
};

const invalidateOldOTPs = async (email) => {
  await PasswordOTP.updateMany(
    { email: email.toLowerCase(), used: false, verified: false },
    { $set: { used: true } }
  );
};

const canResendOTP = async (email) => {
  const latest = await PasswordOTP.findOne(
    { email: email.toLowerCase() },
    {},
    { sort: { lastSentAt: -1 } }
  );
  if (!latest) return { allowed: true };
  const elapsed = Date.now() - latest.lastSentAt.getTime();
  const remaining = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
  return { allowed: remaining <= 0, remaining: Math.max(remaining, 0) };
};

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

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this email already exists');
  }

  const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
  const user = await User.create({ name, email, password, role });
  const token = generateToken(user._id);

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

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

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

const forgotPasswordSendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();

  const resendCheck = await canResendOTP(normalizedEmail);
  if (!resendCheck.allowed) {
    throw new ApiError(
      429,
      `Please wait ${resendCheck.remaining} seconds before requesting a new OTP`
    );
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
    return sendSuccess(res, 200, 'If an account exists with this email, an OTP has been sent', {
      emailSent: true,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  }

  await invalidateOldOTPs(normalizedEmail);

  const otp = generate6DigitOTP();
  const otpHash = await PasswordOTP.hashOTP(otp);

  let otpRecord = null;
  try {
    otpRecord = await PasswordOTP.create({
      email: normalizedEmail,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      lastSentAt: new Date(),
    });

    if (isDevMode()) {
      const expiryStr = new Date(otpRecord.expiresAt).toLocaleString();
      const border = '══════════════════════════════════════════════════════════════';
      console.log(`\n${border}`);
      console.log(`📩  [DEV MODE] Forgot Password OTP — NO EMAIL SENT`);
      console.log(`    To:       ${normalizedEmail} (${user.name || 'user'})`);
      console.log(`    OTP:      👉  ${otp}  👈`);
      console.log(`    Expires:  ${expiryStr} (${OTP_EXPIRY_MINUTES} min from now)`);
      console.log(`    OTP ID:   ${otpRecord._id}`);
      console.log(`${border}\n`);

      sendSuccess(res, 200, 'If an account exists with this email, an OTP has been sent', {
        emailSent: false,
        devMode: true,
        otp,
        resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        expiresAt: otpRecord.expiresAt.toISOString(),
      });
      return;
    }

    await sendForgotPasswordOTPEmail({
      email: normalizedEmail,
      name: user.name,
      otp,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (emailError) {
    if (otpRecord) {
      try {
        await PasswordOTP.deleteOne({ _id: otpRecord._id });
        console.error(
          `[Auth] Rolled back OTP record ${otpRecord._id} for ${normalizedEmail} due to email failure`
        );
      } catch (delErr) {
        console.error('[Auth] Critical: Failed to rollback OTP record after email failure:', delErr);
      }
    }

    const isConfigErr =
      emailError.code === 'SMTP_NOT_CONFIGURED' ||
      emailError.name === 'EmailServiceError';

    const smtpCode = emailError.code || null;
    const smtpResp = emailError.smtpResponse || '';
    const isUnauthorizedIP = /unauthorized\s*ip/i.test(smtpResp) || smtpCode === 'EAUTH' && /5\.7\.1/.test(smtpResp);
    const isInvalidCreds = smtpCode === 'EAUTH' && !isUnauthorizedIP;
    const isSSLCert = /certificate|tls|ssl/i.test(emailError.message + smtpResp);

    console.error(
      `[Auth] Email service error sending OTP to ${normalizedEmail}:`,
      {
        message: emailError.message,
        code: smtpCode,
        smtpResponse: smtpResp,
        category: 'forgot-password-otp',
      }
    );

    if (isConfigErr && emailError.code === 'SMTP_NOT_CONFIGURED') {
      throw new ApiError(
        503,
        'Email service is not available right now. Please configure Brevo SMTP settings or try again later.'
      );
    }

    if (isUnauthorizedIP) {
      throw new ApiError(
        502,
        'SMTP blocked: Brevo rejected your IP address. In Brevo → SMTP & API → SMTP → Authorized IPs, either add this server IP or click "Disable Restriction" for development. Then retry.'
      );
    }

    if (isInvalidCreds) {
      throw new ApiError(
        502,
        `SMTP auth failed: Invalid Brevo SMTP_USER or SMTP_PASS. Double-check the SMTP key at Brevo → SMTP & API → SMTP. (SMTP said: ${smtpResp || smtpCode})`
      );
    }

    if (isSSLCert) {
      throw new ApiError(
        502,
        `SMTP TLS/SSL error: ${smtpResp || smtpCode || emailError.message}. Try changing SMTP_PORT from 587 to 465 in .env (or vice versa) and restart.`
      );
    }

    const detailsPart = smtpResp ? ` (SMTP: ${smtpResp})` : '';
    throw new ApiError(
      502,
      `We could not send the OTP email at this time. Please wait a moment and try again.${detailsPart}`
    );
  }

  sendSuccess(res, 200, 'If an account exists with this email, an OTP has been sent', {
    emailSent: true,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  });
});

const verifyForgotPasswordOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = email.toLowerCase();

  const latestOTP = await PasswordOTP.findOne(
    { email: normalizedEmail, used: false },
    {},
    { sort: { createdAt: -1 } }
  );

  if (!latestOTP) {
    throw new ApiError(400, 'No OTP found for this email. Please request a new one.');
  }

  if (latestOTP.expiresAt < Date.now()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  const isValid = await latestOTP.verifyOTP(otp);
  if (!isValid) {
    throw new ApiError(400, 'Invalid OTP. Please try again.');
  }

  latestOTP.verified = true;
  await latestOTP.save();

  sendSuccess(res, 200, 'OTP verified successfully', {
    verified: true,
  });
});

const resetPasswordWithOTP = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = email.toLowerCase();

  const latestOTP = await PasswordOTP.findOne(
    { email: normalizedEmail, used: false, verified: true },
    {},
    { sort: { createdAt: -1 } }
  );

  if (!latestOTP) {
    const unverified = await PasswordOTP.findOne(
      { email: normalizedEmail, used: false },
      {},
      { sort: { createdAt: -1 } }
    );
    if (unverified) {
      throw new ApiError(400, 'Please verify the OTP before resetting your password.');
    }
    throw new ApiError(400, 'No valid OTP session found. Please request a new OTP.');
  }

  if (latestOTP.expiresAt < Date.now()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  const isValid = await latestOTP.verifyOTP(otp);
  if (!isValid) {
    throw new ApiError(400, 'Invalid OTP. Please try again.');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isSameAsOld = await user.comparePassword(newPassword);
  if (isSameAsOld) {
    throw new ApiError(400, 'New password cannot be the same as your old password.');
  }

  user.password = newPassword;
  await user.save();

  latestOTP.used = true;
  await latestOTP.save();

  await PasswordOTP.updateMany(
    { email: normalizedEmail, used: false },
    { $set: { used: true } }
  );

  sendSuccess(res, 200, 'Password reset successfully. You can now log in with your new password.', {
    reset: true,
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, 'Profile fetched successfully', { user: req.user });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  req.user.name = name.trim();
  await req.user.save();

  sendSuccess(res, 200, 'Profile updated successfully', { user: req.user });
});

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
  req.user.name = fullName.trim();

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

module.exports = {
  registerUser,
  loginUser,
  forgotPasswordSendOTP,
  verifyForgotPasswordOTP,
  resetPasswordWithOTP,
  getMyProfile,
  updateMyProfile,
  completeProfile,
};
