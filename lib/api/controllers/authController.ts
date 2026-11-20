/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const {
  getAuthService,
  getDatabaseClient,
  unpackMetadata,
  writePortalData,
} = require('../../../database/services/dbService.ts');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const {
  consumeSignupOtp,
  requestSignupOtp: requestSignupOtpCode,
  cancelSignupOtp,
} = require('../services/signupOtpService.ts');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  createSession,
  rotateSession,
  revokeSessionById,
  revokeSessionByToken,
  revokeAllUserSessions,
  signAccessToken,
} = require('../services/sessionService.ts');
const { setAuthCookies, clearAuthCookies } = require('../services/authCookieService.ts');

const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

// Login throttling: at most MAX_FAILED_ATTEMPTS failures per email within the
// rolling window before further attempts are refused.
const MAX_FAILED_ATTEMPTS = 5;
const LOGIN_WINDOW_MINUTES = 15;

// Transactional email is best-effort: a missing configuration or send failure is
// logged but must never change the authentication response. The mailer is required
// lazily so the module (and the test harness) can load without mail credentials.
const sendMailBestEffort = (kind: string, send: () => Promise<unknown>) => {
  void Promise.resolve()
    .then(send)
    .catch((error) => console.error(`[auth] Unable to send ${kind} email:`, error));
};

const clientIp = (req: any): string | null => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req?.ip || null;
};

const recordLoginAttempt = async (email: string, ip: string | null, success: boolean): Promise<void> => {
  try {
    await getDatabaseClient().execute({
      sql: 'INSERT INTO login_attempts (id, email, ip_address, success) VALUES (?, ?, ?, ?)',
      args: [uuidv4(), email, ip, success ? 1 : 0],
    });
  } catch (error) {
    console.error('[auth] Unable to record login attempt:', error);
  }
};

const isLoginThrottled = async (email: string): Promise<boolean> => {
  try {
    const result = await getDatabaseClient().execute({
      sql: `SELECT COUNT(*) AS failures FROM login_attempts
        WHERE email = ? COLLATE NOCASE AND success = 0
          AND created_at >= datetime('now', ?)`,
      args: [email, `-${LOGIN_WINDOW_MINUTES} minutes`],
    });
    return Number(result.rows[0]?.failures || 0) >= MAX_FAILED_ATTEMPTS;
  } catch (error) {
    console.error('[auth] Unable to read login attempts:', error);
    return false;
  }
};

const publicUser = (row: any) => {
  const metadata = unpackMetadata(row.metadata_json);
  const userMetadata = { ...metadata.user_metadata };
  delete userMetadata.username;
  return {
    id: row.id,
    email: row.email,
    user_metadata: userMetadata,
    app_metadata: metadata.app_metadata || {},
  };
};

const loadUserRow = async (userId: unknown) => {
  const result = await getDatabaseClient().execute({
    sql: 'SELECT id, email, name, role, password_hash, metadata_json, created_at FROM users WHERE id = ?',
    args: [userId],
  });
  return result.rows[0] || null;
};

// Login endpoint (new – replaces Supabase signInWithPassword). A successful
// login establishes a server-side session: a short-lived access JWT plus an
// HttpOnly rotating refresh-token cookie.
const login = async (req: any, res: any) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedEmail = String(email).trim();
    const ip = clientIp(req);

    if (await isLoginThrottled(normalizedEmail)) {
      return res.status(429).json({ error: 'Too many failed login attempts. Please try again later.' });
    }

    const db = getDatabaseClient();
    const result = await db.execute({
      sql: 'SELECT id, email, password_hash, metadata_json FROM users WHERE email = ? COLLATE NOCASE',
      args: [normalizedEmail],
    });
    if (result.rows.length === 0) {
      await recordLoginAttempt(normalizedEmail, ip, false);
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordLoginAttempt(normalizedEmail, ip, false);
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    await recordLoginAttempt(normalizedEmail, ip, true);

    const session = await createSession({
      userId: user.id,
      userAgent: req.headers?.['user-agent'] || null,
      ipAddress: ip,
    });
    const token = signAccessToken(
      {
        id: user.id,
        email: user.email,
        role: unpackMetadata(user.metadata_json).user_metadata?.role || 'teacher',
        name: unpackMetadata(user.metadata_json).user_metadata?.name || '',
      },
      session.sessionId,
    );

    setAuthCookies(res, { accessToken: token, refreshToken: session.refreshToken });

    const metadata = unpackMetadata(user.metadata_json).user_metadata;
    sendMailBestEffort('sign-in notice', () => {
      const { sendSignInNotice } = require('../../email/mailer.ts');
      return sendSignInNotice({ to: user.email, name: metadata.name });
    });

    return res.json({
      success: true,
      token,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: publicUser(user),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Exchanges the refresh cookie for a fresh access token, rotating the refresh
// token in the process. Replayed tokens revoke the whole session family.
const refresh = async (req: any, res: any) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured' });
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'No active session', code: 'SESSION_EXPIRED' });
    }

    const rotated = await rotateSession(refreshToken, {
      userAgent: req.headers?.['user-agent'] || null,
      ipAddress: clientIp(req),
    });
    if (!rotated.ok) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const row = await loadUserRow(rotated.userId);
    if (!row) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const token = signAccessToken(
      {
        id: row.id,
        email: row.email,
        role: unpackMetadata(row.metadata_json).user_metadata?.role || row.role,
        name: row.name || '',
      },
      rotated.sessionId,
    );
    setAuthCookies(res, { accessToken: token, refreshToken: rotated.refreshToken });

    return res.json({
      success: true,
      token,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: publicUser(row),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Revokes the current session and clears its cookies.
const logout = async (req: any, res: any) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) await revokeSessionByToken(refreshToken);
    else if (req.user?.session_id) await revokeSessionById(req.user.session_id);
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (err: any) {
    clearAuthCookies(res);
    return res.status(500).json({ error: err.message });
  }
};

