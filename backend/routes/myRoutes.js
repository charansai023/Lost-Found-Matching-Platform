const express = require('express');
const router = express.Router();

const { getMyLostItems, getMyFoundItems, getMyMatches } = require('../controllers/myController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/lost', getMyLostItems);
router.get('/found', getMyFoundItems);
router.get('/matches', getMyMatches);

module.exports = router;
