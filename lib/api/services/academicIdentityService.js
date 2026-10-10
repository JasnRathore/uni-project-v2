const { randomUUID } = require('node:crypto');
const { getDatabaseClient, withTransaction } = require('../../../database/services/dbService');

const identityService = {
  async listDegrees(includeInactive = false) {
    const result = await getDatabaseClient().execute({
      sql: `SELECT d.*, COUNT(c.id) AS cohort_count FROM degrees d
        LEFT JOIN graduation_cohorts c ON c.degree_id = d.id
        ${includeInactive ? '' : "WHERE d.status = 'active'"} GROUP BY d.id ORDER BY d.name`,
    });
    return result.rows;
  },
  async createDegree({ name, status = 'active' }) {
    if (!String(name || '').trim()) throw new Error('Degree name is required');
    const id = randomUUID();
    await getDatabaseClient().execute({ sql: 'INSERT INTO degrees (id, name, status) VALUES (?, ?, ?)', args: [id, name.trim(), status] });
    return (await getDatabaseClient().execute({ sql: 'SELECT * FROM degrees WHERE id=?', args: [id] })).rows[0];
  },
  async setDegreeStatus(id, status) {
    if (!['active', 'inactive'].includes(status)) throw new Error('Invalid degree status');
    await getDatabaseClient().execute({ sql: 'UPDATE degrees SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', args: [status, id] });
    return (await getDatabaseClient().execute({ sql: 'SELECT * FROM degrees WHERE id=?', args: [id] })).rows[0] || null;
  },
  async listCohorts(degreeId, includeInactive = false) {
    const result = await getDatabaseClient().execute({
      sql: `SELECT c.*, d.name AS degree_name FROM graduation_cohorts c
        JOIN degrees d ON d.id=c.degree_id WHERE c.degree_id=?
        ${includeInactive ? '' : "AND c.status='active'"} ORDER BY c.label`,
      args: [degreeId],
    });
    return result.rows;
  },
  async createCohort({ degreeId, label, status = 'active' }) {
    if (!degreeId || !String(label || '').trim()) throw new Error('degreeId and label are required');
    const id = randomUUID();
    await getDatabaseClient().execute({ sql: 'INSERT INTO graduation_cohorts (id, degree_id, label, status) VALUES (?, ?, ?, ?)', args: [id, degreeId, label.trim(), status] });
    return (await getDatabaseClient().execute({ sql: 'SELECT * FROM graduation_cohorts WHERE id=?', args: [id] })).rows[0];
  },
  async setCohortStatus(id, status) {
    if (!['active', 'inactive'].includes(status)) throw new Error('Invalid cohort status');
    await getDatabaseClient().execute({ sql: 'UPDATE graduation_cohorts SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', args: [status, id] });
    return (await getDatabaseClient().execute({ sql: 'SELECT * FROM graduation_cohorts WHERE id=?', args: [id] })).rows[0] || null;
  },
  async assignStudent({ studentId, degreeId, cohortId, actorId, reason }) {
    if (!reason || !String(reason).trim()) throw new Error('A reason is required for identity corrections');
    return withTransaction(async tx => {
      const student = (await tx.execute({
        sql: `SELECT s.id, s.cohort_id, c.degree_id FROM students s
          LEFT JOIN graduation_cohorts c ON c.id=s.cohort_id WHERE s.id=?`,
        args: [studentId],
      })).rows[0];
      if (!student) throw new Error('Student not found');
      const cohort = (await tx.execute({ sql: 'SELECT id, degree_id, status FROM graduation_cohorts WHERE id=?', args: [cohortId] })).rows[0];
      if (!cohort || (degreeId && cohort.degree_id !== degreeId)) throw new Error('Cohort does not belong to degree');
      await tx.execute({ sql: 'UPDATE students SET cohort_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', args: [cohortId, studentId] });
      await tx.execute({ sql: `INSERT INTO academic_identity_events
        (id, student_id, old_degree_id, new_degree_id, old_cohort_id, new_cohort_id, actor_id, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, args: [randomUUID(), studentId, student.degree_id, cohort.degree_id, student.cohort_id, cohortId, actorId, reason.trim()] });
      return { ...student, degree_id: cohort.degree_id, cohort_id: cohortId };
    });
  },
};

module.exports = identityService;
