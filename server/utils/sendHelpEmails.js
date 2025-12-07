let SibApiV3Sdk;

const loadSdk = () => {
  if (SibApiV3Sdk) return SibApiV3Sdk;
  // eslint-disable-next-line global-require
  SibApiV3Sdk = require('sib-api-v3-sdk');
  return SibApiV3Sdk;
};

const ensureConfig = () => {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    const error = new Error('Email sending requires BREVO_API_KEY and BREVO_SENDER_EMAIL');
    error.statusCode = 500;
    throw error;
  }
};

const buildSupportPayload = ({ fromEmail, message }) => {
  const sdk = loadSdk();
  const senderName = process.env.BREVO_SENDER_NAME || 'Nexora';
  const sendSmtpEmail = new sdk.SendSmtpEmail();

  sendSmtpEmail.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: senderName,
  };

  sendSmtpEmail.to = [{ email: process.env.BREVO_SENDER_EMAIL, name: senderName }];
  sendSmtpEmail.replyTo = { email: fromEmail };
  sendSmtpEmail.subject = 'Nexora - New help request';
  sendSmtpEmail.htmlContent = `
    <p>Yeni bir destek talebi alındı.</p>
    <p><strong>Gönderen:</strong> ${fromEmail}</p>
    <p><strong>Mesaj:</strong></p>
    <p>${message.replace(/\n/g, '<br/>')}</p>
  `;
  sendSmtpEmail.textContent = `From: ${fromEmail}\n\n${message}`;

  return sendSmtpEmail;
};

const buildAutoReplyPayload = ({ toEmail }) => {
  const sdk = loadSdk();
  const senderName = process.env.BREVO_SENDER_NAME || 'Nexora';
  const sendSmtpEmail = new sdk.SendSmtpEmail();

  sendSmtpEmail.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: senderName,
  };

  sendSmtpEmail.to = [{ email: toEmail }];
  sendSmtpEmail.subject = 'We received your request - Nexora Support';
  sendSmtpEmail.htmlContent = `
    <p>Hello,</p>
    <p>We received your help request and will get back to you soon.</p>
    <p>Thank you,<br/>Nexora Support Team</p>
  `;
  sendSmtpEmail.textContent = 'We received your help request and will get back to you soon. - Nexora Support Team';

  return sendSmtpEmail;
};

const sendHelpEmails = async ({ fromEmail, message }) => {
  ensureConfig();
  const sdk = loadSdk();
  const defaultClient = sdk.ApiClient.instance;
  defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

  const apiInstance = new sdk.TransactionalEmailsApi();
  const supportPayload = buildSupportPayload({ fromEmail, message });
  const autoReplyPayload = buildAutoReplyPayload({ toEmail: fromEmail });

  await apiInstance.sendTransacEmail(supportPayload);
  await apiInstance.sendTransacEmail(autoReplyPayload);
};

module.exports = sendHelpEmails;
