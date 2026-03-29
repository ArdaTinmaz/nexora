const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserModel = require('../models/User');
const generateToken = require('../utils/generateToken');
const generateRefreshToken = require('../utils/generateRefreshToken');
const { getRefreshTokenFingerprint } = generateRefreshToken;
const sendPasswordResetEmail = require('../utils/sendPasswordResetEmail');
const { getClientBaseUrl, getDesktopBaseUrl } = require('../utils/getClientBaseUrl');
const normalizeAvatarUrl = require('../utils/normalizeAvatarUrl');
const {
  requireString,
  optionalString,
  sanitizeDisplayText,
} = require('../security/validation');
const { extractClientIpFromRequest, getUserAgentFromRequest } = require('../security/requestMeta');
const {
  buildAttemptKeys,
  ensureAuthScopeOpen,
  recordAuthFailure,
  recordAuthSuccess,
} = require('../services/authSecurityService');
const { logSecurityEvent } = require('../services/auditLogService');
const {
  COOKIE_NAMES,
  getCookieFromRequest,
  setUserAuthCookies,
  clearUserAuthCookies,
} = require('../security/authCookies');

const buildUserResponse = (userDoc) => ({
  id: userDoc.id,
  name: userDoc.name,
  email: userDoc.email,
  role: userDoc.role || 'developer',
  avatarURL: normalizeAvatarUrl(userDoc.avatarURL),
  theme: userDoc.theme,
});

const normalizeEmailInput = (input) => {
  if (!input) {
    return '';
  }

  const trimmed = input.trim();
  return (
    validator.normalizeEmail(trimmed, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }) || trimmed.toLowerCase()
  );
};

const saveRefreshToken = async (userId, refreshToken) => {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await UserModel.updateRefreshToken(userId, refreshTokenHash);
};

const sendAuthResponse = async ({ res, user, statusCode, message }) => {
  const sessionVersion = Number.isFinite(Number(user?.sessionVersion))
    ? Number(user.sessionVersion)
    : 0;
  const token = generateToken(user.id, sessionVersion);
  const refreshToken = generateRefreshToken(user.id, sessionVersion);
  await saveRefreshToken(user.id, refreshToken);
  setUserAuthCookies(res.req, res, { accessToken: token, refreshToken });

  res.status(statusCode).json({
    message,
    token,
    refreshToken,
    user: buildUserResponse(user),
  });
};

const verifyRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Refresh token gereklidir');
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    const error = new Error('JWT_REFRESH_SECRET tanımlı değil');
    error.statusCode = 500;
    throw error;
  }

  try {
    return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    const error = new Error('Geçersiz veya süresi dolmuş refresh token');
    error.statusCode = 401;
    throw error;
  }
};

const getAuthRequestMeta = (req) => ({
  ip: extractClientIpFromRequest(req),
  userAgent: getUserAgentFromRequest(req),
});

