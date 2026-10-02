const { getSupabaseClient, kvSet, kvGetByPrefix } = require('../../database/services/dbService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

// Login endpoint (new – replaces Supabase signInWithPassword)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const supabase = getSupabaseClient();
    // Look up user by email via the Turso-backed shim
    const { getTursoClient } = require('../../database/services/dbService');
    const db = getTursoClient();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid login credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid login credentials' });

    const metadata = JSON.parse(user.metadata || '{}');
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
        user_metadata: metadata,
        app_metadata: {},
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const signup = async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { email, password, name, role, ...rest } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });
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
    const supabase = getSupabaseClient();
    const { email, password, name, username, rollNumber, batch, class: className, ...rest } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'student', username, rollNumber, batch, class: className, ...rest },
    });
    if (error) return res.status(400).json({ error: error.message });

    let matchedClassId = null;
    if (className) {
      try {
        const allClassesEntries = await kvGetByPrefix('classes:');
        for (const entry of allClassesEntries) {
          const classes = Array.isArray(entry.value) ? entry.value : [];
          const match = classes.find(c => c.name === className || c.subject === className);
          if (match) { matchedClassId = match.id; break; }
        }
      } catch (e) { /* ignore */ }
    }

    const profileKey = `student_profile:${email}`;
    await kvSet(profileKey, {
      email,
      name,
      username: username || '',
      rollNumber: rollNumber || '',
      batch: batch || '',
      className: className || '',
      classId: matchedClassId || null,
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

    const supabase = getSupabaseClient();
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
