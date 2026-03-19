const mongoose = require('mongoose');

class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sanitizePlainText = (input, { trim = true, maxLength = 2000 } = {}) => {
  let text = String(input ?? '');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (trim) text = text.trim();
  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text;
};

const sanitizeDisplayText = (input, { maxLength = 128 } = {}) =>
  sanitizePlainText(input, { maxLength }).replace(/[<>]/g, '');

const requireString = (value, fieldName, { min = 1, max = 2000, trim = true } = {}) => {
  const normalized = sanitizePlainText(value, { trim, maxLength: max });
  if (normalized.length < min) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return normalized;
};

const optionalString = (value, { max = 2000, trim = true } = {}) => {
  if (value === null || typeof value === 'undefined') return '';
  return sanitizePlainText(value, { trim, maxLength: max });
};

const requireObjectId = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return normalized;
};

const requireEnum = (value, fieldName, allowedValues = []) => {
  const normalized = String(value || '').trim();
  if (!allowedValues.includes(normalized)) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return normalized;
};

const validatePayloadShape = (payload, { maxDepth = 6, maxKeys = 200, maxArrayLength = 200 } = {}) => {
  let keyCount = 0;

  const walk = (value, depth) => {
    if (depth > maxDepth) {
      throw new ValidationError('Payload nesting is too deep');
    }

    if (Array.isArray(value)) {
      if (value.length > maxArrayLength) {
        throw new ValidationError('Payload array is too large');
      }
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }

    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      keyCount += keys.length;
      if (keyCount > maxKeys) {
        throw new ValidationError('Payload has too many keys');
      }
      keys.forEach((key) => walk(value[key], depth + 1));
    }
  };

  walk(payload, 0);
};

const sanitizePayloadStrings = (value, { maxLength = 5000 } = {}) => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePayloadStrings(entry, { maxLength }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = sanitizePayloadStrings(entry, { maxLength });
      return acc;
    }, {});
  }

  if (typeof value === 'string') {
    return sanitizePlainText(value, { trim: false, maxLength });
  }

  return value;
};

module.exports = {
  ValidationError,
  sanitizePlainText,
  sanitizeDisplayText,
  requireString,
  optionalString,
  requireObjectId,
  requireEnum,
  validatePayloadShape,
  sanitizePayloadStrings,
};
