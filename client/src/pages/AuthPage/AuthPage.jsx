import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoginForm from '../../components/LoginForm/LoginForm';
import RegisterForm from '../../components/RegisterForm/RegisterForm';
import styles from './AuthPage.module.css';
import { assetUrl } from '../../utils/assets';

function AuthPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isLogin = id === 'login';

  const handleTabChange = (newId) => {
    navigate(`/auth/${newId}`);
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.logoContainer}>
          <img
            className={styles.logoIcon}
            src={assetUrl('icon.PNG')}
            alt="Nexora icon"
          />
          <span className={styles.logoText}>Nexora</span>
        </div>

        {/* Tabs */}
        <div className={styles.authTabs}>
          <button
            className={`${styles.authTab} ${!isLogin ? styles.authTabActive : ''}`}
            onClick={() => handleTabChange('register')}
            type="button"
          >
            Registration
          </button>
          <button
            className={`${styles.authTab} ${isLogin ? styles.authTabActive : ''}`}
            onClick={() => handleTabChange('login')}
            type="button"
          >
            Log In
          </button>
          <button
            className={styles.authTab}
            onClick={() => navigate('/admin/login')}
            type="button"
          >
            Admin
          </button>
        </div>

        {/* Form */}
        {isLogin ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}

export default AuthPage;
