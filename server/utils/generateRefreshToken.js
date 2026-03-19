const jwt = require('jsonwebtoken');

const generateRefreshToken = (userId, sessionVersion = 0) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET tanımlı değil');
  }

  return jwt.sign(
    { userId, sessionVersion: Number(sessionVersion) || 0 },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '14d',
    }
  );
};

const getRefreshTokenFingerprint = (refreshToken) => {
  const raw = String(refreshToken || '').trim();
  if (!raw) return '';
  return raw.slice(0, 12);
};

module.exports = generateRefreshToken;
module.exports.getRefreshTokenFingerprint = getRefreshTokenFingerprint;
