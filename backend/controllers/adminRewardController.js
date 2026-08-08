const User = require('../models/User');
const RedemptionRequest = require('../models/RedemptionRequest');
const RewardHistory = require('../models/RewardHistory');
const RewardConfig = require('../models/RewardConfig');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getRewardLevel } = require('../services/rewardService');

// @desc    Get all redemption requests
// @route   GET /api/admin/rewards/requests
// @access  Private/Admin
const getRedemptionRequests = asyncHandler(async (req, res) => {
  const requests = await RedemptionRequest.find()
    .populate('user', 'name email rewardPoints')
    .sort({ createdAt: -1 });
    
  sendSuccess(res, 200, 'Requests fetched successfully', { requests });
});

// @desc    Approve or reject a redemption request
// @route   PUT /api/admin/rewards/request/:id/:action
// @access  Private/Admin
const updateRedemptionRequest = asyncHandler(async (req, res) => {
  const { action } = req.params;
  const request = await RedemptionRequest.findById(req.params.id).populate('user');
  
  if (!request) {
    throw new ApiError(404, 'Request not found');
  }

  if (request.status !== 'pending') {
    throw new ApiError(400, `Request is already ${request.status}`);
  }

  if (action === 'approve') {
    const user = await User.findById(request.user._id);
    
    if (user.rewardPoints < request.pointsCost) {
       throw new ApiError(400, 'User does not have enough points anymore');
    }
    
    // Deduct points
    user.rewardPoints -= request.pointsCost;
    user.rewardLevel = getRewardLevel(user.rewardPoints);
    await user.save();
    
    // Log history
    await RewardHistory.create({
      user: user._id,
      points: -request.pointsCost,
      type: 'redeemed',
      reason: `Redeemed for ${request.rewardName}`
    });

    request.status = 'approved';
  } else if (action === 'reject') {
    request.status = 'rejected';
  } else {
    throw new ApiError(400, 'Invalid action');
  }

  await request.save();
  sendSuccess(res, 200, `Request ${action}d successfully`, { request });
});

// @desc    Get global reward configuration
// @route   GET /api/admin/rewards/config
// @access  Private/Admin
const getRewardConfig = asyncHandler(async (req, res) => {
  let config = await RewardConfig.findOne({ singletonKey: 'global_config' });
  if (!config) {
    config = await RewardConfig.create({});
  }
  sendSuccess(res, 200, 'Config fetched successfully', { config });
});

// @desc    Update global reward configuration
// @route   PUT /api/admin/rewards/config
// @access  Private/Admin
const updateRewardConfig = asyncHandler(async (req, res) => {
  const { pointValues } = req.body;
  let config = await RewardConfig.findOne({ singletonKey: 'global_config' });
  if (!config) {
    config = await RewardConfig.create({ pointValues });
  } else {
    config.pointValues = pointValues;
    await config.save();
  }
  sendSuccess(res, 200, 'Config updated successfully', { config });
});

module.exports = {
  getRedemptionRequests,
  updateRedemptionRequest,
  getRewardConfig,
  updateRewardConfig
};
