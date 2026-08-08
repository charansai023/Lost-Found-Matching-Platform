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
  // AI Image Similarity fields
  imageSimilarityScore: {
    type: Number,
    default: 0,
  },
  isAiMatch: {
    type: Boolean,
    default: false,
  },
  aiConfidence: {
    type: String,
    default: '',
  },
  matchingStatus: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'completed',
  },
  // Intermediate debug scores stored in MongoDB
  embeddingScore: {
    type: Number,
    default: 0,
  },
  categoryScore: {
    type: Number,
    default: 0,
  },
  brandScore: {
    type: Number,
    default: 0,
  },
  textScore: {
    type: Number,
    default: 0,
  },
  colorScore: {
    type: Number,
    default: 0,
  },
  finalScore: {
    type: Number,
    default: 0,
  },
  matchLogs: {
    type: [String],
    default: [],
  },
  // Hybrid AI Matching fields
  semanticSimilarity: {
    type: Number,
    default: 0,
  },
  titleSimilarity: {
    type: Number,
    default: 0,
  },
  descriptionSimilarity: {
    type: Number,
    default: 0,
  },
  locationSimilarity: {
    type: Number,
    default: 0,
  },
  overallTextSimilarity: {
    type: Number,
    default: 0,
  },
  finalConfidenceScore: {
    type: Number,
    default: 0,
  },
  matchingMethod: {
    type: String,
    default: 'Hybrid AI Engine',
  },
  matchingVersion: {
    type: String,
    default: 'v2',
  },
  lastMatchedAt: {
    type: Date,
    default: Date.now,
  },
  // Single unified status field — no separate boolean flags
  // Pending → Verified → Returned (or Pending → Rejected)
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected', 'Returned'],
    default: 'Pending',
  },
  isRewarded: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate match records for the same lost/found pairing
matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
