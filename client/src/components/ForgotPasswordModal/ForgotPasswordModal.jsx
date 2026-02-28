import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ForgotPasswordModal.module.css';
import { authApi } from '../../api/authApi';

function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('request');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setStep('request');
      setResetToken('');
      setPassword('');
      setConfirmPassword('');
      setStatus({ type: '', message: '' });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const getPasswordValidationError = (value) => {
    if (!value) {
      return '';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(value)) {
      return 'Password must include at least one uppercase letter.';
    }

    if (!/\d/.test(value)) {
      return 'Password must include at least one number.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    setIsSubmitting(true);

    try {
      if (step === 'request') {
        if (!email.trim()) {
          setStatus({ type: 'error', message: 'Please enter your email address.' });
          return;
        }

        await authApi.forgotPassword({ email: email.trim() });
        setStep('reset');
        setStatus({
          type: 'success',
          message: 'Check your email for the reset token, then paste it below to set a new password.',
        });
        return;
      }

      if (!resetToken.trim()) {
        setStatus({ type: 'error', message: 'Please enter the reset token from the email.' });
        return;
      }

      const passwordError = getPasswordValidationError(password);
      if (passwordError) {
        setStatus({ type: 'error', message: passwordError });
        return;
      }

      if (password !== confirmPassword) {
        setStatus({ type: 'error', message: 'Passwords do not match.' });
        return;
      }

      await authApi.resetPassword({ token: resetToken.trim(), password });
      setStatus({
        type: 'success',
        message: 'Your password has been updated. You can now sign in.',
      });
      setStep('request');
      setResetToken('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Forgot password error:', error);
      setStatus({
        type: 'error',
        message: error.message || 'Unable to reach the server. Please try again.',
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
          {step === 'request'
            ? 'Enter your email address and we will send a one-time reset token if an account exists.'
            : 'Paste the token from the email and choose a new password.'}
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          {step === 'request' ? (
            <input
              type="email"
              className={styles.input}
              placeholder="Your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          ) : (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder="Reset token"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
              />
              <input
                type="password"
                className={styles.input}
                placeholder="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <input
                type="password"
                className={styles.input}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setStep('request');
                  setResetToken('');
                  setPassword('');
                  setConfirmPassword('');
                  setStatus({ type: '', message: '' });
                }}
              >
                Back to email step
              </button>
            </>
          )}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : step === 'request' ? 'Send token' : 'Update password'}
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
