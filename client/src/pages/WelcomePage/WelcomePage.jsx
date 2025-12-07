import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './WelcomePage.module.css';

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.welcomePage}>
      <div className={styles.welcomeContent}>
        {/* Illustration */}
        <div className={styles.illustration}>
          <img 
            src={`${process.env.PUBLIC_URL}/images/TaskProDesktop/welcomePageImage.png`}
            alt="Person with laptop" 
            className={styles.illustrationImage}
          />
        </div>

        {/* Nexora Logo */}
        <div className={styles.logoContainer}>
          <svg className={styles.lightningIcon} width="48" height="48" viewBox="0 0 32 32">
            <use href="/sprites.svg#icon-icon"></use>
          </svg>
          <span className={styles.logoText}>Nexora</span>
        </div>

        {/* Tagline */}
        <p className={styles.tagline}>
          Supercharge your productivity and take control of your tasks with Nexora - Don't wait, start achieving your goals now!
        </p>

        {/* Registration Button */}
        <button 
          className={styles.btnRegistration}
          onClick={() => navigate('/auth/register')}
          type="button"
        >
          Registration
        </button>

        {/* Log In Link */}
        <button 
          className={styles.linkLogin}
          onClick={() => navigate('/auth/login')}
          type="button"
        >
          Log In
        </button>
      </div>
    </div>
  );
}

export default WelcomePage;
