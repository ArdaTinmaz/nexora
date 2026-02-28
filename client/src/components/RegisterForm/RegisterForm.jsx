import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import styles from './RegisterForm.module.css';
import { authApi } from '../../api/authApi';
import { setSession } from '../../desktop/session';
import { showNotification } from '../../desktop/notifications';

const schema = yup.object({
  name: yup
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(32, 'Name must be at most 32 characters')
    .matches(
      /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/,
      'Name can only contain Latin letters, numbers, and symbols'
    ),
  email: yup
    .string()
    .required('Email is required')
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    )
    .test('single-at', 'Email must contain only one @', (value) => {
      return (value.match(/@/g) || []).length === 1;
    })
    .test('dot-in-host', 'Email must contain a dot in the host part', (value) => {
      const parts = value.split('@');
      return parts.length === 2 && parts[1].includes('.');
    }),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(64, 'Password must be at most 64 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/^\S*$/, 'Password cannot contain spaces'),
});

function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    setServerError('');

    try {
      const result = await authApi.register({
        ...data,
        name: data.name?.trim(),
      });

      if (!result?.token || !result?.refreshToken || !result?.user) {
        setServerError('Registration failed. Please try again.');
        return;
      }

      await setSession('user', {
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
      });
      await showNotification({
        title: 'Nexora',
        body: `Account created for ${result.user.name || 'your team member'}.`,
      });

      navigate('/home');
    } catch (error) {
      console.error('Registration error:', error);
      setServerError(error.message || 'Unable to reach the server. Please try again.');
    }
  };

  return (
    <form className={styles.registerForm} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.formGroup}>
        <input
          type="text"
          placeholder="Enter your name"
          className={`${styles.formInput} ${errors.name ? styles.formInputError : ''}`}
          {...register('name')}
        />
        {errors.name && (
          <span className={styles.errorMessage}>{errors.name.message}</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <input
          type="email"
          placeholder="Enter your email"
          className={`${styles.formInput} ${errors.email ? styles.formInputError : ''}`}
          {...register('email')}
        />
        {errors.email && (
          <span className={styles.errorMessage}>{errors.email.message}</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <div className={styles.passwordInputWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            className={`${styles.formInput} ${errors.password ? styles.formInputError : ''}`}
            {...register('password')}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <svg className={styles.eyeIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        {errors.password && (
          <span className={styles.errorMessage}>{errors.password.message}</span>
        )}
      </div>

      {serverError && <div className={styles.submitError}>{serverError}</div>}

      <button
        type="submit"
        className={styles.btnSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Registering...' : 'Register Now'}
      </button>
    </form>
  );
}

export default RegisterForm;
