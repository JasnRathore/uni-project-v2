const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = '2';

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

const readSchemaDefinitions = () => {
  const schemaPath = getSchemaPath();
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const definitions = [];
  const tablePattern = /CREATE TABLE IF NOT EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\n\);/g;
  let tableMatch;
  while ((tableMatch = tablePattern.exec(schema))) {
    const columns = [];
    for (const line of tableMatch[2].split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)(?:,)?$/);
      if (match && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)\b/i.test(match[1])) {
        columns.push({ name: match[1], definition: match[2].replace(/,$/, '') });
      }
    }
    definitions.push({ name: tableMatch[1], columns });
  }
  if (!definitions.length) throw new Error(`No table definitions found in ${schemaPath}`);
  return definitions;
};

const quoteIdentifier = value => `"${String(value).replaceAll('"', '""')}"`;

const getAlterColumnDefinition = definition => {
  if (/\bPRIMARY\s+KEY\b/i.test(definition)) {
    throw new Error(`Cannot add missing primary-key column automatically: ${definition}`);
  }
  // SQLite does not allow CURRENT_TIMESTAMP as a default in ALTER TABLE ... ADD COLUMN.
  return definition
    .replace(/\s+NOT NULL\b/gi, '')
    .replace(/\s+UNIQUE\b/gi, '')
    .replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP\b/gi, '');
};

const ensureDatabaseSchema = async db => {
  const definitions = readSchemaDefinitions();
  await db.executeMultiple(fs.readFileSync(getSchemaPath(), 'utf8'));

  for (const table of definitions) {
    const tableInfo = await db.execute(`PRAGMA table_info(${quoteIdentifier(table.name)})`);
    const existingColumns = new Set(tableInfo.rows.map(row => String(row.name)));
    for (const column of table.columns) {
      if (!existingColumns.has(column.name)) {
        await db.execute(
          `ALTER TABLE ${quoteIdentifier(table.name)} ADD COLUMN ${quoteIdentifier(column.name)} ${getAlterColumnDefinition(column.definition)}`,
        );
      }

      // Backfill the normalized membership table from the legacy one-class-per-
      // teacher roster. This is deliberately idempotent for existing local DBs.
      await db.execute(`
        INSERT OR IGNORE INTO class_memberships
          (teacher_id, student_id, class_id, status, assigned_at, created_at, updated_at, source_json)
        SELECT teacher_id, student_id, class_id, status, assigned_at, created_at, updated_at, source_json
        FROM teacher_students
        WHERE class_id IS NOT NULL
      `);
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute({
    sql: `INSERT INTO schema_migrations (version) VALUES (?) ON CONFLICT(version) DO NOTHING`,
    args: [SCHEMA_VERSION],
  });
};

module.exports = { ensureDatabaseSchema };
