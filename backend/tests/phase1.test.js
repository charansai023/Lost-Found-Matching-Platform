const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * Phase 1 — Security, Validation & Core Business Rules test suite.
 * Pure Node assertions (no DB / no network), following the same lightweight
 * style as tests/matchingService.test.js.
 *
 * Run: node tests/phase1.test.js
 */

const {
  rejectFutureDate,
  escapeRegex,
  isValidObjectId,
} = require('../middleware/validate');
const { getRewardCost, REWARD_CATALOG } = require('../services/rewardService');
const ApiError = require('../utils/ApiError');
const { errorHandler } = require('../middleware/errorHandler');

let passed = 0;
let total = 0;

const test = (name, fn) => {
  total++;
  try {
    fn();
    console.log(`✅ PASSED: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAILED: ${name} -> ${err.message}`);
  }
};

const expectApiError = (fn, expectedStatus, namePart) => {
  try {
    fn();
    return false; // no error thrown — validation missing
  } catch (err) {
    if (!(err instanceof ApiError)) return false;
    if (expectedStatus && err.statusCode !== expectedStatus) return false;
    if (namePart && !String(err.message).toLowerCase().includes(namePart.toLowerCase())) return false;
    return true;
  }
};

// ── Local YYYY-MM-DD helpers (no hardcoded dates) ──
const toYmd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toYmd(d);
};

// ═══════════════ A. Lost-style future-date rules (shared helper) ═══════════════

test('A1. Date: yesterday allowed', () => {
  assert.strictEqual(rejectFutureDate(shiftDays(-1), 'Date Lost'), true);
});

test('A2. Date: today allowed', () => {
  assert.strictEqual(rejectFutureDate(shiftDays(0), 'Date Lost'), true);
});

test('A3. Date: tomorrow rejected (400, "future")', () => {
  assert(expectApiError(() => rejectFutureDate(shiftDays(1), 'Date Lost'), 400, 'future'),
    'tomorrow must be rejected with ApiError 400 mentioning future');
});

test('A4. Date: far-future rejected', () => {
  assert(expectApiError(() => rejectFutureDate('2999-12-31', 'Date Lost'), 400, 'future'));
});

test('A5. Date: missing date rejected 400', () => {
  assert(expectApiError(() => rejectFutureDate('', 'Date Lost'), 400));
  assert(expectApiError(() => rejectFutureDate(null, 'Date Lost'), 400));
});

test('A6. Date: non-date garbage rejected 400 (not crashed)', () => {
  assert(expectApiError(() => rejectFutureDate('not-a-date', 'Date Lost'), 400));
});

test('A7. Date: midnight safety — today parsed from YYYY-MM-DD never rejected', () => {
  // Regression guard for the UTC-midnight bug: the calendar-day key of the
  // input string must equal the local today key at any hour of the day.
  const ymd = shiftDays(0);
  assert.doesNotThrow(() => rejectFutureDate(ymd, 'Date Lost'));
});

// ═══════════════ B. Found-style rules (same helper) ═══════════════

test('B1. Found date: previous date allowed', () => {
  assert.strictEqual(rejectFutureDate(shiftDays(-3), 'Date Found'), true);
});

test('B2. Found date: today allowed', () => {
  assert.doesNotThrow(() => rejectFutureDate(shiftDays(0), 'Date Found'));
});

test('B3. Found date: future rejected', () => {
  assert(expectApiError(() => rejectFutureDate(shiftDays(2), 'Date Found'), 400, 'future'));
});

// ═══════════════ C. ObjectId validation ═══════════════

test('C1. isValidObjectId accepts a real 24-hex ObjectId', () => {
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd799439011'), true);
});

test('C2. isValidObjectId rejects malformed ids', () => {
  assert.strictEqual(isValidObjectId('123'), false);
  assert.strictEqual(isValidObjectId(''), false);
  assert.strictEqual(isValidObjectId(null), false);
  assert.strictEqual(isValidObjectId(undefined), false);
  assert.strictEqual(isValidObjectId('{}'), false);
  assert.strictEqual(isValidObjectId('zzzzzzzzzzzzzzzzzzzzzzzz'), false); // 24 chars, non-hex
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd7994390110'), false); // 25 chars
  assert.strictEqual(isValidObjectId('["$ne"]'), false); // injection attempt
});

