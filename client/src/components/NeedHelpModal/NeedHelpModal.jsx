import React, { useState } from 'react';
import styles from './NeedHelpModal.module.css';
import supportApi from '../../api/supportApi';

function NeedHelpModal({ isOpen, onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (email.trim() && comment.trim()) {
      try {
        setLoading(true);
        await supportApi.sendHelp({
          email: email.trim(),
          comment: comment.trim(),
        });
        if (onSubmit) {
          onSubmit({
            email: email.trim(),
            comment: comment.trim(),
          });
        }
        setStatus('Your request has been sent. Please check your email.');
        setEmail('');
        setComment('');
      } catch (err) {
        setError(err.message || 'Unable to send request.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Need help</h2>
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
            <input
              type="email"
              className={styles.input}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <textarea
              className={styles.textarea}
              placeholder="Comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>

          {(status || error) && (
            <div className={status ? styles.status : styles.error}>{status || error}</div>
          )}

          <button type="submit" className={styles.submitBtn}>
            <span className={styles.submitText}>{loading ? 'Sending...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default NeedHelpModal;

