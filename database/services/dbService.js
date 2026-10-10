const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { createClient } = require('@libsql/client');
const { ensureDatabaseSchema } = require('./schemaService');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

let client = null;
let schemaReady = null;

const getDatabaseUrl = () => {
  const target = (process.env.DATABASE_TARGET || '').toLowerCase();
  if (target === 'local') return process.env.LOCAL_DATABASE_URL || 'file:local.db';
  if (target === 'turso') {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('DATABASE_TARGET=turso requires TURSO_DATABASE_URL');
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      throw new Error('DATABASE_TARGET=turso requires TURSO_AUTH_TOKEN');
    }
    return process.env.TURSO_DATABASE_URL;
  }
  if (!process.env.TURSO_DATABASE_URL) return 'file:local.db';
  throw new Error('Set DATABASE_TARGET=local or DATABASE_TARGET=turso before using the database');
};

const getDatabaseClient = () => {
  if (!client) {
    const url = getDatabaseUrl();
    client = createClient({
      url,
      authToken: url.startsWith('file:') ? undefined : process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
};

const ensureDatabaseReady = () => {
  if (!schemaReady) {
    schemaReady = ensureDatabaseSchema(getDatabaseClient()).catch(error => {
      schemaReady = null;
      throw new Error(`Database schema initialization failed: ${error.message}`);
    });
  }
  return schemaReady;
};

const unpackMetadata = value => {
  let stored = value || '{}';
  try {
    stored = typeof stored === 'string' ? JSON.parse(stored) : stored;
  } catch (error) {
    throw new Error(`Invalid user metadata JSON: ${error.message}`);
  }
  if (stored && typeof stored === 'object' && Object.hasOwn(stored, 'user_metadata')) {
    return {
      user_metadata: stored.user_metadata || {},
      app_metadata: stored.app_metadata || {},
    };
  }
  return { user_metadata: stored && typeof stored === 'object' ? stored : {}, app_metadata: {} };
};

const authUserFromRow = row => {
  const metadata = unpackMetadata(row.metadata_json);
  return {
    id: row.id,
    email: row.email,
    user_metadata: metadata.user_metadata,
    app_metadata: metadata.app_metadata,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at || null,
  };
};

const getAuthService = () => {
  const db = getDatabaseClient();
  const admin = {
    listUsers: async ({ page = 1, perPage = 1000 } = {}) => {
      const offset = Math.max(0, page - 1) * perPage;
      const result = await db.execute({
        sql: `SELECT id, email, name, role, metadata_json, created_at
          FROM users ORDER BY created_at, id LIMIT ? OFFSET ?`,
        args: [perPage, offset],
      });
      return {
        data: {
          users: result.rows.map(row => ({
            ...row,
            user_metadata: unpackMetadata(row.metadata_json).user_metadata,
            app_metadata: unpackMetadata(row.metadata_json).app_metadata,
          })),
        },
        error: null,
      };
    },
    deleteUser: async id => {
      try {
        await withTransaction(async tx => {
          const result = await tx.execute({ sql: 'SELECT role FROM users WHERE id=?', args: [id] });
          if (result.rows[0]?.role === 'student') {
            await tx.execute({ sql: 'DELETE FROM students WHERE user_id=?', args: [id] });
          }
          await tx.execute({ sql: 'DELETE FROM users WHERE id=?', args: [id] });
        });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    createUser: async ({ email, password, user_metadata = {} }) => {
      try {
        if (!email || !password) throw new Error('Email and password are required');
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);
        const metadata = {
          ...(user_metadata && typeof user_metadata === 'object' ? user_metadata : {}),
        };
        const role = metadata.role || 'student';
        if (role === 'teacher') delete metadata.department;
        await withTransaction(async tx => {
          await tx.execute({
            sql: `INSERT INTO users (id, email, password_hash, name, role, metadata_json)
              VALUES (?, ?, ?, ?, ?, ?)`,
            args: [userId, email.trim(), passwordHash, metadata.name || '', role,
              JSON.stringify({ user_metadata: metadata, app_metadata: {} })],
          });
          if (role === 'student') {
            await require('./relationalDataService').ensureStudent(tx, email.trim(), {
              id: userId,
              name: metadata.name || '',
              prn: metadata.prn || metadata.rollNumber || null,
              cohortId: metadata.cohortId || null,
              lifecycleState: 'active',
              className: metadata.class || null,
              registeredAt: new Date().toISOString(),
            });
            if (metadata.username) {
              await tx.execute({
                sql: 'INSERT INTO usernames (username, user_id) VALUES (?, ?)',
                args: [metadata.username, userId],
              });
            }
          } else if (role === 'teacher') {
            await tx.execute({
              sql: 'INSERT INTO teacher_profiles (user_id, department_id, source_json) VALUES (?, ?, ?)',
              args: [userId, metadata.departmentId || null, JSON.stringify(metadata)],
            });
          }
        });
        return { data: { user: { id: userId, email: email.trim(), user_metadata: metadata, app_metadata: {} } }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    updateUserById: async (id, updates = {}) => {
      try {
        await withTransaction(async tx => {
          const result = await tx.execute({ sql: 'SELECT * FROM users WHERE id=?', args: [id] });
          const row = result.rows[0];
          if (!row) throw new Error('User not found');
          const current = unpackMetadata(row.metadata_json);
          const userMetadata = updates.user_metadata
            ? { ...current.user_metadata, ...updates.user_metadata }
            : current.user_metadata;
          const appMetadata = updates.app_metadata
            ? { ...current.app_metadata, ...updates.app_metadata }
            : current.app_metadata;
          const role = userMetadata.role || row.role;
          if (role === 'teacher') delete userMetadata.department;
          await tx.execute({
            sql: 'UPDATE users SET name=?, role=?, metadata_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            args: [
              userMetadata.name || row.name || '',
              role,
              JSON.stringify({ user_metadata: userMetadata, app_metadata: appMetadata }),
              id,
            ],
          });
          if (role === 'student') {
            const studentUpdates = updates.user_metadata || {};
            await require('./relationalDataService').ensureStudent(tx, row.email, studentUpdates);
            if (Object.hasOwn(studentUpdates, 'username') && studentUpdates.username) {
              await tx.execute({
                sql: `INSERT INTO usernames (username, user_id) VALUES (?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET username=excluded.username`,
                args: [studentUpdates.username, id],
              });
            } else if (Object.hasOwn(studentUpdates, 'username')) {
              await tx.execute({ sql: 'DELETE FROM usernames WHERE user_id=?', args: [id] });
            }
          } else if (role === 'teacher') {
            await tx.execute({
              sql: `INSERT INTO teacher_profiles (user_id, department_id, source_json) VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  department_id=excluded.department_id, source_json=excluded.source_json`,
              args: [id, userMetadata.departmentId || null, JSON.stringify(userMetadata)],
            });
          }
        });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    getUserById: async id => {
      const result = await db.execute({
        sql: 'SELECT id, email, name, role, metadata_json, created_at FROM users WHERE id=?',
        args: [id],
      });
      if (!result.rows[0]) return { data: null, error: new Error('Not found') };
      return { data: { user: authUserFromRow(result.rows[0]) }, error: null };
    },
  };
  return { auth: { admin } };
};

const readPortalData = (...args) => require('./relationalDataService').readPortalData(...args);
const writePortalData = (...args) => require('./relationalDataService').writePortalData(...args);
const deletePortalData = (...args) => require('./relationalDataService').deletePortalData(...args);
const listPortalDataByPrefix = (...args) => require('./relationalDataService').listPortalDataByPrefix(...args);
const withTransaction = (...args) => require('./relationalDataService').withTransaction(...args);

module.exports = {
  getAuthService,
  getDatabaseClient,
  ensureDatabaseReady,
  authUserFromRow,
  unpackMetadata,
  readPortalData,
  writePortalData,
  deletePortalData,
  listPortalDataByPrefix,
  withTransaction,
};
