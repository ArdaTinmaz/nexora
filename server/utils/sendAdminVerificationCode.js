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
  sendSmtpEmail.subject = 'Nexora Admin - Verification code';
  sendSmtpEmail.htmlContent = `
    <p>Hello ${name || 'Admin'},</p>
    <p>Your verification code is: <strong>${code}</strong></p>
    <p>This code is valid for 15 minutes.</p>
    <p>Nexora Team</p>
  `;
  sendSmtpEmail.textContent = `Your verification code is: ${code}. This code is valid for 15 minutes.`;

  return sendSmtpEmail;
};

const sendAdminVerificationCode = async ({ to, name, code }) => {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    const error = new Error('BREVO_API_KEY or BREVO_SENDER_EMAIL is missing');
    error.statusCode = 500;
    throw error;
  }

  const sdk = loadSdk();
  const defaultClient = sdk.ApiClient.instance;
  defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

  const apiInstance = new sdk.TransactionalEmailsApi();
  const payload = buildPayload({ to, name, code });

  try {
    await apiInstance.sendTransacEmail(payload);
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const rawMessage =
      error?.response?.text ||
      error?.response?.body?.message ||
      error?.message ||
      'Failed to send verification email.';
    const normalized = String(rawMessage).toLowerCase();
    const err = new Error(
      normalized.includes('unauthorized')
        ? 'Email service authorization failed. Check BREVO_API_KEY and sender email.'
        : rawMessage
    );
    err.statusCode = status && Number.isFinite(status) ? status : 500;
    throw err;
  }
};

module.exports = sendAdminVerificationCode;
