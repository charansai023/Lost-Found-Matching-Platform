const User = require('../models/User');
const RewardHistory = require('../models/RewardHistory');
const RedemptionRequest = require('../models/RedemptionRequest');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { REWARD_LEVELS } = require('../services/rewardService');

// @desc    Get logged in user's reward info and history
// @route   GET /api/rewards/my-rewards
// @access  Private
const getMyRewards = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  // Calculate rank
  const usersWithMorePoints = await User.countDocuments({ rewardPoints: { $gt: user.rewardPoints } });
  const rank = usersWithMorePoints + 1;

  // Calculate points for next level
  let pointsToNextLevel = null;
  let nextLevelName = null;
  for (const level of REWARD_LEVELS) {
    if (level.threshold > user.rewardPoints) {
      pointsToNextLevel = level.threshold - user.rewardPoints;
      nextLevelName = level.name;
      break;
    }
  }
  
  // Get history
  const history = await RewardHistory.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  sendSuccess(res, 200, 'Rewards fetched successfully', {
    rewardPoints: user.rewardPoints,
    itemsReturned: user.itemsReturned,
    rewardLevel: user.rewardLevel,
    rank,
    pointsToNextLevel,
    nextLevelName,
    history
  });
});

// @desc    Get top 10 users by points
// @route   GET /api/rewards/leaderboard
// @access  Private
const getLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await User.find({ rewardPoints: { $gt: 0 } })
    .select('name rewardPoints rewardLevel itemsReturned')
    .sort({ rewardPoints: -1 })
    .limit(10);
    
  sendSuccess(res, 200, 'Leaderboard fetched successfully', { leaderboard });
});

// @desc    Submit a redemption request
// @route   POST /api/rewards/redeem
// @access  Private
const redeemReward = asyncHandler(async (req, res) => {
  const { rewardName, pointsCost } = req.body;
  const user = await User.findById(req.user._id);

  if (user.rewardPoints < pointsCost) {
    throw new ApiError(400, 'Insufficient reward points');
  }

  // We do not deduct points until admin approval
  const request = await RedemptionRequest.create({
    user: user._id,
    rewardName,
    pointsCost
  });

  sendSuccess(res, 201, 'Redemption request submitted successfully', { request });
});

module.exports = {
  getMyRewards,
  getLeaderboard,
  redeemReward
};
