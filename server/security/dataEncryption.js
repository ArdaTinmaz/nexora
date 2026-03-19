const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'enc:v1';
const IV_BYTES = 12;

const toBufferFromHexOrBase64 = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;

  if (/^[0-9a-fA-F]{64}$/.test(input)) {
    return Buffer.from(input, 'hex');
  }

  try {
    const base64 = Buffer.from(input, 'base64');
    if (base64.length === 32) return base64;
  } catch (_err) {
    // no-op
  }

  return null;
};

const buildEncryptionKey = () => {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;

  const parsed = toBufferFromHexOrBase64(raw);
  if (parsed) return parsed;

  return crypto.createHash('sha256').update(String(raw)).digest();
};

const ENCRYPTION_KEY = buildEncryptionKey();

if (!ENCRYPTION_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SECURITY] DATA_ENCRYPTION_KEY is not set. Message at-rest encryption is currently disabled.'
  );
}

const isEncryptionEnabled = () => Boolean(ENCRYPTION_KEY);

const isEncryptedValue = (value) => String(value || '').startsWith(`${ENCRYPTION_PREFIX}:`);

const encryptText = (plainText) => {
  const input = String(plainText || '');
  if (!input) return '';
  if (!isEncryptionEnabled() || isEncryptedValue(input)) return input;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString(
    'base64'
  )}`;
};

const decryptText = (value) => {
  const input = String(value || '');
  if (!input) return '';
  if (!isEncryptedValue(input)) return input;
  if (!isEncryptionEnabled()) return '';

  const parts = input.split(':');
  if (parts.length !== 5) return '';

  try {
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const encrypted = Buffer.from(parts[4], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (_err) {
    return '';
  }
};

module.exports = {
  encryptText,
  decryptText,
  isEncryptionEnabled,
  isEncryptedValue,
  ENCRYPTION_PREFIX,
};
