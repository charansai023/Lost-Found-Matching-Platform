const FoundItem = require('../models/FoundItem');
const LostItem = require('../models/LostItem');
const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { findMatchesForFoundItem, calculateMatchScore, MATCH_THRESHOLDS } = require('../services/matchingService');
const { runAsyncMatching } = require('../services/asyncMatchingQueue');
const { getSearchQuerySynonyms } = require('../services/textEmbeddingService');
const { createAndSendNotification } = require('../services/socketService');

// @desc    Create a new found item report and automatically run matching
// @route   POST /api/found
// @access  Private
const createFoundItem = asyncHandler(async (req, res) => {
  const {
    itemType, category, brand, color, model, description,
    location, dateFound, uniqueMarks, additionalObservations,
    linkedLostItemId,
  } = req.body;

  const image = req.file ? `/uploads/${req.file.filename}` : '';

  const foundItem = await FoundItem.create({
    user: req.user._id,
    itemType,
    category,
    brand,
    color,
    model,
    description,
    location,
    dateFound,
    image,
    uniqueMarks: uniqueMarks || '',
    additionalObservations: additionalObservations || '',
    matchingStatus: 'processing',
  });

  // Compare against every Pending lost item
  const openLostItems = await LostItem.find({ status: 'Pending' }).select('+uniqueMarks +ownershipDetails');
  const calculatedMatches = findMatchesForFoundItem(foundItem, openLostItems);

  const matchesToSave = calculatedMatches.filter((m) => m.score > 0);

  await Promise.all(
    matchesToSave.map((m) =>
      Match.findOneAndUpdate(
        { lostItem: m.lostItem._id, foundItem: foundItem._id },
        { score: m.score, matchLevel: m.matchLevel, matchedFields: m.matchedFields, status: 'Pending' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  if (linkedLostItemId) {
    const linkedLostItem = await LostItem.findById(linkedLostItemId).select('+uniqueMarks +ownershipDetails');
    if (linkedLostItem) {
      const { score, matchLevel, matchedFields } = calculateMatchScore(linkedLostItem, foundItem);
      await Match.findOneAndUpdate(
        { lostItem: linkedLostItem._id, foundItem: foundItem._id },
        { score, matchLevel, matchedFields, status: 'Pending' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      linkedLostItem.status = 'Matched';
      await linkedLostItem.save();
      foundItem.status = 'Matched';
      await foundItem.save();
    }
  } else {
    const hasHighMatch = calculatedMatches.some((m) => m.score >= MATCH_THRESHOLDS.HIGH);
    if (hasHighMatch) {
      foundItem.status = 'Matched';
      await foundItem.save();
    }
  }

  // Trigger non-blocking asynchronous AI image matching in the background
  runAsyncMatching(foundItem._id, 'found');

  // Notify admins of new found item report (non-blocking)
  createAndSendNotification({
    title: '📦 New Found Report Submitted',
    message: `${req.user.name} reported a found ${itemType || category} at ${location}.`,
    notificationType: 'new_found',
    isAdminNotification: true,
    relatedItem: foundItem._id,
    itemModel: 'FoundItem',
    priority: 'medium',
  }).catch((e) => console.error('[Notification] Error on new found report:', e.message));

  sendSuccess(res, 201, 'Found item created successfully', {
    foundItem,
    matchCount: matchesToSave.length,
  });
});

// @desc    Get all found items — public fields only (search, filter, pagination)
// @route   GET /api/found
// @access  Private
const getFoundItems = asyncHandler(async (req, res) => {
  const { search, category, location, page = 1, limit = 10 } = req.query;

  const filter = {};

  if (search) {
    const synonyms = getSearchQuerySynonyms(search);
    const regexTerms = synonyms.map((term) => ({
      $or: [
        { itemType: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ],
    }));
    filter.$or = regexTerms.flat();
  }

  if (category) {
    filter.category = { $regex: category, $options: 'i' };
  }

  if (location) {
    filter.location = { $regex: location, $options: 'i' };
  }

  const pageNumber = Number(page) || 1;
  const pageSize = Number(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

  const [foundItems, totalCount] = await Promise.all([
    // Public listing — do NOT expose private fields
    FoundItem.find(filter)
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    FoundItem.countDocuments(filter),
  ]);

  sendSuccess(res, 200, 'Found items fetched successfully', {
    foundItems,
    pagination: {
      total: totalCount,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
});

// @desc    Get a single found item by id
//          Private fields included only for owner or admin
// @route   GET /api/found/:id
// @access  Private
const getFoundItemById = asyncHandler(async (req, res) => {
  const foundItemBase = await FoundItem.findById(req.params.id);

  if (!foundItemBase) {
    throw new ApiError(404, 'Found item not found');
  }

  const isOwner = foundItemBase.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  let query = FoundItem.findById(req.params.id).populate('user', 'name email');

  if (isOwner || isAdmin) {
    query = query.select('+uniqueMarks +additionalObservations');
  }

  const foundItem = await query;

  sendSuccess(res, 200, 'Found item fetched successfully', { foundItem });
});

// @desc    Update a found item (only the owner can update it)
// @route   PUT /api/found/:id
// @access  Private
const updateFoundItem = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.id).select('+uniqueMarks +additionalObservations');

  if (!foundItem) {
    throw new ApiError(404, 'Found item not found');
  }

  if (foundItem.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to edit this report');
  }

  const fieldsToUpdate = [
    'itemType', 'category', 'color', 'brand', 'model',
    'description', 'location', 'dateFound',
    'uniqueMarks', 'additionalObservations',
  ];

  fieldsToUpdate.forEach((field) => {
    if (req.body[field] !== undefined) {
      foundItem[field] = req.body[field];
    }
  });

  if (req.file) {
    foundItem.image = `/uploads/${req.file.filename}`;
  }

  foundItem.matchingStatus = 'processing';
  const updatedFoundItem = await foundItem.save();

  runAsyncMatching(updatedFoundItem._id, 'found');

  sendSuccess(res, 200, 'Found item updated successfully', { foundItem: updatedFoundItem });
});

// @desc    Delete a found item (only the owner can delete it)
// @route   DELETE /api/found/:id
// @access  Private
const deleteFoundItem = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.id);

  if (!foundItem) {
    throw new ApiError(404, 'Found item not found');
  }

  if (foundItem.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this report');
  }

  await foundItem.deleteOne();
  await Match.deleteMany({ foundItem: foundItem._id });

  sendSuccess(res, 200, 'Found item deleted successfully', {});
});

module.exports = {
  createFoundItem,
  getFoundItems,
  getFoundItemById,
  updateFoundItem,
  deleteFoundItem,
};
