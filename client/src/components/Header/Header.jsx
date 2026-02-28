import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import UserInfoModal from '../UserInfoModal/UserInfoModal';
import { API_ORIGIN } from '../../config';
import userApi from '../../api/userApi';
import { getSession } from '../../desktop/session';
import { spriteHref } from '../../utils/assets';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const isTasksActive = location.pathname.includes('/home/tasks');

  const avatarSrc = () => {
    if (user?.avatarURL) {
      if (/^(?:https?:|data:|blob:|file:)/i.test(user.avatarURL)) return user.avatarURL;
      if (user.avatarURL.startsWith('/')) return `${API_ORIGIN}${user.avatarURL}`;
      if (user.avatarURL.startsWith('uploads/')) return `${API_ORIGIN}/${user.avatarURL}`;
      return `${API_ORIGIN}/uploads/${user.avatarURL}`;
    }
    return null;
  };

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

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerRight}>
            <button
              className={`${styles.tasksBtn} ${isTasksActive ? styles.tasksActive : ''}`}
              type="button"
              onClick={() => navigate('/home/tasks')}
            >
              Tasks
            </button>
            <span className={styles.profileDivider} aria-hidden="true" />
            <button 
              className={styles.userBtn} 
              type="button"
              onClick={() => setIsUserInfoModalOpen(true)}
            >
              <span>{user?.name || 'User'}</span>
              <div className={styles.userAvatar}>
                {avatarSrc() ? (
                  <img src={avatarSrc()} alt="Avatar" />
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

      <UserInfoModal
        isOpen={isUserInfoModalOpen}
        onClose={() => setIsUserInfoModalOpen(false)}
        onProfileUpdate={setUser}
      />
    </>
  );
}

export default Header;