const applyAuthLockHeader = (res, error) => {
  if (error?.code === 'AUTH_TEMP_LOCKED') {
    const retryAfterSeconds = Math.max(1, Math.ceil(Number(error.retryAfterMs || 0) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
  }
};

const parseBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
};

exports.register = async (req, res, next) => {
  try {
    const name = requireString(req.body?.name, 'İsim', { max: 120 });
    const email = requireString(req.body?.email, 'E-posta', { max: 254 });
    const password = requireString(req.body?.password, 'Şifre', { max: 256, trim: false });
    const avatarURL = optionalString(req.body?.avatarURL, { max: 2_000_000 });
    const trimmedEmail = email.trim();

    if (!validator.isEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }

    if (!validator.isStrongPassword(password, { minNumbers: 1, minSymbols: 0 })) {
      return res.status(400).json({
        message:
          'Şifre en az 8 karakter olmalı, en az bir rakam ve en az bir büyük harf içermelidir',
      });
    }

    const normalizedEmail = normalizeEmailInput(trimmedEmail);
    const existingUser = await UserModel.findUserByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ message: 'Bu e-posta ile kayıtlı kullanıcı bulunuyor' });
    }

    const user = await UserModel.createUser({
      name: sanitizeDisplayText(name, { maxLength: 120 }),
      email: normalizedEmail,
      password,
      avatarURL,
    });

    await sendAuthResponse({
      res,
      user,
      statusCode: 201,
      message: 'Kullanıcı başarıyla oluşturuldu',
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = requireString(req.body?.email, 'E-posta', { max: 254 });
    const password = requireString(req.body?.password, 'Şifre', { max: 256, trim: false });
    const trimmedEmail = email.trim();
    const { ip, userAgent } = getAuthRequestMeta(req);

    if (!validator.isEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }

    const normalizedEmail = normalizeEmailInput(trimmedEmail);
    const attemptKeys = buildAttemptKeys({ identifier: normalizedEmail, ip });

    try {
      await ensureAuthScopeOpen({
        scope: 'auth_login',
        keys: attemptKeys,
      });
    } catch (error) {
      applyAuthLockHeader(res, error);
      await logSecurityEvent({
        eventType: 'auth.login_blocked',
        severity: 'high',
        outcome: 'blocked',
        actorType: 'user',
        actorId: normalizedEmail,
        ip,
        userAgent,
        resource: '/api/auth/login',
        message: 'Login blocked due to temporary lock',
      });
      return res.status(error.statusCode || 429).json({ message: error.message });
    }

    const user = await UserModel.findUserByEmail(normalizedEmail);

    if (!user) {
      await recordAuthFailure({
        scope: 'auth_login',
        keys: attemptKeys,
        ip,
      });
      await logSecurityEvent({
        eventType: 'auth.login_failed',
        severity: 'medium',
        outcome: 'failure',
        actorType: 'user',
        actorId: normalizedEmail,
        ip,
        userAgent,
        resource: '/api/auth/login',
        message: 'Login failed: user not found',
      });
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await recordAuthFailure({
        scope: 'auth_login',
        keys: attemptKeys,
        ip,
        metadata: { userId: user.id },
      });
      await logSecurityEvent({
        eventType: 'auth.login_failed',
        severity: 'medium',
        outcome: 'failure',
        actorType: 'user',
        actorId: user.id,
        actorName: user.email,
        ip,
        userAgent,
        resource: '/api/auth/login',
        message: 'Login failed: password mismatch',
      });
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    await recordAuthSuccess({
      scope: 'auth_login',
      keys: attemptKeys,
    });
    await logSecurityEvent({
      eventType: 'auth.login_success',
      severity: 'low',
      outcome: 'success',
      actorType: 'user',
      actorId: user.id,
      actorName: user.email,
      ip,
      userAgent,
      resource: '/api/auth/login',
      message: 'User login successful',
    });

    await sendAuthResponse({
      res,
      user,
      statusCode: 200,
      message: 'Başarıyla giriş yapıldı',
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const refreshTokenFromBody = optionalString(req.body?.refreshToken, {
      max: 6000,
      trim: true,
    });
    const refreshTokenFromCookie = getCookieFromRequest(req, COOKIE_NAMES.refresh);
    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token gereklidir' });
    }
    const { ip, userAgent } = getAuthRequestMeta(req);
    const fingerprint = getRefreshTokenFingerprint(refreshToken);
    const attemptKeys = buildAttemptKeys({
      identifier: `refresh:${fingerprint || 'unknown'}`,
      ip,
    });

    try {
      await ensureAuthScopeOpen({
        scope: 'auth_refresh',
        keys: attemptKeys,
      });
    } catch (error) {
      applyAuthLockHeader(res, error);
      await logSecurityEvent({
        eventType: 'auth.refresh_blocked',
        severity: 'high',
        outcome: 'blocked',
        actorType: 'user',
        actorId: fingerprint,
        ip,
        userAgent,
        resource: '/api/auth/refresh-token',
        message: 'Refresh blocked due to temporary lock',
      });
      return res.status(error.statusCode || 429).json({ message: error.message });
    }

    let decoded;
    try {
      decoded = await verifyRefreshToken(refreshToken);
    } catch (verifyError) {
      await recordAuthFailure({
        scope: 'auth_refresh',
        keys: attemptKeys,
        ip,
        metadata: { reason: 'invalid_refresh_token' },
      });
      await logSecurityEvent({
        eventType: 'auth.refresh_failed',
        severity: 'medium',
        outcome: 'failure',
        actorType: 'user',
        actorId: fingerprint,
        ip,
        userAgent,
        resource: '/api/auth/refresh-token',
        message: 'Refresh failed: invalid token',
      });
      return res.status(401).json({ message: 'Refresh token doğrulanamadı' });
    }

    const user = await UserModel.findUserById(decoded.userId);

    if (!user || !user.refreshTokenHash) {
      await recordAuthFailure({
        scope: 'auth_refresh',
        keys: attemptKeys,
        ip,
        metadata: { userId: decoded.userId },
      });
      await logSecurityEvent({
        eventType: 'auth.refresh_failed',
        severity: 'medium',
        outcome: 'failure',
        actorType: 'user',
        actorId: decoded.userId,
        ip,
        userAgent,
        resource: '/api/auth/refresh-token',
        message: 'Refresh failed: user or stored token not found',
      });
      return res.status(401).json({ message: 'Refresh token doğrulanamadı' });
    }

    const tokenSessionVersion = Number.isFinite(Number(decoded.sessionVersion))
      ? Number(decoded.sessionVersion)
      : 0;
    const currentSessionVersion = Number.isFinite(Number(user.sessionVersion))
      ? Number(user.sessionVersion)
      : 0;

    if (tokenSessionVersion !== currentSessionVersion) {
      await recordAuthFailure({
        scope: 'auth_refresh',
        keys: attemptKeys,
        ip,
        metadata: { userId: user.id, reason: 'session_version_mismatch' },
      });
      await logSecurityEvent({
        eventType: 'auth.refresh_failed',
        severity: 'high',
        outcome: 'failure',
        actorType: 'user',
        actorId: user.id,
        ip,
        userAgent,
        resource: '/api/auth/refresh-token',
        message: 'Refresh failed: session version mismatch',
      });
      return res.status(401).json({ message: 'Refresh token doğrulanamadı' });
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isMatch) {
      await UserModel.invalidateUserSessions(user.id);
      await recordAuthFailure({
        scope: 'auth_refresh',
        keys: attemptKeys,
        ip,
        metadata: { userId: user.id, reason: 'refresh_reuse_detected' },
      });
      await logSecurityEvent({
        eventType: 'auth.refresh_reuse_detected',
        severity: 'critical',
        outcome: 'blocked',
        actorType: 'user',
        actorId: user.id,
        actorName: user.email,
        ip,
        userAgent,
        resource: '/api/auth/refresh-token',
        message: 'Refresh token reuse detected. All sessions invalidated.',
      });
      return res.status(401).json({ message: 'Refresh token doğrulanamadı' });
    }

    await recordAuthSuccess({
      scope: 'auth_refresh',
      keys: attemptKeys,
    });
    await logSecurityEvent({
      eventType: 'auth.refresh_success',
      severity: 'low',
      outcome: 'success',
      actorType: 'user',
      actorId: user.id,
      actorName: user.email,
      ip,
      userAgent,
      resource: '/api/auth/refresh-token',
      message: 'Token refresh successful',
    });

    await sendAuthResponse({
      res,
      user,
      statusCode: 200,
      message: 'Token yenilendi',
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const refreshTokenBody = optionalString(req.body?.refreshToken, { max: 6000, trim: true });
    const refreshTokenCookie = getCookieFromRequest(req, COOKIE_NAMES.refresh);
    const refreshToken = refreshTokenBody || refreshTokenCookie;
    const bearerToken = parseBearerToken(req) || getCookieFromRequest(req, COOKIE_NAMES.access);
    const { ip, userAgent } = getAuthRequestMeta(req);
    const invalidatedUserIds = new Set();

    const invalidateUser = async (userId) => {
      if (!userId || invalidatedUserIds.has(String(userId))) return;
      await UserModel.invalidateUserSessions(userId);
      invalidatedUserIds.add(String(userId));
    };

    if (refreshToken) {
      try {
        const decoded = await verifyRefreshToken(refreshToken);
        const user = await UserModel.findUserById(decoded.userId);
        if (user && user.refreshTokenHash) {
          const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
          if (isMatch) {
            await invalidateUser(user.id);
          }
        }
      } catch (err) {
        if (!err.statusCode || err.statusCode >= 500) {
          return next(err);
        }
      }
    }

    if (bearerToken && process.env.JWT_SECRET) {
      try {
        const decodedAccess = jwt.verify(bearerToken, process.env.JWT_SECRET);
        if (decodedAccess?.userId) {
          await invalidateUser(decodedAccess.userId);
        }
      } catch (_err) {
        // logout endpoint remains idempotent for expired/invalid access token
      }
    }

    await logSecurityEvent({
      eventType: 'auth.logout',
      severity: 'low',
      outcome: 'success',
      actorType: 'user',
      actorId: invalidatedUserIds.size ? [...invalidatedUserIds][0] : '',
      ip,
      userAgent,
      resource: '/api/auth/logout',
      message: 'Logout processed and token invalidation applied',
      metadata: {
        invalidatedSessionCount: invalidatedUserIds.size,
      },
    });
    clearUserAuthCookies(req, res);

    return res.status(200).json({ message: 'Çıkış yapıldı' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const email = requireString(req.body?.email, 'E-posta', { max: 254 });
    const trimmedEmail = email.trim();

    if (!validator.isEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }

    const normalizedEmail = normalizeEmailInput(trimmedEmail);
    const user = await UserModel.findUserByEmail(normalizedEmail);
    const genericMessage = { message: 'Eğer e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi' };

    if (!user) {
      return res.status(200).json(genericMessage);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await UserModel.setPasswordResetToken(user.id, resetTokenHash, Date.now() + 60 * 60 * 1000);

    const clientURL = getClientBaseUrl().replace(/\/$/, '');
    const desktopURL = getDesktopBaseUrl().replace(/\/$/, '');
    const resetPath = `/reset-password?token=${resetToken}`;
    const loginPath = '/auth/login';
    const resetURL = clientURL.startsWith('http')
      ? `${clientURL}${resetPath}`
      : `${desktopURL}${resetPath}`;
    const loginURL = clientURL.startsWith('http')
      ? `${clientURL}${loginPath}`
      : `${desktopURL}${loginPath}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetToken,
        resetURL,
        loginURL,
      });
    } catch (emailError) {
      await UserModel.clearPasswordResetToken(user.id);
      const error = new Error(emailError?.message || 'Şifre sıfırlama e-postası gönderilemedi');
      error.statusCode = emailError?.statusCode || 500;
      throw error;
    }

    res.status(200).json(genericMessage);
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const token = requireString(req.body?.token, 'Token', { max: 6000 });
    const password = requireString(req.body?.password, 'Şifre', { max: 256, trim: false });

    if (!validator.isStrongPassword(password, { minNumbers: 1, minSymbols: 0 })) {
      return res.status(400).json({
        message:
          'Şifre en az 8 karakter olmalı, en az bir rakam ve en az bir büyük harf içermelidir',
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await UserModel.findUserByResetToken(resetTokenHash);

    if (!user) {
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş token' });
    }

    const updatedUser = await UserModel.updatePassword(user.id, password);
    const sessionInvalidatedUser = await UserModel.incrementSessionVersion(updatedUser.id);
    const userForResponse = sessionInvalidatedUser || updatedUser;

    await sendAuthResponse({
      res,
      user: userForResponse,
      statusCode: 200,
      message: 'Şifreniz güncellendi',
    });
  } catch (error) {
    next(error);
  }
};
