const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * Phase 4 — Analytics accuracy, image handling, navigation & cleanup tests.
 * Pure Node assertions (no real DB / network), same lightweight style as
 * the other phase suites. The analytics test runs the real getPlatformStats
 * controller against mocked models (require.cache swap) and proves the
 * source-of-truth and double-count-protection behavior.
 *
 * Run: node tests/phase4.test.js
 */

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

// ─── Mock infrastructure for getPlatformStats ───

const buildAnalyticsMocks = () => {
  const state = {
    users: [{ _id: 'u1' }, { _id: 'u2' }, { _id: 'u3' }, { _id: 'u4' }, { _id: 'u5' }, { _id: 'u6' }, { _id: 'u7' }],
    lost: [
      { _id: 'L1', status: 'Returned' }, // the one real-world recovery
      { _id: 'L2', status: 'Pending' },
    ],
    found: [{ _id: 'F1', status: 'Returned' }],
    matches: [
      { status: 'Returned', matchLevel: 'High Match', isAiMatch: true, imageSimilarityScore: 90, imageEngine: 'Gemini', score: 90 },
      { status: 'Pending', matchLevel: 'Low Match', isAiMatch: false, imageSimilarityScore: 30, imageEngine: 'Fallback', score: 50 },
      { status: 'Verified', matchLevel: 'High Match', isAiMatch: false, imageSimilarityScore: 0, imageEngine: 'Legacy', score: 70 },
      { status: 'Pending', matchLevel: 'Low Match', isAiMatch: false, imageSimilarityScore: 0, imageEngine: 'Identical File', score: 40 },
    ],
    claims: [
      { status: 'pending' },
      { status: 'verified' },
      { status: 'rejected' },
      { status: 'returned' },
    ],
  };

  const countMatch = (filter = {}) => {
    let arr = state.matches;
    if (filter.status) arr = arr.filter((m) => m.status === filter.status);
    if (filter.matchLevel) arr = arr.filter((m) => m.matchLevel === filter.matchLevel);
    if (filter.imageEngine) arr = arr.filter((m) => m.imageEngine === filter.imageEngine);
    if (filter.$or) {
      arr = arr.filter((m) =>
        filter.$or.some((cond) =>
          cond.isAiMatch !== undefined ? m.isAiMatch === cond.isAiMatch : false
        )
      );
    }
    return arr.length;
  };

  const models = {
    User: { countDocuments: async () => state.users.length },
    LostItem: {
      countDocuments: async () => state.lost.length,
      // distinct returned lost items — the double-count-proof recovery source
      distinct: async (field, filter) =>
        filter && filter.status === 'Returned'
          ? state.lost.filter((l) => l.status === 'Returned').map((l) => l._id)
          : [],
    },
    FoundItem: { countDocuments: async () => state.found.length },
    Match: {
      countDocuments: async (filter) => countMatch(filter),
      aggregate: async (pipeline) => {
        const avg = state.matches.reduce((s, m) => s + m.score, 0) / state.matches.length;
        return [{ _id: null, avg }];
      },
    },
    Claim: {
      countDocuments: async (filter = {}) =>
        filter.status ? state.claims.filter((c) => c.status === filter.status).length : state.claims.length,
    },
  };
  return { models, state };
};

const resolve = (p) => require.resolve(p);
const swapPaths = {
  User: resolve('../models/User'),
  LostItem: resolve('../models/LostItem'),
  FoundItem: resolve('../models/FoundItem'),
  Match: resolve('../models/Match'),
  Claim: resolve('../models/Claim'),
};
const CONTROLLER_PATH = resolve('../controllers/adminController');

const fakeModule = (p, exportsObj) => ({
  id: p, filename: p, path: p, loaded: true, exports: exportsObj, children: [], paths: [],
});

const withMocks = async (models, body) => {
  const saved = {};
  for (const [k, p] of Object.entries(swapPaths)) saved[k] = require.cache[p];
  const savedCtrl = require.cache[CONTROLLER_PATH];
  for (const [k, p] of Object.entries(swapPaths)) require.cache[p] = fakeModule(p, models[k]);
  delete require.cache[CONTROLLER_PATH];
  const ctrl = require(CONTROLLER_PATH);
  try {
    await body(ctrl);
  } finally {
    for (const [k, p] of Object.entries(swapPaths)) {
      if (saved[k]) require.cache[p] = saved[k];
      else delete require.cache[p];
    }
    if (savedCtrl) require.cache[CONTROLLER_PATH] = savedCtrl;
    else delete require.cache[CONTROLLER_PATH];
  }
};

const runStats = async (ctrl) => {
  const res = {
    statusCode: null, body: null,
    status(c) { res.statusCode = c; return res; },
    json(b) { res.body = b; return res; },
  };
  // asyncHandler's wrapper returns undefined (the inner promise is
  // detached), so drain the event loop until the response arrives.
  ctrl.getPlatformStats({}, res, (err) => { throw err; });
  for (let i = 0; i < 1000 && res.statusCode === null; i++) {
    await new Promise((r) => setImmediate(r));
  }
  if (res.statusCode === null) throw new Error('stats controller never settled');
  return res;
};

// ═════ Functional analytics tests ═════

const analyticsTests = [];
const atest = (name, fn) => analyticsTests.push({ name, fn });

