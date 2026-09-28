const assert = require('assert');
const path = require('path');

/**
 * Phase 3 — AI Matching, Confidence, Fallback & Provenance tests.
 * Pure Node assertions (no real network). Gemini retry behavior is tested
 * with stub attempt functions; the two bounded-backoff tests add ~3s total.
 *
 * Run: node tests/phase3.test.js
 */

const {
  calculateHybridMatchScore,
  HYBRID_WEIGHTS,
  IMAGE_ENGINES,
} = require('../services/matchingService');
const {
  compareImagesSemantically,
  withGeminiRetries,
  classifyGeminiFailure,
  normalizeEngineName,
  GEMINI_MAX_ATTEMPTS,
} = require('../services/imageSimilarityService');
const Match = require('../models/Match');

let passed = 0;
let total = 0;
let failed = false;

const test = (name, fn) => {
  total++;
  try {
    fn();
    console.log(`✅ PASSED: ${name}`);
    passed++;
  } catch (err) {
    failed = true;
    console.log(`❌ FAILED: ${name} -> ${err.message}`);
  }
};

const asyncTests = [];
const atest = (name, fn) => asyncTests.push({ name, fn });

// ─── Fixtures ───

const walletA = {
  category: 'Wallets', itemType: 'Black Leather Wallet', brand: 'Wildcraft',
  color: 'Black', description: 'Black folding leather wallet near library',
  location: 'Central Library',
};
const walletB = {
  category: 'Wallets', itemType: 'Black Leather Wallet', brand: 'Wildcraft',
  color: 'Black', description: 'Black folding leather wallet near library',
  location: 'Central Library',
};
const purse = {
  category: 'Wallets', itemType: 'Black Purse cardholder', brand: 'Wildcraft',
  color: 'Black', description: 'Black leather purse found near Central Library',
  location: 'Central Library',
};
const laptop = {
  category: 'Electronics', itemType: 'Dell Laptop computer', brand: 'Dell',
  color: 'Black', description: 'Dell laptop notebook with Ubuntu Linux sticker near library',
  location: 'Library entrance',
};
const notebook = {
  category: 'Electronics', itemType: 'Dell Notebook portable computer', brand: 'Dell',
  color: 'Black', description: 'Dell notebook laptop having Linux sticker near library',
  location: 'Library',
};
const phone = {
  category: 'Electronics', itemType: 'Vivo Smartphone mobile phone', brand: 'Vivo',
  color: 'Black', description: 'Android mobile screen phone', location: 'Playground',
};
const keys = {
  category: 'Keys', itemType: 'Bike Keys', brand: 'Honda', color: 'Silver',
  description: 'Keys with key ring keychain', location: 'College ground',
};
const keychain = {
  category: 'Keys', itemType: 'Honda keychain bike keys', brand: 'Honda', color: 'Silver',
  description: 'Bike keys keychain', location: 'Hostel block',
};
const shoes = {
  category: 'Clothing', itemType: 'Running Shoes Sneakers', brand: 'Nike',
  color: 'Black', description: 'Nike sports shoes', location: 'Hostel A',
};
const waterBottle = {
  category: 'Sports Equipment', itemType: 'Water Bottle', brand: 'Milton',
  color: 'Silver', description: 'Steel bottle', location: 'Playground',
};

// ═════ 1. Weights unchanged (spec: verify, do not change) ═════

test('P3-1. Hybrid weights remain 60/15/15/5/5', () => {
  assert.deepStrictEqual(HYBRID_WEIGHTS, {
    image: 0.60, title: 0.15, description: 0.15, location: 0.05, category: 0.05,
  });
});

// ═════ 2-3. No-image principled policy ═════

atest('P3-2. No-image strong text evidence reaches high confidence (old 85-cap removed)', async () => {
  const r = await calculateHybridMatchScore(walletA, walletB);
  assert.ok(r.score >= 90, `strong no-image match should reach >=90, got ${r.score}`);
  assert.ok(r.score <= 99, `no-image must never be a fake 100, got ${r.score}`);
  assert.strictEqual(r.matchLevel, 'High Match');
});

