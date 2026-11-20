/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const { getDatabaseClient } = require('../../../database/services/dbService.ts');
const { getProgression, awardXp } = require('../services/xpService.ts');
const { getLeaderboard, getActiveClasses } = require('../services/leaderboardService.ts');

const studentIdFor = async (user: any) => (await getDatabaseClient().execute({
  sql: "SELECT id FROM students WHERE (user_id=? OR email=? COLLATE NOCASE) AND lifecycle_state='active'",
  args: [user.id, user.email],
})).rows[0]?.id;

const progression = async (req: any, res: any) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  return res.json({ progression: await getProgression(studentId) });
};
const reward = async (req: any, res: any) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  const { points, sourceId, idempotencyKey } = req.body || {};
  if (Number(points) <= 0 || Number(points) > 100 || !sourceId || !idempotencyKey) return res.status(400).json({ error: 'Valid bounded reward fields are required' });
  try {
    const event = await awardXp({ studentId, points: Math.trunc(Number(points)), sourceApplication: 'game', sourceType: 'achievement', sourceId, idempotencyKey, createdBy: req.user.id });
    return res.status(201).json({ event, progression: await getProgression(studentId) });
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const leaderboard = async (req: any, res: any) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  try { return res.json(await getLeaderboard({ studentId, scope: req.params.scope, scopeId: req.params.scopeId })); } catch (e: any) { return res.status(403).json({ error: e.message }); }
};
const cohortLeaderboard = (req: any, res: any) => leaderboard({ ...req, params: { scope: 'cohort' } }, res);
const classLeaderboard = (req: any, res: any) => leaderboard({ ...req, params: { scope: 'class', scopeId: req.params.classId } }, res);
const activeClasses = async (req: any, res: any) => {
  const studentId = await studentIdFor(req.user);
  if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
  return res.json({ classes: await getActiveClasses(studentId) });
};
module.exports = { progression, reward, leaderboard, cohortLeaderboard, classLeaderboard, activeClasses };
