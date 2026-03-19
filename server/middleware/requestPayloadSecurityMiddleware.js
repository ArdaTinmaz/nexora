const {
  ValidationError,
  validatePayloadShape,
  sanitizePayloadStrings,
} = require('../security/validation');

const requestPayloadSecurityMiddleware = (req, res, next) => {
  try {
    const hasJsonBody = req.body && typeof req.body === 'object';
    if (hasJsonBody) {
      validatePayloadShape(req.body, {
        maxDepth: 6,
        maxKeys: 300,
        maxArrayLength: 300,
      });
      req.body = sanitizePayloadStrings(req.body, {
        maxLength: 5000,
        maxLengthByKey: {
          avatarURL: 2_000_000,
        },
      });
    }
    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode || 400).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = requestPayloadSecurityMiddleware;
