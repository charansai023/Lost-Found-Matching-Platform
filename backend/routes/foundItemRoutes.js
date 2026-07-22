const express = require('express');
const router = express.Router();

const {
  createFoundItem,
  getFoundItems,
  getFoundItemById,
  updateFoundItem,
  deleteFoundItem,
} = require('../controllers/foundItemController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateItem } = require('../middleware/validate');

// All routes below require the user to be logged in
router.use(protect);

router
  .route('/')
  .post(upload.single('image'), validateItem, createFoundItem)
  .get(getFoundItems);

router
  .route('/:id')
  .get(getFoundItemById)
  .put(upload.single('image'), updateFoundItem)
  .delete(deleteFoundItem);

module.exports = router;
