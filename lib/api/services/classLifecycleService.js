const { randomUUID } = require('node:crypto');
const { getDatabaseClient, withTransaction } = require('../../../database/services/dbService');

const classLifecycleService = {
  async transition({ classId, teacherId, status, startsAt, endsAt }) {
    if (!['active', 'completed', 'archived'].includes(status)) throw new Error('Invalid class status');
    return withTransaction(async tx => {
      const current = (await tx.execute({ sql: 'SELECT * FROM classes WHERE id=? AND teacher_id=?', args: [classId, teacherId] })).rows[0];
      if (!current) throw new Error('Class not found');
      await tx.execute({ sql: `UPDATE classes SET class_status=?, starts_at=COALESCE(?, starts_at),
        ends_at=COALESCE(?, ends_at) WHERE id=? AND teacher_id=?`, args: [status, startsAt || null, endsAt || null, classId, teacherId] });
      if (status !== 'active') await tx.execute({ sql: "UPDATE class_memberships SET membership_status='ended', status='ended', ended_at=COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE class_id=? AND membership_status='active'", args: [classId] });
      return { ...current, class_status: status };
    });
  },
  async addMembership({ classId, studentId, teacherId, actorId }) {
    return withTransaction(async tx => {
      const klass = (await tx.execute({ sql: "SELECT id FROM classes WHERE id=? AND teacher_id=? AND class_status='active'", args: [classId, teacherId] })).rows[0];
      if (!klass) throw new Error('Active class not found or not owned by teacher');
      const student = (await tx.execute({ sql: "SELECT id FROM students WHERE id=? AND lifecycle_state='active'", args: [studentId] })).rows[0];
      if (!student) throw new Error('Active student not found');
      await tx.execute({ sql: `INSERT INTO class_memberships
        (teacher_id, student_id, class_id, status, membership_status, created_by, started_at, assigned_at, updated_at)
        VALUES (?, ?, ?, 'active', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(teacher_id, student_id, class_id) DO UPDATE SET
          status='active', membership_status='active', ended_at=NULL, updated_at=CURRENT_TIMESTAMP`,
        args: [teacherId, studentId, classId, actorId || teacherId] });
      await tx.execute({ sql: `INSERT INTO teacher_students
        (teacher_id, student_id, class_id, status, started_at, assigned_at, updated_at)
        VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(teacher_id, student_id) DO UPDATE SET
          class_id=excluded.class_id, status='active', ended_at=NULL,
          started_at=COALESCE(teacher_students.started_at, excluded.started_at),
          assigned_at=excluded.assigned_at, updated_at=CURRENT_TIMESTAMP`,
        args: [teacherId, studentId, classId] });
      return { classId, studentId, status: 'active' };
    });
  },
  async endMembership({ classId, studentId, teacherId, status = 'ended' }) {
    if (!['ended', 'withdrawn'].includes(status)) throw new Error('Invalid membership status');
    return withTransaction(async tx => {
      const result = await tx.execute({ sql: `UPDATE class_memberships SET status=?, membership_status=?, ended_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE class_id=? AND student_id=? AND teacher_id=? AND membership_status='active'`, args: [status, status, classId, studentId, teacherId] });
      if (!result.rowsAffected) throw new Error('Active membership not found');
      const replacement = (await tx.execute({ sql: `SELECT class_id FROM class_memberships
        WHERE teacher_id=? AND student_id=? AND membership_status='active'
        ORDER BY updated_at DESC, class_id LIMIT 1`, args: [teacherId, studentId] })).rows[0];
      await tx.execute({ sql: `UPDATE teacher_students SET class_id=?, status=?, ended_at=?,
        updated_at=CURRENT_TIMESTAMP WHERE teacher_id=? AND student_id=?`,
        args: [replacement?.class_id || null, replacement ? 'active' : status,
          replacement ? null : new Date().toISOString(), teacherId, studentId] });
      return { classId, studentId, status };
    });
  },
  async getClass(classId) {
    return (await getDatabaseClient().execute({ sql: 'SELECT * FROM classes WHERE id=?', args: [classId] })).rows[0] || null;
  },
};

module.exports = classLifecycleService;
