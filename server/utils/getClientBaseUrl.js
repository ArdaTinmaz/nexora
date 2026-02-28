const DEFAULT_WEB_URL = 'http://localhost:3000';
const DEFAULT_DESKTOP_URL = 'nexora://app';

const firstConfiguredUrl = (value) => {
  if (!value) {
    return null;
  }

  const [firstURL] = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return firstURL || null;
};

const getClientBaseUrl = () =>
  firstConfiguredUrl(process.env.DESKTOP_PROTOCOL_URL) ||
  firstConfiguredUrl(process.env.CLIENT_URL) ||
  DEFAULT_WEB_URL;

const getDesktopBaseUrl = () =>
  firstConfiguredUrl(process.env.DESKTOP_PROTOCOL_URL) || DEFAULT_DESKTOP_URL;

module.exports = {
  getClientBaseUrl,
  getDesktopBaseUrl,
};
