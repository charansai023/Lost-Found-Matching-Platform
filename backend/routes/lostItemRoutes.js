const express = require('express');
const router = express.Router();

const {
  createLostItem,
  getLostItems,
  getLostItemById,
  updateLostItem,
  deleteLostItem,
} = require('../controllers/lostItemController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateItem } = require('../middleware/validate');

// All routes below require the user to be logged in
router.use(protect);

router
  .route('/')
  .post(upload.single('image'), validateItem, createLostItem)
  .get(getLostItems);

router
  .route('/:id')
  .get(getLostItemById)
  .put(upload.single('image'), updateLostItem)
  .delete(deleteLostItem);

module.exports = router;
