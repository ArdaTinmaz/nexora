import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLogin.module.css';
import { adminApi, getAdminToken } from '../../api/adminApi';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState('');

  useEffect(() => {
    let cancelled = false;

    const resolveExistingSession = async () => {
      if (getAdminToken()) {
        navigate('/admin', { replace: true });
        return;
      }

      try {
        await adminApi.adminProfile();
        if (!cancelled) {
          navigate('/admin', { replace: true });
        }
      } catch (_) {
        // no active admin session
      }
    };

    resolveExistingSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      setLoading(true);
      await adminApi.login({ username: form.username, password: form.password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async () => {
    setError('');
    setInfo('');
    const email = (forgotEmail || '').trim();
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    try {
      setLoading(true);
      const res = await adminApi.forgotAdminPassword({ email });
      setInfo(res?.message || 'If the account exists, a verification code was sent.');
      setForgotStep('code');
    } catch (err) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setInfo('');
    if (!forgotEmail.trim() || !forgotCode.trim()) {
      setError('Email and verification code are required.');
      return;
    }
    try {
      setLoading(true);
      await adminApi.verifyAdminResetCode({ email: forgotEmail.trim(), code: forgotCode.trim() });
      setInfo('Code verified. You can set a new password.');
      setForgotStep('reset');
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setInfo('');
    if (!forgotEmail.trim() || !forgotCode.trim()) {
      setError('Email and verification code are required.');
      return;
    }
    if (!forgotPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (forgotPassword !== forgotPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await adminApi.resetAdminPassword({
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        password: forgotPassword,
      });
      setInfo(res?.message || 'Password updated.');
      setForgotStep('email');
      setForgotCode('');
      setForgotPassword('');
      setForgotPasswordConfirm('');
      setForgotOpen(false);
    } catch (err) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/welcome')}
          >
            Back
          </button>
        </div>
        <div className={styles.brand}>NEXORA Admin</div>
        <h1 className={styles.title}>Admin Login</h1>

        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.label}>
            Username or email
            <input
              className={styles.input}
              placeholder="admin or admin@nexora.com"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>
          <button className={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className={styles.forgotRow}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setForgotOpen((prev) => !prev);
              setError('');
              setInfo('');
              setForgotStep('email');
            }}
          >
            Forgot password?
          </button>
        </div>

        {forgotOpen && (
          <div className={styles.forgotPanel}>
            <div className={styles.forgotTitle}>Reset admin password</div>
            <p className={styles.forgotHint}>
              Enter your email to receive a verification code.
            </p>
            <input
              className={styles.input}
              placeholder="Email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
            {forgotStep !== 'email' && (
              <input
                className={styles.input}
                placeholder="Verification code"
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value)}
              />
            )}
            {forgotStep === 'reset' && (
              <>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="New password"
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                />
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Confirm password"
                  value={forgotPasswordConfirm}
                  onChange={(e) => setForgotPasswordConfirm(e.target.value)}
                />
              </>
            )}
            {forgotStep === 'email' && (
              <button className={styles.secondaryBtn} type="button" onClick={handleForgotRequest} disabled={loading}>
                Send code
              </button>
            )}
            {forgotStep === 'code' && (
              <button className={styles.secondaryBtn} type="button" onClick={handleVerifyCode} disabled={loading}>
                Verify code
              </button>
            )}
            {forgotStep === 'reset' && (
              <button className={styles.secondaryBtn} type="button" onClick={handleResetPassword} disabled={loading}>
                Update password
              </button>
            )}
          </div>
        )}

        {error && <div className={styles.errorText}>{error}</div>}
        {info && <div className={styles.infoText}>{info}</div>}
      </div>
    </div>
  );
};

export default AdminLogin;
