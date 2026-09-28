const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * Phase 2 — Claim → Verify → Return → Finder Reward lifecycle tests.
 * Pure Node assertions (no real DB / network), same lightweight style as
 * tests/phase1.test.js. The return-flow tests invoke the real
 * markClaimReturned controller with mocked mongoose models (swapped via
 * require.cache) so reward, status-transition, and consistency logic is
 * exercised end-to-end without a database.
 *
 * Run: node tests/phase2.test.js
 */

const ApiError = require('../utils/ApiError');
const { isValidObjectId } = require('../middleware/validate');

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

// ─── Source files (for contract assertions) ───
const ADMIN_CTRL = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminController.js'), 'utf8');
const CLAIM_CTRL = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'claimController.js'), 'utf8');
const CLAIM_MODEL = fs.readFileSync(path.join(__dirname, '..', 'models', 'Claim.js'), 'utf8');
const ADMIN_ROUTES = fs.readFileSync(path.join(__dirname, '..', 'routes', 'adminRoutes.js'), 'utf8');

// Strip comments so explanatory mentions don't count as live code.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, ' ');

// ─── Mock infrastructure ───

// All fixture ids MUST be valid 24-hex ObjectIds — the controller's
// assertValidObjectId guard rejects anything else before the flow runs.
const OWNER = '0aaaaaaaaaaaaaaaaaaaaaa1';
const FINDER = 'f1aaaaaaaaaaaaaaaaaaaaaa';
const FOUND_ID = 'f0aaaaaaaaaaaaaaaaaaaaaa';
const LOST_ID = '10aaaaaaaaaaaaaaaaaaaaaa';
const CLAIM_ID = 'c1a111111111111111111111';
const MATCH_ID = 'a1aaaaaaaaaaaaaaaaaaaaa1';

// Populates/selects are chained (a.populate()... / .select(...)); mocks
// return the LIVE fixture object with chainable helpers attached, so the
// controller's mutations (like real mongoose) persist into state.
const withPopulate = (doc) => {
  doc.populate = () => doc;
  doc.select = () => doc;
  doc.lean = () => doc;
  return doc;
};

const buildMocks = ({ claimStatus, claimUser = OWNER, withLostItem = false, withMatch = false } = {}) => {
  const state = {
    claims: [
      {
        _id: CLAIM_ID,
        status: claimStatus,
        user: claimUser,
        foundItem: FOUND_ID,
        lostItem: withLostItem ? LOST_ID : null,
        rewardGranted: false,
        save: async function () { return this; },
      },
    ],
    foundItems: [
      {
        _id: FOUND_ID,
        itemType: 'Wallet',
        category: 'Wallet',
        status: 'Verified',
        user: { _id: FINDER, name: 'Finder F', email: 'finder@test.dev' },
      },
    ],
    lostItems: withLostItem ? [{ _id: LOST_ID, status: 'Verified' }] : [],
    matches: withMatch
      ? [{ _id: MATCH_ID, lostItem: LOST_ID, foundItem: FOUND_ID, status: 'Pending', isRewarded: false, save: async function () { return this; } }]
      : [],
    users: [
      { _id: FINDER, name: 'Finder F', email: 'finder@test.dev', rewardPoints: 0, itemsReturned: 0, rewardLevel: 'Bronze Helper', save: async function () { return this; } },
      { _id: OWNER, name: 'Owner O', email: 'owner@test.dev', rewardPoints: 0, itemsReturned: 0, rewardLevel: 'Bronze Helper', save: async function () { return this; } },
    ],
    rewardHistory: [],
    notifications: [],
  };

  const findUser = (id) => state.users.find((u) => String(u._id) === String(id)) || null;
  const same = (a, b) => String(a) === String(b);

  const models = {
    Claim: {
      findById: (id) => {
        const c = state.claims.find((x) => same(x._id, id));
        return c ? withPopulate(c) : null;
      },
      findOne: async (filter) =>
        state.claims.find((c) => same(c._id, filter._id) && (!('rewardGranted' in filter) || c.rewardGranted === filter.rewardGranted)) || null,
      findOneAndUpdate: async (filter, update) => {
        const c = state.claims.find((x) => same(x._id, filter._id) && x.rewardGranted === filter.rewardGranted);
        if (!c) return null;
        Object.assign(c, update.$set);
        return c;
      },
      countDocuments: async () => state.claims.length,
    },
    FoundItem: {
      findById: (id) => {
        const i = state.foundItems.find((x) => same(x._id, id));
        return i ? withPopulate(i) : null;
      },
      findByIdAndUpdate: async (id, update) => {
        const i = state.foundItems.find((x) => same(x._id, id));
        if (i) Object.assign(i, update);
        return i || null;
      },
    },
    LostItem: {
      findById: (id) => {
        const i = state.lostItems.find((x) => same(x._id, id));
        return i ? withPopulate(i) : null;
      },
      findByIdAndUpdate: async (id, update) => {
        const i = state.lostItems.find((x) => same(x._id, id));
        if (i) Object.assign(i, update);
        return i || null;
      },
    },
    Match: {
      findOne: async (filter) =>
        state.matches.find((m) => same(m.lostItem, filter.lostItem) && same(m.foundItem, filter.foundItem)) || null,
      findOneAndUpdate: async (filter, update) => {
        const m = state.matches.find((x) => same(x._id, filter._id) && x.isRewarded === filter.isRewarded);
        if (!m) return null;
        Object.assign(m, update.$set);
        return m;
      },
      countDocuments: async () => state.matches.length,
    },
    User: {
      findById: (id) => {
        const u = findUser(id);
        return u ? withPopulate(u) : Promise.resolve(null);
      },
    },
    RewardHistory: {
      create: async (doc) => {
                const entry = Object.assign({ _id: `rh-${state.rewardHistory.length + 1}` }, doc);
        state.rewardHistory.push(entry);
        return entry;
      },
    },
    RewardConfig: {
      findOne: async () => ({ pointValues: new Map([['Wallet', 50], ['Others', 50]]) }),
    },
    socketService: {
      createAndSendNotification: async (payload) => {
        state.notifications.push(payload);
        return payload;
      },
    },
    emailService: {
      // Email is not a project feature (no SMTP); stub keeps tests hermetic.
      sendClaimStatusEmail: async () => undefined,
      sendRewardEarnedEmail: async () => undefined,
    },
  };

  return { models, state };
};