atest('P3-3. Missing image behavior: provenance recorded as None + substitution reason', async () => {
  const r = await calculateHybridMatchScore(walletA, purse);
  assert.strictEqual(r.imageEngine, 'None');
  assert.ok(/no image/i.test(r.imageEngineReason), `reason should mention missing image: ${r.imageEngineReason}`);
  // Identity substitution visible in the image slot, capped below 100.
  assert.ok(r.imageSimilarityScore <= 95, 'substituted identity capped at 95');
  assert.ok(r.score >= 80 && r.score <= 98, `wallet/purse expected 80-98, got ${r.score}`);
});

// ═════ 4-5. Category safety preserved ═════

atest('P3-4. Category mismatch protection: wallet vs phone stays low', async () => {
  const r = await calculateHybridMatchScore(walletA, phone);
  assert.ok(r.score < 30, `incompatible categories must stay <30, got ${r.score}`);
  assert.strictEqual(r.categoryScore, 0);
});

atest('P3-5. Hard incompatible pairs: wallet/laptop and keys/shoes capped', async () => {
  const r1 = await calculateHybridMatchScore(walletA, laptop);
  assert.ok(r1.score <= 20, `wallet vs laptop capped at 20, got ${r1.score}`);
  const r2 = await calculateHybridMatchScore(keys, shoes);
  assert.ok(r2.score <= 14, `keys vs shoes capped at 14, got ${r2.score}`);
  const r3 = await calculateHybridMatchScore(waterBottle, shoes);
  assert.ok(r3.score < 20, `bottle vs shoes <20, got ${r3.score}`);
});

// ═════ 6-9. Engine provenance ═════

test('P3-6. Engine vocabulary is controlled', () => {
  assert.deepStrictEqual(IMAGE_ENGINES, ['Gemini', 'Fallback', 'Identical File', 'None', 'Legacy']);
  assert.strictEqual(Match.schema.path('imageEngine').enumValues.join(','), IMAGE_ENGINES.join(','));
});

test('P3-7. Gemini engine provenance mapping', () => {
  assert.strictEqual(normalizeEngineName('Gemini Vision AI'), 'Gemini');
  assert.strictEqual(normalizeEngineName('Gemini'), 'Gemini');
  assert.strictEqual(normalizeEngineName('512D Semantic Embedding Cosine Similarity'), 'Fallback');
  assert.strictEqual(normalizeEngineName('Semantic Embedding Engine'), 'Fallback');
  assert.strictEqual(normalizeEngineName('Identical File'), 'Identical File');
  assert.strictEqual(normalizeEngineName('None'), 'None');
  assert.strictEqual(normalizeEngineName(undefined), 'Legacy');
});

atest('P3-8. Fallback reason recorded when images cannot load (no key configured)', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const r = await compareImagesSemantically('/nonexistent/a.jpg', '/nonexistent/b.jpg');
    assert.strictEqual(r.engine, 'None');
    assert.ok(r.fallbackReason, 'fallback reason must be present');
    assert.strictEqual(r.similarityScore, 0);
  } finally {
    if (savedKey) process.env.GEMINI_API_KEY = savedKey;
  }
});

atest('P3-9. Exact duplicate image is explicitly Identical File at 100', async () => {
  const r = await compareImagesSemantically('uploads/same-photo.jpg', 'uploads/same-photo.jpg');
  assert.strictEqual(r.engine, 'Identical File');
  assert.strictEqual(r.similarityScore, 100);
  assert.strictEqual(r.sameObjectCategory, true);
});

// ═════ 10. Combined confidence ≠ image-only score ═════

atest('P3-10. Overall confidence is the combined score, never the image-only score', async () => {
  const r = await calculateHybridMatchScore(keys, keychain);
  // Contract: finalConfidenceScore IS the returned score, aiConfidence echoes it.
  assert.strictEqual(r.score, r.finalConfidenceScore);
  assert.ok(r.aiConfidence.startsWith(`${r.finalConfidenceScore}%`));
  // For this pair the combined score differs from the image-slot value —
  // proving the headline is computed, not copied.
  assert.notStrictEqual(r.score, r.imageSimilarityScore);
});

