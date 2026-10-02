const { createClient } = require('@libsql/client');

let client = null;
let initialized = false;

const getTursoClient = () => {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }
  
  if (!initialized) {
    initialized = true;
    client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(console.error);

    client.execute(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(console.error);
  }
  
  return client;
};

const getSupabaseClient = () => {
  const db = getTursoClient();
  return {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => {
          const res = await db.execute("SELECT * FROM users");
          return { data: { users: res.rows.map(r => ({ ...r, user_metadata: JSON.parse(r.metadata) })) }, error: null };
        },
        deleteUser: async (id) => {
          await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
          return { error: null };
        },
        createUser: async ({ email, password, user_metadata }) => {
          const bcrypt = require('bcryptjs');
          const { v4: uuidv4 } = require('uuid');
          try {
            const check = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
            if (check.rows.length > 0) throw new Error('User already exists');
            const id = uuidv4();
            const hash = await bcrypt.hash(password, 10);
            await db.execute({
              sql: "INSERT INTO users (id, email, password, name, role, metadata) VALUES (?, ?, ?, ?, ?, ?)",
              args: [id, email, hash, user_metadata.name || '', user_metadata.role || 'student', JSON.stringify(user_metadata)]
            });
            return { data: { user: { id, email, user_metadata } }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        updateUserById: async (id, updates) => {
          if (updates.user_metadata) {
            await db.execute({ sql: "UPDATE users SET metadata = ? WHERE id = ?", args: [JSON.stringify(updates.user_metadata), id] });
          }
          return { error: null };
        },
        getUserById: async (id) => {
          const res = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
          if (res.rows.length === 0) return { data: null, error: new Error('Not found') };
          const r = res.rows[0];
          return { data: { user: { ...r, user_metadata: JSON.parse(r.metadata) } }, error: null };
        }
      }
    }
  };
};

const kvGet = async (key) => {
  const db = getTursoClient();
  const res = await db.execute({ sql: "SELECT value FROM kv_store WHERE key = ?", args: [key] });
  if (res.rows.length === 0) return null;
  return JSON.parse(res.rows[0].value);
};

const kvSet = async (key, value) => {
  const db = getTursoClient();
  await db.execute({
    sql: "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
    args: [key, JSON.stringify(value)]
  });
};

const kvDelete = async (key) => {
  const db = getTursoClient();
  await db.execute({ sql: "DELETE FROM kv_store WHERE key = ?", args: [key] });
};

const kvGetByPrefix = async (prefix) => {
  const db = getTursoClient();
  const res = await db.execute({ sql: "SELECT key, value FROM kv_store WHERE key LIKE ?", args: [`${prefix}%`] });
  return res.rows.map(r => ({ key: r.key, value: JSON.parse(r.value) }));
};

module.exports = {
  getSupabaseClient,
  kvGet,
  kvSet,
  kvDelete,
  kvGetByPrefix,
  getTursoClient
};
