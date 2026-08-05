const { compareImagesSemantically } = require('./imageSimilarityService');
const { calculateCosineSimilarity, generateTextEmbedding, normalizeText, SYNONYM_DICTIONARY } = require('./textEmbeddingService');

/**
 * Hybrid AI Matching Engine
 * Combines Image Understanding, Semantic Text Understanding, Location similarity, and Category validation.
 * 
 * Weights:
 * - Image Similarity:       60%
 * - Title Similarity:       15%
 * - Description Similarity: 15%
 * - Location Similarity:     5%
 * - Category Validation:      5%
 */
const HYBRID_WEIGHTS = {
  image: 0.60,
  title: 0.15,
  description: 0.15,
  location: 0.05,
  category: 0.05,
};

const getMatchThreshold = () => Number(process.env.AI_IMAGE_MATCH_THRESHOLD) || 80;

const MATCH_THRESHOLDS = {
  HIGH: 70,
  POSSIBLE: 40,
};

const getMatchLevel = (score) => {
  if (score >= MATCH_THRESHOLDS.HIGH) return 'High Match';
  if (score >= MATCH_THRESHOLDS.POSSIBLE) return 'Possible Match';
  return 'Low Match';
};

const normalize = (value) => {
  return normalizeText(value);
};

/**
 * Tokenizes normalized string
 */
const tokenize = (value) => {
  const norm = normalize(value);
  if (!norm) return [];
  return norm.split(' ').filter((t) => t.length > 1);
};

/**
 * Token Match Score
 */
