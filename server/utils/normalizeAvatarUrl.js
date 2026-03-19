const path = require('path');

const ABSOLUTE_PROTOCOL_RE = /^(?:https?:|data:|blob:|file:)/i;
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:\//i;

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

  const normalized = trimmed.replace(/\\/g, '/');
  const normalizedLower = normalized.toLowerCase();

  const uploadsSegmentIndex = normalizedLower.indexOf('/uploads/');
  if (uploadsSegmentIndex >= 0) {
    return normalized.slice(uploadsSegmentIndex);
  }

  if (WINDOWS_ABSOLUTE_PATH_RE.test(normalized)) {
    const fileName = path.win32.basename(trimmed);
    return fileName ? `/uploads/${fileName}` : '';
  }

  if (normalized.startsWith('/uploads/')) {
    return normalized;
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('/')) {
    return normalized;
  }

  if (!normalized.includes('/')) {
    return `/uploads/${normalized}`;
  }

  return `/${normalized.replace(/^\/+/, '')}`;
};

module.exports = normalizeAvatarUrl;