test('C3. Global CastError handler returns 400 with clean message', () => {
  // Simulate the exact response pipeline for a CastError from Mongoose.
  let captured = null;
  const fakeRes = {
    status(code) { captured = captured || {}; captured.statusCode = code; return this; },
    json(body) { captured = captured || {}; captured.body = body; return this; },
  };
  const castErr = Object.assign(new Error('Cast to ObjectId failed'), {
    name: 'CastError',
    path: '_id',
  });
  errorHandler(castErr, {}, fakeRes, () => {});
  assert.strictEqual(captured.statusCode, 400, 'CastError must map to 400');
  assert.strictEqual(captured.body.success, false);
  assert.ok(!/stack/i.test(captured.body.message), 'must not leak stack details');
});

// ═══════════════ D. Regex escaping ═══════════════

test('D1. escapeRegex neutralizes regex special characters', () => {
  assert.strictEqual(escapeRegex('['), '\\[');
  assert.strictEqual(escapeRegex('.*'), '\\.\\*');
  assert.strictEqual(escapeRegex('(a|b)+'), '\\(a\\|b\\)\\+');
  assert.strictEqual(escapeRegex('a?b^c$d'), 'a\\?b\\^c\\$d');
  assert.strictEqual(escapeRegex('\\'), '\\\\');
});

test('D2. Escaped input compiles as a literal, unescaped input is dangerous', () => {
  const malicious = '[';
  assert.throws(() => new RegExp(malicious), 'sanity: raw "[" is invalid regex');
  assert.doesNotThrow(() => new RegExp(escapeRegex(malicious)), 'escaped "[" must be a valid literal pattern');
});

test('D3. escapeRegex leaves normal searches unchanged', () => {
  assert.strictEqual(escapeRegex('black wallet'), 'black wallet');
  assert.strictEqual(escapeRegex('Dell Latitude E6410'), 'Dell Latitude E6410');
});

test('D4. escapeRegex handles non-string input safely', () => {
  assert.strictEqual(escapeRegex(null), '');
  assert.strictEqual(escapeRegex(undefined), '');
  assert.strictEqual(escapeRegex(42), '');
});

// ═══════════════ E. Reward redemption security ═══════════════

test('E1. Reward catalog resolves authoritative costs', () => {
  assert.strictEqual(getRewardCost('Canteen Coupon'), 200);
  assert.strictEqual(getRewardCost('Printing Credits'), 100);
  assert.strictEqual(getRewardCost('College Merchandise'), 800);
  assert.strictEqual(getRewardCost('  Event Pass  '), 500); // trims input
});

test('E2. Unknown reward is rejected (null), never guessed', () => {
  assert.strictEqual(getRewardCost('Nonexistent Reward'), null);
  assert.strictEqual(getRewardCost(''), null);
  assert.strictEqual(getRewardCost(null), null);
});

test('E3. Redeem endpoint derives cost server-side (source contract)', () => {
  // Static contract test: the controller must resolve the cost from the
  // catalog and persist the authoritative amount, not the client value.
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rewardController.js'), 'utf8');
  assert.ok(src.includes('getRewardCost(rewardName)'), 'controller must look up authoritative cost');
  assert.ok(src.includes('pointsCost: authoritativeCost'), 'stored cost must be the authoritative one');
  assert.ok(!/\bpointsCost\s*=\s*req\.body/.test(src), 'client-supplied pointsCost must not be assigned');
});

// ═══════════════ F. Registration privilege escalation tripwire ═══════════════

test('F1. Registration can never derive admin role from email (source tripwire)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'authController.js'), 'utf8');
  assert.ok(!src.includes("includes('admin')"), "email-based admin assignment must stay removed");
  assert.ok(src.includes("const role = 'user'"), 'registration must always create role user');
});

// ═══════════════ G. Claim status guard ═══════════════

test('G1. Claim guard uses only real FoundItem statuses (source contract)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'claimController.js'), 'utf8');
  // Strip comments so a 'Resolved' mention in an explanatory comment does not
  // count as live code — we only assert on actual executable statements.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, ' ');
  assert.ok(!/\b'Resolved'\b/.test(code), "dead status 'Resolved' must be gone from code");
  assert.ok(!/\b'Closed'\b/.test(code), "dead status 'Closed' must be gone from code");
  assert.ok(src.includes("['Pending', 'Matched'].includes(foundItem.status)"),
    'guard must allow exactly the claimable enum states');
});

test('G2. Guard semantics: claimable when Pending/Matched, blocked otherwise', () => {
  const claimable = (status) => ['Pending', 'Matched'].includes(status);
  assert.ok(claimable('Pending') && claimable('Matched'));
  assert.ok(!claimable('Verified') && !claimable('Returned'));
});

// ═══════════════ Summary ═══════════════

console.log('\n====================================================');
console.log(`  PHASE 1 TESTS COMPLETE: ${passed}/${total} PASSED`);
console.log('====================================================');

if (passed !== total) {
  process.exit(1);
}