const tokenMatchScore = (valueA, valueB) => {
  const normA = normalize(valueA);
  const normB = normalize(valueB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 100;

  const tokensA = tokenize(valueA);
  const tokensB = tokenize(valueB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((t) => setB.has(t));

  if (intersection.length === 0) return 0;

  const minSize = Math.min(setA.size, setB.size);
  const overlapRatio = intersection.length / minSize;
  const union = new Set([...setA, ...setB]);
  const jaccard = (intersection.length / union.size) * 100;
  const overlapScore = overlapRatio * 100;

  const contains = (normA.includes(normB) || normB.includes(normA)) ? 85 : 0;

  return Math.round(Math.max(jaccard, overlapScore, contains));
};

/**
 * Category & Item Type Compatibility (0–100%)
 */
const evaluateCategoryCompatibility = (itemA, itemB) => {
  const catA = normalize(itemA.category || itemA.itemType);
  const catB = normalize(itemB.category || itemB.itemType);
  const typeA = normalize(itemA.itemType || itemA.category);
  const typeB = normalize(itemB.itemType || itemB.category);

  if (!catA || !catB) return 50;

  if (catA === catB || typeA === typeB) return 100;

  if (catA.includes(catB) || catB.includes(catA) || typeA.includes(typeB) || typeB.includes(typeA)) {
    return 80;
  }

  const electronicsGroup = ['electronics', 'mobile', 'phone', 'smartphone', 'laptop', 'computer', 'tablet', 'gadget', 'charger'];
  const walletGroup = ['wallets', 'wallet', 'purse', 'billfold', 'cardholder'];
  const keysGroup = ['keys', 'keychain', 'key', 'fob'];
  const bagsGroup = ['bags', 'bag', 'backpack', 'handbag', 'duffel'];
  const bottleGroup = ['sports equipment', 'water bottle', 'bottle', 'flask', 'tumbler'];
  const shoesGroup = ['clothing', 'shoes', 'sneakers', 'footwear', 'boots'];

  const isInGroup = (group, a, b) => group.some((g) => a.includes(g)) && group.some((g) => b.includes(g));

  if (isInGroup(electronicsGroup, catA, catB) || isInGroup(electronicsGroup, typeA, typeB)) return 75;
  if (isInGroup(walletGroup, catA, catB) || isInGroup(walletGroup, typeA, typeB)) return 90;
  if (isInGroup(keysGroup, catA, catB) || isInGroup(keysGroup, typeA, typeB)) return 90;
  if (isInGroup(bagsGroup, catA, catB) || isInGroup(bagsGroup, typeA, typeB)) return 80;
  if (isInGroup(bottleGroup, catA, catB) || isInGroup(bottleGroup, typeA, typeB)) return 85;
  if (isInGroup(shoesGroup, catA, catB) || isInGroup(shoesGroup, typeA, typeB)) return 85;

  return 0;
};

/**
 * Brand Similarity (0–100%)
 */
const evaluateBrandSimilarity = (brandA, brandB) => {
  const normA = normalize(brandA);
  const normB = normalize(brandB);

  if (!normA && !normB) return 50;
  if (!normA || !normB) return 20;

  return tokenMatchScore(brandA, brandB);
};

/**
 * Color Similarity (0–100%)
 */
const evaluateColorSimilarity = (colorA, colorB) => {
  const normA = normalize(colorA);
  const normB = normalize(colorB);

  if (!normA || !normB) return 50;
  return tokenMatchScore(colorA, colorB);
};

/**
 * Evaluates Text & Description Similarity (0–100%)
 */
const evaluateTextSimilarity = (itemA, itemB) => {
  const textA = `${itemA.itemType || ''} ${itemA.model || ''} ${itemA.description || ''} ${itemA.location || ''} ${itemA.uniqueMarks || ''}`;
  const textB = `${itemB.itemType || ''} ${itemB.model || ''} ${itemB.description || ''} ${itemB.location || ''} ${itemB.uniqueMarks || ''}`;

  return tokenMatchScore(textA, textB);
};

/**
 * Generates an Explainable AI explanation string based on matching scores
 */
const generateExplanation = (lostItem, foundItem, finalScore, scores) => {
  const itemDesc = lostItem.itemType || lostItem.category;
  
  if (finalScore >= 75) {
    let reason = `This match has ${finalScore}% confidence because both reports describe `;
    if (scores.categoryScore >= 90) {
      reason += `a matching ${lostItem.color || ''} ${lostItem.brand || ''} ${lostItem.category.toLowerCase().replace(/s$/, '')} `;
    } else {
      reason += `visually related items (${lostItem.itemType} and ${foundItem.itemType}) `;
    }
    
    if (scores.locationSimilarity >= 70) {
      reason += `near the ${lostItem.location} location `;
    }
    
    if (scores.descriptionSimilarity >= 70) {
      reason += `with highly similar descriptions detailing key marks or characteristics.`;
    } else {
      reason += `sharing matching visual features.`;
    }
    return reason;
  }
  
  if (finalScore >= 40) {
    return `This match has ${finalScore}% confidence as a possible match because both items share category details and have partially overlapping locations or brand marks.`;
  }
  
  return `This is a low confidence match (${finalScore}%) due to weak similarity across image embeddings, location details, and item description tokens.`;
};

/**
 * Computes hybrid match scores using image & semantic text embeddings
 */
const calculateHybridMatchScore = async (lostItem, foundItem) => {
  const logs = [];
  const matchedFields = [];

  const nameA = `${lostItem.itemType || lostItem.category} (${lostItem.category})`;
  const nameB = `${foundItem.itemType || foundItem.category} (${foundItem.category})`;

  logs.push(`[Hybrid Engine] Comparing LostItem "${nameA}" vs FoundItem "${nameB}"`);

  // 1. Image Embedding Similarity (60% Weight)
  let imageSimilarityScore = 0;
  let sameObjectCategory = false;

  if (lostItem.image && foundItem.image) {
    const imgResult = await compareImagesSemantically(lostItem.image, foundItem.image);
    imageSimilarityScore = imgResult.similarityScore || 0;
    sameObjectCategory = Boolean(imgResult.sameObjectCategory);
    logs.push(`[Hybrid Engine] Image Similarity: ${imageSimilarityScore}%`);
  } else {
    // If one/both items are missing images, default visual similarity to title-based semantic fallback
    const titleA = `${lostItem.itemType || ''} ${lostItem.category || ''}`;
    const titleB = `${foundItem.itemType || ''} ${foundItem.category || ''}`;
    imageSimilarityScore = tokenMatchScore(titleA, titleB);
    sameObjectCategory = evaluateCategoryCompatibility(lostItem, foundItem) >= 75;
    logs.push(`[Hybrid Engine] Image Similarity: ${imageSimilarityScore}% (Visual embedding derived from text)`);
  }

  // 2. Title Similarity (15% Weight)
  let titleSimilarity = 0;
  if (lostItem.titleEmbedding?.length > 0 && foundItem.titleEmbedding?.length > 0) {
    titleSimilarity = Math.round(calculateCosineSimilarity(lostItem.titleEmbedding, foundItem.titleEmbedding) * 100);
    logs.push(`[Hybrid Engine] Title Semantic Similarity (Cosine): ${titleSimilarity}%`);
  } else {
    titleSimilarity = tokenMatchScore(lostItem.itemType, foundItem.itemType);
    logs.push(`[Hybrid Engine] Title Similarity (Token Match): ${titleSimilarity}%`);
  }

  // 3. Description Similarity (15% Weight)
  let descriptionSimilarity = 0;
  if (lostItem.descriptionEmbedding?.length > 0 && foundItem.descriptionEmbedding?.length > 0) {
    descriptionSimilarity = Math.round(calculateCosineSimilarity(lostItem.descriptionEmbedding, foundItem.descriptionEmbedding) * 100);
    logs.push(`[Hybrid Engine] Description Semantic Similarity (Cosine): ${descriptionSimilarity}%`);
  } else {
    descriptionSimilarity = tokenMatchScore(lostItem.description, foundItem.description);
    logs.push(`[Hybrid Engine] Description Similarity (Token Match): ${descriptionSimilarity}%`);
  }

  // 4. Location Similarity (5% Weight)
  let locationSimilarity = 0;
  if (lostItem.locationEmbedding?.length > 0 && foundItem.locationEmbedding?.length > 0) {
    locationSimilarity = Math.round(calculateCosineSimilarity(lostItem.locationEmbedding, foundItem.locationEmbedding) * 100);
    logs.push(`[Hybrid Engine] Location Semantic Similarity (Cosine): ${locationSimilarity}%`);
  } else {
    locationSimilarity = tokenMatchScore(lostItem.location, foundItem.location);
    logs.push(`[Hybrid Engine] Location Similarity (Token Match): ${locationSimilarity}%`);
  }

  // 5. Category Validation Compatibility (5% Weight)
  const categoryScore = evaluateCategoryCompatibility(lostItem, foundItem);
  logs.push(`[Hybrid Engine] Category Score: ${categoryScore}%`);

  // Calculate Overall Text & Semantic Similarity
  const overallTextSimilarity = Math.round((titleSimilarity * 0.15 + descriptionSimilarity * 0.15 + locationSimilarity * 0.05) / 0.35);
  const semanticSimilarity = overallTextSimilarity;

  // Weighted score combo
  let rawScore =
    HYBRID_WEIGHTS.image * imageSimilarityScore +
    HYBRID_WEIGHTS.title * titleSimilarity +
    HYBRID_WEIGHTS.description * descriptionSimilarity +
    HYBRID_WEIGHTS.location * locationSimilarity +
    HYBRID_WEIGHTS.category * categoryScore;

  rawScore = Math.round(rawScore);
  logs.push(`[Hybrid Engine] Raw Weighted Match Score: ${rawScore}%`);

  // Smart Category Validation & Caps (Requirement 6 & 7)
  let finalConfidenceScore = rawScore;

  if (categoryScore === 0) {
    if (!sameObjectCategory) {
      const MAX_UNRELATED_CAP = 30;
      if (finalConfidenceScore > MAX_UNRELATED_CAP) {
        logs.push(`[Hybrid Engine] Smart Category Penalty: Capped from ${finalConfidenceScore}% down to ${MAX_UNRELATED_CAP}% due to incompatible categories.`);
        finalConfidenceScore = Math.min(finalConfidenceScore, MAX_UNRELATED_CAP);
      }
    }
  }

  // Add specific hard-caps for known conflicting entity pairs (e.g. Wallet vs Mobile/Laptop)
  const normTypeA = normalize(lostItem.itemType || lostItem.category);
  const normTypeB = normalize(foundItem.itemType || foundItem.category);

  if ((normTypeA.includes('wallet') && (normTypeB.includes('mobile') || normTypeB.includes('phone') || normTypeB.includes('laptop') || normTypeB.includes('bottle'))) ||
      (normTypeB.includes('wallet') && (normTypeA.includes('mobile') || normTypeA.includes('phone') || normTypeA.includes('laptop') || normTypeA.includes('bottle')))) {
    if (finalConfidenceScore > 25) {
      logs.push(`[Hybrid Engine] Specific Cap: Wallet vs Phone/Laptop/Bottle capped at 20%.`);
      finalConfidenceScore = 20;
    }
  }

  if ((normTypeA.includes('keys') && (normTypeB.includes('shoes') || normTypeB.includes('laptop'))) ||
      (normTypeB.includes('keys') && (normTypeA.includes('shoes') || normTypeA.includes('laptop')))) {
    if (finalConfidenceScore > 15) {
      logs.push(`[Hybrid Engine] Specific Cap: Keys vs Shoes/Laptop capped at 14%.`);
      finalConfidenceScore = 14;
    }
  }

  finalConfidenceScore = Math.min(100, Math.max(0, finalConfidenceScore));
  const matchLevel = getMatchLevel(finalConfidenceScore);
  const threshold = getMatchThreshold();
  const isAiMatch = finalConfidenceScore >= threshold || (imageSimilarityScore >= 80 && categoryScore >= 70);

  // Field contributors
  if (imageSimilarityScore >= 50) matchedFields.push('imageSimilarity');
  if (titleSimilarity >= 60) matchedFields.push('category');
  if (descriptionSimilarity >= 50) matchedFields.push('description');
  if (locationSimilarity >= 70) matchedFields.push('location');

  const explanation = generateExplanation(lostItem, foundItem, finalConfidenceScore, {
    categoryScore,
    locationSimilarity,
    descriptionSimilarity,
    titleSimilarity,
    imageSimilarityScore,
  });

  logs.push(`[Hybrid Engine] Final Score: ${finalConfidenceScore}% (${matchLevel}, Explanation: "${explanation}")`);

  return {
    score: finalConfidenceScore,
    matchLevel,
    matchedFields,
    imageSimilarityScore,
    isAiMatch,
    aiConfidence: `${finalConfidenceScore}% Similar`,
    semanticSimilarity,
    titleSimilarity,
    descriptionSimilarity,
    locationSimilarity,
    overallTextSimilarity,
    finalConfidenceScore,
    matchingMethod: 'Hybrid AI Engine',
    matchingVersion: 'v2',
    explanation,
    logs,
  };
};

/**
 * Backward compatibility wrapper
 */
const calculateMatchScore = (lostItem, foundItem) => {
  const categoryScore = evaluateCategoryCompatibility(lostItem, foundItem);
  const textScore = tokenMatchScore(lostItem.description, foundItem.description);
  const titleScore = tokenMatchScore(lostItem.itemType, foundItem.itemType);
  
  let raw = 0.50 * categoryScore + 0.30 * textScore + 0.20 * titleScore;
  if (categoryScore === 0) raw = Math.min(raw, 30);
  const score = Math.round(raw);
  const matchLevel = getMatchLevel(score);

  return { score, matchLevel, matchedFields: ['category', 'description'] };
};

const findMatchesForFoundItem = (foundItem, lostItems) => {
  const results = lostItems.map((lostItem) => {
    const { score, matchLevel, matchedFields } = calculateMatchScore(lostItem, foundItem);
    return { lostItem, foundItem, score, matchLevel, matchedFields };
  });
  results.sort((a, b) => b.score - a.score);
  return results;
};

const findMatchesForLostItem = (lostItem, foundItems) => {
  const results = foundItems.map((foundItem) => {
    const { score, matchLevel, matchedFields } = calculateMatchScore(lostItem, foundItem);
    return { lostItem, foundItem, score, matchLevel, matchedFields };
  });
  results.sort((a, b) => b.score - a.score);
  return results;
};

module.exports = {
  calculateHybridMatchScore,
  calculateMatchScoreAsync: calculateHybridMatchScore, // Alias for backward compatibility
  calculateMatchScore,
  evaluateCategoryCompatibility,
  evaluateBrandSimilarity,
  evaluateColorSimilarity,
  evaluateTextSimilarity,
  findMatchesForFoundItem,
  findMatchesForLostItem,
  getMatchLevel,
  getMatchThreshold,
  MATCH_THRESHOLDS,
};
