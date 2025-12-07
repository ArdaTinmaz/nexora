import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import styles from './ResetPasswordPage.module.css';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

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

    if (!token) {
      setStatus({ type: 'error', message: 'Reset link is invalid or missing.' });
      return;
    }

    const validationError = getPasswordValidationError(password);
    if (validationError) {
      setStatus({
        type: 'error',
        message: validationError,
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({
        type: 'error',
        message: 'Passwords do not match.',
      });
      return;
    }

    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          result?.message || 'Password could not be reset. Please try again.';
        setStatus({ type: 'error', message: errorMessage });
      } else {
        setStatus({
          type: 'success',
          message: 'Your password has been updated. Redirecting to the login screen...',
        });
        setTimeout(() => navigate('/auth/login'), 2000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setStatus({
        type: 'error',
        message: 'Unable to reach the server. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Create a new password</h1>
        <p className={styles.subtitle}>
          Create a strong password to regain access to your account.
        </p>
        <div className={styles.inputWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="New password"
            className={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <svg
              className={styles.eyeIcon}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {showPassword ? (
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {password && getPasswordValidationError(password) && (
          <p className={styles.requirementsText}>{getPasswordValidationError(password)}</p>
        )}
        <div className={styles.inputWrapper}>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm new password"
            className={styles.input}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            <svg
              className={styles.eyeIcon}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {showConfirmPassword ? (
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating...' : 'Update password'}
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
  );
}

export default ResetPasswordPage;
