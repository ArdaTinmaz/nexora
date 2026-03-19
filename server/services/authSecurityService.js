const AuthAttempt = require('../models/AuthAttempt');
const { sanitizePlainText } = require('../security/validation');

const DEFAULT_SCOPE_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

const SCOPE_CONFIG = {
  auth_login: {
    maxAttempts: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS) || 5,
    windowMs: Number(process.env.AUTH_LOGIN_WINDOW_MS) || 15 * 60 * 1000,
    lockMs: Number(process.env.AUTH_LOGIN_LOCK_MS) || 15 * 60 * 1000,
  },
  auth_refresh: {
    maxAttempts: Number(process.env.AUTH_REFRESH_MAX_ATTEMPTS) || 8,
    windowMs: Number(process.env.AUTH_REFRESH_WINDOW_MS) || 15 * 60 * 1000,
    lockMs: Number(process.env.AUTH_REFRESH_LOCK_MS) || 15 * 60 * 1000,
  },
  admin_login: {
    maxAttempts: Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS) || 5,
    windowMs: Number(process.env.ADMIN_LOGIN_WINDOW_MS) || 15 * 60 * 1000,
    lockMs: Number(process.env.ADMIN_LOGIN_LOCK_MS) || 30 * 60 * 1000,
  },
};

const getScopeConfig = (scope) => SCOPE_CONFIG[scope] || DEFAULT_SCOPE_CONFIG;

const buildAttemptKeys = ({ identifier = '', ip = '' } = {}) => {
  const normalizedIdentifier = sanitizePlainText(identifier, { maxLength: 160 }).toLowerCase();
  const normalizedIp = sanitizePlainText(ip, { maxLength: 120 });
  const keys = [];

  if (normalizedIdentifier) keys.push(`id:${normalizedIdentifier}`);
  if (normalizedIp) keys.push(`ip:${normalizedIp}`);
  if (!keys.length) keys.push('anonymous');

  return keys;
};

const getLockedRecord = async (scope, keys) => {
  const now = Date.now();
  return AuthAttempt.findOne({
    scope,
    key: { $in: keys },
    lockUntil: { $gt: now },
  }).lean();
};

const ensureAuthScopeOpen = async ({ scope, keys }) => {
  const locked = await getLockedRecord(scope, keys);
  if (!locked) return null;

  const retryAfterMs = Math.max(0, Number(locked.lockUntil || 0) - Date.now());
  const error = new Error('Too many failed attempts. Please try again later.');
  error.statusCode = 429;
  error.code = 'AUTH_TEMP_LOCKED';
  error.retryAfterMs = retryAfterMs;
  throw error;
};

const updateFailureCounter = async ({ scope, key, metadata = null, ip = '' }) => {
  const now = Date.now();
  const config = getScopeConfig(scope);
  const existing = await AuthAttempt.findOne({ scope, key }).lean();

  const windowExpired =
    !existing || !existing.windowStartAt || now - Number(existing.windowStartAt) > config.windowMs;
  const failCount = windowExpired ? 1 : Number(existing.failCount || 0) + 1;
  const lockUntil = failCount >= config.maxAttempts ? now + config.lockMs : null;

  await AuthAttempt.findOneAndUpdate(
    { scope, key },
    {
      $set: {
        windowStartAt: windowExpired ? now : Number(existing.windowStartAt),
        failCount,
        lockUntil,
        lastFailureAt: now,
        lastIp: sanitizePlainText(ip, { maxLength: 120 }),
        metadata,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, new: true }
  );
};

const recordAuthFailure = async ({ scope, keys, metadata = null, ip = '' }) => {
  await Promise.all(
    keys.map((key) => updateFailureCounter({ scope, key, metadata, ip }))
  );
};

const recordAuthSuccess = async ({ scope, keys }) => {
  const now = Date.now();
  await AuthAttempt.updateMany(
    { scope, key: { $in: keys } },
    {
      $set: {
        failCount: 0,
        lockUntil: null,
        windowStartAt: now,
        lastSuccessAt: now,
        updatedAt: now,
      },
    }
  );
};

module.exports = {
  buildAttemptKeys,
  ensureAuthScopeOpen,
  recordAuthFailure,
  recordAuthSuccess,
};
