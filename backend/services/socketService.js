const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

let io = null;

/**
 * Initializes Socket.IO server with CORS configuration and handshake authentication middleware
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || origin === process.env.CLIENT_URL) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  // JWT Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket.IO] Handshake auth error:', err.message);
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const userIdStr = socket.user._id.toString();
    console.log(`[Socket.IO] Client connected: ${socket.user.name} (${userIdStr}) [SocketID: ${socket.id}]`);

    // 1. Join user personal room
    socket.join(userIdStr);

    // 2. Join admins room if role is admin
    if (socket.user.role === 'admin') {
      socket.join('admins');
      console.log(`[Socket.IO] Admin joined 'admins' room: ${socket.user.name}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.user.name} [SocketID: ${socket.id}]`);
    });
  });

  return io;
};

/**
 * Helper to get the active Socket.IO server instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};

/**
 * Creates a notification document in MongoDB and immediately emits it in real-time
 * 
 * @param {Object} data 
 * @param {string} data.title - Notification title
 * @param {string} data.message - Notification body content
 * @param {string} data.notificationType - Enum matching type list
 * @param {string} [data.userId] - Target student user ObjectId string (omitted/null for admin broadcasts)
 * @param {boolean} [data.isAdminNotification=false] - Flag indicating admin audience
 * @param {string} [data.relatedItem] - LostItem/FoundItem ObjectId
 * @param {string} [data.itemModel] - 'LostItem' | 'FoundItem'
 * @param {string} [data.relatedMatch] - Match ObjectId
 * @param {'low' | 'medium' | 'high'} [data.priority='medium'] - Priority level
 */
const createAndSendNotification = async (data) => {
  try {
    const notification = await Notification.create({
      title: data.title,
      message: data.message,
      notificationType: data.notificationType,
      type: data.type || data.notificationType,
      userId: data.userId || null,
      isAdminNotification: Boolean(data.isAdminNotification),
      relatedItem: data.relatedItem || null,
      itemModel: data.itemModel || null,
      relatedMatch: data.relatedMatch || null,
      priority: data.priority || 'medium',
      isRead: false,
      readStatus: false,
    });

    // Populate populated items before emitting
    const populated = await Notification.findById(notification._id)
      .populate('relatedItem')
      .populate('relatedMatch');

    if (!io) {
      console.warn('[Socket.IO] Warning: Server not initialized yet. Notification saved to DB only.');
      return populated;
    }

    // Emit Real-Time Socket Event
    if (populated.isAdminNotification) {
      io.to('admins').emit('new_notification', populated);
      console.log(`[Socket.IO] Real-time admin notification emitted: "${populated.title}"`);
    } else if (populated.userId) {
      io.to(populated.userId.toString()).emit('new_notification', populated);
      console.log(`[Socket.IO] Real-time user notification emitted to ${populated.userId}: "${populated.title}"`);
    }

    return populated;
  } catch (err) {
    console.error('[Socket.IO] Error creating/sending notification:', err.message);
  }
};

module.exports = {
  initSocket,
  getIO,
  createAndSendNotification,
};
