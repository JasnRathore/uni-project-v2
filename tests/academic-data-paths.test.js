/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dbServicePath = require.resolve('../database/services/dbService');
const originalDbService = require(dbServicePath);
let queries = [];
let mockDatabase;

require.cache[dbServicePath].exports = {
  ...originalDbService,
  getDatabaseClient: () => mockDatabase,
};
const catalog = require('../lib/api/services/academicCatalogService');

const result = rows => ({ rows });

test('program years are listed within the selected degree and exclude inactive catalog rows', async () => {
  queries = [];
  mockDatabase = {
    execute: async query => {
      queries.push(query);
      return result([{ id: 'py-bds1', degree_id: 'degree-bds', label: 'BDS 1' }]);
    },
  };

  const years = await catalog.listProgramYears('degree-bds');

  assert.equal(years[0].label, 'BDS 1');
  assert.match(queries[0].sql, /p\.degree_id = \?/);
  assert.match(queries[0].sql, /p\.status = 'active'/);
  assert.match(queries[0].sql, /d\.status = 'active'/);
  assert.deepEqual(queries[0].args, ['degree-bds']);
});

test('program-year creation verifies an active degree and trims its label', async () => {
  queries = [];
  mockDatabase = {
    execute: async query => {
      queries.push(query);
      if (query.sql.includes('SELECT id FROM degrees')) return result([{ id: 'degree-bds' }]);
      if (query.sql.includes('SELECT * FROM program_years')) {
        return result([{ id: query.args[0], degree_id: 'degree-bds', label: 'BDS 1' }]);
      }
      return result([]);
    },
  };

  const year = await catalog.createProgramYear({ degreeId: 'degree-bds', label: ' BDS 1 ' });

  assert.equal(year.label, 'BDS 1');
  const insert = queries.find(query => query.sql.includes('INSERT INTO program_years'));
  assert.deepEqual(insert.args.slice(1), ['degree-bds', 'BDS 1']);
  assert.match(queries[0].sql, /status = 'active'/);
});

test('subject creation takes degree ownership from its program year', async () => {
  queries = [];
  mockDatabase = {
    execute: async query => {
      queries.push(query);
      if (query.sql.includes('SELECT p.id, p.degree_id')) {
        return result([{ id: 'py-bds1', degree_id: 'degree-bds' }]);
      }
      if (query.sql.includes('SELECT s.id, s.degree_id')) {
        return result([{
          id: query.args[0], degree_id: 'degree-bds',
          program_year_id: 'py-bds1', name: 'Oral Pathology',
        }]);
      }
      return result([]);
    },
  };

  const subject = await catalog.createSubject({
    programYearId: 'py-bds1',
    degreeId: 'degree-other',
    name: ' Oral Pathology ',
  });

  assert.equal(subject.degree_id, 'degree-bds');
  assert.equal(subject.program_year_id, 'py-bds1');
  const insert = queries.find(query => query.sql.includes('INSERT INTO subjects'));
  assert.deepEqual(insert.args.slice(1), ['degree-bds', 'py-bds1', 'Oral Pathology']);
});

test('the academic catalog API exposes public catalog reads and admin writes', () => {
  const routeRegistry = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'api', 'routeRegistry.ts'),
    'utf8',
  );
  for (const route of [
    '/academic/degrees/:degreeId/program-years',
    '/academic/program-years/:programYearId/subjects',
    '/admin/degrees/:degreeId/program-years',
    '/admin/program-years/:programYearId/subjects',
    '/teacher/classes/create',
  ]) {
    assert.ok(routeRegistry.includes(route), `expected route ${route}`);
  }
});

test('application persistence derives subject and grade identity through classes and student IDs', () => {
  const adapter = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'services', 'relationalDataService.js'),
    'utf8',
  );
  const teacherController = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'api', 'controllers', 'teacherController.js'),
    'utf8',
  );
  assert.match(adapter, /subject_id/);
  assert.match(adapter, /FROM grades g JOIN students st ON st\.id = g\.student_id/);
  assert.match(adapter, /Every task requires a class/);
  assert.match(adapter, /Every grade requires a class/);
  assert.doesNotMatch(adapter, /grades WHERE student_email/);
  assert.match(teacherController, /student ID, class, and assignment/);
});
