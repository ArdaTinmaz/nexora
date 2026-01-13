const jwt = require('jsonwebtoken');

const adminAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET tanımlı değil' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    req.admin = {
      username: decoded.username,
      isAdmin: true,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = adminAuthMiddleware;
