const express = require('express');
const { getMyRewards, getLeaderboard, redeemReward } = require('../controllers/rewardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/my-rewards', protect, getMyRewards);
router.get('/leaderboard', protect, getLeaderboard);
router.post('/redeem', protect, redeemReward);

module.exports = router;
