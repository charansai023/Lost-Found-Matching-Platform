const mongoose = require('mongoose');

// Persists each algorithm-suggested match as its own document.
// The Admin can then verify, reject, or mark it returned.
const matchSchema = new mongoose.Schema({
  lostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LostItem',
    required: true,
  },
  foundItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoundItem',
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  // Human-readable match level (e.g. 'High Match', 'Possible Match')
  matchLevel: {
    type: String,
    enum: ['High Match', 'Possible Match', 'Low Match'],
    required: true,
  },
  // Which fields contributed to the score, for admin transparency
  matchedFields: {
    type: [String],
    default: [],
  },
  // Single unified status field — no separate boolean flags
  // Pending → Verified → Returned (or Pending → Rejected)
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected', 'Returned'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate match records for the same lost/found pairing
matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
