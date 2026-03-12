const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }

    if (!process.env.JWT_SECRET) {
      return next(new Error('JWT_SECRET tanımlı değil'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error('Unauthorized'));
    }

    const user = await User.findUserById(decoded.userId);
    if (!user) {
      return next(new Error('Unauthorized'));
    }

    socket.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarURL: user.avatarURL || '',
    };

    return next();
  } catch (err) {
    return next(new Error('Unauthorized'));
  }
};

module.exports = authenticateSocket;
