/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const {
  getAuthService,
  getDatabaseClient,
  writePortalData,
} = require('../../../database/services/dbService.ts');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  consumeSignupOtp,
  requestSignupOtp: requestSignupOtpCode,
  cancelSignupOtp,
} = require('../services/signupOtpService.ts');

const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

// Transactional email is best-effort: a missing configuration or send failure is
// logged but must never change the authentication response. The mailer is required
// lazily so the module (and the test harness) can load without mail credentials.
const sendMailBestEffort = (kind: string, send: () => Promise<unknown>) => {
  void Promise.resolve()
    .then(send)
    .catch((error) => console.error(`[auth] Unable to send ${kind} email:`, error));
};

// Login endpoint (new – replaces Supabase signInWithPassword)
const login = async (req: any, res: any) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const db = getDatabaseClient();
    const result = await db.execute({
      sql: 'SELECT id, email, password_hash, metadata_json FROM users WHERE email = ? COLLATE NOCASE',
      args: [email.trim()],
    });
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid login credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid login credentials' });

    const { unpackMetadata } = require('../../../database/services/dbService.ts');
    const metadata = unpackMetadata(user.metadata_json).user_metadata;
    const userMetadata = { ...metadata };
    delete userMetadata.username;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: metadata.role || 'teacher', name: metadata.name || '' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    sendMailBestEffort('sign-in notice', () => {
      const { sendSignInNotice } = require('../../email/mailer.ts');
      return sendSignInNotice({ to: user.email, name: metadata.name });
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: userMetadata,
        app_metadata: {},
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
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
      return res.status(503).json({ error: 'Email delivery is not configured. Please contact an administrator.' });
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

    const { unpackMetadata } = require('../../../database/services/dbService.ts');
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

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const changePassword = async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const password = req.body?.password ?? req.body?.newPassword;
    if (!password) return res.status(400).json({ error: 'A new password is required' });
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await getDatabaseClient().execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [passwordHash, user.id],
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const reactivateAccount = async (req: any, res: any) => {
  try {
    // User already decoded by requireAuth middleware
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getAuthService();
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, accountDisabled: false },
    });
    if (updateError) return res.status(400).json({ error: updateError.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  requestSignupOtp,
  signup,
  studentSignup,
  forgotPassword,
  resetPassword,
  changePassword,
  reactivateAccount
};
