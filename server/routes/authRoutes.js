const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { createEndpointRateLimiter } = require('../security/endpointRateLimit');

const router = express.Router();

const loginRateLimiter = createEndpointRateLimiter({
  scope: 'auth:login',
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE) || 12,
});

const refreshRateLimiter = createEndpointRateLimiter({
  scope: 'auth:refresh-token',
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.AUTH_REFRESH_RATE_LIMIT_PER_MINUTE) || 24,
});

router.post('/register', register);
router.post('/login', loginRateLimiter, login);
router.post('/refresh-token', refreshRateLimiter, refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
