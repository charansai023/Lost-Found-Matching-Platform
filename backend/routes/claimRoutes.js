const express = require('express');
const router = express.Router();

const { createClaim, getMyClaims } = require('../controllers/claimController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require the user to be logged in
router.use(protect);

router.post('/', upload.single('image'), createClaim);
router.get('/my-claims', getMyClaims);

module.exports = router;
