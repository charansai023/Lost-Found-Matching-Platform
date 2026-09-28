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
  // Phase 2: atomic finder-reward guard for DIRECT claims (no Match record).
  // Flipped false→true by a conditional findOneAndUpdate when the reward is
  // awarded, so concurrent/repeated return requests can never pay twice.
  // Claims WITH a linked Match instead reuse the Match's existing isRewarded
  // flag, so the reward can never be paid once per path.
  rewardGranted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Sparse partial index backing the atomic reward guard: only unclaimed
// (rewardGranted: false) claims are indexed, keeping it tiny.
claimSchema.index(
  { _id: 1, rewardGranted: 1 },
  { partialFilterExpression: { rewardGranted: false } }
);

module.exports = mongoose.model('Claim', claimSchema);
