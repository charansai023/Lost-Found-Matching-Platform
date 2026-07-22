const User = require('../models/User');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const Claim = require('../models/Claim');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');

// @desc    Get all registered users (with contact info visible to admin)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('+fullName +profileEmail +mobileNumber')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Users fetched successfully', { users });
});

// @desc    Get every lost item report (with private fields visible to admin)
// @route   GET /api/admin/lost
// @access  Private/Admin
const getAllLostItemsAdmin = asyncHandler(async (req, res) => {
  const lostItems = await LostItem.find()
    .populate('user', 'name email')
    .select('+uniqueMarks +ownershipDetails')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Lost items fetched successfully', { lostItems });
});

// @desc    Get every found item report (with private fields visible to admin)
// @route   GET /api/admin/found
// @access  Private/Admin
const getAllFoundItemsAdmin = asyncHandler(async (req, res) => {
  const foundItems = await FoundItem.find()
    .populate('user', 'name email')
    .select('+uniqueMarks +additionalObservations')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Found items fetched successfully', { foundItems });
});

// @desc    Get every match record (admin review queue)
//          Populates both items with their private fields for side-by-side comparison
// @route   GET /api/admin/matches
// @access  Private/Admin
const getAllMatchesAdmin = asyncHandler(async (req, res) => {
  const matches = await Match.find()
    .populate({
      path: 'lostItem',
      select: '+uniqueMarks +ownershipDetails',
      populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' },
    })
    .populate({
      path: 'foundItem',
      select: '+uniqueMarks +additionalObservations',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ score: -1 });

  sendSuccess(res, 200, 'Matches fetched successfully', { matches });
});

// @desc    Get a single match by ID (for detailed admin review)
// @route   GET /api/admin/match/:id
// @access  Private/Admin
const getMatchByIdAdmin = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate({
      path: 'lostItem',
      select: '+uniqueMarks +ownershipDetails',
      populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' },
    })
    .populate({
      path: 'foundItem',
      select: '+uniqueMarks +additionalObservations',
      populate: { path: 'user', select: 'name email' },
    });

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  sendSuccess(res, 200, 'Match fetched successfully', { match });
});

// @desc    Verify a match — confirms the algorithm suggestion is a real match
// @route   PUT /api/admin/match/:id/verify
// @access  Private/Admin
const verifyMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status === 'Returned') {
    throw new ApiError(400, 'This match has already been returned');
  }

  match.status = 'Verified';
  await match.save();

  // Propagate status to both underlying items
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Verified' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Verified' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name email' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name email' } });

  sendSuccess(res, 200, 'Match verified successfully', { match: updatedMatch });
});

// @desc    Reject a match — admin confirms these are NOT the same item
// @route   PUT /api/admin/match/:id/reject
// @access  Private/Admin
const rejectMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status === 'Returned') {
    throw new ApiError(400, 'This match has already been returned and cannot be rejected');
  }

  match.status = 'Rejected';
  await match.save();

  // Reset items back to Pending (they are back in the pool for new matches)
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Pending' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Pending' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name email' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name email' } });

  sendSuccess(res, 200, 'Match rejected', { match: updatedMatch });
});

// @desc    Mark a match as Returned — item physically handed back to owner
//          Requires the match to already be Verified
// @route   PUT /api/admin/match/:id/returned
// @access  Private/Admin
const markMatchReturned = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status !== 'Verified') {
    throw new ApiError(400, 'A match must be Verified before it can be marked as Returned');
  }

  match.status = 'Returned';
  await match.save();

  // Propagate Returned status to both items
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Returned' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Returned' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', select: '+uniqueMarks +ownershipDetails', populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' } })
    .populate({ path: 'foundItem', select: '+uniqueMarks +additionalObservations', populate: { path: 'user', select: 'name email' } });

  sendSuccess(res, 200, 'Match marked as returned', { match: updatedMatch });
});

// @desc    Delete a lost item report (admin)
// @route   DELETE /api/admin/lost/:id
// @access  Private/Admin
const deleteLostItemAdmin = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.id);

  if (!lostItem) {
    throw new ApiError(404, 'Lost item not found');
  }

  await lostItem.deleteOne();
  await Match.deleteMany({ lostItem: lostItem._id });

  sendSuccess(res, 200, 'Lost item deleted successfully', {});
});

// @desc    Delete a found item report (admin)
// @route   DELETE /api/admin/found/:id
// @access  Private/Admin
const deleteFoundItemAdmin = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.id);

  if (!foundItem) {
    throw new ApiError(404, 'Found item not found');
  }

  await foundItem.deleteOne();
  await Match.deleteMany({ foundItem: foundItem._id });

  sendSuccess(res, 200, 'Found item deleted successfully', {});
});

// @desc    Get all claim requests (admin review)
// @route   GET /api/admin/claims
// @access  Private/Admin
const getAllClaimsAdmin = asyncHandler(async (req, res) => {
  const claims = await Claim.find()
    .populate('user', 'name email')
    .populate('foundItem', 'itemType category location dateFound image')
    .populate('lostItem', 'itemType category location dateLost image')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Claims fetched successfully', { claims });
});

// @desc    Verify or reject a claim
// @route   PUT /api/admin/claim/:id/verify
// @route   PUT /api/admin/claim/:id/reject
// @access  Private/Admin
const updateClaimStatus = asyncHandler(async (req, res) => {
  const { action } = req.params; // 'verify' or 'reject'
  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    throw new ApiError(404, 'Claim not found');
  }

  if (action === 'verify') {
    claim.status = 'verified';
  } else if (action === 'reject') {
    claim.status = 'rejected';
  } else {
    throw new ApiError(400, 'Invalid action');
  }

  await claim.save();

  const updatedClaim = await Claim.findById(claim._id)
    .populate('user', 'name email')
    .populate('foundItem', 'itemType category location')
    .populate('lostItem', 'itemType category location');

  sendSuccess(res, 200, `Claim ${action}ed successfully`, { claim: updatedClaim });
});

// @desc    Get platform-wide statistics for the admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalLost, totalFound, totalMatches,
    verifiedMatches, returnedMatches, highMatches, pendingMatches, totalClaims, pendingClaims,
  ] = await Promise.all([
    User.countDocuments(),
    LostItem.countDocuments(),
    FoundItem.countDocuments(),
    Match.countDocuments(),
    Match.countDocuments({ status: 'Verified' }),
    Match.countDocuments({ status: 'Returned' }),
    Match.countDocuments({ matchLevel: 'High Match' }),
    Match.countDocuments({ status: 'Pending' }),
    Claim.countDocuments(),
    Claim.countDocuments({ status: 'pending' }),
  ]);

  sendSuccess(res, 200, 'Platform statistics fetched successfully', {
    totalUsers,
    totalLost,
    totalFound,
    totalMatches,
    verifiedMatches,
    returnedMatches,
    highMatches,
    pendingMatches,
    totalClaims,
    pendingClaims,
  });
});

module.exports = {
  getAllUsers,
  getAllLostItemsAdmin,
  getAllFoundItemsAdmin,
  getAllMatchesAdmin,
  getMatchByIdAdmin,
  verifyMatch,
  rejectMatch,
  markMatchReturned,
  deleteLostItemAdmin,
  deleteFoundItemAdmin,
  getPlatformStats,
  getAllClaimsAdmin,
  updateClaimStatus,
};
