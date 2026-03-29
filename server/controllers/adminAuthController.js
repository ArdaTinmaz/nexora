const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const AdminProfile = require('../models/AdminProfile');
const sendAdminVerificationCode = require('../utils/sendAdminVerificationCode');
const { requireString } = require('../security/validation');
const { extractClientIpFromRequest, getUserAgentFromRequest } = require('../security/requestMeta');
const {
  buildAttemptKeys,
  ensureAuthScopeOpen,
  recordAuthFailure,
  recordAuthSuccess,
} = require('../services/authSecurityService');
const { logSecurityEvent } = require('../services/auditLogService');
const { setAdminAuthCookie, clearAdminAuthCookie } = require('../security/authCookies');

const getAdminCredentials = () => ({
  username: String(process.env.ADMIN_USERNAME || '').trim(),
  password: String(process.env.ADMIN_PASSWORD || ''),
  email: String(process.env.ADMIN_EMAIL || '').trim(),
});

const ensureBootstrapCredentials = () => {
  const creds = getAdminCredentials();
  if (!creds.username || !creds.password) {
    const error = new Error(
      'Admin bootstrap credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.'
    );
    error.statusCode = 500;
    throw error;
  }
  return creds;
};

exports.login = async (req, res) => {
  const username = requireString(req.body?.username, 'Username/email', { max: 180 });
  const password = requireString(req.body?.password, 'Password', { max: 256, trim: false });
  const ip = extractClientIpFromRequest(req);
  const userAgent = getUserAgentFromRequest(req);
  const normalizedIdentifier = String(username || '').trim().toLowerCase();
  const attemptKeys = buildAttemptKeys({ identifier: normalizedIdentifier, ip });

  try {
    await ensureAuthScopeOpen({
      scope: 'admin_login',
      keys: attemptKeys,
    });
  } catch (error) {
    if (error?.code === 'AUTH_TEMP_LOCKED') {
      const retryAfterSeconds = Math.max(1, Math.ceil(Number(error.retryAfterMs || 0) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
    }
    await logSecurityEvent({
      eventType: 'auth.admin_login_blocked',
      severity: 'high',
      outcome: 'blocked',
      actorType: 'admin',
      actorId: normalizedIdentifier,
      ip,
      userAgent,
      resource: '/api/admin/login',
      message: 'Admin login blocked due to temporary lock',
    });
    return res.status(error.statusCode || 429).json({ message: error.message });
  }

  const storedProfile = await AdminProfile.findOne().lean();
  if (storedProfile) {
    const passwordOk = storedProfile.passwordHash
      ? await bcrypt.compare(password, storedProfile.passwordHash)
      : false;
    const matchesUsername = storedProfile.username?.toLowerCase() === normalizedIdentifier;
    const matchesEmail = storedProfile.email?.toLowerCase() === normalizedIdentifier;
    if ((!matchesUsername && !matchesEmail) || !passwordOk) {
      await recordAuthFailure({ scope: 'admin_login', keys: attemptKeys, ip });
      await logSecurityEvent({
        eventType: 'auth.admin_login_failed',
        severity: 'high',
        outcome: 'failure',
        actorType: 'admin',
        actorId: normalizedIdentifier,
        ip,
        userAgent,
        resource: '/api/admin/login',
        message: 'Admin login failed: invalid credentials',
      });
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
  } else {
    const creds = ensureBootstrapCredentials();
    const matchesUsername = creds.username.toLowerCase() === normalizedIdentifier;
    const matchesEmail = creds.email?.toLowerCase() === normalizedIdentifier;
    if ((!matchesUsername && !matchesEmail) || password !== creds.password) {
      await recordAuthFailure({ scope: 'admin_login', keys: attemptKeys, ip });
      await logSecurityEvent({
        eventType: 'auth.admin_login_failed',
        severity: 'high',
        outcome: 'failure',
        actorType: 'admin',
        actorId: normalizedIdentifier,
        ip,
        userAgent,
        resource: '/api/admin/login',
        message: 'Admin login failed: invalid credentials',
      });
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    const passwordHash = await bcrypt.hash(creds.password, 10);
    await AdminProfile.create({
      name: 'Admin',
      username: creds.username,
      email: creds.email || '',
      passwordHash,
      avatarURL: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET is missing.' });
  }

  await recordAuthSuccess({ scope: 'admin_login', keys: attemptKeys });
  await logSecurityEvent({
    eventType: 'auth.admin_login_success',
    severity: 'low',
    outcome: 'success',
    actorType: 'admin',
    actorId: normalizedIdentifier,
    ip,
    userAgent,
    resource: '/api/admin/login',
    message: 'Admin login successful',
  });

  const token = jwt.sign({ username: normalizedIdentifier, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '2h',
  });
  setAdminAuthCookie(req, res, token);

  return res.json({ token, username: normalizedIdentifier });
};

const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const storedProfile = await AdminProfile.findOne().lean();
    const bootstrapCreds = storedProfile ? null : ensureBootstrapCredentials();
    const expectedEmail = storedProfile?.email || bootstrapCreds?.email;
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!expectedEmail) {
      return res.status(400).json({ message: 'Admin email is not configured.' });
    }

    if (expectedEmail.toLowerCase() !== normalizedEmail) {
      return res.status(200).json({
        message: 'If the account exists, a verification code was sent.',
      });
    }

    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiry = Date.now() + 15 * 60 * 1000;

    const setUpdates = {
      resetCodeHash: codeHash,
      resetCodeExpiry: expiry,
      updatedAt: Date.now(),
    };
    if (storedProfile && !storedProfile.email && expectedEmail) {
      setUpdates.email = expectedEmail;
    }

    const setOnInsert = {};
    if (bootstrapCreds) {
      const passwordHash = await bcrypt.hash(bootstrapCreds.password, 10);
      setOnInsert.name = 'Admin';
      setOnInsert.username = bootstrapCreds.username;
      setOnInsert.email = expectedEmail;
      setOnInsert.passwordHash = passwordHash;
      setOnInsert.avatarURL = '';
      setOnInsert.createdAt = Date.now();
    }

    await AdminProfile.findOneAndUpdate(
      {},
      {
        $set: setUpdates,
        $setOnInsert: setOnInsert,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await sendAdminVerificationCode({
      to: expectedEmail,
      name: storedProfile?.name || 'Admin',
      code,
    });

    return res.status(200).json({
      message: 'If the account exists, a verification code was sent.',
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    clearAdminAuthCookie(req, res);
    return res.status(200).json({ message: 'Admin logout successful.' });
  } catch (error) {
    next(error);
  }
};

exports.verifyPasswordReset = async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const profile = await AdminProfile.findOne().lean();
    if (!profile?.email || profile.email.toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (!profile.resetCodeHash || !profile.resetCodeExpiry) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (profile.resetCodeExpiry < Date.now()) {
      return res.status(400).json({ message: 'Verification code expired.' });
    }

    const codeHash = hashCode(String(code).trim());
    if (codeHash !== profile.resetCodeHash) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    return res.json({ verified: true });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body || {};
    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Email, code, and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!validator.isStrongPassword(password, { minNumbers: 1, minSymbols: 0 })) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include 1 number and 1 uppercase letter.',
      });
    }

    const profile = await AdminProfile.findOne().lean();
    if (!profile?.email || profile.email.toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (!profile.resetCodeHash || !profile.resetCodeExpiry) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (profile.resetCodeExpiry < Date.now()) {
      return res.status(400).json({ message: 'Verification code expired.' });
    }

    const codeHash = hashCode(String(code).trim());
    if (codeHash !== profile.resetCodeHash) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await AdminProfile.updateOne(
      {},
      {
        $set: {
          passwordHash,
          resetCodeHash: null,
          resetCodeExpiry: null,
          updatedAt: Date.now(),
        },
      }
    );

    return res.json({ message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
};
