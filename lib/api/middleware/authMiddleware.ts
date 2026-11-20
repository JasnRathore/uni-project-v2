/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const jwt = require('jsonwebtoken');

const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

const getUser = async (authHeader?: string | null) => {
  const token = authHeader?.split(' ')[1];
  if (!token || !JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch full user data from DB to populate user_metadata
    const { getDatabaseClient } = require('../../../database/services/dbService.ts');
    const db = getDatabaseClient();
    const result = await db.execute({
      sql: 'SELECT id, email, name, role, metadata_json, created_at FROM users WHERE id = ?',
      args: [decoded.id],
    });

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const { unpackMetadata } = require('../../../database/services/dbService.ts');
    const metadata = unpackMetadata(row.metadata_json);

    return {
      id: row.id,
      email: row.email,
      user_metadata: metadata.user_metadata,
      app_metadata: metadata.app_metadata,
      last_sign_in_at: null,
      created_at: row.created_at,
    };
  } catch {
    return null;
  }
};

const requireAuth = async (req: any, res: any, next: () => void) => {
  try {
    const user = await getUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.app_metadata?.accountDisabled) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const requireTeacher = (req: any, res: any, next: () => void) => {
  if (req.user?.user_metadata?.role === 'student') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  return next();
};

const requireStudent = (req: any, res: any, next: () => void) => {
  if (req.user?.user_metadata?.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  return next();
};

module.exports = {
  getUser,
  requireAuth,
  requireTeacher,
  requireStudent,
};
