const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const normalizeAvatarUrl = require('../utils/normalizeAvatarUrl');
const { encryptText, decryptText } = require('../security/dataEncryption');

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'product_manager', 'scrum_master', 'team_leader', 'developer', 'designer'],
    default: 'developer',
  },
  avatarURL: { type: String, default: '' },
  theme: { type: String, enum: ['light', 'dark', 'violet'], default: 'light' },
  refreshTokenHash: { type: String, default: null },
  sessionVersion: { type: Number, default: 0 },
  passwordResetTokenHash: { type: String, default: null },
  passwordResetTokenExpiry: { type: Number, default: null },
  pendingEmail: { type: String, default: null },
  emailVerificationTokenHash: { type: String, default: null },
  emailVerificationTokenExpiry: { type: Number, default: null },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

const User = mongoose.model('User', userSchema);

const mapUserDoc = (doc) => {
  if (!doc) {
    return null;
  }

  const data = doc.toObject ? doc.toObject() : doc;

  return {
    id: data._id.toString(),
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role || 'developer',
    avatarURL: normalizeAvatarUrl(data.avatarURL),
    theme: data.theme || 'light',
    refreshTokenHash: data.refreshTokenHash,
    sessionVersion: Number.isFinite(Number(data.sessionVersion)) ? Number(data.sessionVersion) : 0,
    passwordResetTokenHash: data.passwordResetTokenHash,
    passwordResetTokenExpiry: data.passwordResetTokenExpiry,
    pendingEmail: data.pendingEmail ? decryptText(data.pendingEmail) : null,
    emailVerificationTokenHash: data.emailVerificationTokenHash,
    emailVerificationTokenExpiry: data.emailVerificationTokenExpiry,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const transformSensitiveUpdateFields = (updates = {}) => {
  const next = { ...updates };
  if (Object.prototype.hasOwnProperty.call(next, 'pendingEmail')) {
    next.pendingEmail = next.pendingEmail ? encryptText(String(next.pendingEmail)) : null;
  }
  return next;
};

const createUser = async ({ name, email, password, avatarURL = '', role = 'developer' }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    avatarURL: avatarURL || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return mapUserDoc(user);
};

const findUserById = async (id) => {
  if (!isValidObjectId(id)) {
    return null;
  }
  const user = await User.findById(id).lean();
  return mapUserDoc(user);
};

const findUserByEmail = async (email) => {
  const user = await User.findOne({ email }).lean();
  return mapUserDoc(user);
};

const findUserByResetToken = async (tokenHash) => {
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetTokenExpiry: { $gt: Date.now() },
  }).lean();
  return mapUserDoc(user);
};

const updateUser = async (id, updates) => {
  if (!isValidObjectId(id)) {
    return null;
  }

  const allowedFields = [
    'name',
    'email',
    'password',
    'role',
    'avatarURL',
    'theme',
    'refreshTokenHash',
    'sessionVersion',
    'passwordResetTokenHash',
    'passwordResetTokenExpiry',
    'pendingEmail',
    'emailVerificationTokenHash',
    'emailVerificationTokenExpiry',
  ];

  const nextUpdates = Object.fromEntries(
    Object.entries(updates || {}).filter(
      ([key, value]) => allowedFields.includes(key) && typeof value !== 'undefined'
    )
  );
  const transformedUpdates = transformSensitiveUpdateFields(nextUpdates);

  if (!Object.keys(transformedUpdates).length) {
    return findUserById(id);
  }

  transformedUpdates.updatedAt = Date.now();

  const user = await User.findByIdAndUpdate(id, transformedUpdates, {
    new: true,
    runValidators: true,
  }).lean();

  return mapUserDoc(user);
};

const updateRefreshToken = async (id, refreshTokenHash) => updateUser(id, { refreshTokenHash });

const clearRefreshToken = async (id) => updateUser(id, { refreshTokenHash: null });

const incrementSessionVersion = async (id) => {
  if (!isValidObjectId(id)) {
    return null;
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $inc: { sessionVersion: 1 }, $set: { updatedAt: Date.now() } },
    { new: true }
  ).lean();

  return mapUserDoc(user);
};

const invalidateUserSessions = async (id) => {
  const user = await incrementSessionVersion(id);
  if (!user) return null;
  return updateUser(id, { refreshTokenHash: null });
};

const setPasswordResetToken = async (id, tokenHash, expiry) =>
  updateUser(id, {
    passwordResetTokenHash: tokenHash,
    passwordResetTokenExpiry: expiry,
  });

const clearPasswordResetToken = async (id) =>
  updateUser(id, {
    passwordResetTokenHash: null,
    passwordResetTokenExpiry: null,
  });

const updatePassword = async (id, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return updateUser(id, {
    password: hashedPassword,
    passwordResetTokenHash: null,
    passwordResetTokenExpiry: null,
  });
};

const updateUserFields = async (id, updates) => updateUser(id, updates);

const setPendingEmail = async (id, { pendingEmail, tokenHash, expiry }) =>
  updateUser(id, {
    pendingEmail,
    emailVerificationTokenHash: tokenHash,
    emailVerificationTokenExpiry: expiry,
  });

const clearPendingEmail = async (id) =>
  updateUser(id, {
    pendingEmail: null,
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiry: null,
  });

const applyPendingEmail = async (id) => {
  const user = await findUserById(id);
  if (!user || !user.pendingEmail) return user;

  return updateUser(id, {
    email: user.pendingEmail,
    pendingEmail: null,
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiry: null,
  });
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  updateRefreshToken,
  clearRefreshToken,
  incrementSessionVersion,
  invalidateUserSessions,
  setPasswordResetToken,
  clearPasswordResetToken,
  updatePassword,
  updateUserFields,
  setPendingEmail,
  clearPendingEmail,
  applyPendingEmail,
  // Expose underlying mongoose model-style helpers for admin/screens that expect query chaining
  find: (...args) => User.find(...args),
  model: User,
};
