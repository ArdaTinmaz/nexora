import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../../config';
import styles from './ForgotPasswordModal.module.css';

function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setStatus({ type: '', message: '' });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          result?.message || 'The reset email could not be sent. Please try again.';
        setStatus({ type: 'error', message: errorMessage });
      } else {
        setStatus({
          type: 'success',
          message: 'If the email is registered, a reset link has been sent.',
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setStatus({
        type: 'error',
        message: 'Unable to reach the server. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close reset password dialog"
        >
          &times;
        </button>
        <h2 className={styles.title}>Password reset</h2>
        <p className={styles.subtitle}>
          Enter your email address and we will send a reset link if an account exists.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            className={styles.input}
            placeholder="Your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send link'}
          </button>
          {status.message && (
            <div
              className={
                status.type === 'success' ? styles.successText : styles.errorText
              }
            >
              {status.message}
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}

export default ForgotPasswordModal;
