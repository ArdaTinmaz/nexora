const bcrypt = require('bcryptjs');
const validator = require('validator');
const AdminProfile = require('../models/AdminProfile');

const getEnvDefaults = () => ({
  name: 'Admin',
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  email: process.env.ADMIN_EMAIL || '',
  avatarURL: '',
});

const ensureDefaultProfile = async () => {
  const existing = await AdminProfile.findOne().lean();
  if (existing) {
    return existing;
  }

  const defaults = getEnvDefaults();
  const passwordHash = await bcrypt.hash(defaults.password, 10);
  const created = await AdminProfile.create({
    name: defaults.name,
    username: defaults.username,
    email: defaults.email,
    passwordHash,
    avatarURL: defaults.avatarURL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return created.toObject ? created.toObject() : created;
};

exports.getAdminProfile = async (_req, res, next) => {
  try {
    const profile = await ensureDefaultProfile();
    res.json({
      name: profile.name,
      username: profile.username,
      email: profile.email || '',
      avatarURL: profile.avatarURL || '',
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminProfile = async (req, res, next) => {
  try {
    const { name, username, password, avatarURL, email } = req.body || {};

    const updates = {};
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Name is required.' });
      }
      updates.name = trimmed;
    }

    if (typeof username === 'string') {
      const trimmed = username.trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Username is required.' });
      }
      updates.username = trimmed;
    }

    if (typeof avatarURL === 'string') {
      updates.avatarURL = avatarURL.trim();
    }

    if (typeof email === 'string') {
      const trimmed = email.trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Email is required' });
      }
      if (!validator.isEmail(trimmed)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
      updates.email = trimmed;
    }

    if (password) {
      if (!validator.isStrongPassword(password, { minNumbers: 1, minSymbols: 0 })) {
        return res.status(400).json({
          message:
            'Password must be at least 8 characters and include 1 number and 1 uppercase letter.',
        });
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No changes provided.' });
    }

    updates.updatedAt = Date.now();

    const updated = await AdminProfile.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      name: updated.name,
      username: updated.username,
      email: updated.email || '',
      avatarURL: updated.avatarURL || '',
    });
  } catch (error) {
    next(error);
  }
};
