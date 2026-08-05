const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const { generateTextEmbedding } = require('./textEmbeddingService');
const { calculateHybridMatchScore, MATCH_THRESHOLDS, getMatchThreshold } = require('./matchingService');
const { createAndSendNotification } = require('./socketService');

/**
 * Ensures text embeddings for an item are generated and cached in MongoDB
 */
const ensureItemEmbeddingsCached = async (item, itemModel) => {
  // We check if embeddings exist, if not, generate and save them
  let updated = false;

  if (!item.titleEmbedding || item.titleEmbedding.length === 0) {
    item.titleEmbedding = await generateTextEmbedding(item.itemType || item.category || '');
    updated = true;
  }
  if (!item.descriptionEmbedding || item.descriptionEmbedding.length === 0) {
    item.descriptionEmbedding = await generateTextEmbedding(item.description || '');
    updated = true;
  }
  if (!item.locationEmbedding || item.locationEmbedding.length === 0) {
    item.locationEmbedding = await generateTextEmbedding(item.location || '');
    updated = true;
  }

  if (updated) {
    item.embeddingVersion = 'v2';
    await itemModel.findByIdAndUpdate(item._id, {
      titleEmbedding: item.titleEmbedding,
      descriptionEmbedding: item.descriptionEmbedding,
      locationEmbedding: item.locationEmbedding,
      embeddingVersion: 'v2',
    });
  }
};

/**
 * Runs asynchronous background matching for a newly created or updated item.
 * Runs non-blocking using setImmediate / background async worker.
 * 
 * @param {string} itemId - Database _id of the item
 * @param {'lost' | 'found'} itemType - Category of the newly reported item
 */
const runAsyncMatching = (itemId, itemType) => {
  setImmediate(async () => {
    try {
      if (itemType === 'lost') {
        await matchLostItemAsync(itemId);
      } else if (itemType === 'found') {
        await matchFoundItemAsync(itemId);
      }
    } catch (err) {
      console.error(`[AI Hybrid Queue] Error in async matching for ${itemType} item ${itemId}:`, err.message);
      if (itemType === 'lost') {
        await LostItem.findByIdAndUpdate(itemId, { matchingStatus: 'failed' }).catch(() => {});
      } else {
        await FoundItem.findByIdAndUpdate(itemId, { matchingStatus: 'failed' }).catch(() => {});
      }
    }
  });
};

/**
 * Compares a single Lost Item against all open Found Items asynchronously
 */
