const ABSOLUTE_PROTOCOL_RE = /^(?:https?:|data:|blob:|file:)/i;

const normalizeAvatarUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (ABSOLUTE_PROTOCOL_RE.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (!trimmed.includes('/')) {
    return `/uploads/${trimmed}`;
  }

  return `/${trimmed.replace(/^\/+/, '')}`;
};

module.exports = normalizeAvatarUrl;
