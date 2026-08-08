const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  foundItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoundItem',
    required: [true, 'Found item is required'],
  },
  lostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LostItem',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Claimant user is required'],
  },
  uniqueMarks: {
    type: String,
    required: [true, 'Unique identifying marks are required'],
    trim: true,
  },
  ownershipDetails: {
    type: String,
    required: [true, 'Ownership details are required'],
    trim: true,
  },
  approximateDateLost: {
    type: Date,
    required: [true, 'Approximate date lost is required'],
  },
  supportingImage: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'returned'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Claim', claimSchema);