const resolve = (p) => require.resolve(p);
const swapPaths = {
  Claim: resolve('../models/Claim'),
  FoundItem: resolve('../models/FoundItem'),
  LostItem: resolve('../models/LostItem'),
  Match: resolve('../models/Match'),
  User: resolve('../models/User'),
  RewardHistory: resolve('../models/RewardHistory'),
  RewardConfig: resolve('../models/RewardConfig'),
  socketService: resolve('../services/socketService'),
  emailService: resolve('../utils/emailService'),
};
const CONTROLLER_PATH = resolve('../controllers/adminController');
const REWARD_SVC_PATH = resolve('../services/rewardService');

const fakeModule = (p, exportsObj) => ({
  id: p, filename: p, path: p, loaded: true, exports: exportsObj, children: [], paths: [],
});

// Installs mocks, loads a FRESH controller instance bound to them (rewardService
// is also reloaded so its RewardConfig binding picks up the mock), runs body,
// then fully restores the previous module cache.
const withMocks = async (models, body) => {
  const savedCache = {};
  for (const [name, p] of Object.entries(swapPaths)) savedCache[name] = require.cache[p];
  const savedCtrl = require.cache[CONTROLLER_PATH];
  const savedRewardSvc = require.cache[REWARD_SVC_PATH];

  for (const [name, p] of Object.entries(swapPaths)) {
    require.cache[p] = fakeModule(p, models[name]);
  }
  delete require.cache[REWARD_SVC_PATH];
  delete require.cache[CONTROLLER_PATH];
  const ctrl = require(CONTROLLER_PATH);

  try {
    await body(ctrl);
  } finally {
    for (const [name, p] of Object.entries(swapPaths)) {
      if (savedCache[name]) require.cache[p] = savedCache[name];
      else delete require.cache[p];
    }
    delete require.cache[REWARD_SVC_PATH];
    if (savedRewardSvc) require.cache[REWARD_SVC_PATH] = savedRewardSvc;
    if (savedCtrl) require.cache[CONTROLLER_PATH] = savedCtrl;
    else delete require.cache[CONTROLLER_PATH];
  }
};

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
// The asyncHandler wrapper returns undefined immediately (the inner
// controller promise is detached), so we drain the event loop until the
// controller has actually settled: response sent OR error passed to next.
const runController = async (fn, req) => {
  const res = makeRes();
  let nextErr = null;
  let settled = false;
  const markSettled = () => { settled = true; };
  fn(req, res, (err) => { nextErr = err; markSettled(); });
  for (let i = 0; i < 1000 && !settled; i++) {
    await new Promise((r) => setImmediate(r));
    if (res.statusCode !== null) settled = true;
  }
  if (!settled) throw new Error('controller never settled (no response, no error)');
  return { res, nextErr };
};

// ═══════════ TESTS 1-3: claim creation protections ═══════════

test('TEST 1. Owner (different user) can claim — guard only fires on self', () => {
  const c = code(CLAIM_CTRL);
  assert.ok(c.includes('foundItem.user.toString() === req.user._id.toString()'),
    'self-claim equality guard must exist');
  assert.ok(c.includes("throw new ApiError(403, 'You cannot claim a found item that you reported.')"),
    '403 fires only when reporter == claimant');
});

