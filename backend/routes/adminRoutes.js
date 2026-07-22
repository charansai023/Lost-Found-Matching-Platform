const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getAllLostItemsAdmin,
  getAllFoundItemsAdmin,
  getAllMatchesAdmin,
  getMatchByIdAdmin,
  verifyMatch,
  rejectMatch,
  markMatchReturned,
  deleteLostItemAdmin,
  deleteFoundItemAdmin,
  getPlatformStats,
  getAllClaimsAdmin,
  updateClaimStatus,
} = require('../controllers/adminController');

const { protect, isAdmin } = require('../middleware/auth');

// Every route below requires a valid JWT AND the "admin" role
router.use(protect, isAdmin);

router.get('/stats', getPlatformStats);
router.get('/users', getAllUsers);
router.get('/lost', getAllLostItemsAdmin);
router.get('/found', getAllFoundItemsAdmin);
router.get('/matches', getAllMatchesAdmin);
router.get('/match/:id', getMatchByIdAdmin);

router.put('/match/:id/verify', verifyMatch);
router.put('/match/:id/reject', rejectMatch);
router.put('/match/:id/returned', markMatchReturned);

router.delete('/lost/:id', deleteLostItemAdmin);
router.delete('/found/:id', deleteFoundItemAdmin);

router.get('/claims', getAllClaimsAdmin);
router.put('/claim/:id/:action', updateClaimStatus);

module.exports = router;