// Returns the currently authenticated account (browser session hydration).
const me = async (req: any, res: any) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    },
  });
};

const markEmailVerified = async (userId: unknown) => {
  if (!userId) return;
  try {
    await getDatabaseClient().execute({
      sql: 'UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ? AND email_verified_at IS NULL',
      args: [userId],
    });
  } catch (error) {
    console.error('[auth] Unable to mark email as verified:', error);
  }
};

const requestSignupOtp = async (req: any, res: any) => {
  try {
    const body = { ...(req.body || {}) };
    const role = body.role === 'student' ? 'student' : 'teacher';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const db = getDatabaseClient();
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? COLLATE NOCASE',
      args: [email],
    });
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    if (role === 'teacher') {
      if (!body.departmentId) return res.status(400).json({ error: 'A department is required' });
      const department = await db.execute({
        sql: 'SELECT id FROM departments WHERE id = ?',
        args: [body.departmentId],
      });
      if (!department.rows.length) return res.status(400).json({ error: 'Select a valid department' });
    } else {
      if (!body.cohortId) return res.status(400).json({ error: 'A graduation cohort is required' });
      const cohort = await db.execute({
        sql: 'SELECT id FROM graduation_cohorts WHERE id = ?',
        args: [body.cohortId],
      });
      if (!cohort.rows.length) return res.status(400).json({ error: 'Select a valid graduation cohort' });
    }

    const result = await requestSignupOtpCode({ email, role });
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    let sent = false;
    try {
      const { sendSignupOtpEmail } = require('../../email/mailer.ts');
      sent = await sendSignupOtpEmail({ to: email, name, otp: result.otp });
    } catch (error) {
      console.error('[auth] Unable to send signup verification email:', error);
    }
    if (!sent) {
      await cancelSignupOtp(email);
      return res.status(503).json({ error: 'We could not send the verification email. Please try again later or contact an administrator.' });
    }

    return res.json({ success: true, email, expiresInSeconds: 600, resendAfterSeconds: 60 });
  } catch (err: any) {
    console.error('[auth] request-signup-otp failed:', err);
    return res.status(500).json({ error: err.message });
  }
};