test('TEST 2. Finder cannot claim own found report (server-side, bypass-proof)', () => {
  const c = code(CLAIM_CTRL);
  assert.ok(c.includes('assertValidObjectId(foundItemId'), 'claim ids validated server-side');
  assert.ok(/cannot claim a found item that you reported/i.test(c),
    '403 self-claim guard present in createClaim');
});

test('TEST 3. Phase 1 protections intact; guard uses authenticated user only', () => {
  const c = code(CLAIM_CTRL);
  assert.ok(c.includes('req.user._id'), 'guards must use the authenticated user');
  assert.ok(c.includes("['Pending', 'Matched'].includes(foundItem.status)"),
    'Phase 1 claimable-status guard unchanged');
});

// ═══════════ TESTS 4-6: return transition rules (real controller) ═══════════

atest('TEST 4. Pending claim cannot be marked Returned (400)', async () => {
  const { models, state } = buildMocks({ claimStatus: 'pending' });
  await withMocks(models, async (ctrl) => {
    const { nextErr } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.ok(nextErr instanceof ApiError, 'must be an ApiError');
    assert.strictEqual(nextErr.statusCode, 400, 'pending → returned must be 400');
    assert.ok(/must be Verified/i.test(nextErr.message));
    assert.strictEqual(state.claims[0].status, 'pending', 'status must be unchanged');
    assert.strictEqual(state.rewardHistory.length, 0, 'no reward for pending claim');
  });
});

atest('TEST 5. Rejected claim cannot be marked Returned (400)', async () => {
  const { models, state } = buildMocks({ claimStatus: 'rejected' });
  await withMocks(models, async (ctrl) => {
    const { nextErr } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.ok(nextErr instanceof ApiError, 'must be an ApiError');
    assert.strictEqual(nextErr.statusCode, 400, 'rejected → returned must be 400');
    assert.strictEqual(state.claims[0].status, 'rejected', 'status must be unchanged');
    assert.strictEqual(state.rewardHistory.length, 0, 'no reward for rejected claim');
  });
});

atest('TEST 6. Verified direct claim CAN be marked Returned (200 + reward)', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified', withLostItem: false });
  await withMocks(models, async (ctrl) => {
    const { res, nextErr } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(nextErr, null, 'must succeed: ' + (nextErr && nextErr.message));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.rewardAwarded, true);
    assert.strictEqual(res.body.data.rewardPoints, 50);
    assert.strictEqual(state.claims[0].status, 'returned', 'claim → returned');
    assert.strictEqual(state.claims[0].rewardGranted, true, 'reward guard flag flipped');
    assert.strictEqual(state.foundItems[0].status, 'Returned', 'found item → Returned');
    assert.strictEqual(state.users[0].rewardPoints, 50, 'finder credited');
    assert.strictEqual(state.users[0].itemsReturned, 1);
  });
});

// ═══════════ TESTS 7-9: reward correctness ═══════════

atest('TEST 7. Finder receives reward exactly once with a RewardHistory entry', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified' });
  await withMocks(models, async (ctrl) => {
    await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(state.rewardHistory.length, 1, 'one history entry');
    assert.strictEqual(String(state.rewardHistory[0].user), FINDER, 'entry belongs to finder');
    assert.strictEqual(state.rewardHistory[0].points, 50);
    assert.strictEqual(state.rewardHistory[0].type, 'earned');
  });
});

atest('TEST 8. Owner does NOT receive the finder reward', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified' });
  await withMocks(models, async (ctrl) => {
    await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    const owner = state.users.find((u) => String(u._id) === OWNER);
    const finder = state.users.find((u) => String(u._id) === FINDER);
    assert.strictEqual(owner.rewardPoints, 0, 'owner must have zero points');
    assert.strictEqual(owner.itemsReturned, 0);
    assert.ok(state.rewardHistory.every((r) => String(r.user) !== OWNER), 'no history entry for owner');
    assert.ok(finder.rewardPoints > 0, 'finder did get the reward');
  });
});

atest('TEST 9. Direct claim with NO LostItem still rewards the finder', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified', withLostItem: false });
  await withMocks(models, async (ctrl) => {
    const { res } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(state.claims[0].lostItem, null, 'no LostItem involved');
    assert.strictEqual(state.rewardHistory.length, 1, 'finder still rewarded');
    assert.strictEqual(String(state.rewardHistory[0].user), FINDER);
    assert.strictEqual(res.body.data.rewardAwarded, true);
  });
});

// ═══════════ TESTS 10-11: duplicate protection ═══════════

