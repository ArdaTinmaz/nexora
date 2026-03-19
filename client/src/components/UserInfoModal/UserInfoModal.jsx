import React, { useEffect, useState } from 'react';
import styles from './UserInfoModal.module.css';
import userApi from '../../api/userApi';
import { API_ORIGIN } from '../../config';
import { getSession, setSession } from '../../desktop/session';
import { showNotification } from '../../desktop/notifications';
import { spriteHref } from '../../utils/assets';

const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:\//i;

function UserInfoModal({ isOpen, onClose, onProfileUpdate }) {
  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Avatar secilemedi'));
      reader.readAsDataURL(file);
    });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getProfile();
        setName(data?.user?.name || '');
        setEmail(data?.user?.email || '');
        setCurrentEmail(data?.user?.email || '');
        setAvatarPreview(data?.user?.avatarURL || '');
        if (onProfileUpdate && data?.user) {
          onProfileUpdate(data.user);
        }
      } catch (err) {
        setError(err.message || 'Profil alınamadı');
      }
    };

    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const updateStoredUser = (nextUser) => {
    getSession('user').then((storedAuth) => {
      if (!storedAuth) return;
      setSession('user', {
        ...storedAuth,
        user: { ...(storedAuth.user || {}), ...nextUser },
      });
    });
  };

  const getAvatarSrc = () => {
    if (avatarPreview) {
      const normalized = String(avatarPreview).trim().replace(/\\/g, '/');
      if (!normalized) return '';
      if (/^(?:https?:|data:|blob:|file:)/i.test(normalized)) return normalized;
      const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
      if (uploadsIndex >= 0) return `${API_ORIGIN}${normalized.slice(uploadsIndex)}`;
      if (WINDOWS_ABSOLUTE_PATH_RE.test(normalized)) {
        const fileName = normalized.split('/').pop();
        return fileName ? `${API_ORIGIN}/uploads/${fileName}` : '';
      }
      if (normalized.startsWith('/')) return `${API_ORIGIN}${normalized}`;
      if (normalized.startsWith('uploads/')) return `${API_ORIGIN}/${normalized}`;
      return `${API_ORIGIN}/uploads/${normalized}`;
    }
    return '';
  };

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarPreview]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    if (awaitingVerification) {
      if (!verificationCode.trim()) {
        setError('Please enter the verification code sent to your new email');
        return;
      }
      try {
        setLoading(true);
        const data = await userApi.verifyEmailChange({ code: verificationCode.trim() });
        setEmail(data?.user?.email || email);
        setCurrentEmail(data?.user?.email || email);
        updateStoredUser(data?.user);
        if (onProfileUpdate && data?.user) {
          onProfileUpdate(data.user);
        }
        setStatus('Email verified and updated');
        await showNotification({
          title: 'Nexora',
          body: 'Your email address has been verified.',
        });
        setAwaitingVerification(false);
        setVerificationCode('');
      } catch (err) {
        setError(err.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const profileRes = await userApi.updateProfile({
        name,
        password: password || undefined,
        avatarURL: avatarDataUrl || undefined,
      });

      updateStoredUser(profileRes?.user);
      if (onProfileUpdate && profileRes?.user) {
        onProfileUpdate(profileRes.user);
      }
      setStatus('Profile updated');
      setPassword('');
      setConfirmPassword('');
      if (profileRes?.user?.avatarURL) {
        setAvatarPreview(profileRes.user.avatarURL);
        setAvatarDataUrl('');
      }

      if (email !== currentEmail) {
        await userApi.requestEmailChange({ newEmail: email });
        setAwaitingVerification(true);
        setStatus('Verification code sent to new email');
      } else {
        await showNotification({
          title: 'Nexora',
          body: 'Your profile was updated.',
        });
      }
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarDataUrl(dataUrl);
      setAvatarPreview(dataUrl);
      setAvatarLoadFailed(false);
    } catch (err) {
      setError(err.message || 'Avatar secilemedi');
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>User Profile</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Avatar</label>
            <div className={styles.avatarSection}>
              <div className={styles.avatarPreview}>
                {getAvatarSrc() && !avatarLoadFailed ? (
                  <img
                    src={getAvatarSrc()}
                    alt="Avatar"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <svg width="64" height="64" viewBox="0 0 32 32">
                    <use href={spriteHref('icon-user-white')}></use>
                  </svg>
                )}
              </div>
              <label className={styles.avatarUploadBtn}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className={styles.fileInput}
                />
                Upload Avatar
              </label>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirm Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {awaitingVerification && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Verification code</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Enter code sent to new email"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
            </div>
          )}

          {(status || error) && (
            <div className={status ? styles.status : styles.error}>
              {status || error}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            <span className={styles.submitText}>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserInfoModal;
