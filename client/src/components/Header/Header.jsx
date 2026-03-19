import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import UserInfoModal from '../UserInfoModal/UserInfoModal';
import { API_ORIGIN } from '../../config';
import userApi from '../../api/userApi';
import { notificationApi } from '../../api/notificationApi';
import { getSession } from '../../desktop/session';
import { spriteHref } from '../../utils/assets';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const notificationModalRef = useRef(null);
  const notificationTriggerRef = useRef(null);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionId, setActionId] = useState('');
  const isTasksActive = location.pathname.includes('/home/tasks');
  const isHomeActive = location.pathname === '/home' || location.pathname === '/home/';

  const avatarSrc = useMemo(() => {
    if (user?.avatarURL) {
      if (/^(?:https?:|data:|blob:|file:)/i.test(user.avatarURL)) return user.avatarURL;
      const normalized = user.avatarURL.replace(/\\/g, '/');
      if (normalized.startsWith('/')) return `${API_ORIGIN}${normalized}`;
      if (normalized.startsWith('uploads/')) return `${API_ORIGIN}/${normalized}`;
      return `${API_ORIGIN}/uploads/${normalized}`;
    }
    return null;
  }, [user?.avatarURL]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarSrc]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const stored = await getSession('user');
        if (!stored?.token) return;
        const data = await userApi.getProfile();
        setUser(data?.user || null);
      } catch (err) {
        setError(err.message || 'Profil alınamadı');
      }
    };

    const loadStoredSession = async () => {
      const storedAuth = await getSession('user');
      if (storedAuth?.user) {
        setUser(storedAuth.user);
        fetchProfile();
      }
    };

    loadStoredSession();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationApi.list(120);
      const nextNotifications = (Array.isArray(data?.notifications) ? data.notifications : [])
        .filter((item) => !['channel_message', 'channel_created'].includes(item?.type));
      setNotifications(nextNotifications);
      setUnreadCount(nextNotifications.filter((item) => !item.isRead).length);
    } catch (err) {
      setError(err.message || 'Notifications could not be loaded');
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!isNotificationModalOpen) return undefined;

    const handleOutsideClick = (event) => {
      const modal = notificationModalRef.current;
      const trigger = notificationTriggerRef.current;
      if (modal?.contains(event.target) || trigger?.contains(event.target)) return;
      setIsNotificationModalOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNotificationModalOpen]);

  const unreadBadgeLabel = useMemo(
    () => (unreadCount > 99 ? '99+' : String(unreadCount || 0)),
    [unreadCount]
  );

  const formatNotificationTime = (value) => {
    const ts = Number(value || 0);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const date = new Date(ts);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  };

  const handleMarkAsRead = async (notificationId) => {
    if (!notificationId) return;
    setActionId(notificationId);
    try {
      await notificationApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: true, readAt: item.readAt || Date.now() }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Notification could not be marked as read');
    } finally {
      setActionId('');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!notificationId) return;
    setActionId(notificationId);
    try {
      const target = notifications.find((item) => item.id === notificationId);
      await notificationApi.remove(notificationId);
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      setError(err.message || 'Notification could not be deleted');
    } finally {
      setActionId('');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead('general');
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || Date.now(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || 'Notifications could not be marked as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.id) return;
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    setIsNotificationModalOpen(false);
    navigate(notification.link || '/home/tasks');
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerRight}>
            <button
              ref={notificationTriggerRef}
              className={styles.notificationBtn}
              type="button"
              onClick={() => setIsNotificationModalOpen((prev) => !prev)}
              aria-label="Open notifications"
            >
              <svg className={styles.notificationIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a6 6 0 0 0-6 6v3.48c0 .71-.21 1.41-.61 2l-1.16 1.73A1.5 1.5 0 0 0 5.48 18h13.04a1.5 1.5 0 0 0 1.25-2.79l-1.16-1.73a3.58 3.58 0 0 1-.61-2V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22Z"
                />
              </svg>
              {unreadCount > 0 && (
                <span className={styles.notificationBadge}>{unreadBadgeLabel}</span>
              )}
            </button>
            <span className={styles.headerDivider} aria-hidden="true" />
            <button
              className={`${styles.tasksBtn} ${isTasksActive ? styles.tasksActive : ''}`}
              type="button"
              onClick={() => navigate('/home/tasks')}
            >
              Tasks
            </button>
            <span className={styles.headerDivider} aria-hidden="true" />
            <button
              className={`${styles.tasksBtn} ${isHomeActive ? styles.tasksActive : ''}`}
              type="button"
              onClick={() => navigate('/home')}
            >
              Home
            </button>
            <span className={styles.profileDivider} aria-hidden="true" />
            <button 
              className={styles.userBtn} 
              type="button"
              onClick={() => setIsUserInfoModalOpen(true)}
            >
              <span>{user?.name || 'User'}</span>
              <div className={styles.userAvatar}>
                {avatarSrc && !avatarLoadFailed ? (
                  <img src={avatarSrc} alt="Avatar" onError={() => setAvatarLoadFailed(true)} />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <use href={spriteHref('icon-user-white')}></use>
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {isNotificationModalOpen && (
        <div className={styles.notificationModal} ref={notificationModalRef}>
          <div className={styles.notificationModalHeader}>
            <h3>Notifications</h3>
            <button
              type="button"
              className={styles.notificationMarkAllBtn}
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>
          <div className={styles.notificationList}>
            {notifications.length === 0 ? (
              <p className={styles.notificationEmpty}>No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.notificationItem} ${
                    item.isRead ? styles.notificationRead : styles.notificationUnread
                  }`}
                  onClick={() => handleNotificationClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                >
                  <div className={styles.notificationContent}>
                    <p className={styles.notificationTitle}>{item.title || 'Notification'}</p>
                    <p className={styles.notificationMessage}>{item.message}</p>
                    <span className={styles.notificationTime}>
                      {formatNotificationTime(item.createdAt)}
                    </span>
                  </div>
                  <div
                    className={styles.notificationActions}
                    onClick={(event) => event.stopPropagation()}
                    role="presentation"
                  >
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(item.id)}
                        disabled={actionId === item.id}
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(item.id)}
                      disabled={actionId === item.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <UserInfoModal
        isOpen={isUserInfoModalOpen}
        onClose={() => setIsUserInfoModalOpen(false)}
        onProfileUpdate={setUser}
      />
    </>
  );
}

export default Header;
