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

const buildEmailPayload = ({ to, name, resetURL }) => {
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
    <p>To reset your password, click the link below:</p>
    <p><a href="${resetURL}" target="_blank">${resetURL}</a></p>
    <p>This link is valid for 1 hour. If you did not request this, please ignore this email.</p>
    <p>Nexora Team</p>
  `;
  sendSmtpEmail.textContent = `Hello ${name || 'Nexora user'}, to reset your password, use this link: ${resetURL}`;

  return sendSmtpEmail;
};

const sendPasswordResetEmail = async ({ to, name, resetURL }) => {
  const apiInstance = getTransactionalClient();
  const payload = buildEmailPayload({ to, name, resetURL });

  try {
    await apiInstance.sendTransacEmail(payload);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Brevo e-posta gönderim hatası:', error?.response?.text || error.message);
    throw error;
  }
};

module.exports = sendPasswordResetEmail;
