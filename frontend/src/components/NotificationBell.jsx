import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  connectSocket,
  disconnectSocket,
} from '../services/notificationService';
import useAuth from '../hooks/useAuth';
import './NotificationBell.css';

// Notification type → icon mapping
const typeIcon = {
  match: '✨',
  claim_approved: '✅',
  claim_rejected: '❌',
  returned: '🎉',
  message: '📩',
  otp: '🔐',
  reminder: '⏰',
  new_lost: '📋',
  new_found: '📦',
  new_claim: '📎',
  high_confidence: '🧠',
  item_returned: '📬',
  info_submitted: '📝',
};

// Notification type → colour class
const typeColor = {
  match: 'notif-match',
  claim_approved: 'notif-approved',
  claim_rejected: 'notif-rejected',
  returned: 'notif-returned',
  message: 'notif-message',
  high_confidence: 'notif-ai',
  new_claim: 'notif-claim',
  new_lost: 'notif-admin',
  new_found: 'notif-admin',
};

const formatTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.readStatus).length;

  // Load existing notifications from API
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchNotifications();
      setNotifications(res.data.data?.notifications || []);
    } catch (err) {
      // Silently fail — non-critical
    }
  }, [user]);

  // Show a toast for incoming real-time notification
  const addToast = useCallback((notification) => {
    const id = notification._id || Date.now();
    setToasts((prev) => [{ ...notification, toastId: id }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.toastId !== id));
    }, 5000);
  }, []);

  // Handle incoming real-time event
  const handleNewNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev]);
    addToast(notification);
  }, [addToast]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const token = localStorage.getItem('token');
    if (token) {
      connectSocket(token, handleNewNotification);
    }

    return () => {
      disconnectSocket();
    };
  }, [user, loadNotifications, handleNewNotification]);

  // Close panel on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readStatus: true } : n))
      );
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
    } catch (e) {}
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (e) {}
  };

  if (!user) return null;

  return (
    <>
      {/* Bell Button */}
      <div className="notif-bell-wrapper">
        <button
          ref={bellRef}
          className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          title="Notifications"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* Notification Panel Dropdown */}
        {isOpen && (
          <div ref={panelRef} className="notif-panel">
            <div className="notif-panel__header">
              <span className="notif-panel__title">🔔 Notifications</span>
              <div className="notif-panel__actions">
                {unreadCount > 0 && (
                  <button className="notif-btn-text" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="notif-panel__list">
              {notifications.length === 0 ? (
                <div className="notif-empty">
                  <span>🔕</span>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`notif-item ${!n.readStatus ? 'notif-item--unread' : ''} ${typeColor[n.notificationType] || ''}`}
                    onClick={() => !n.readStatus && handleMarkRead(n._id)}
                  >
                    <div className="notif-item__icon">
                      {typeIcon[n.notificationType] || '🔔'}
                    </div>
                    <div className="notif-item__body">
                      <div className="notif-item__title">{n.title}</div>
                      <div className="notif-item__msg">{n.message}</div>
                      <div className="notif-item__meta">
                        <span className="notif-item__time">{formatTime(n.createdAt)}</span>
                        {!n.readStatus && <span className="notif-item__unread-dot" />}
                      </div>
                    </div>
                    <button
                      className="notif-item__delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                      title="Delete notification"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification Stack */}
      <div className="notif-toast-container">
        {toasts.map((t) => (
          <div key={t.toastId} className={`notif-toast notif-toast--enter ${typeColor[t.notificationType] || ''}`}>
            <span className="notif-toast__icon">{typeIcon[t.notificationType] || '🔔'}</span>
            <div className="notif-toast__body">
              <div className="notif-toast__title">{t.title}</div>
              <div className="notif-toast__msg">{t.message}</div>
            </div>
            <button
              className="notif-toast__close"
              onClick={() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId))}
            >✕</button>
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationBell;
