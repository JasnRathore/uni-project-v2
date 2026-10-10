const { getDatabaseClient } = require('../../../database/services/dbService');
const { getProgression, awardXp } = require('../services/xpService');
const { getLeaderboard, getActiveClasses } = require('../services/leaderboardService');

const studentIdFor = async user => (await getDatabaseClient().execute({
  sql: "SELECT id FROM students WHERE (user_id=? OR email=? COLLATE NOCASE) AND lifecycle_state='active'",
  args: [user.id, user.email],
})).rows[0]?.id;

const progression = async (req, res) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  return res.json({ progression: await getProgression(studentId) });
};
const reward = async (req, res) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  const { points, sourceId, idempotencyKey } = req.body || {};
  if (Number(points) <= 0 || Number(points) > 100 || !sourceId || !idempotencyKey) return res.status(400).json({ error: 'Valid bounded reward fields are required' });
  try {
    const event = await awardXp({ studentId, points: Math.trunc(Number(points)), sourceApplication: 'game', sourceType: 'achievement', sourceId, idempotencyKey, createdBy: req.user.id });
    return res.status(201).json({ event, progression: await getProgression(studentId) });
  } catch (e) { return res.status(400).json({ error: e.message }); }
};
const leaderboard = async (req, res) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  try { return res.json(await getLeaderboard({ studentId, scope: req.params.scope, scopeId: req.params.scopeId })); } catch (e) { return res.status(403).json({ error: e.message }); }
};
const cohortLeaderboard = (req, res) => leaderboard({ ...req, params: { scope: 'cohort' } }, res);
const classLeaderboard = (req, res) => leaderboard({ ...req, params: { scope: 'class', scopeId: req.params.classId } }, res);
const activeClasses = async (req, res) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  return res.json({ classes: await getActiveClasses(studentId) });
};
module.exports = { progression, reward, leaderboard, cohortLeaderboard, classLeaderboard, activeClasses };