const signup = async (req: any, res: any) => {
  try {
    const supabase = getAuthService();
    const signupBody = { ...req.body };
    delete signupBody.username;
    const { email, password, name, role, otp, ...rest } = signupBody;
    const effectiveRole = role === 'student' ? 'student' : 'teacher';
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });
    if (!otp) {
      return res.status(400).json({ error: 'Enter the verification code sent to your email', code: 'OTP_REQUIRED' });
    }
    if (effectiveRole !== 'student') {
      if (!rest.departmentId) return res.status(400).json({ error: 'A department is required' });
      const department = await getDatabaseClient().execute({
        sql: 'SELECT id FROM departments WHERE id = ?',
        args: [rest.departmentId],
      });
      if (!department.rows.length) return res.status(400).json({ error: 'Select a valid department' });
      delete rest.department;
    }
    const verification = await consumeSignupOtp({ email, otp, role: effectiveRole });
    if (!verification.ok) return res.status(verification.status).json({ error: verification.error });
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: effectiveRole, ...rest },
    });
    if (error) return res.status(400).json({ error: error.message });
    await markEmailVerified(data.user?.id);
    sendMailBestEffort('welcome', () => {
      const { sendWelcomeEmail } = require('../../email/mailer.ts');
      return sendWelcomeEmail({
        to: data.user?.email || email,
        name: data.user?.user_metadata?.name || name,
        role: data.user?.user_metadata?.role || effectiveRole,
      });
    });
    return res.json({ success: true, user: data.user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const studentSignup = async (req: any, res: any) => {
  try {
    const supabase = getAuthService();
    const signupBody = { ...req.body };
    delete signupBody.class;
    delete signupBody.degreeId;
    delete signupBody.batch;
    delete signupBody.username;
    const { email, password, name, prn, rollNumber: legacyRollNumber, cohortId, otp, ...rest } = signupBody;
    const studentPrn = prn || legacyRollNumber || null;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });
    if (!otp) {
      return res.status(400).json({ error: 'Enter the verification code sent to your email', code: 'OTP_REQUIRED' });
    }
    const verification = await consumeSignupOtp({ email, otp, role: 'student' });
    if (!verification.ok) return res.status(verification.status).json({ error: verification.error });
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'student', prn: studentPrn, cohortId, ...rest },
    });
    if (error) return res.status(400).json({ error: error.message });
    await markEmailVerified(data.user?.id);
    await writePortalData(`student_profile:${email}`, {
      email,
      name,
      prn: studentPrn,
      cohortId: cohortId || null,
      lifecycleState: 'active',
      totalPoints: 0,
      currentLevel: 1,
      registeredAt: new Date().toISOString(),
    });
    sendMailBestEffort('welcome', () => {
      const { sendWelcomeEmail } = require('../../email/mailer.ts');
      return sendWelcomeEmail({
        to: data.user?.email || email,
        name: data.user?.user_metadata?.name || name,
        role: 'student',
      });
    });
    return res.json({ success: true, user: data.user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const forgotPassword = async (req: any, res: any) => {
  // Always respond with the same generic success so callers cannot probe which
  // emails belong to a user account.
  try {
    const email = req.body?.email;
    if (!email || typeof email !== 'string') return res.json({ success: true });
    if (!JWT_SECRET) {
      console.error('[auth] Password reset is unavailable: JWT_SECRET is not configured');
      return res.json({ success: true });
    }

    const { createPasswordResetToken } = require('../services/passwordResetService.ts');
    const db = getDatabaseClient();
    const result = await db.execute({
      sql: 'SELECT id, email, password_hash, metadata_json FROM users WHERE email = ? COLLATE NOCASE',
      args: [email.trim()],
    });
    if (!result.rows.length) return res.json({ success: true });

    const user = result.rows[0];
    const token = createPasswordResetToken({ userId: user.id, passwordHash: user.password_hash });
    if (!token) return res.json({ success: true });

    const metadata = unpackMetadata(user.metadata_json).user_metadata;

    sendMailBestEffort('password reset', () => {
      const { sendPasswordResetEmail } = require('../../email/mailer.ts');
      return sendPasswordResetEmail({ to: user.email, name: metadata?.name, token });
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[auth] forgot-password failed:', err);
    return res.json({ success: true });
  }
};

const resetPassword = async (req: any, res: any) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password ?? req.body?.newPassword;
    if (!token || !password) return res.status(400).json({ error: 'A reset token and new password are required' });
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const { verifyPasswordResetToken, fingerprintPasswordHash } = require('../services/passwordResetService.ts');
    const verification = verifyPasswordResetToken(token);
    if (!verification.ok) return res.status(400).json({ error: verification.error });

    const db = getDatabaseClient();
    const result = await db.execute({
      sql: 'SELECT id, password_hash FROM users WHERE id = ?',
      args: [verification.userId],
    });
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const user = result.rows[0];
    if (fingerprintPasswordHash(user.password_hash) !== verification.fingerprint) {
      return res.status(400).json({ error: 'This reset link is no longer valid' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [passwordHash, user.id],
    });

    // A password reset invalidates every existing session.
    await revokeAllUserSessions(user.id);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const changePassword = async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const currentPassword = req.body?.currentPassword ?? req.body?.current_password;
    const password = req.body?.password ?? req.body?.newPassword;
    if (!currentPassword) return res.status(400).json({ error: 'Your current password is required' });
    if (!password) return res.status(400).json({ error: 'A new password is required' });
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const row = await loadUserRow(user.id);
    if (!row) return res.status(401).json({ error: 'Unauthorized' });

    const valid = await bcrypt.compare(String(currentPassword), row.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    await getDatabaseClient().execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [passwordHash, user.id],
    });

    // Changing a password signs out every other device but keeps this session.
    await revokeAllUserSessions(user.id, { exceptSessionId: user.session_id || undefined });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const reactivateAccount = async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getAuthService();
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), accountDisabled: false },
    });
    if (updateError) return res.status(400).json({ error: updateError.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  refresh,
  logout,
  me,
  requestSignupOtp,
  signup,
  studentSignup,
  forgotPassword,
  resetPassword,
  changePassword,
  reactivateAccount
};
