const DEFAULT_ACCESS_COOKIE_NAME = 'nexora_at';
const DEFAULT_REFRESH_COOKIE_NAME = 'nexora_rt';
const DEFAULT_ADMIN_ACCESS_COOKIE_NAME = 'nexora_admin_at';

const DEFAULT_ACCESS_MAX_AGE_MS = 20 * 60 * 1000;
const DEFAULT_REFRESH_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_ACCESS_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const COOKIE_NAMES = {
  access: process.env.AUTH_ACCESS_COOKIE_NAME || DEFAULT_ACCESS_COOKIE_NAME,
  refresh: process.env.AUTH_REFRESH_COOKIE_NAME || DEFAULT_REFRESH_COOKIE_NAME,
  adminAccess: process.env.ADMIN_ACCESS_COOKIE_NAME || DEFAULT_ADMIN_ACCESS_COOKIE_NAME,
};

const COOKIE_MAX_AGE = {
  access: Number(process.env.AUTH_ACCESS_COOKIE_MAX_AGE_MS) || DEFAULT_ACCESS_MAX_AGE_MS,
  refresh: Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE_MS) || DEFAULT_REFRESH_MAX_AGE_MS,
  adminAccess: Number(process.env.ADMIN_ACCESS_COOKIE_MAX_AGE_MS) || DEFAULT_ADMIN_ACCESS_MAX_AGE_MS,
};

const parseSameSite = () => {
  const raw = String(process.env.AUTH_COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
  if (raw === 'strict') return 'strict';
  if (raw === 'none') return 'none';
  return 'lax';
};

const readBooleanEnv = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

const parseCookieHeader = (headerValue = '') =>
  String(headerValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return acc;
      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      if (key) acc[key] = value;
      return acc;
    }, {});

const getCookieFromRequest = (req, name) => {
  const cookies = parseCookieHeader(req?.headers?.cookie || '');
  return cookies[name] || '';
};

const getCookieFromSocket = (socket, name) => {
  const cookies = parseCookieHeader(socket?.handshake?.headers?.cookie || '');
  return cookies[name] || '';
};

const resolveSecureFlag = (req) => {
  const forcedSecure = readBooleanEnv(process.env.AUTH_COOKIE_SECURE);
  if (forcedSecure !== null) return forcedSecure;

  if (process.env.NODE_ENV === 'production') return true;

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  return Boolean(req?.secure || forwardedProto === 'https');
};

const buildCookieOptions = (req, maxAge) => {
  const sameSite = parseSameSite();
  const secure = sameSite === 'none' ? true : resolveSecureFlag(req);
  const options = {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
  };

  if (Number.isFinite(Number(maxAge)) && Number(maxAge) > 0) {
    options.maxAge = Number(maxAge);
  }

  const domain = String(process.env.AUTH_COOKIE_DOMAIN || '').trim();
  if (domain) {
    options.domain = domain;
  }

  return options;
};

const setUserAuthCookies = (req, res, { accessToken = '', refreshToken = '' } = {}) => {
  if (accessToken) {
    res.cookie(COOKIE_NAMES.access, accessToken, buildCookieOptions(req, COOKIE_MAX_AGE.access));
  }
  if (refreshToken) {
    res.cookie(COOKIE_NAMES.refresh, refreshToken, buildCookieOptions(req, COOKIE_MAX_AGE.refresh));
  }
};

const clearUserAuthCookies = (req, res) => {
  res.clearCookie(COOKIE_NAMES.access, buildCookieOptions(req));
  res.clearCookie(COOKIE_NAMES.refresh, buildCookieOptions(req));
};

const setAdminAuthCookie = (req, res, token = '') => {
  if (!token) return;
  res.cookie(COOKIE_NAMES.adminAccess, token, buildCookieOptions(req, COOKIE_MAX_AGE.adminAccess));
};

const clearAdminAuthCookie = (req, res) => {
  res.clearCookie(COOKIE_NAMES.adminAccess, buildCookieOptions(req));
};

module.exports = {
  COOKIE_NAMES,
  parseCookieHeader,
  getCookieFromRequest,
  getCookieFromSocket,
  setUserAuthCookies,
  clearUserAuthCookies,
  setAdminAuthCookie,
  clearAdminAuthCookie,
};
