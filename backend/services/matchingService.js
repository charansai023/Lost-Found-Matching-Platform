/**
 * matchingService.js
 *
 * Enhanced weighted matching algorithm for the Lost & Found platform.
 * Uses text normalization, token comparison, and structured field weights
 * to generate a transparent match score between a Lost Item and a Found Item.
 *
 * NOTE: This is plain, readable business logic — no AI or ML required.
 */

// Weights must sum to 100.
const SCORE_WEIGHTS = {
  category: 25,    // Most important — broad classification must match
  itemType: 20,    // Specific item type e.g. "laptop", "wallet"
  color: 15,       // Visual identifier
  location: 15,    // Where lost vs where found
  brand: 10,       // Manufacturer / brand name
  model: 5,        // Specific model — optional field
  description: 5,  // Free-text description tokens
  uniqueMarks: 5,  // Private field — marks/scratches etc.
};

// Thresholds for converting numeric score into a human-readable level
const MATCH_THRESHOLDS = {
  HIGH: 70,
  POSSIBLE: 40,
};

/**
 * Normalizes a string for comparison:
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove punctuation
 * - Collapse multiple spaces into one
 */
const normalize = (value) => {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');         // Collapse whitespace
};

/**
 * Tokenizes a normalized string into individual words.
 * Filters out very short tokens (single letters) that add noise.
 */
const tokenize = (value) => {
  const normalized = normalize(value);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 1);
};

/**
 * Computes a partial match score (0–1) between two string values
 * using token intersection. This is better than exact equality because:
 *   - "Black Leather Wallet" vs "wallet" → tokens overlap → match
 *   - "Nike Running Shoes" vs "Nike Shoes" → partial overlap → partial score
 *
 * Returns 1.0 for exact match, a fraction for partial, 0 for no overlap.
 */
const tokenMatchScore = (valueA, valueB) => {
  const tokensA = tokenize(valueA);
  const tokensB = tokenize(valueB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Check exact normalized string match first
  if (normalize(valueA) === normalize(valueB)) return 1.0;

  // Count how many tokens from A appear in B and vice versa
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = [...setA].filter((t) => setB.has(t));

  if (intersection.length === 0) return 0;

  // Jaccard-like score: intersection / union
  const union = new Set([...setA, ...setB]);
  const jaccardScore = intersection.length / union.size;

  // Also check substring containment for short values
  const containsScore =
    normalize(valueA).includes(normalize(valueB)) ||
    normalize(valueB).includes(normalize(valueA))
      ? 0.7
      : 0;

  return Math.max(jaccardScore, containsScore);
};

/**
 * Converts a numeric score (0–100) into a human-readable match level.
 */
const getMatchLevel = (score) => {
  if (score >= MATCH_THRESHOLDS.HIGH) return 'High Match';
  if (score >= MATCH_THRESHOLDS.POSSIBLE) return 'Possible Match';
  return 'Low Match';
};

/**
 * Calculates a weighted match score between one lost item and one found item.
 * Each field is compared using token matching; the result is multiplied by
 * that field's weight to produce a partial score contribution.
 *
 * @param {Object} lostItem  - LostItem document (may include private fields)
 * @param {Object} foundItem - FoundItem document (may include private fields)
 * @returns {{ score: number, matchLevel: string, matchedFields: string[] }}
 */
const calculateMatchScore = (lostItem, foundItem) => {
  let totalScore = 0;
  const matchedFields = [];

  const checkField = (fieldName, lostValue, foundValue, weight) => {
    const partialScore = tokenMatchScore(lostValue, foundValue);
    if (partialScore > 0) {
      totalScore += weight * partialScore;
      matchedFields.push(fieldName);
    }
  };

  checkField('category', lostItem.category, foundItem.category, SCORE_WEIGHTS.category);
  checkField('itemType', lostItem.itemType, foundItem.itemType, SCORE_WEIGHTS.itemType);
  checkField('color', lostItem.color, foundItem.color, SCORE_WEIGHTS.color);
  checkField('location', lostItem.location, foundItem.location, SCORE_WEIGHTS.location);
  checkField('brand', lostItem.brand, foundItem.brand, SCORE_WEIGHTS.brand);
  checkField('model', lostItem.model, foundItem.model, SCORE_WEIGHTS.model);
  checkField('description', lostItem.description, foundItem.description, SCORE_WEIGHTS.description);

  // Private field comparison — only has value if both items have marks set
  checkField('uniqueMarks', lostItem.uniqueMarks, foundItem.uniqueMarks, SCORE_WEIGHTS.uniqueMarks);

  // Round to nearest integer
  const score = Math.round(totalScore);
  const matchLevel = getMatchLevel(score);

  return { score, matchLevel, matchedFields };
};

/**
 * Compares a single found item against a list of lost items.
 * Returns results sorted from highest score to lowest.
 */
const findMatchesForFoundItem = (foundItem, lostItems) => {
  const results = lostItems.map((lostItem) => {
    const { score, matchLevel, matchedFields } = calculateMatchScore(lostItem, foundItem);
    return { lostItem, foundItem, score, matchLevel, matchedFields };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
};

/**
 * Compares a single lost item against a list of found items.
 * Used when a new lost item is created to check existing found items.
 */
const findMatchesForLostItem = (lostItem, foundItems) => {
  const results = foundItems.map((foundItem) => {
    const { score, matchLevel, matchedFields } = calculateMatchScore(lostItem, foundItem);
    return { lostItem, foundItem, score, matchLevel, matchedFields };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
};

module.exports = {
  calculateMatchScore,
  findMatchesForFoundItem,
  findMatchesForLostItem,
  getMatchLevel,
  SCORE_WEIGHTS,
  MATCH_THRESHOLDS,
};