atest('TEST 10. Repeated return request does not award twice', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified' });
  await withMocks(models, async (ctrl) => {
    const first = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(first.res.statusCode, 200);
    const second = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.ok(second.nextErr instanceof ApiError, 'repeat must be rejected');
    assert.strictEqual(second.nextErr.statusCode, 400, 'already returned → 400');
    assert.ok(/already been marked as returned/i.test(second.nextErr.message));
    assert.strictEqual(state.users[0].rewardPoints, 50, 'finder credited only once');
    assert.strictEqual(state.rewardHistory.length, 1, 'only one history entry');
  });
});

atest('TEST 11. Concurrent return requests remain protected (single award)', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified', withLostItem: true, withMatch: false });
  await withMocks(models, async (ctrl) => {
    // Two requests launched simultaneously — both pass the in-memory status
    // check, but the atomic conditional update must let only ONE award.
    const [a, b] = await Promise.all([
      runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } }),
      runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } }),
    ]);
    const awarded = state.users[0].rewardPoints;
    assert.strictEqual(awarded, 50, `exactly one award (got ${awarded})`);
    assert.strictEqual(state.rewardHistory.length, 1, 'one history entry under race');
    const successes = [a, b].filter((r) => r.res.statusCode === 200).length;
    assert.ok(successes >= 1, 'at least one request succeeds');
  });
});

// ═══════════ TEST 13: Match synchronization ═══════════

atest('TEST 13. Linked Match is synchronized and its isRewarded flag guards payment', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified', withLostItem: true, withMatch: true });
  await withMocks(models, async (ctrl) => {
    const { res } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(state.matches[0].status, 'Returned', 'match → Returned');
    assert.strictEqual(state.matches[0].isRewarded, true, 'match reward flag used');
    assert.strictEqual(state.lostItems[0].status, 'Returned', 'lost item → Returned');
    assert.strictEqual(state.foundItems[0].status, 'Returned', 'found item → Returned');
    assert.strictEqual(state.claims[0].status, 'returned', 'claim → returned');
    assert.strictEqual(state.claims[0].rewardGranted, false, 'claim flag untouched (match flag used)');
    assert.strictEqual(state.rewardHistory.length, 1, 'single reward via match flag');
  });
});

// ═══════════ TEST 15: invalid ID handling ═══════════

atest('TEST 15. Invalid claim ID returns 400 (never 500/stack)', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified' });
  await withMocks(models, async (ctrl) => {
    const { nextErr } = await runController(ctrl.markClaimReturned, { params: { id: 'not-an-id' } });
    assert.ok(nextErr instanceof ApiError, 'must be an ApiError');
    assert.strictEqual(nextErr.statusCode, 400);
    assert.ok(!/stack|at /i.test(nextErr.message), 'no stack leakage');
    assert.strictEqual(state.claims[0].status, 'verified', 'nothing mutated');
  });
});

// ═══════════ TEST 16 (RULE 5): self-reward protection ═══════════

atest('TEST 16. Owner == finder: item returned but NO finder reward', async () => {
  const { models, state } = buildMocks({ claimStatus: 'verified', claimUser: FINDER, withLostItem: false });
  await withMocks(models, async (ctrl) => {
    const { res } = await runController(ctrl.markClaimReturned, { params: { id: CLAIM_ID } });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.rewardAwarded, false, 'self-reward blocked');
    assert.strictEqual(res.body.data.rewardPoints, 0);
    assert.strictEqual(state.claims[0].status, 'returned', 'return still happens');
    assert.strictEqual(state.rewardHistory.length, 0, 'zero reward entries');
    const finder = state.users.find((u) => String(u._id) === FINDER);
    assert.strictEqual(finder.rewardPoints, 0, 'no points awarded');
  });
});

// ═══════════ TESTS 12 & 14: source contracts ═══════════

test('TEST 12. Returned status is a real enum value and transition persists', () => {
  const m = code(CLAIM_MODEL);
  assert.ok(/enum:\s*\['pending',\s*'verified',\s*'rejected',\s*'returned'\]/.test(m),
    'Claim enum must include returned');
  const c = code(ADMIN_CTRL);
  assert.ok(c.includes("claim.status = 'returned'"),
    'markClaimReturned performs the real transition');
  assert.ok(c.includes('await claim.save()'), 'transition is persisted via save()');
});

test('TEST 14. Only admins can confirm return (middleware + route)', () => {
  const r = code(ADMIN_ROUTES);
  assert.ok(r.includes('router.use(protect, isAdmin)'), 'admin router behind protect+isAdmin');
  assert.ok(r.includes("router.patch('/claim/:id/return', markClaimReturned)"),
    'PATCH /claim/:id/return registered on the admin router');
  const c = code(ADMIN_CTRL);
  assert.ok(c.includes("assertValidObjectId(req.params.id, 'Claim ID')"),
    'controller validates the claim id');
});

// ═══════════ Runner ═══════════

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
  console.log(`  PHASE 2 TESTS COMPLETE: ${passed}/${total} PASSED`);
  console.log('====================================================');
  process.exit(failed ? 1 : 0);
})();
