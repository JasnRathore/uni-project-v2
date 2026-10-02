import { db } from "./db";

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function kvGet(key: string) {
  const result = await db.execute({
    sql: "SELECT value FROM kv_store WHERE key = ?",
    args: [key]
  });
  if (result.rows.length === 0) return null;
  return JSON.parse(result.rows[0].value as string);
}

export async function kvSet(key: string, value: any) {
  await db.execute({
    sql: "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
    args: [key, JSON.stringify(value)]
  });
}

export async function kvDelete(key: string) {
  await db.execute({
    sql: "DELETE FROM kv_store WHERE key = ?",
    args: [key]
  });
}

export async function kvGetByPrefix(prefix: string) {
  const result = await db.execute({
    sql: "SELECT key, value FROM kv_store WHERE key LIKE ?",
    args: [`${prefix}%`]
  });
  return result.rows.map(row => ({
    key: row.key as string,
    value: JSON.parse(row.value as string)
  }));
}
