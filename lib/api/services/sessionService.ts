/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const crypto = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const { getDatabaseClient } = require('../../../database/services/dbService.ts');

// Short-lived access tokens are held in memory by the browser client. The
// durable credential is the rotating refresh token, which lives in an
// HttpOnly cookie and is stored server-side only as a SHA-256 hash.
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_TOKEN_BYTES = 48;

const generateRefreshToken = (): string => crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

const hashRefreshToken = (token: unknown): string =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const isoFromNow = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

const isExpired = (value: unknown): boolean => {
  if (!value) return true;
  const time = new Date(String(value)).getTime();
  return !Number.isFinite(time) || time <= Date.now();
};

// Creates a brand-new session and returns the plaintext refresh token, which
// is the only time it exists outside the client's cookie.
const createSession = async ({
  userId,
  userAgent,
  ipAddress,
  familyId,
}: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  familyId?: string;
}): Promise<{ sessionId: string; refreshToken: string; familyId: string; expiresAt: string }> => {
  const sessionId = uuidv4();
  const refreshToken = generateRefreshToken();
  const family = familyId || uuidv4();
  const expiresAt = isoFromNow(REFRESH_TOKEN_TTL_SECONDS);
  await getDatabaseClient().execute({
    sql: `INSERT INTO auth_sessions
        (id, user_id, refresh_token_hash, family_id, user_agent, ip_address, expires_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      sessionId,
      userId,
      hashRefreshToken(refreshToken),
      family,
      userAgent || null,
      ipAddress || null,
      expiresAt,
    ],
  });
  return { sessionId, refreshToken, familyId: family, expiresAt };
};

const findSessionByToken = async (refreshToken: unknown): Promise<any> => {
  if (!refreshToken) return null;
  const result = await getDatabaseClient().execute({
    sql: `SELECT id, user_id, family_id, expires_at, revoked_at
      FROM auth_sessions WHERE refresh_token_hash = ?`,
    args: [hashRefreshToken(refreshToken)],
  });
  return result.rows[0] || null;
};

const touchSession = async (sessionId: string): Promise<void> => {
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [sessionId],
  });
};

// Returns null when the session id is unknown (legacy token without `sid`);
// callers treat `false` as revoked/expired and `null` as "do not enforce".
const isSessionActive = async (sessionId: unknown): Promise<boolean | null> => {
  if (!sessionId) return null;
  const result = await getDatabaseClient().execute({
    sql: 'SELECT revoked_at, expires_at FROM auth_sessions WHERE id = ?',
    args: [sessionId],
  });
  const row = result.rows[0];
  if (!row) return null;
  if (row.revoked_at) return false;
  return !isExpired(row.expires_at);
};

const revokeSessionById = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL',
    args: [sessionId],
  });
};

const revokeSessionByToken = async (refreshToken: unknown): Promise<void> => {
  if (!refreshToken) return;
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = ? AND revoked_at IS NULL',
    args: [hashRefreshToken(refreshToken)],
  });
};

// Reuse of a rotated refresh token revokes every session in its lineage.
const revokeSessionFamily = async (familyId: string): Promise<void> => {
  if (!familyId) return;
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = ? AND revoked_at IS NULL',
    args: [familyId],
  });
};

const revokeAllUserSessions = async (userId: string, options: { exceptSessionId?: string } = {}): Promise<void> => {
  if (!userId) return;
  if (options.exceptSessionId) {
    await getDatabaseClient().execute({
      sql: 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL',
      args: [userId, options.exceptSessionId],
    });
    return;
  }
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
    args: [userId],
  });
};

// Validates and rotates a refresh token. A replayed (already revoked) token is
// treated as a breach and invalidates the entire session family.
const rotateSession = async (
  refreshToken: unknown,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<
  | { ok: true; userId: string; sessionId: string; refreshToken: string; familyId: string; expiresAt: string }
  | { ok: false; reason: 'invalid' | 'reuse' | 'expired' }
> => {
  const existing = await findSessionByToken(refreshToken);
  if (!existing) return { ok: false, reason: 'invalid' };
  if (existing.revoked_at) {
    await revokeSessionFamily(existing.family_id);
    return { ok: false, reason: 'reuse' };
  }
  if (isExpired(existing.expires_at)) {
    await revokeSessionById(existing.id);
    return { ok: false, reason: 'expired' };
  }

  await revokeSessionById(existing.id);
  const created = await createSession({
    userId: existing.user_id,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
    familyId: existing.family_id,
  });
  await getDatabaseClient().execute({
    sql: 'UPDATE auth_sessions SET replaced_by = ? WHERE id = ?',
    args: [created.sessionId, existing.id],
  });
  return { ok: true, userId: existing.user_id, ...created };
};

const signAccessToken = (user: { id: string; email: string; role?: string; name?: string }, sessionId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Authentication is not configured');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'teacher', name: user.name || '', sid: sessionId },
    secret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
};

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  createSession,
  findSessionByToken,
  isSessionActive,
  touchSession,
  revokeSessionById,
  revokeSessionByToken,
  revokeSessionFamily,
  revokeAllUserSessions,
  rotateSession,
  signAccessToken,
};
