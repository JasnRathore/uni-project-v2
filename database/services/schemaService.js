const fs = require('node:fs');
const path = require('node:path');

const getSchemaPath = () => {
  const candidates = [
    path.resolve(process.cwd(), 'new_schema.sql'),
    path.join(__dirname, '..', '..', 'new_schema.sql'),
  ];
  const schemaPath = candidates.find(candidate => fs.existsSync(candidate));
  if (!schemaPath) {
    throw new Error(`Schema file not found. Checked: ${candidates.join(', ')}`);
  }
  return schemaPath;
};

const ensureDatabaseSchema = async db => {
  await db.executeMultiple(fs.readFileSync(getSchemaPath(), 'utf8'));
  await db.execute('DROP TABLE IF EXISTS usernames');
  const columns = (await db.execute('PRAGMA table_info("teacher_profiles")')).rows;
  if (!columns.some(column => column.name === 'department_id')) {
    await db.execute(
      'ALTER TABLE teacher_profiles ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE RESTRICT',
    );
    if (columns.some(column => column.name === 'department')) {
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