// ═════ 11. No-image normalization policy ═════

atest('P3-11. No-image identity substitution cannot fabricate a perfect 100', async () => {
  // Even identical reports max out at 97 (0.60*95 + 0.15*100 + 0.15*100 + 0.05*100 + 0.05*100 = 97).
  const r = await calculateHybridMatchScore(walletA, walletB);
  assert.ok(r.score < 100, `must stay below 100 without visual confirmation, got ${r.score}`);
  // Same-category strong pair with weaker description still lands high.
  const r2 = await calculateHybridMatchScore(laptop, notebook);
  assert.ok(r2.score >= 90, `laptop/notebook expected >=90, got ${r2.score}`);
});

// ═════ 12. Legacy Match compatibility ═════

test('P3-12. Legacy Match records default safely (no migration required)', () => {
  const schema = Match.schema;
  assert.strictEqual(schema.path('imageEngine').defaultValue, 'Legacy');
  assert.strictEqual(schema.path('imageEngineReason').defaultValue, '');
  // Brand/color defaults no longer fake 50 in the UI (frontend shows 0/'Not compared').
  assert.strictEqual(schema.path('brandScore').defaultValue, 0);
  assert.strictEqual(schema.path('colorScore').defaultValue, 0);
});

// ═════ 13-14. Retry behavior ═════

test('P3-13. Failure classification: transient vs permanent', () => {
  assert.strictEqual(classifyGeminiFailure({ statusCode: 429 }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 500 }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 502 }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 503 }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ isTimeout: true }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ code: 'ECONNRESET' }), 'transient');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 400 }), 'permanent');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 401 }), 'permanent');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 404 }), 'permanent');
  assert.strictEqual(classifyGeminiFailure({ statusCode: 0, message: 'invalid Gemini response' }), 'permanent');
});

asyncTests.push({
  name: 'P3-13b. Transient failures are retried with bounded backoff, then succeed',
  fn: async () => {
    let attempts = 0;
    const outcome = await withGeminiRetries(async () => {
      attempts++;
      if (attempts < 3) throw { statusCode: 503, message: 'high demand' };
      return { semanticEmbeddingScore: 88 };
    }, { label: 'Test' });
    assert.strictEqual(attempts, 3, 'two transient retries then success');
    assert.strictEqual(outcome.failed, undefined);
    assert.strictEqual(outcome.semanticEmbeddingScore, 88);
  },
});

asyncTests.push({
  name: 'P3-14. Permanent failures do NOT retry; exhaustion stops after GEMINI_MAX_ATTEMPTS',
  fn: async () => {
    // Permanent: exactly one attempt, no retries.
    let permAttempts = 0;
    const perm = await withGeminiRetries(async () => {
      permAttempts++;
      throw { statusCode: 401, message: 'invalid key' };
    }, { label: 'Test' });
    assert.strictEqual(permAttempts, 1, 'permanent error must not retry');
    assert.strictEqual(perm.failed, true);
    assert.ok(/invalid key/.test(perm.reason));

    // Transient exhaustion: bounded at GEMINI_MAX_ATTEMPTS, never endless.
    let transAttempts = 0;
    const trans = await withGeminiRetries(async () => {
      transAttempts++;
      throw { statusCode: 503, message: 'still overloaded' };
    }, { label: 'Test' });
    assert.strictEqual(transAttempts, GEMINI_MAX_ATTEMPTS);
    assert.strictEqual(trans.failed, true);
    assert.ok(/503/.test(trans.reason), `reason captured: ${trans.reason}`);
  },
});

// ═════ Runner ═════

(async () => {
  for (const t of asyncTests) {
    total++;
    try {
      await t.fn();
      console.log(`✅ PASSED: ${t.name}`);
      passed++;
    } catch (err) {
      failed = true;
      console.log(`❌ FAILED: ${t.name} -> ${err.message}`);
    }
  }
  console.log('\n====================================================');
  console.log(`  PHASE 3 TESTS COMPLETE: ${passed}/${total} PASSED`);
  console.log('====================================================');
  process.exit(failed ? 1 : 0);
})();
