const User = require('../models/User');
const RewardConfig = require('../models/RewardConfig');

const REWARD_LEVELS = [
  { name: 'Bronze Helper', threshold: 0 },
  { name: 'Silver Helper', threshold: 201 },
  { name: 'Gold Helper', threshold: 501 },
  { name: 'Platinum Helper', threshold: 1001 },
  { name: 'Campus Legend', threshold: 2001 }
];

const getRewardLevel = (points) => {
  let currentLevel = REWARD_LEVELS[0].name;
  for (const level of REWARD_LEVELS) {
    if (points >= level.threshold) {
      currentLevel = level.name;
    } else {
      break;
    }
  }
  return currentLevel;
};

const getPointsForCategory = async (category) => {
  let config = await RewardConfig.findOne({ singletonKey: 'global_config' });
  if (!config) {
    // Create default config if not exists
    config = await RewardConfig.create({});
  }

  const pointValues = config.pointValues;
  if (pointValues.has(category)) {
    return pointValues.get(category);
  }
  return pointValues.get('Others') || 50;
};

// Canonical redemption catalog (Phase 1 security fix).
// The redeemable items and their point costs are defined HERE on the server,
// mirroring the prices shown in frontend/src/pages/Student/Rewards/RedeemRewards.jsx.
// The redemption API resolves the cost from this catalog by rewardName and
// IGNORES any client-supplied pointsCost, so a forged request can never
// claim that a reward costs fewer points than it really does.
const REWARD_CATALOG = {
  'Printing Credits': 100,
  'Canteen Coupon': 200,
  'Library Extension': 300,
  'Stationery Voucher': 400,
  'Event Pass': 500,
  'College Merchandise': 800,
};

// Returns the authoritative cost for a reward, or null if it doesn't exist.
const getRewardCost = (rewardName) => {
  if (!rewardName || typeof rewardName !== 'string') return null;
  const cost = REWARD_CATALOG[rewardName.trim()];
  return typeof cost === 'number' ? cost : null;
};

module.exports = {
  getRewardLevel,
  getPointsForCategory,
  REWARD_LEVELS,
  REWARD_CATALOG,
  getRewardCost,
};
