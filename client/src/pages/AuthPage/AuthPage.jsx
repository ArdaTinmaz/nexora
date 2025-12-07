import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoginForm from '../../components/LoginForm/LoginForm';
import RegisterForm from '../../components/RegisterForm/RegisterForm';
import styles from './AuthPage.module.css';

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
        </div>

        {/* Form */}
        {isLogin ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}

export default AuthPage;
