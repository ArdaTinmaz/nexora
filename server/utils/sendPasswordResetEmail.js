let transactionalClient;
let SibApiV3Sdk;

const loadSdk = () => {
  if (SibApiV3Sdk) return SibApiV3Sdk;

  try {
    // Lazily yükle, yalnızca gerçekten e-posta gönderileceği zaman ihtiyaç var
    // form-data eksik ise daha anlaşılır hata ver.
    // eslint-disable-next-line global-require
    SibApiV3Sdk = require('sib-api-v3-sdk');
    return SibApiV3Sdk;
  } catch (error) {
    const missingDep = new Error(
      'Şifre sıfırlama için gerekli paketler eksik (sib-api-v3-sdk / form-data). ' +
        'E-posta göndermek için `npm install sib-api-v3-sdk form-data` çalıştırın.'
    );
    missingDep.statusCode = 500;
    missingDep.originalError = error;
    throw missingDep;
  }
};

const ensureBrevoConfig = () => {
  if (!process.env.BREVO_API_KEY) {
    const error = new Error('BREVO_API_KEY tanımlı değil');
    error.statusCode = 500;
    throw error;
  }

  if (!process.env.BREVO_SENDER_EMAIL) {
    const error = new Error('BREVO_SENDER_EMAIL tanımlı değil');
    error.statusCode = 500;
    throw error;
  }
};

const getTransactionalClient = () => {
  if (transactionalClient) {
    return transactionalClient;
  }

  const sdk = loadSdk();
  ensureBrevoConfig();

  const defaultClient = sdk.ApiClient.instance;
  defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
  transactionalClient = new sdk.TransactionalEmailsApi();
  return transactionalClient;
};

const LINK_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isLinkTarget = (value) => LINK_SCHEME_RE.test(String(value || ''));

const buildHtmlSection = (label, value) => {
  if (!value) {
    return '';
  }

  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(value);

  if (isLinkTarget(value)) {
    return `<p>${safeLabel}: <a href="${safeValue}">${safeValue}</a></p>`;
  }

  return `<p>${safeLabel}: <strong>${safeValue}</strong></p>`;
};

const buildEmailPayload = ({ to, name, resetToken, resetURL, loginURL }) => {
  const sdk = loadSdk();
  const senderName = process.env.BREVO_SENDER_NAME || 'Nexora';
  const sendSmtpEmail = new sdk.SendSmtpEmail();

  sendSmtpEmail.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: senderName,
  };

  sendSmtpEmail.to = [{ email: to, name: name || '' }];
  sendSmtpEmail.subject = 'Nexora - Password reset instructions';
  sendSmtpEmail.htmlContent = `
    <p>Hello ${name || 'Nexora user'},</p>
    <p>Use this one-time reset token in the Nexora app:</p>
    <p><strong>${resetToken}</strong></p>
    ${buildHtmlSection('Reset link', resetURL)}
    ${buildHtmlSection('Login link', loginURL)}
    <p>This link is valid for 1 hour. If you did not request this, please ignore this email.</p>
    <p>Nexora Team</p>
  `;
  sendSmtpEmail.textContent =
    `Hello ${name || 'Nexora user'}, use this one-time reset token in the Nexora app: ${resetToken}. ` +
    (resetURL ? `Reset link: ${resetURL}. ` : '') +
    (loginURL ? `Login link: ${loginURL}.` : '');

  return sendSmtpEmail;
};

const sendPasswordResetEmail = async ({ to, name, resetToken, resetURL, loginURL }) => {
  const apiInstance = getTransactionalClient();
  const payload = buildEmailPayload({ to, name, resetToken, resetURL, loginURL });

  try {
    await apiInstance.sendTransacEmail(payload);
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const rawMessage =
      error?.response?.text ||
      error?.response?.body?.message ||
      error?.message ||
      'Şifre sıfırlama e-postası gönderilemedi';
    const normalized = String(rawMessage).toLowerCase();
    const wrappedError = new Error(
      normalized.includes('unauthorized')
        ? 'Email service authorization failed. Check BREVO_API_KEY and verify BREVO_SENDER_EMAIL in Brevo.'
        : rawMessage
    );
    wrappedError.statusCode = status && Number.isFinite(status) ? status : 500;
    // eslint-disable-next-line no-console
    console.error('Brevo e-posta gönderim hatası:', error?.response?.text || error.message);
    throw wrappedError;
  }
};

module.exports = sendPasswordResetEmail;
