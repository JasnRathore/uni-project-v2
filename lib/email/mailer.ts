/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

// Transactional email helper. The transport is created lazily on first use so the
// application (and the test harness) can load this module without mail credentials.
// Every helper logs and returns `false` on failure; none of them ever throw.

type SendResult = boolean;

type MailOptions = {
  to?: string;
  subject: string;
  text: string;
  html: string;
};

const resolveAppUrl = (): string => {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const trimmed = configured && configured.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : 'http://localhost:3000';
};

const isConfigured = (): boolean => Boolean(process.env.MAIL && process.env.MAIL_PASSWORD);

let transport: any = null;

const getTransport = (): any => {
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }
  return transport;
};

const resolveFromAddress = (): string => {
  const override = process.env.MAIL_FROM && process.env.MAIL_FROM.trim();
  return override || `Dental College Portal <${process.env.MAIL}>`;
};

const send = async (options: MailOptions): Promise<SendResult> => {
  if (!isConfigured()) {
    console.error('[email] MAIL and MAIL_PASSWORD are not configured; skipping email send');
    return false;
  }
  if (!options.to) {
    console.error('[email] Cannot send email without a recipient address');
    return false;
  }
  try {
    await getTransport().sendMail({
      from: resolveFromAddress(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    return false;
  }
};

const greetingName = (name?: string): string => (name && name.trim() ? name.trim() : 'there');

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sendWelcomeEmail = async ({ to, name, role }: { to?: string; name?: string; role?: string }): Promise<SendResult> => {
  const portal = role === 'student' ? 'Student Portal' : 'Faculty Portal';
  const appUrl = resolveAppUrl();
  const greeting = escapeHtml(greetingName(name));
  return send({
    to,
    subject: 'Welcome to the Dental College Portal',
    text: `Hi ${greetingName(name)},\n\nYour ${portal} account has been created. Sign in at ${appUrl}.\n\nDental College Portal`,
    html: `<p>Hi ${greeting},</p><p>Your <strong>${portal}</strong> account has been created. You can sign in at <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a>.</p><p>Dental College Portal</p>`,
  });
};

const sendSignInNotice = async ({ to, name }: { to?: string; name?: string }): Promise<SendResult> => {
  const sentAt = new Date().toUTCString();
  const greeting = escapeHtml(greetingName(name));
  return send({
    to,
    subject: 'New sign-in to your Dental College Portal account',
    text: `Hi ${greetingName(name)},\n\nYour account was just used to sign in at ${sentAt} UTC.\n\nIf this was not you, please reset your password.\n\nDental College Portal`,
    html: `<p>Hi ${greeting},</p><p>Your account was just used to sign in at <strong>${escapeHtml(sentAt)} UTC</strong>.</p><p>If this was not you, please reset your password.</p><p>Dental College Portal</p>`,
  });
};

const sendPasswordResetEmail = async ({ to, name, token }: { to?: string; name?: string; token: string }): Promise<SendResult> => {
  const resetUrl = `${resolveAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const greeting = escapeHtml(greetingName(name));
  return send({
    to,
    subject: 'Reset your Dental College Portal password',
    text: `Hi ${greetingName(name)},\n\nUse the link below to choose a new password. It expires in about 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\nDental College Portal`,
    html: `<p>Hi ${greeting},</p><p>Use the link below to choose a new password. It expires in about 1 hour.</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p><p>Dental College Portal</p>`,
  });
};

const sendSignupOtpEmail = async ({ to, name, otp, expiresInMinutes = 10 }: { to?: string; name?: string; otp: string; expiresInMinutes?: number }): Promise<SendResult> => {
  const greeting = escapeHtml(greetingName(name));
  const safeOtp = escapeHtml(otp);
  return send({
    to,
    subject: 'Your Dental College Portal verification code',
    text: `Hi ${greetingName(name)},\n\nYour signup verification code is ${otp}. It expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, you can ignore this email.\n\nDental College Portal`,
    html: `<p>Hi ${greeting},</p><p>Your signup verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${safeOtp}</p><p>This code expires in ${expiresInMinutes} minutes.</p><p>If you did not request this, you can ignore this email.</p><p>Dental College Portal</p>`,
  });
};

module.exports = {
  resolveAppUrl,
  sendWelcomeEmail,
  sendSignInNotice,
  sendPasswordResetEmail,
  sendSignupOtpEmail,
};
