const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false, // Never return the password field by default
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  fullName: {
    type: String,
    select: false,
  },
  profileEmail: {
    type: String,
    select: false,
  },
  mobileNumber: {
    type: String,
    select: false,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  rewardPoints: {
    type: Number,
    default: 0,
  },
  itemsReturned: {
    type: Number,
    default: 0,
  },
  rewardLevel: {
    type: String,
    enum: ['Bronze Helper', 'Silver Helper', 'Gold Helper', 'Platinum Helper', 'Campus Legend'],
    default: 'Bronze Helper',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash the password before saving, but only if it was modified
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plain text password with the hashed one
userSchema.methods.comparePassword = async function comparePassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
