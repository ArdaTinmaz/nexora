let SibApiV3Sdk;

const loadSdk = () => {
  if (SibApiV3Sdk) return SibApiV3Sdk;
  // eslint-disable-next-line global-require
  SibApiV3Sdk = require('sib-api-v3-sdk');
  return SibApiV3Sdk;
};

const buildPayload = ({ to, name, code }) => {
  const sdk = loadSdk();
  const senderName = process.env.BREVO_SENDER_NAME || 'Nexora';
  const sendSmtpEmail = new sdk.SendSmtpEmail();

  sendSmtpEmail.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: senderName,
  };

  sendSmtpEmail.to = [{ email: to, name: name || '' }];
  sendSmtpEmail.subject = 'Nexora - Email verification code';
  sendSmtpEmail.htmlContent = `
    <p>Merhaba ${name || 'Nexora kullanıcısı'},</p>
    <p>Email değişikliğini tamamlamak için doğrulama kodunuz: <strong>${code}</strong></p>
    <p>Kod 15 dakika boyunca geçerlidir.</p>
  `;
  sendSmtpEmail.textContent = `Doğrulama kodunuz: ${code}`;

  return sendSmtpEmail;
};

const sendEmailVerificationCode = async ({ to, name, code }) => {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    const error = new Error('E-posta gönderimi için BREVO_API_KEY veya BREVO_SENDER_EMAIL eksik');
    error.statusCode = 500;
    throw error;
  }

  const sdk = loadSdk();
  const defaultClient = sdk.ApiClient.instance;
  defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

  const apiInstance = new sdk.TransactionalEmailsApi();
  const payload = buildPayload({ to, name, code });

  await apiInstance.sendTransacEmail(payload);
};

module.exports = sendEmailVerificationCode;
