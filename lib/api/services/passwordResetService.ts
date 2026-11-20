/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Password reset tokens are short-lived JWTs that are bound to the user's current
// password hash. Changing the password (or reusing a link after a successful reset)
// produces a different hash, which invalidates any outstanding token.

const RESET_PURPOSE = 'password-reset';
const RESET_EXPIRES_IN = '1h';

const fingerprintPasswordHash = (passwordHash: string): string =>
  crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 32);

const createPasswordResetToken = ({ userId, passwordHash }: { userId: string; passwordHash: string }): string | null => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    { sub: userId, purpose: RESET_PURPOSE, fp: fingerprintPasswordHash(passwordHash) },
    secret,
    { expiresIn: RESET_EXPIRES_IN },
  );
};

type ResetTokenVerification =
  | { ok: true; userId: string; fingerprint: string }
  | { ok: false; error: string };

const verifyPasswordResetToken = (token: unknown): ResetTokenVerification => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, error: 'Password reset is not configured' };
  if (!token || typeof token !== 'string') return { ok: false, error: 'Invalid or expired reset link' };
  try {
    const decoded: any = jwt.verify(token, secret);
    if (decoded?.purpose !== RESET_PURPOSE || !decoded?.sub || !decoded?.fp) {
      return { ok: false, error: 'Invalid or expired reset link' };
    }
    return { ok: true, userId: String(decoded.sub), fingerprint: String(decoded.fp) };
  } catch {
    return { ok: false, error: 'Invalid or expired reset link' };
  }
};

module.exports = {
  RESET_PURPOSE,
  RESET_EXPIRES_IN,
  fingerprintPasswordHash,
  createPasswordResetToken,
  verifyPasswordResetToken,
};
