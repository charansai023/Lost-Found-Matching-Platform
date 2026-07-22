const FoundItem = require('../models/FoundItem');
const LostItem = require('../models/LostItem');
const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { findMatchesForFoundItem, calculateMatchScore, MATCH_THRESHOLDS } = require('../services/matchingService');

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
  });

  // Compare against every Pending lost item (include private fields for better matching)
  const openLostItems = await LostItem.find({ status: 'Pending' }).select('+uniqueMarks +ownershipDetails');
  const calculatedMatches = findMatchesForFoundItem(foundItem, openLostItems);

  // Persist all matches with a non-zero score
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

  // If linkedLostItemId is provided (from "I Found This Item" button),
  // force-upsert the match for that specific pair even if score was 0
  if (linkedLostItemId) {
    const linkedLostItem = await LostItem.findById(linkedLostItemId).select('+uniqueMarks +ownershipDetails');
    if (linkedLostItem) {
      const { score, matchLevel, matchedFields } = calculateMatchScore(linkedLostItem, foundItem);
      await Match.findOneAndUpdate(
        { lostItem: linkedLostItem._id, foundItem: foundItem._id },
        { score, matchLevel, matchedFields, status: 'Pending' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      // Mark both items as Matched
      linkedLostItem.status = 'Matched';
      await linkedLostItem.save();
      foundItem.status = 'Matched';
      await foundItem.save();
    }
  } else {
    // If there is at least one high match, mark this found item as Matched
    const hasHighMatch = calculatedMatches.some((m) => m.score >= MATCH_THRESHOLDS.HIGH);
    if (hasHighMatch) {
      foundItem.status = 'Matched';
      await foundItem.save();
    }
  }

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
    filter.$or = [
      { itemType: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
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

  const updatedFoundItem = await foundItem.save();

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