atest('P4-1. Claim metrics come from the Claim collection (source of truth)', async () => {
  const { models } = buildAnalyticsMocks();
  await withMocks(models, async (ctrl) => {
    const res = await runStats(ctrl);
    const d = res.body.data;
    // 4 claim rows: pending/verified/rejected/returned — from Claim, NOT Match
    assert.strictEqual(d.totalClaims, 4);
    assert.strictEqual(d.pendingClaims, 1);
    assert.strictEqual(d.verifiedClaims, 1);
    assert.strictEqual(d.rejectedClaims, 1);
    assert.strictEqual(d.returnedClaims, 1);
  });
});

atest('P4-2. Recovery counts DISTINCT returned lost items — no Claim/Match double counting', async () => {
  const { models, state } = buildAnalyticsMocks();
  await withMocks(models, async (ctrl) => {
    const res = await runStats(ctrl);
    const d = res.body.data;
    // 1 returned match AND 1 returned claim row, but only ONE distinct
    // returned lost item — recovery must be 1 (50%), never 2 or 3.
    assert.strictEqual(d.recoveredItems, 1);
    assert.strictEqual(d.recoveryRate, 50);
    assert.strictEqual(state.lost.filter((l) => l.status === 'Returned').length, 1);
  });
});

atest('P4-3. AI engine provenance metrics counted from Match.imageEngine', async () => {
  const { models } = buildAnalyticsMocks();
  await withMocks(models, async (ctrl) => {
    const res = await runStats(ctrl);
    const d = res.body.data;
    assert.strictEqual(d.geminiMatches, 1);
    assert.strictEqual(d.fallbackMatches, 1);
    assert.strictEqual(d.identicalFileMatches, 1);
    assert.strictEqual(d.legacyEngineMatches, 1);
    assert.strictEqual(d.noneEngineMatches, 0);
  });
});

atest('P4-4. Average confidence computed server-side across ALL matches', async () => {
  const { models } = buildAnalyticsMocks();
  await withMocks(models, async (ctrl) => {
    const res = await runStats(ctrl);
    // (90+50+70+40)/4 = 62.5 → 63
    assert.strictEqual(res.body.data.avgMatchConfidence, 63);
  });
});

atest('P4-5. Match metrics still sourced from Match (compat keys intact)', async () => {
  const { models } = buildAnalyticsMocks();
  await withMocks(models, async (ctrl) => {
    const res = await runStats(ctrl);
    const d = res.body.data;
    assert.strictEqual(d.totalMatches, 4);
    assert.strictEqual(d.verifiedMatches, 1); // Match status, distinct from verifiedClaims
    assert.strictEqual(d.pendingMatches, 2);
    assert.strictEqual(d.returnedMatches, 1);
    assert.strictEqual(d.totalUsers, 7);
    assert.strictEqual(d.totalLost, 2);
    assert.strictEqual(d.totalFound, 1);
  });
});

// ═════ Image handling / navigation / cleanup contracts ═════

const UTILS_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'image.js'), 'utf8');
const SAFE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'SafeImage.jsx'), 'utf8');
const LOGIN_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Login.jsx'), 'utf8');
const REGISTER_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Register.jsx'), 'utf8');
const ADMINROUTE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'AdminRoute.jsx'), 'utf8');

test('P4-6. Legacy /uploads images are detected and never fetched blindly', () => {
  assert.ok(UTILS_SRC.includes("imagePath.startsWith('/uploads/')"), 'isLegacyImagePath must detect /uploads paths');
  assert.ok(SAFE_SRC.includes('isLegacyImagePath(src)'), 'SafeImage must check the legacy flag before rendering');
  assert.ok(SAFE_SRC.includes('onError'), 'SafeImage must handle load failures');
  assert.ok(/no longer available/i.test(SAFE_SRC), 'placeholder must communicate the legacy situation');
});

test('P4-7. Navigation no longer points at the unrouted /dashboard', () => {
  for (const [name, src] of [['Login', LOGIN_SRC], ['Register', REGISTER_SRC], ['AdminRoute', ADMINROUTE_SRC]]) {
    assert.ok(!src.includes("'/dashboard'"), `${name} must not navigate to /dashboard`);
  }
  assert.ok(LOGIN_SRC.includes("'/my-reports'"), 'Login lands students on /my-reports');
  assert.ok(ADMINROUTE_SRC.includes('/my-reports'), 'AdminRoute redirects non-admins to /my-reports');
});

test('P4-8. Dead code removed; live utilities retained', () => {
  const feRoot = path.join(__dirname, '..', '..', 'frontend', 'src');
  assert.ok(!fs.existsSync(path.join(feRoot, 'pages', 'MatchResults.jsx')), 'MatchResults.jsx removed');
  assert.ok(!fs.existsSync(path.join(feRoot, 'pages', 'MyMatches.jsx')), 'MyMatches.jsx removed');
  assert.ok(!fs.existsSync(path.join(feRoot, 'pages', 'Dashboard.jsx')), 'Dashboard.jsx removed');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'backend', 'check_db.js')), 'check_db.js removed');
  // Retained: getMyMatches is genuinely used by MyReports
  const myService = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'services', 'myService.js'), 'utf8');
  assert.ok(myService.includes('getMyMatches'), 'myService.getMyMatches must be retained (used by MyReports)');
});

// ═════ Runner ═════

(async () => {
  for (const t of analyticsTests) {
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
  console.log(`  PHASE 4 TESTS COMPLETE: ${passed}/${total} PASSED`);
  console.log('====================================================');
  process.exit(failed ? 1 : 0);
})();
