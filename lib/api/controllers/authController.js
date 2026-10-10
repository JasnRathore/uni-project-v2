/* eslint-disable @typescript-eslint/no-require-imports */
const {
  getAuthService,
  getDatabaseClient,
  writePortalData,
} = require('../../../database/services/dbService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Login endpoint (new – replaces Supabase signInWithPassword)
const login = async (req, res) => {
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

    const { unpackMetadata } = require('../../../database/services/dbService');
    const metadata = unpackMetadata(user.metadata_json).user_metadata;
    const userMetadata = { ...metadata };
    delete userMetadata.username;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: metadata.role || 'teacher', name: metadata.name || '' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const signup = async (req, res) => {
  try {
    const supabase = getAuthService();
    const signupBody = { ...req.body };
    delete signupBody.username;
    const { email, password, name, role, ...rest } = signupBody;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });
    if ((role || 'teacher') !== 'student') {
      if (!rest.departmentId) return res.status(400).json({ error: 'A department is required' });
      const department = await getDatabaseClient().execute({
        sql: 'SELECT id FROM departments WHERE id = ?',
        args: [rest.departmentId],
      });
      if (!department.rows.length) return res.status(400).json({ error: 'Select a valid department' });
      delete rest.department;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || 'teacher', ...rest },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, user: data.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const studentSignup = async (req, res) => {
  try {
    const supabase = getAuthService();
    const signupBody = { ...req.body };
    delete signupBody.class;
    delete signupBody.degreeId;
    delete signupBody.batch;
    delete signupBody.username;
    const { email, password, name, prn, rollNumber: legacyRollNumber, cohortId, ...rest } = signupBody;
    const studentPrn = prn || legacyRollNumber || null;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'student', prn: studentPrn, cohortId, ...rest },
    });
    if (error) return res.status(400).json({ error: error.message });

    await writePortalData(`student_profile:${email}`, {
      email,
      name,
      prn: studentPrn,
      cohortId: cohortId || null,
      lifecycleState: 'active',
      totalPoints: 0,
      currentLevel: 1,
      gameProgress: 0,
      registeredAt: new Date().toISOString(),
    });

    return res.json({ success: true, user: data.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const reactivateAccount = async (req, res) => {
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  signup,
  studentSignup,
  reactivateAccount
};
