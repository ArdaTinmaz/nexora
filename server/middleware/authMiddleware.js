const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET tanımlı değil');
      error.statusCode = 500;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const tokenSessionVersion = Number.isFinite(Number(decoded.sessionVersion))
      ? Number(decoded.sessionVersion)
      : 0;
    const currentSessionVersion = Number.isFinite(Number(user.sessionVersion))
      ? Number(user.sessionVersion)
      : 0;
    if (tokenSessionVersion !== currentSessionVersion) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    next(error);
  }
};

module.exports = authMiddleware;
