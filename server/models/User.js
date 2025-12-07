const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    avatarURL: row.avatarURL || '',
    theme: row.theme || 'light',
    refreshTokenHash: row.refreshTokenHash,
    passwordResetTokenHash: row.passwordResetTokenHash,
    passwordResetTokenExpiry: row.passwordResetTokenExpiry,
    pendingEmail: row.pendingEmail,
    emailVerificationTokenHash: row.emailVerificationTokenHash,
    emailVerificationTokenExpiry: row.emailVerificationTokenExpiry,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const insertUser = (db, { name, email, password }) => {
  const timestamps = Date.now();
  const statement = db.prepare(`
    INSERT INTO users (name, email, password, createdAt, updatedAt)
    VALUES (@name, @email, @password, @createdAt, @updatedAt)
  `);

  const result = statement.run({
    name,
    email,
    password,
    createdAt: timestamps,
    updatedAt: timestamps,
  });

  return result.lastInsertRowid;
};

const updateUser = (db, id, updates) => {
  const allowedFields = [
    'name',
    'email',
    'password',
    'avatarURL',
    'theme',
    'refreshTokenHash',
    'passwordResetTokenHash',
    'passwordResetTokenExpiry',
    'pendingEmail',
    'emailVerificationTokenHash',
    'emailVerificationTokenExpiry',
  ];

  const entries = Object.entries(updates).filter(
    ([key, value]) => allowedFields.includes(key) && typeof value !== 'undefined'
  );

  if (!entries.length) {
    return;
  }

  const assignments = entries.map(([key]) => `${key} = @${key}`).join(', ');
  const statement = db.prepare(`
    UPDATE users
    SET ${assignments}, updatedAt = @updatedAt
    WHERE id = @id
  `);

  statement.run({
    ...Object.fromEntries(entries),
    id,
    updatedAt: Date.now(),
  });
};

const findUserById = async (id) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return mapUserRow(row);
};

const findUserByEmail = async (email) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  return mapUserRow(row);
};

const findUserByResetToken = async (tokenHash) => {
  const db = getDB();
  const row = db
    .prepare(
      `
      SELECT *
      FROM users
      WHERE passwordResetTokenHash = @tokenHash
        AND passwordResetTokenExpiry IS NOT NULL
        AND passwordResetTokenExpiry > @now
    `
    )
    .get({
      tokenHash,
      now: Date.now(),
    });

  return mapUserRow(row);
};

const createUser = async ({ name, email, password }) => {
  const db = getDB();
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = insertUser(db, {
    name,
    email,
    password: hashedPassword,
  });

  return findUserById(userId);
};

const updateRefreshToken = async (id, refreshTokenHash) => {
  const db = getDB();
  updateUser(db, id, { refreshTokenHash });
  return findUserById(id);
};

const clearRefreshToken = async (id) => {
  const db = getDB();
  updateUser(db, id, { refreshTokenHash: null });
  return findUserById(id);
};

const setPasswordResetToken = async (id, tokenHash, expiry) => {
  const db = getDB();
  updateUser(db, id, {
    passwordResetTokenHash: tokenHash,
    passwordResetTokenExpiry: expiry,
  });
  return findUserById(id);
};

const clearPasswordResetToken = async (id) => {
  const db = getDB();
  updateUser(db, id, {
    passwordResetTokenHash: null,
    passwordResetTokenExpiry: null,
  });
  return findUserById(id);
};

const updatePassword = async (id, password) => {
  const db = getDB();
  const hashedPassword = await bcrypt.hash(password, 10);
  updateUser(db, id, {
    password: hashedPassword,
    passwordResetTokenHash: null,
    passwordResetTokenExpiry: null,
  });
  return findUserById(id);
};

const updateUserFields = async (id, updates) => {
  const db = getDB();
  updateUser(db, id, updates);
  return findUserById(id);
};

const setPendingEmail = async (id, { pendingEmail, tokenHash, expiry }) => {
  const db = getDB();
  updateUser(db, id, {
    pendingEmail,
    emailVerificationTokenHash: tokenHash,
    emailVerificationTokenExpiry: expiry,
  });
  return findUserById(id);
};

const clearPendingEmail = async (id) => {
  const db = getDB();
  updateUser(db, id, {
    pendingEmail: null,
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiry: null,
  });
  return findUserById(id);
};

const applyPendingEmail = async (id) => {
  const db = getDB();
  const user = await findUserById(id);
  if (!user || !user.pendingEmail) return user;

  updateUser(db, id, {
    email: user.pendingEmail,
    pendingEmail: null,
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiry: null,
  });
  return findUserById(id);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  updateRefreshToken,
  clearRefreshToken,
  setPasswordResetToken,
  clearPasswordResetToken,
  updatePassword,
  updateUserFields,
  setPendingEmail,
  clearPendingEmail,
  applyPendingEmail,
};
