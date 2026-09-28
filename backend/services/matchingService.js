const { compareImagesSemantically, normalizeEngineName } = require('./imageSimilarityService');
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

// Phase 3: engine provenance for the image component.
// Controlled vocabulary persisted on Match documents:
//   'Gemini' | 'Fallback' | 'Identical File' | 'None' | 'Legacy'
// 'Legacy' is the display default for pre-Phase-3 Match records that have
// no provenance fields (no destructive migration required).
const IMAGE_ENGINES = ['Gemini', 'Fallback', 'Identical File', 'None', 'Legacy'];
const LEGACY_ENGINE = 'Legacy';

// Phase 3: conservative ceiling for the deterministic fallback image
// engine. Byte-statistic similarity is NOT semantic understanding, so its
// score can never exceed this (Genuine Gemini scores are uncapped). The
// image service already scales its output to this ceiling.
const FALLBACK_IMAGE_MAX = 60;

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

// Image evidence is only "available" for weighting when a real visual score
// exists (Gemini, deterministic Fallback, or exact Identical File). 'None'
// (missing/unloadable images) excludes the image weight entirely.
const imageAvailableFn = (engine) => engine === 'Gemini' || engine === 'Fallback' || engine === 'Identical File';

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

  // 1. Image Embedding Similarity (60% Weight when available)
  // Provenance: WHICH engine produced the image score is captured and
  // propagated so the Match record can answer "Gemini or fallback?".
  let imageSimilarityScore = 0;
  let sameObjectCategory = false;
  let imageEngine = LEGACY_ENGINE;
  let imageEngineReason = '';

  if (lostItem.image && foundItem.image) {
    const imgResult = await compareImagesSemantically(lostItem.image, foundItem.image);
    imageSimilarityScore = imgResult.similarityScore || 0;
    sameObjectCategory = Boolean(imgResult.sameObjectCategory);
    imageEngine = normalizeEngineName(imgResult.engine);
    imageEngineReason = imgResult.fallbackReason || '';
    logs.push(`[Hybrid Engine] Image Similarity: ${imageSimilarityScore}% (engine: ${imageEngine}${imageEngineReason ? ` — ${imageEngineReason}` : ''})`);
    // 'None' means the images were referenced but could not be loaded —
    // visual evidence is effectively UNAVAILABLE, so exclude the image
    // weight below (same policy as reports without images).
    if (imageEngine === 'None') {
      logs.push(`[Hybrid Engine] Image evidence unavailable (${imageEngineReason || 'not loadable'}) — excluding image weight from scoring.`);
    }
  } else {
    // Phase 3 no-image policy (replaces the old blanket 85% cap):
    // the image slot answers "how likely are these the same physical
    // object?". With no image evidence, the best available proxy is the
    // itemType+category identity match — substituted into the slot and
    // CAPPED AT 95 so a missing visual confirmation can never produce a
    // fake perfect 100. Provenance records the substitution explicitly.
    imageEngine = 'None';
    imageEngineReason = 'No image — identity substituted from itemType/category metadata';
    const titleA = `${lostItem.itemType || ''} ${lostItem.category || ''}`;
    const titleB = `${foundItem.itemType || ''} ${foundItem.category || ''}`;
    imageSimilarityScore = Math.min(95, tokenMatchScore(titleA, titleB));
    sameObjectCategory = evaluateCategoryCompatibility(lostItem, foundItem) >= 75;
    logs.push(`[Hybrid Engine] Image Similarity: ${imageSimilarityScore}% (identity substituted from text metadata, capped at 95 — no visual confirmation available)`);
  }

  // Weight availability flag (Gemini / Fallback / Identical File provide a
  // real visual score; 'None' means the slot carries substituted identity
  // evidence instead — recorded for provenance, weights unchanged).
  const imageAvailable = imageAvailableFn(imageEngine);

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

  // 6. Brand & Color similarity (Phase 3: actually calculated with the
  // existing evaluators — previously defined but never invoked, leaving
  // brandScore/colorScore at schema defaults and the UI showing fake 50s).
  // These are METADATA-ONLY: informational scores for the admin breakdown
  // UI, deliberately NOT part of the weighted final confidence.
  const brandScore = evaluateBrandSimilarity(lostItem.brand, foundItem.brand);
  const colorScore = evaluateColorSimilarity(lostItem.color, foundItem.color);
  logs.push(`[Hybrid Engine] Brand Score: ${brandScore}%, Color Score: ${colorScore}% (metadata-only, not weighted)`);

  // Calculate Overall Text & Semantic Similarity
  const overallTextSimilarity = Math.round((titleSimilarity * 0.15 + descriptionSimilarity * 0.15 + locationSimilarity * 0.05) / 0.35);
  const semanticSimilarity = overallTextSimilarity;

  // Weighted score combo — Phase 3: the overall confidence is ALWAYS the
  // combined weighted evidence (60/15/15/5/5), never the image-only score.
  let rawScore =
    HYBRID_WEIGHTS.image * imageSimilarityScore +
    HYBRID_WEIGHTS.title * titleSimilarity +
    HYBRID_WEIGHTS.description * descriptionSimilarity +
    HYBRID_WEIGHTS.location * locationSimilarity +
    HYBRID_WEIGHTS.category * categoryScore;

  rawScore = Math.round(rawScore);
  logs.push(`[Hybrid Engine] Weighted Match Score: ${rawScore}% (weights: image 60%, title 15%, desc 15%, loc 5%, cat 5%)`);

  // Smart Category Validation & Caps (Requirement 6 & 7) — Phase 3 keeps
  // ALL category safeguards. The old blanket no-image 85% cap is REPLACED
  // by the principled weight-normalization above (strong text evidence can
  // reach high confidence; missing evidence cannot be faked).
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

  finalConfidenceScore = Math.min(99, Math.max(0, finalConfidenceScore));
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
    categoryScore,
    brandScore,
    colorScore,
    overallTextSimilarity,
    finalConfidenceScore,
    // Phase 3 provenance fields
    imageEngine,
    imageEngineReason,
    matchingMethod: 'Hybrid AI Engine',
    matchingVersion: 'v3',
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
  HYBRID_WEIGHTS,
  IMAGE_ENGINES,
  FALLBACK_IMAGE_MAX,
};
