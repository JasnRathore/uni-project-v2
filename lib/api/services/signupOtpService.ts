/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { getDatabaseClient } = require('../../../database/services/dbService.ts');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type RequestResult =
  | { ok: true; otp: string; expiresAt: string }
  | { ok: false; status: number; error: string };

type ConsumeResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const normalizeEmail = (email: unknown): string => String(email || '').trim().toLowerCase();

const generateOtp = (): string => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const requestSignupOtp = async ({ email, role }: { email: unknown; role: string }): Promise<RequestResult> => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { ok: false, status: 400, error: 'A valid email address is required' };

  const db = getDatabaseClient();
  const recent = await db.execute({
    sql: `SELECT created_at FROM signup_otps
      WHERE email = ? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    args: [normalizedEmail],
  });
  if (recent.rows.length) {
    const createdAt = Date.parse(recent.rows[0].created_at);
    if (Number.isFinite(createdAt) && Date.now() - createdAt < OTP_RESEND_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_MS - (Date.now() - createdAt)) / 1000);
      return { ok: false, status: 429, error: `Please wait ${waitSeconds}s before requesting another code` };
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const createdAt = new Date().toISOString();

  // Only one pending code per email; a resend replaces the previous code.
  await db.execute({
    sql: 'DELETE FROM signup_otps WHERE email = ? AND consumed_at IS NULL',
    args: [normalizedEmail],
  });
  await db.execute({
    sql: `INSERT INTO signup_otps (id, email, role, otp_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), normalizedEmail, role, otpHash, expiresAt, createdAt],
  });

  return { ok: true, otp, expiresAt };
};

const consumeSignupOtp = async ({ email, otp, role }: { email: unknown; otp: unknown; role: string }): Promise<ConsumeResult> => {
  const normalizedEmail = normalizeEmail(email);
  const code = String(otp || '').trim();
  if (!normalizedEmail || !code) return { ok: false, status: 400, error: 'Email and verification code are required' };

  const db = getDatabaseClient();
  const result = await db.execute({
    sql: `SELECT id, role, otp_hash, attempts, expires_at FROM signup_otps
      WHERE email = ? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    args: [normalizedEmail],
  });
  if (!result.rows.length) return { ok: false, status: 400, error: 'Invalid or expired verification code' };

  const row = result.rows[0];
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await db.execute({ sql: 'DELETE FROM signup_otps WHERE id = ?', args: [row.id] });
    return { ok: false, status: 400, error: 'This verification code has expired. Request a new one.' };
  }
  if (Number(row.attempts) >= OTP_MAX_ATTEMPTS) {
    await db.execute({ sql: 'DELETE FROM signup_otps WHERE id = ?', args: [row.id] });
    return { ok: false, status: 429, error: 'Too many attempts. Request a new verification code.' };
  }

  const matches = row.role === role && await bcrypt.compare(code, row.otp_hash);
  if (!matches) {
    const attempts = Number(row.attempts) + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await db.execute({ sql: 'DELETE FROM signup_otps WHERE id = ?', args: [row.id] });
      return { ok: false, status: 429, error: 'Too many attempts. Request a new verification code.' };
    }
    await db.execute({ sql: 'UPDATE signup_otps SET attempts = ? WHERE id = ?', args: [attempts, row.id] });
    return { ok: false, status: 400, error: 'Incorrect verification code' };
  }

  await db.execute({
    sql: 'UPDATE signup_otps SET consumed_at = ? WHERE id = ?',
    args: [new Date().toISOString(), row.id],
  });
  return { ok: true };
};

const cancelSignupOtp = async (email: unknown): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  await getDatabaseClient().execute({
    sql: 'DELETE FROM signup_otps WHERE email = ? AND consumed_at IS NULL',
    args: [normalizedEmail],
  });
};

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_RESEND_MS,
  OTP_MAX_ATTEMPTS,
  generateOtp,
  requestSignupOtp,
  consumeSignupOtp,
  cancelSignupOtp,
};