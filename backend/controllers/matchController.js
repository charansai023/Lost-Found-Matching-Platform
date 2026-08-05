const Match = require('../models/Match');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { MATCH_THRESHOLDS } = require('../services/matchingService');

// @desc    Get all non-rejected matches with score above POSSIBLE threshold
//          Returns flat matches list AND grouped results for backwards compatibility & UI flexibility
// @route   GET /api/matches
// @access  Private
const getAllMatches = asyncHandler(async (req, res) => {
  const matches = await Match.find({
    status: { $ne: 'Rejected' },
    $or: [
      { score: { $gte: MATCH_THRESHOLDS.POSSIBLE } },
      { isAiMatch: true },
      { imageSimilarityScore: { $gte: 50 } },
    ],
  })
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name' } })
    .sort({ score: -1, imageSimilarityScore: -1 });

  // Group by foundItem for UI grouping if required
  const groupedMap = new Map();
  matches.forEach((m) => {
    if (!m.foundItem) return;
    const fId = m.foundItem._id.toString();
    if (!groupedMap.has(fId)) {
      groupedMap.set(fId, {
        foundItem: m.foundItem,
        matches: [],
      });
    }
    groupedMap.get(fId).matches.push(m);
  });

  const results = Array.from(groupedMap.values());

  sendSuccess(res, 200, 'Matches fetched successfully', { matches, results });
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
    .sort({ score: -1, imageSimilarityScore: -1 });

  sendSuccess(res, 200, 'Matches fetched successfully', { matches });
});

// @desc    Check AI matching status for an item
// @route   GET /api/matches/status/:itemType/:itemId
// @access  Private
const getMatchingStatus = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;
  let item = null;

  if (itemType === 'lost') {
    item = await LostItem.findById(itemId).select('matchingStatus status');
  } else if (itemType === 'found') {
    item = await FoundItem.findById(itemId).select('matchingStatus status');
  }

  if (!item) {
    return sendSuccess(res, 200, 'Item not found', { matchingStatus: 'completed' });
  }

  sendSuccess(res, 200, 'Matching status retrieved', {
    matchingStatus: item.matchingStatus || 'completed',
    status: item.status,
  });
});

module.exports = { getAllMatches, getMatchesForFoundItem, getMatchingStatus };
