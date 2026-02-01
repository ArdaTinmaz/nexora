const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const AdminProfile = require('../models/AdminProfile');
const sendAdminVerificationCode = require('../utils/sendAdminVerificationCode');

const getAdminCredentials = () => ({
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  email: process.env.ADMIN_EMAIL || '',
});

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  const creds = getAdminCredentials();

  if (!username || !password) {
    return res.status(400).json({ message: 'Username/email and password are required.' });
  }

  const storedProfile = await AdminProfile.findOne().lean();
  if (storedProfile) {
    const passwordOk = storedProfile.passwordHash
      ? await bcrypt.compare(password, storedProfile.passwordHash)
      : false;
    const identifier = String(username || '').trim().toLowerCase();
    const matchesUsername = storedProfile.username?.toLowerCase() === identifier;
    const matchesEmail = storedProfile.email?.toLowerCase() === identifier;
    if ((!matchesUsername && !matchesEmail) || !passwordOk) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
  } else {
    const identifier = String(username || '').trim().toLowerCase();
    const matchesUsername = creds.username.toLowerCase() === identifier;
    const matchesEmail = creds.email?.toLowerCase() === identifier;
    if ((!matchesUsername && !matchesEmail) || password !== creds.password) {
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

  const token = jwt.sign({ username, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

  return res.json({ token, username });
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
    const creds = getAdminCredentials();
    const expectedEmail = storedProfile?.email || creds.email;
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

    const defaults = getAdminCredentials();
    const passwordHash = await bcrypt.hash(defaults.password, 10);
    const setUpdates = {
      resetCodeHash: codeHash,
      resetCodeExpiry: expiry,
      updatedAt: Date.now(),
    };
    if (storedProfile && !storedProfile.email && expectedEmail) {
      setUpdates.email = expectedEmail;
    }

    await AdminProfile.findOneAndUpdate(
      {},
      {
        $set: setUpdates,
        $setOnInsert: {
          name: 'Admin',
          username: defaults.username,
          email: expectedEmail,
          passwordHash,
          avatarURL: '',
          createdAt: Date.now(),
        },
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
