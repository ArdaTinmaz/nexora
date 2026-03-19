const jwt = require('jsonwebtoken');

const generateToken = (userId, sessionVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET tanımlı değil');
  }

  return jwt.sign({ userId, sessionVersion: Number(sessionVersion) || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '20m',
  });
};

module.exports = generateToken;
