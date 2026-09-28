const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { findMatchesForLostItem, MATCH_THRESHOLDS } = require('../services/matchingService');
const { runAsyncMatching } = require('../services/asyncMatchingQueue');
const { getSearchQuerySynonyms } = require('../services/textEmbeddingService');
const { createAndSendNotification } = require('../services/socketService');
const { escapeRegex, assertValidObjectId, rejectFutureDate } = require('../middleware/validate');

// @desc    Create a new lost item report and run matching against open found items
// @route   POST /api/lost
// @access  Private
const createLostItem = asyncHandler(async (req, res) => {
  const {
    itemType, category, brand, color, model, description,
    location, dateLost, uniqueMarks, ownershipDetails,
  } = req.body;

  if (!itemType || !category || !location || !dateLost) {
    throw new ApiError(400, 'Item Type, Category, Location, and Date Lost are required fields.');
  }

  // Business rule: only today and previous calendar dates are allowed.
  // Enforced server-side so a crafted request cannot bypass the frontend's
  // date-picker max attribute. Comparison uses local calendar-day semantics
  // (rejectFutureDate) to avoid the UTC-midnight bug with YYYY-MM-DD inputs.
  rejectFutureDate(dateLost, 'Date Lost');

  const image = req.file ? (req.file.path || req.file.secure_url) : '';

  const lostItem = await LostItem.create({
    user: req.user._id,
    itemType,
    category,
    brand,
    color,
    model,
    description,
    location,
    dateLost,
    image,
    uniqueMarks: uniqueMarks || '',
    ownershipDetails: ownershipDetails || '',
    matchingStatus: 'processing',
  });

  // Run immediate fast attribute matching for instant feedback
  const openFoundItems = await FoundItem.find({ status: 'Pending' }).select('+uniqueMarks +additionalObservations');
  const calculatedMatches = findMatchesForLostItem(lostItem, openFoundItems);
  const matchesToSave = calculatedMatches.filter((m) => m.score > 0);

  await Promise.all(
    matchesToSave.map((m) =>
      Match.findOneAndUpdate(
        { lostItem: lostItem._id, foundItem: m.foundItem._id },
        { score: m.score, matchLevel: m.matchLevel, matchedFields: m.matchedFields, status: 'Pending' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  const hasHighMatch = calculatedMatches.some((m) => m.score >= MATCH_THRESHOLDS.HIGH);
  if (hasHighMatch) {
    lostItem.status = 'Matched';
    await lostItem.save();
  }

  // Trigger non-blocking asynchronous AI image matching in the background
  runAsyncMatching(lostItem._id, 'lost');

  // Notify admins of new lost item report (non-blocking)
  createAndSendNotification({
    title: '📋 New Lost Report Submitted',
    message: `${req.user.name} reported a lost ${itemType || category} at ${location}.`,
    notificationType: 'new_lost',
    isAdminNotification: true,
    relatedItem: lostItem._id,
    itemModel: 'LostItem',
    priority: 'medium',
  }).catch((e) => console.error('[Notification] Error on new lost report:', e.message));

  sendSuccess(res, 201, 'Lost item created successfully', { lostItem });
});

// @desc    Get all lost items — public fields only (search, filter, pagination)
// @route   GET /api/lost
// @access  Private
const getLostItems = asyncHandler(async (req, res) => {
  const { search, category, location, page = 1, limit = 10 } = req.query;

  const filter = {};

  if (search) {
    const synonyms = getSearchQuerySynonyms(search);
    // Escape every term before $regex use — user input must never be
    // interpreted as regex syntax (injection/crash prevention).
    const regexTerms = synonyms.map((term) => ({
      $or: [
        { itemType: { $regex: escapeRegex(term), $options: 'i' } },
        { category: { $regex: escapeRegex(term), $options: 'i' } },
        { description: { $regex: escapeRegex(term), $options: 'i' } },
      ],
    }));
    filter.$or = regexTerms.flat();
  }

  if (category) {
    filter.category = { $regex: escapeRegex(category), $options: 'i' };
  }

  if (location) {
    filter.location = { $regex: escapeRegex(location), $options: 'i' };
  }

  const pageNumber = Number(page) || 1;
  const pageSize = Number(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

  const [lostItems, totalCount] = await Promise.all([
    // Do NOT select private fields here (public listing)
    LostItem.find(filter)
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    LostItem.countDocuments(filter),
  ]);

  sendSuccess(res, 200, 'Lost items fetched successfully', {
    lostItems,
    pagination: {
      total: totalCount,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
});

// @desc    Get a single lost item by id
//          Private fields are included only if the requester is the owner or admin
// @route   GET /api/lost/:id
// @access  Private
const getLostItemById = asyncHandler(async (req, res) => {
  // Reject malformed ids with a clean 400 before any DB query runs.
  assertValidObjectId(req.params.id, 'Lost item ID');

  const isOwnerOrAdmin = req.user.role === 'admin';

  let query = LostItem.findById(req.params.id).populate('user', 'name email');

  // Temporarily fetch without select to check ownership
  const lostItemBase = await LostItem.findById(req.params.id);

  if (!lostItemBase) {
    throw new ApiError(404, 'Lost item not found');
  }

  const isOwner = lostItemBase.user.toString() === req.user._id.toString();

  if (isOwner || isOwnerOrAdmin) {
    // Include private fields
    query = LostItem.findById(req.params.id)
      .populate('user', 'name email')
      .select('+uniqueMarks +ownershipDetails');
  }

  const lostItem = await query;

  sendSuccess(res, 200, 'Lost item fetched successfully', { lostItem });
});

// @desc    Update a lost item (only the owner can update it)
// @route   PUT /api/lost/:id
// @access  Private
const updateLostItem = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.id).select('+uniqueMarks +ownershipDetails');

  if (!lostItem) {
    throw new ApiError(404, 'Lost item not found');
  }

  if (lostItem.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to edit this report');
  }

  if (
    !req.body.itemType ||
    !req.body.category ||
    !req.body.location ||
    !req.body.dateLost
  ) {
    throw new ApiError(400, 'Item Type, Category, Location, and Date Lost are required fields.');
  }

  // Same calendar-day rule as creation, applied to updates.
  rejectFutureDate(req.body.dateLost, 'Date Lost');

  const fieldsToUpdate = [
    'itemType', 'category', 'color', 'brand', 'model',
    'description', 'location', 'dateLost',
    'uniqueMarks', 'ownershipDetails',
  ];

  if (
    !req.body.itemType || 
    !req.body.category || 
    !req.body.location || 
    !req.body.dateLost
  ) {
    throw new ApiError(400, 'Item Type, Category, Location, and Date Lost are required fields.');
  }

  fieldsToUpdate.forEach((field) => {
    if (req.body[field] !== undefined) {
      lostItem[field] = req.body[field];
    }
  });

  if (req.file) {
    lostItem.image = req.file.path || req.file.secure_url;
  }

  lostItem.matchingStatus = 'processing';
  const updatedLostItem = await lostItem.save();

  runAsyncMatching(updatedLostItem._id, 'lost');

  sendSuccess(res, 200, 'Lost item updated successfully', { lostItem: updatedLostItem });
});

// @desc    Delete a lost item (only the owner can delete it)
// @route   DELETE /api/lost/:id
// @access  Private
const deleteLostItem = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.id);

  if (!lostItem) {
    throw new ApiError(404, 'Lost item not found');
  }

  if (lostItem.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this report');
  }

  await lostItem.deleteOne();
  // Clean up related matches
  await Match.deleteMany({ lostItem: lostItem._id });

  sendSuccess(res, 200, 'Lost item deleted successfully', {});
});

module.exports = {
  createLostItem,
  getLostItems,
  getLostItemById,
  updateLostItem,
  deleteLostItem,
};
