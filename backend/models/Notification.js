const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
  },
  notificationType: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: [
      // Student notification types
      'match', 'claim_approved', 'claim_rejected', 'returned', 'message', 'otp', 'reminder',
      // Admin notification types
      'new_lost', 'new_found', 'new_claim', 'high_confidence', 'item_returned', 'info_submitted'
    ],
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: [
      // Student notification types
      'match', 'claim_approved', 'claim_rejected', 'returned', 'message', 'otp', 'reminder',
      // Admin notification types
      'new_lost', 'new_found', 'new_claim', 'high_confidence', 'item_returned', 'info_submitted'
    ],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // Null for public or admin-wide notifications
  },
  isAdminNotification: {
    type: Boolean,
    default: false,
  },
  readStatus: {
    type: Boolean,
    default: false,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  relatedItem: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'itemModel',
    default: null,
  },
  itemModel: {
    type: String,
    enum: ['LostItem', 'FoundItem', null],
    default: null,
  },
  relatedMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware hooks to sync fields
notificationSchema.pre('validate', function(next) {
  // Sync type / notificationType
  if (this.type && !this.notificationType) {
    this.notificationType = this.type;
  } else if (this.notificationType && !this.type) {
    this.type = this.notificationType;
  }

  // Sync isRead / readStatus
  if (this.isRead !== undefined && this.readStatus === undefined) {
    this.readStatus = this.isRead;
  } else if (this.readStatus !== undefined && this.isRead === undefined) {
    this.isRead = this.readStatus;
  }
  next();
});

notificationSchema.pre('save', function(next) {
  // Sync modifications
  if (this.isModified('isRead')) {
    this.readStatus = this.isRead;
  } else if (this.isModified('readStatus')) {
    this.isRead = this.readStatus;
  }

  if (this.isModified('type')) {
    this.notificationType = this.type;
  } else if (this.isModified('notificationType')) {
    this.type = this.notificationType;
  }
  next();
});

notificationSchema.pre(['update', 'updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
  const update = this.getUpdate();
  if (update) {
    if (update.readStatus !== undefined && update.isRead === undefined) {
      update.isRead = update.readStatus;
    } else if (update.isRead !== undefined && update.readStatus === undefined) {
      update.readStatus = update.isRead;
    }

    if (update.notificationType !== undefined && update.type === undefined) {
      update.type = update.notificationType;
    } else if (update.type !== undefined && update.notificationType === undefined) {
      update.notificationType = update.type;
    }
  }
  next();
});

// Index declarations for fast lookups
notificationSchema.index({ userId: 1, readStatus: 1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ isAdminNotification: 1, readStatus: 1 });
notificationSchema.index({ isAdminNotification: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
