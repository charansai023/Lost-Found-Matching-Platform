const Claim = require('../models/Claim');
const Match = require('../models/Match');
const FoundItem = require('../models/FoundItem');
const LostItem = require('../models/LostItem');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { calculateMatchScore } = require('../services/matchingService');
const { createAndSendNotification } = require('../services/socketService');

// @desc    Create a new claim request
// @route   POST /api/claims
// @access  Private
const createClaim = asyncHandler(async (req, res) => {
  const { foundItemId, lostItemId, uniqueMarks, ownershipDetails, approximateDateLost } = req.body;

  if (!foundItemId) {
    throw new ApiError(400, 'Found item ID is required');
  }
  if (!uniqueMarks || !uniqueMarks.trim()) {
    throw new ApiError(400, 'Unique identifying marks are required');
  }
  if (!ownershipDetails || !ownershipDetails.trim()) {
    throw new ApiError(400, 'Additional ownership details are required');
  }
  if (!approximateDateLost) {
    throw new ApiError(400, 'Approximate date lost is required');
  }

  const foundItem = await FoundItem.findById(foundItemId);
  if (!foundItem) {
    throw new ApiError(404, 'Found item not found');
  }

  if (foundItem.user.toString() === req.user._id.toString()) {
    throw new ApiError(403, 'You cannot claim a found item that you reported.');
  }

  // Ensure item is claimable
  if (['Verified', 'Returned', 'Resolved', 'Closed'].includes(foundItem.status)) {
    throw new ApiError(400, `This found item is no longer available for claiming (Status: ${foundItem.status})`);
  }

  // Prevent duplicate active claims by this user for this item
  const existingClaim = await Claim.findOne({
    user: req.user._id,
    foundItem: foundItemId,
    status: { $in: ['pending', 'verified'] }
  });
  if (existingClaim) {
    throw new ApiError(400, 'You already have an active claim for this found item');
  }

  let lostItem = null;
  if (lostItemId) {
    lostItem = await LostItem.findById(lostItemId);
    if (!lostItem) {
      throw new ApiError(404, 'Lost item not found');
    }
  }

  const supportingImage = req.file ? (req.file.path || req.file.secure_url) : '';

  const claimData = {
    user: req.user._id,
    foundItem: foundItemId,
    uniqueMarks,
    ownershipDetails,
    approximateDateLost,
    supportingImage,
    status: 'pending',
  };
  
  if (lostItemId) {
    claimData.lostItem = lostItemId;
  }
  
  const claim = await Claim.create(claimData);

  // Calculate matching score and create/update a Match record if not already present
  let match = null;
  if (lostItemId) {
    match = await Match.findOne({ lostItem: lostItemId, foundItem: foundItemId });
    if (!match) {
      const { score, matchLevel, matchedFields } = calculateMatchScore(lostItem, foundItem);
      match = await Match.create({
        lostItem: lostItemId,
        foundItem: foundItemId,
        score,
        matchLevel,
        matchedFields,
      });
    }
  }

  // Notify the Admin of new claim request
  const isDirectClaim = !lostItemId;
  const itemName = foundItem.title || foundItem.itemType || foundItem.category;
  
  createAndSendNotification({
    title: isDirectClaim ? '🚨 New Direct Claim Submitted' : '📎 New Claim Request',
    message: isDirectClaim 
      ? `${req.user.name} has claimed a found item: ${itemName}`
      : `${req.user.name} submitted a claim for a ${itemName} found at ${foundItem.location}.`,
    notificationType: 'new_claim',
    isAdminNotification: true,
    priority: 'high',
  }).catch((e) => console.error('[Notification] createClaim admin:', e.message));

  sendSuccess(res, 201, 'Claim request submitted successfully', { claim, match });
});

// @desc    Get logged in user's claim requests
// @route   GET /api/claims/my-claims
// @access  Private
const getMyClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ user: req.user._id })
    .populate('foundItem')
    .populate('lostItem')
    .sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Claims fetched successfully', { claims });
});

module.exports = { createClaim, getMyClaims };
