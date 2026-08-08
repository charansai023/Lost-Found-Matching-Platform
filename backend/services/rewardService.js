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

module.exports = {
  getRewardLevel,
  getPointsForCategory,
  REWARD_LEVELS
};
