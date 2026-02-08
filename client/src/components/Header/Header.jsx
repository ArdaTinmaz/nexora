import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import UserInfoModal from '../UserInfoModal/UserInfoModal';
import { AUTH_STORAGE_KEY } from '../../config';
import userApi from '../../api/userApi';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const isTasksActive = location.pathname.includes('/home/tasks');

  const getBackendOrigin = () => {
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api$/, '');
  };

  const avatarSrc = () => {
    if (user?.avatarURL) {
      if (user.avatarURL.startsWith('http')) return user.avatarURL;
      return `${getBackendOrigin()}${user.avatarURL}`;
    }
    return null;
  };

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed?.token ? parsed : null;
      } catch (_) {
        return null;
      }
    };

    const fetchProfile = async () => {
      try {
        const stored = loadFromStorage();
        if (!stored?.token) return;
        const data = await userApi.getProfile();
        setUser(data?.user || null);
      } catch (err) {
        setError(err.message || 'Profil alınamadı');
      }
    };

    const storedAuth = loadFromStorage();
    if (storedAuth?.user) {
      setUser(storedAuth.user);
      fetchProfile();
    }
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
                    <use href="/sprites.svg#icon-user-white"></use>
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
