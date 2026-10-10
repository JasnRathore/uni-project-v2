const { randomUUID } = require('node:crypto');
const { getDatabaseClient, withTransaction } = require('../../../database/services/dbService');

const tierFor = xp => xp >= 2000 ? 'master' : xp >= 1000 ? 'expert' : xp >= 500 ? 'scholar' : 'novice';

async function awardXp({ studentId, points, sourceApplication = 'portal', sourceType = 'bonus', sourceId = null, idempotencyKey, createdBy = null, rulesetVersion = 'v1', reversalOf = null }) {
  const amount = Number(points);
  if (!Number.isInteger(amount) || !idempotencyKey) throw new Error('Integer points and idempotencyKey are required');
  return withTransaction(async tx => {
    const existing = (await tx.execute({ sql: 'SELECT * FROM xp_events WHERE idempotency_key=?', args: [idempotencyKey] })).rows[0];
    if (existing) return existing;
    const student = (await tx.execute({ sql: "SELECT id FROM students WHERE id=? AND lifecycle_state='active'", args: [studentId] })).rows[0];
    if (!student) throw new Error('Student not found');
    const id = randomUUID();
    await tx.execute({ sql: `INSERT INTO xp_events
      (id, student_id, source_application, source_type, source_id, points, ruleset_version, idempotency_key, created_by, reversal_of)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, studentId, sourceApplication, sourceType, sourceId, amount, rulesetVersion, idempotencyKey, createdBy, reversalOf] });
    const total = (await tx.execute({ sql: 'SELECT COALESCE(SUM(points),0) AS total FROM xp_events WHERE student_id=?', args: [studentId] })).rows[0].total;
    await tx.execute({ sql: `UPDATE students SET total_points=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, args: [total, studentId] });
    await tx.execute({ sql: `INSERT INTO progression_states (student_id, progression_xp, tier, buff_entitlement)
      VALUES (?, ?, ?, ?) ON CONFLICT(student_id) DO UPDATE SET progression_xp=excluded.progression_xp,
      tier=excluded.tier, updated_at=CURRENT_TIMESTAMP`, args: [studentId, total, tierFor(total), tierFor(total) === 'master' ? 'xp-boost' : null] });
    return (await tx.execute({ sql: 'SELECT * FROM xp_events WHERE id=?', args: [id] })).rows[0];
  });
}

async function getProgression(studentId) {
  const db = getDatabaseClient();
  const state = (await db.execute({ sql: 'SELECT * FROM progression_states WHERE student_id=?', args: [studentId] })).rows[0];
  const total = (await db.execute({ sql: 'SELECT COALESCE(SUM(points),0) AS total FROM xp_events WHERE student_id=?', args: [studentId] })).rows[0].total;
  return { leaderboardXp: Number(total), tier: state?.tier || tierFor(Number(total)), buffEntitlement: state?.buff_entitlement || null, rulesetVersion: 'v1' };
}

module.exports = { awardXp, getProgression, tierFor };
