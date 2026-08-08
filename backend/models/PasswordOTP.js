const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const passwordOTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  used: {
    type: Boolean,
    default: false,
  },
  lastSentAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

passwordOTPSchema.methods.verifyOTP = async function (candidateOTP) {
  if (this.used) return false;
  if (this.expiresAt < Date.now()) return false;
  return bcrypt.compare(candidateOTP, this.otpHash);
};

passwordOTPSchema.statics.hashOTP = async function (otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

passwordOTPSchema.index({ email: 1, used: 0, createdAt: -1 });

module.exports = mongoose.model('PasswordOTP', passwordOTPSchema);
