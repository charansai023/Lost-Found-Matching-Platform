const express = require('express');
const router = express.Router();

const { getAllMatches, getMatchesForFoundItem, getMatchingStatus } = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', getAllMatches);
router.get('/status/:itemType/:itemId', getMatchingStatus);
router.get('/:foundItemId', getMatchesForFoundItem);

module.exports = router;
