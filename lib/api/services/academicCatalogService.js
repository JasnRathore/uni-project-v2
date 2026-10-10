/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID } = require('node:crypto');
const { getDatabaseClient } = require('../../../database/services/dbService');

async function listProgramYears(degreeId, includeInactive = false) {
  const result = await getDatabaseClient().execute({
    sql: `SELECT p.*, d.name AS degree_name FROM program_years p
      JOIN degrees d ON d.id = p.degree_id
      WHERE p.degree_id = ? ${includeInactive ? '' : "AND p.status = 'active' AND d.status = 'active'"}
      ORDER BY p.label COLLATE NOCASE`,
    args: [degreeId],
  });
  return result.rows;
}

async function createProgramYear({ degreeId, label }) {
  if (!degreeId) throw new Error('Degree is required');
  if (!label?.trim()) throw new Error('Program-year label is required');
  const db = getDatabaseClient();
  const degree = (await db.execute({
    sql: "SELECT id FROM degrees WHERE id = ? AND status = 'active'",
    args: [degreeId],
  })).rows[0];
  if (!degree) throw new Error('Active degree not found');
  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO program_years (id, degree_id, label) VALUES (?, ?, ?)',
    args: [id, degreeId, label.trim()],
  });
  return (await db.execute({ sql: 'SELECT * FROM program_years WHERE id = ?', args: [id] })).rows[0];
}

async function listSubjects(programYearId) {
  const result = await getDatabaseClient().execute({
    sql: `SELECT s.id, s.name, s.degree_id, s.program_year_id,
        d.name AS degree_name, p.label AS program_year_label
      FROM subjects s
      JOIN degrees d ON d.id = s.degree_id
      JOIN program_years p ON p.id = s.program_year_id AND p.degree_id = s.degree_id
      WHERE s.program_year_id = ? AND d.status = 'active' AND p.status = 'active'
      ORDER BY s.name COLLATE NOCASE`,
    args: [programYearId],
  });
  return result.rows;
}

async function listCatalogSubjects() {
  const result = await getDatabaseClient().execute({
    sql: `SELECT s.id, s.name, s.degree_id, s.program_year_id,
        d.name AS degree_name, p.label AS program_year_label
      FROM subjects s
      JOIN degrees d ON d.id = s.degree_id
      JOIN program_years p ON p.id = s.program_year_id AND p.degree_id = s.degree_id
      WHERE d.status = 'active' AND p.status = 'active'
      ORDER BY d.name COLLATE NOCASE, p.label COLLATE NOCASE, s.name COLLATE NOCASE`,
  });
  return result.rows;
}

async function createSubject({ programYearId, name }) {
  if (!programYearId) throw new Error('Program year is required');
  if (!name?.trim()) throw new Error('Subject name is required');
  const db = getDatabaseClient();
  const programYear = (await db.execute({
    sql: `SELECT p.id, p.degree_id FROM program_years p
      JOIN degrees d ON d.id = p.degree_id
      WHERE p.id = ? AND p.status = 'active' AND d.status = 'active'`,
    args: [programYearId],
  })).rows[0];
  if (!programYear) throw new Error('Active program year not found');
  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO subjects (id, degree_id, program_year_id, name) VALUES (?, ?, ?, ?)',
    args: [id, programYear.degree_id, programYearId, name.trim()],
  });
  return (await db.execute({
    sql: `SELECT s.id, s.degree_id, s.program_year_id, s.name,
        d.name AS degree_name, p.label AS program_year_label
      FROM subjects s JOIN degrees d ON d.id = s.degree_id
      JOIN program_years p ON p.id = s.program_year_id WHERE s.id = ?`,
    args: [id],
  })).rows[0];
}

module.exports = { listProgramYears, createProgramYear, listSubjects, listCatalogSubjects, createSubject };
