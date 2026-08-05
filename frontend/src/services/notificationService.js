import api from './api';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE.replace('/api', '');

let socketInstance = null;

/**
 * Initialize and connect a Socket.IO client for an authenticated user.
 * Automatically reconnects on network interruption.
 * @param {string} token - JWT token from local storage
 * @param {function} onNotification - callback(notification) fired on real-time event
 * @returns {Socket} connected socket instance
 */
export const connectSocket = (token, onNotification) => {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    transports: ['websocket', 'polling'],
  });

  socketInstance.on('connect', () => {
    console.log('[Socket.IO] Connected to server:', socketInstance.id);
  });

  socketInstance.on('new_notification', (notification) => {
    if (typeof onNotification === 'function') {
      onNotification(notification);
    }
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected:', reason);
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socketInstance;
};

/**
 * Disconnect the active socket connection and clean up
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log('[Socket.IO] Socket disconnected and cleaned up');
  }
};

/**
 * Fetch the user's notifications from the REST API
 */
export const fetchNotifications = () =>
  api.get('/notifications');

/**
 * Mark a single notification as read
 */
export const markAsRead = (id) =>
  api.patch(`/notifications/${id}/read`);

/**
 * Mark all notifications as read
 */
export const markAllRead = () =>
  api.patch('/notifications/read-all');

/**
 * Delete a notification
 */
export const deleteNotification = (id) =>
  api.delete(`/notifications/${id}`);