const matchLostItemAsync = async (lostItemId) => {
  const lostItem = await LostItem.findById(lostItemId).select('+uniqueMarks +ownershipDetails');
  if (!lostItem) return;

  await LostItem.findByIdAndUpdate(lostItemId, { matchingStatus: 'processing' });
  await ensureItemEmbeddingsCached(lostItem, LostItem);

  const openFoundItems = await FoundItem.find({ status: { $in: ['Pending', 'Matched'] } }).select('+uniqueMarks +additionalObservations');
  let hasHighMatch = false;

  for (const foundItem of openFoundItems) {
    await ensureItemEmbeddingsCached(foundItem, FoundItem);

    // Calculate Hybrid Match Score (semantic embeddings + image embeddings)
    const matchResult = await calculateHybridMatchScore(lostItem, foundItem);

    // Print logs
    console.log('----------------------------------------------------');
    matchResult.logs.forEach((line) => console.log(line));
    console.log('----------------------------------------------------');

    if (matchResult.score >= MATCH_THRESHOLDS.HIGH || matchResult.isAiMatch) {
      hasHighMatch = true;
    }

    // Save or delete match based on confidence score threshold
    if (matchResult.score >= 30 || matchResult.isAiMatch) {
      const savedMatch = await Match.findOneAndUpdate(
        { lostItem: lostItem._id, foundItem: foundItem._id },
        {
          score: matchResult.score,
          matchLevel: matchResult.matchLevel,
          matchedFields: matchResult.matchedFields,
          imageSimilarityScore: matchResult.imageSimilarityScore,
          isAiMatch: matchResult.isAiMatch,
          aiConfidence: matchResult.aiConfidence,
          semanticSimilarity: matchResult.semanticSimilarity,
          titleSimilarity: matchResult.titleSimilarity,
          descriptionSimilarity: matchResult.descriptionSimilarity,
          locationSimilarity: matchResult.locationSimilarity,
          overallTextSimilarity: matchResult.overallTextSimilarity,
          finalConfidenceScore: matchResult.finalConfidenceScore,
          matchingMethod: matchResult.matchingMethod,
          matchingVersion: matchResult.matchingVersion,
          explanation: matchResult.explanation,
          matchLogs: matchResult.logs,
          matchingStatus: 'completed',
          lastMatchedAt: Date.now(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Fire real-time notifications for high confidence matches
      if (matchResult.isAiMatch && matchResult.score >= MATCH_THRESHOLDS.HIGH) {
        // Notify the lost item owner
        if (lostItem.user) {
          createAndSendNotification({
            title: '\u2728 New AI Match Found!',
            message: `Our AI found a potential match for your "${lostItem.itemType || lostItem.category}" with ${matchResult.finalConfidenceScore || matchResult.score}% confidence. Check your matches now!`,
            notificationType: 'match',
            userId: lostItem.user,
            relatedMatch: savedMatch._id,
            relatedItem: lostItem._id,
            itemModel: 'LostItem',
            priority: 'high',
          }).catch((e) => console.error('[Notification] AI match lost owner:', e.message));
        }
        // Notify admins of high confidence match
        createAndSendNotification({
          title: '\ud83e\udde0 High Confidence AI Match',
          message: `AI detected a ${matchResult.finalConfidenceScore || matchResult.score}% confidence match: "${lostItem.itemType || lostItem.category}" vs "${foundItem.itemType || foundItem.category}". Review recommended.`,
          notificationType: 'high_confidence',
          isAdminNotification: true,
          relatedMatch: savedMatch._id,
          priority: 'high',
        }).catch((e) => console.error('[Notification] AI match admin:', e.message));
      }
    } else {
      await Match.deleteOne({ lostItem: lostItem._id, foundItem: foundItem._id });
    }
  }

  const updateData = { matchingStatus: 'completed' };
  if (hasHighMatch && lostItem.status === 'Pending') {
    updateData.status = 'Matched';
  }
  await LostItem.findByIdAndUpdate(lostItemId, updateData);
};

/**
 * Compares a single Found Item against all open Lost Items asynchronously
 */
const matchFoundItemAsync = async (foundItemId) => {
  const foundItem = await FoundItem.findById(foundItemId).select('+uniqueMarks +additionalObservations');
  if (!foundItem) return;

  await FoundItem.findByIdAndUpdate(foundItemId, { matchingStatus: 'processing' });
  await ensureItemEmbeddingsCached(foundItem, FoundItem);

  const openLostItems = await LostItem.find({ status: { $in: ['Pending', 'Matched'] } }).select('+uniqueMarks +ownershipDetails');
  let hasHighMatch = false;

  for (const lostItem of openLostItems) {
    await ensureItemEmbeddingsCached(lostItem, LostItem);

    // Calculate Hybrid Match Score (semantic embeddings + image embeddings)
    const matchResult = await calculateHybridMatchScore(lostItem, foundItem);

    // Print logs
    console.log('----------------------------------------------------');
    matchResult.logs.forEach((line) => console.log(line));
    console.log('----------------------------------------------------');

    if (matchResult.score >= MATCH_THRESHOLDS.HIGH || matchResult.isAiMatch) {
      hasHighMatch = true;
    }

    if (matchResult.score >= 30 || matchResult.isAiMatch) {
      await Match.findOneAndUpdate(
        { lostItem: lostItem._id, foundItem: foundItem._id },
        {
          score: matchResult.score,
          matchLevel: matchResult.matchLevel,
          matchedFields: matchResult.matchedFields,
          imageSimilarityScore: matchResult.imageSimilarityScore,
          isAiMatch: matchResult.isAiMatch,
          aiConfidence: matchResult.aiConfidence,
          semanticSimilarity: matchResult.semanticSimilarity,
          titleSimilarity: matchResult.titleSimilarity,
          descriptionSimilarity: matchResult.descriptionSimilarity,
          locationSimilarity: matchResult.locationSimilarity,
          overallTextSimilarity: matchResult.overallTextSimilarity,
          finalConfidenceScore: matchResult.finalConfidenceScore,
          matchingMethod: matchResult.matchingMethod,
          matchingVersion: matchResult.matchingVersion,
          explanation: matchResult.explanation,
          matchLogs: matchResult.logs,
          matchingStatus: 'completed',
          lastMatchedAt: Date.now(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      await Match.deleteOne({ lostItem: lostItem._id, foundItem: foundItem._id });
    }
  }

  const updateData = { matchingStatus: 'completed' };
  if (hasHighMatch && foundItem.status === 'Pending') {
    updateData.status = 'Matched';
  }
  await FoundItem.findByIdAndUpdate(foundItemId, updateData);
};

/**
 * Recalculates all existing matches in MongoDB to purge false positives
 */
const recalculateAllMatches = async () => {
  console.log('[AI Hybrid Queue] Recalculating all matches in database with Hybrid Semantic model...');
  const allLost = await LostItem.find();
  for (const item of allLost) {
    await matchLostItemAsync(item._id);
  }
  console.log('[AI Hybrid Queue] All matches recalculated successfully.');
};

module.exports = {
  runAsyncMatching,
  matchLostItemAsync,
  matchFoundItemAsync,
  recalculateAllMatches,
};
