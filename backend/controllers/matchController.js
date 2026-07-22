const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { MATCH_THRESHOLDS } = require('../services/matchingService');

// @desc    Get all non-rejected matches with score above POSSIBLE threshold
// @route   GET /api/matches
// @access  Private
const getAllMatches = asyncHandler(async (req, res) => {
  const matches = await Match.find({
    score: { $gte: MATCH_THRESHOLDS.POSSIBLE },
    status: { $ne: 'Rejected' },
  })
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name' } })
    .sort({ score: -1 });

  sendSuccess(res, 200, 'Matches fetched successfully', { matches });
});

// @desc    Get match results for one specific found item
// @route   GET /api/matches/:foundItemId
// @access  Private
const getMatchesForFoundItem = asyncHandler(async (req, res) => {
  const matches = await Match.find({
    foundItem: req.params.foundItemId,
    status: { $ne: 'Rejected' },
  })
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name' } })
    .sort({ score: -1 });

  sendSuccess(res, 200, 'Matches fetched successfully', { matches });
});

module.exports = { getAllMatches, getMatchesForFoundItem };
