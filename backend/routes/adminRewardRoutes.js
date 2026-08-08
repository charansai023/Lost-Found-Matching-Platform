const express = require('express');
const { getRedemptionRequests, updateRedemptionRequest, getRewardConfig, updateRewardConfig } = require('../controllers/adminRewardController');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/requests', protect, isAdmin, getRedemptionRequests);
router.put('/request/:id/:action', protect, isAdmin, updateRedemptionRequest);
router.get('/config', protect, isAdmin, getRewardConfig);
router.put('/config', protect, isAdmin, updateRewardConfig);

module.exports = router;
