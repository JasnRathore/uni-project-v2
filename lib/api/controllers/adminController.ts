/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const identity = require('../services/academicIdentityService.ts');
const catalog = require('../services/academicCatalogService.ts');
const { getDatabaseClient } = require('../../../database/services/dbService.ts');

const requireAdmin = (req: any, res: any) => {
  const role = req.user?.user_metadata?.role;
  if (!['admin', 'administrator'].includes(role)) {
    res.status(403).json({ error: 'Administrator access required' });
    return false;
  }
  return true;
};

const listPublicDegrees = async (_req: any, res: any) => {
  return res.json({ degrees: await identity.listDegrees(false) });
};
const listPublicCohorts = async (req: any, res: any) => {
  return res.json({ cohorts: await identity.listCohorts(req.params.degreeId, false) });
};
const listAllPublicCohorts = async (_req: any, res: any) => {
  const result = await getDatabaseClient().execute({
    sql: `SELECT c.id, c.degree_id, c.label, d.name AS degree_name
      FROM graduation_cohorts c
      JOIN degrees d ON d.id = c.degree_id
      WHERE c.status = 'active' AND d.status = 'active'
      ORDER BY d.name COLLATE NOCASE, c.label COLLATE NOCASE`,
  });
  return res.json({ cohorts: result.rows });
};
const listPublicDepartments = async (_req: any, res: any) => {
  const result = await getDatabaseClient().execute({
    sql: 'SELECT id, name FROM departments ORDER BY name COLLATE NOCASE',
  });
  return res.json({ departments: result.rows });
};
const listPublicProgramYears = async (req: any, res: any) => {
  return res.json({ programYears: await catalog.listProgramYears(req.params.degreeId) });
};
const listPublicSubjects = async (req: any, res: any) => {
  return res.json({ subjects: await catalog.listSubjects(req.params.programYearId) });
};

const listDegrees = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ degrees: await identity.listDegrees(req.body?.includeInactive) });
};
const listProgramYears = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ programYears: await catalog.listProgramYears(req.params.degreeId, req.query?.includeInactive === 'true') });
};
const createProgramYear = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { return res.status(201).json({ programYear: await catalog.createProgramYear({ ...req.body, degreeId: req.params.degreeId }) }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const createSubject = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { return res.status(201).json({ subject: await catalog.createSubject({ ...req.body, programYearId: req.params.programYearId }) }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const createDegree = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { return res.status(201).json({ degree: await identity.createDegree(req.body || {}) }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const updateDegree = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { const degree = await identity.setDegreeStatus(req.params.degreeId, req.body?.status); return degree ? res.json({ degree }) : res.status(404).json({ error: 'Degree not found' }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const listCohorts = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ cohorts: await identity.listCohorts(req.params.degreeId, req.body?.includeInactive) });
};
const createCohort = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { return res.status(201).json({ cohort: await identity.createCohort({ ...req.body, degreeId: req.params.degreeId }) }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const updateCohort = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { const cohort = await identity.setCohortStatus(req.params.cohortId, req.body?.status); return cohort ? res.json({ cohort }) : res.status(404).json({ error: 'Cohort not found' }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};
const assignStudent = async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;
  try { return res.json({ student: await identity.assignStudent({ ...req.body, studentId: req.params.studentId, actorId: req.user.id }) }); } catch (e: any) { return res.status(400).json({ error: e.message }); }
};

module.exports = {
  listPublicDegrees,
  listPublicCohorts,
  listAllPublicCohorts,
  listPublicDepartments,
  listPublicProgramYears,
  listPublicSubjects,
  listDegrees,
  listProgramYears,
  createProgramYear,
  createSubject,
  createDegree,
  updateDegree,
  listCohorts,
  createCohort,
  updateCohort,
  assignStudent,
};
