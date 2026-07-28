const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../config/logger');

let transporter = null;

const getBrevoApiKey = () => {
  const explicit = process.env.BREVO_API_KEY?.trim();
  if (explicit) return explicit;

  const smtpKey = config.mail.password?.trim();
  if (smtpKey?.startsWith('xkeysib-')) return smtpKey;

  return '';
};

const isSmtpConfigured = () => {
  const password = config.mail.password?.trim();
  return Boolean(config.mail.user && password && !password.startsWith('xkeysib-'));
};

const isMailConfigured = () => Boolean(isSmtpConfigured() || getBrevoApiKey());

const getTransporter = () => {
  if (!isSmtpConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: Number(config.mail.port) === 465,
    auth: {
      user: config.mail.user,
      pass: config.mail.password,
    },
  });

  return transporter;
};

const sendViaBrevoApi = async ({ to, subject, text, html }) => {
  const apiKey = getBrevoApiKey();
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: config.mail.fromName, email: config.mail.from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${body}`);
  }

  const result = await response.json();
  return { simulated: false, messageId: result.messageId || null, provider: 'brevo-api' };
};

const sendViaSmtp = async (payload) => {
  const tx = getTransporter();
  const info = await tx.sendMail(payload);
  return { simulated: false, messageId: info.messageId, provider: 'smtp' };
};

/**
 * Send email via Brevo API (xkeysib-*) or SMTP (xsmtpsib-*); otherwise log in simulator mode.
 */
const sendMail = async ({ to, subject, text, html }) => {
  const payload = {
    from: `"${config.mail.fromName}" <${config.mail.from}>`,
    to,
    subject,
    text,
    html,
  };

  if (!isMailConfigured()) {
    logger.info('Mail simulator mode — email not sent (missing Brevo credentials)', {
      to,
      subject,
      text,
    });
    return { simulated: true, messageId: null };
  }

  try {
    if (getBrevoApiKey()) {
      const result = await sendViaBrevoApi({ to, subject, text, html });
      logger.info('Email sent via Brevo API', { to, subject, messageId: result.messageId });
      return result;
    }

    const result = await sendViaSmtp(payload);
    logger.info('Email sent via SMTP', { to, subject, messageId: result.messageId });
    return result;
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error: error.message });
    throw error;
  }
};

const sendPasswordResetOtp = async ({ to, otp, expiresMinutes }) => {
  const subject = `${config.server.appName} password reset OTP`;
  const text = `Your password reset OTP is ${otp}. It expires in ${expiresMinutes} minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin-bottom: 8px;">Password reset</h2>
      <p>Use this one-time password to reset your ${config.server.appName} account password:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${otp}</p>
      <p>This OTP expires in <strong>${expiresMinutes} minutes</strong>.</p>
      <p style="color: #666;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
};

module.exports = {
  isMailConfigured,
  sendMail,
  sendPasswordResetOtp,
};
