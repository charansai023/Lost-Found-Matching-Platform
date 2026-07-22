const express = require('express');
const router = express.Router();

const { getAllMatches, getMatchesForFoundItem } = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// All routes below require the user to be logged in
router.use(protect);

router.get('/', getAllMatches);
router.get('/:foundItemId', getMatchesForFoundItem);

module.exports = router;
