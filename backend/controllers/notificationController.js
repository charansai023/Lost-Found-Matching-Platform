const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');

// @desc    Get user or admin notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const filter = {};
  
  if (req.user.role === 'admin') {
    filter.isAdminNotification = true;
  } else {
    filter.userId = req.user._id;
    filter.isAdminNotification = false;
  }

  const notifications = await Notification.find(filter)
    .populate('relatedItem')
    .populate('relatedMatch')
    .sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Notifications fetched successfully', { notifications });
});

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  // Ensure access authorization
  if (req.user.role !== 'admin' && notification.userId?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized access to notification');
  }

  notification.readStatus = true;
  await notification.save();

  sendSuccess(res, 200, 'Notification marked as read', { notification });
});

// @desc    Mark all unread notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const filter = { readStatus: false };
  
  if (req.user.role === 'admin') {
    filter.isAdminNotification = true;
  } else {
    filter.userId = req.user._id;
    filter.isAdminNotification = false;
  }

  const result = await Notification.updateMany(filter, { readStatus: true });

  sendSuccess(res, 200, 'All notifications marked as read', {
    modifiedCount: result.modifiedCount,
  });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  // Ensure access authorization
  if (req.user.role !== 'admin' && notification.userId?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized deletion of notification');
  }

  await notification.deleteOne();

  sendSuccess(res, 200, 'Notification deleted successfully', { id });
});

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
};
