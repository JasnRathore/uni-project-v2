/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');

const baseDir = typeof __dirname === 'string' ? __dirname : process.cwd();

const getSchemaPath = (): string => {
  const candidates = [
    path.resolve(process.cwd(), 'new_schema.sql'),
    path.join(baseDir, '..', '..', 'new_schema.sql'),
  ];
  const schemaPath = candidates.find((candidate: string) => fs.existsSync(candidate));
  if (!schemaPath) {
    throw new Error(`Schema file not found. Checked: ${candidates.join(', ')}`);
  }
  return schemaPath as string;
};

const ensureDatabaseSchema = async (db: any): Promise<void> => {
  await db.executeMultiple(fs.readFileSync(getSchemaPath(), 'utf8'));
  await db.execute('DROP TABLE IF EXISTS usernames');
  const userColumns = (await db.execute('PRAGMA table_info("users")')).rows;
  if (!userColumns.some((column: any) => column.name === 'email_verified_at')) {
    await db.execute('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
    // Accounts created before OTP verification existed are treated as verified.
    await db.execute('UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL');
  }
  await db.execute('DELETE FROM signup_otps WHERE expires_at < ?', [new Date().toISOString()]);
  const columns = (await db.execute('PRAGMA table_info("teacher_profiles")')).rows;
  if (!columns.some((column: any) => column.name === 'department_id')) {
    await db.execute(
      'ALTER TABLE teacher_profiles ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE RESTRICT',
    );
    if (columns.some((column: any) => column.name === 'department')) {
      await db.execute(`UPDATE teacher_profiles
        SET department_id = (
          SELECT id FROM departments
          WHERE name = teacher_profiles.department COLLATE NOCASE
        )
        WHERE department IS NOT NULL`);
      await db.execute('ALTER TABLE teacher_profiles DROP COLUMN department');
    }
  }
};

module.exports = { ensureDatabaseSchema };
