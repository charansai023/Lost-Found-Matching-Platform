const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

// @desc    Get all lost items reported by the logged-in user
//          Includes private fields since this is their own report
// @route   GET /api/my/lost
// @access  Private
const getMyLostItems = asyncHandler(async (req, res) => {
  const lostItems = await LostItem.find({ user: req.user._id })
    .select('+uniqueMarks +ownershipDetails')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Your lost items fetched successfully', { lostItems });
});

// @desc    Get all found items reported by the logged-in user
//          Includes private fields since this is their own report
// @route   GET /api/my/found
// @access  Private
const getMyFoundItems = asyncHandler(async (req, res) => {
  const foundItems = await FoundItem.find({ user: req.user._id })
    .select('+uniqueMarks +additionalObservations')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Your found items fetched successfully', { foundItems });
});

// @desc    Get all matches related to the logged-in user's own reports
//          Only shows match info for items that belong to this user
// @route   GET /api/my/matches
// @access  Private
const getMyMatches = asyncHandler(async (req, res) => {
  // First get the IDs of this user's lost and found reports
  const [myLostItems, myFoundItems] = await Promise.all([
    LostItem.find({ user: req.user._id }).select('_id'),
    FoundItem.find({ user: req.user._id }).select('_id'),
  ]);

  const myLostItemIds = myLostItems.map((item) => item._id);
  const myFoundItemIds = myFoundItems.map((item) => item._id);

  // Fetch matches where this user is involved (as reporter of lost OR found)
  const matches = await Match.find({
    $or: [
      { lostItem: { $in: myLostItemIds } },
      { foundItem: { $in: myFoundItemIds } },
    ],
  })
    .populate({
      path: 'lostItem',
      // Include private fields only for their own lost items
      select: '+uniqueMarks +ownershipDetails',
      populate: { path: 'user', select: 'name' },
    })
    .populate({
      path: 'foundItem',
      // Include private fields only for their own found items
      select: '+uniqueMarks +additionalObservations',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ score: -1 });

  // For each match, scrub private data from items that don't belong to this user
  const sanitizedMatches = matches.map((match) => {
    const m = match.toObject();

    const lostBelongsToUser = myLostItemIds.some(
      (id) => id.toString() === m.lostItem?._id?.toString()
    );
    const foundBelongsToUser = myFoundItemIds.some(
      (id) => id.toString() === m.foundItem?._id?.toString()
    );

    // Strip private fields from items that don't belong to this user
    if (!lostBelongsToUser && m.lostItem) {
      delete m.lostItem.uniqueMarks;
      delete m.lostItem.ownershipDetails;
    }
    if (!foundBelongsToUser && m.foundItem) {
      delete m.foundItem.uniqueMarks;
      delete m.foundItem.additionalObservations;
    }

    return m;
  });

  sendSuccess(res, 200, 'Your matches fetched successfully', { matches: sanitizedMatches });
});

module.exports = { getMyLostItems, getMyFoundItems, getMyMatches };
