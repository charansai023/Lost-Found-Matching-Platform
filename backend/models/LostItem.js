const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // --- Public Information ---
  itemType: {
    type: String,
    required: [true, 'Item type is required'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  brand: {
    type: String,
    trim: true,
    default: '',
  },
  color: {
    type: String,
    trim: true,
    default: '',
  },
  model: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  image: {
    type: String, // Relative path e.g. /uploads/xyz.jpg
    default: '',
  },
  dateLost: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },

  // --- Private Verification Information (hidden from other users) ---
  uniqueMarks: {
    type: String,
    trim: true,
    default: '',
    select: false, // Never returned by default
  },
  ownershipDetails: {
    type: String,
    trim: true,
    default: '',
    select: false, // Never returned by default
  },

  // --- Status ---
  // Pending → Matched → Verified → Returned
  status: {
    type: String,
    enum: ['Pending', 'Matched', 'Verified', 'Returned'],
    default: 'Pending',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('LostItem', lostItemSchema);
