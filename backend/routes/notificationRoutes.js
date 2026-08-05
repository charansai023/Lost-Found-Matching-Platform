const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

// Apply protect middleware to all notification endpoints
router.use(protect);

router.route('/')
  .get(getNotifications);

router.route('/read-all')
  .patch(markAllAsRead);

router.route('/:id/read')
  .patch(markNotificationAsRead);

router.route('/:id')
  .delete(deleteNotification);

module.exports = router;
