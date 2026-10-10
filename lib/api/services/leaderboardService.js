const { getDatabaseClient } = require('../../../database/services/dbService');

const getActiveClasses = async studentId => {
  const db = getDatabaseClient();
  const result = await db.execute({
    sql: `SELECT DISTINCT c.id, c.name, c.subject
      FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id AND c.teacher_id = cm.teacher_id
      JOIN students s ON s.id = cm.student_id
      WHERE cm.student_id = ?
        AND cm.membership_status = 'active'
        AND c.class_status = 'active'
        AND s.lifecycle_state = 'active'
      ORDER BY c.name COLLATE NOCASE, c.id`,
    args: [studentId],
  });
  return result.rows;
};

const leaderboard = async ({ studentId, scope, scopeId }) => {
  const db = getDatabaseClient();
  const current = (await db.execute({
    sql: `SELECT s.id, s.cohort_id, c.label AS cohort_label, d.name AS degree_name
      FROM students s
      LEFT JOIN graduation_cohorts c ON c.id = s.cohort_id
      LEFT JOIN degrees d ON d.id = c.degree_id
      WHERE s.id = ? AND s.lifecycle_state = 'active'`,
    args: [studentId],
  })).rows[0];
  if (!current) throw new Error('Student not found');
  let where = "s.lifecycle_state='active'";
  const args = [];
  let label = scope;
  let scopeName = scope;
  if (scope === 'cohort') {
    if (!current.cohort_id) return {
      scope, scopeId: null, scopeName: null, rulesetVersion: 'v1',
      calculatedAt: new Date().toISOString(), entries: [],
    };
    where += ' AND s.cohort_id=?';
    args.push(current.cohort_id);
    label = current.cohort_id;
    scopeName = [current.degree_name, current.cohort_label].filter(Boolean).join(' · ');
  } else if (scope === 'class') {
    const classResult = await db.execute({
      sql: `SELECT c.id, c.name FROM classes c
        JOIN class_memberships cm ON cm.class_id = c.id AND cm.teacher_id = c.teacher_id
        WHERE c.id = ? AND c.class_status = 'active'
          AND cm.student_id = ? AND cm.membership_status = 'active'`,
      args: [scopeId, studentId],
    });
    const allowed = classResult.rows[0];
    if (!allowed) throw new Error('Class leaderboard access denied');
    where += ` AND EXISTS (SELECT 1 FROM class_memberships cm WHERE cm.class_id=? AND cm.student_id=s.id AND cm.membership_status='active')`;
    args.push(scopeId);
    label = scopeId;
    scopeName = allowed.name;
  } else throw new Error('Invalid leaderboard scope');
  const result = await db.execute({ sql: `SELECT s.id, s.name, COALESCE(SUM(x.points),0) AS leaderboard_xp
    FROM students s LEFT JOIN xp_events x ON x.student_id=s.id WHERE ${where}
    GROUP BY s.id ORDER BY leaderboard_xp DESC, s.name COLLATE NOCASE, s.id`, args });
  let last = null; let rank = 0;
  const entries = result.rows.map((row, index) => {
    if (Number(row.leaderboard_xp) !== last) rank = index + 1;
    last = Number(row.leaderboard_xp);
    return { studentId: row.id, displayName: row.name || 'Student', leaderboardXp: Number(row.leaderboard_xp), rank, isCurrentStudent: row.id === studentId };
  });
  return {
    scope,
    scopeId: label,
    scopeName,
    rulesetVersion: 'v1',
    calculatedAt: new Date().toISOString(),
    entries,
  };
};

module.exports = { getLeaderboard: leaderboard, getActiveClasses };
