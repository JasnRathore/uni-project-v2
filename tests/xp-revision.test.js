/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');

const dbServicePath = require.resolve('../database/services/dbService.ts');
const portalStorePath = require.resolve('../lib/api/storage/portalStore.ts');
const studentServicePath = require.resolve('../lib/api/services/studentService.ts');
const xpServicePath = require.resolve('../lib/api/services/xpService.ts');

const dbService = require(dbServicePath);
let xpRows = [];
require.cache[dbServicePath].exports = {
  ...dbService,
  getDatabaseClient: () => ({
    execute: async query => {
      if (query.sql.includes('FROM students')) return { rows: [{ id: 'student-1', email: 'student@example.edu', name: 'A Student' }] };
      if (query.sql.includes('FROM classes')) {
        return { rows: [{ id: 'class-1', name: 'BDS 1 tutorial', teacher_id: 'teacher-1', subject_name: 'Oral Pathology' }] };
      }
      if (query.sql.includes('FROM xp_events')) return { rows: xpRows };
      return { rows: [] };
    },
  }),
};

require.cache[portalStorePath] = {
  id: portalStorePath,
  filename: portalStorePath,
  loaded: true,
  exports: {
    portalStore: {
      readStudentGrades: async () => [],
      writeStudentGrades: async () => {},
      readStudentTasks: async () => [],
      writeStudentTasks: async () => {},
      readTeacherGrades: async () => [],
      writeTeacherGrades: async () => {},
      readTaskGrades: async () => ({}),
      writeTaskGrades: async () => {},
      readNotifications: async () => [],
      writeNotifications: async () => {},
    },
  },
};

const xpService = require(xpServicePath);
let xpAwards = [];
require.cache[xpServicePath].exports = {
  ...xpService,
  awardXp: async input => {
    xpAwards.push(input);
    return { id: `xp-${xpAwards.length}`, ...input };
  },
};

const studentService = require(studentServicePath);
require.cache[studentServicePath].exports = { ...studentService, trackStudentActivity: async () => {} };

const { recordGrade } = require('../lib/api/services/gradeRecordingService.ts');

const recordRevision = score => recordGrade({
  student: { id: 'student-1', name: 'A Student' },
  task: { id: 'task-1', classId: 'class-1', title: 'Quiz 1', type: 'quiz' },
  teacherId: 'teacher-1',
  grade: score >= 90 ? 'A' : 'B',
  score,
  maxScore: 100,
});

test('the first grade awards one XP event under the stable key', async () => {
  xpRows = [];
  xpAwards = [];

  const grade = await recordRevision(95);

  assert.equal(grade.score, 95);
  assert.equal(xpAwards.length, 1);
  assert.equal(xpAwards[0].points, 110);
  assert.equal(xpAwards[0].sourceType, 'quiz');
  assert.equal(xpAwards[0].idempotencyKey, 'grade:student-1:task-1');
});

test('a revised grade reverses the prior event and awards the new value', async () => {
  xpRows = [{ id: 'xp-old', student_id: 'student-1', source_id: 'task-1', source_type: 'grade', points: 110 }];
  xpAwards = [];

  const grade = await recordRevision(80);

  assert.equal(grade.score, 80);
  const reversal = xpAwards.find(award => award.sourceType === 'reversal');
  assert.ok(reversal, 'expected a reversal XP event');
  assert.equal(reversal.points, -110);
  assert.equal(reversal.reversalOf, 'xp-old');
  assert.equal(reversal.idempotencyKey, 'reversal:xp-old');

  const award = xpAwards.find(award => award.sourceType === 'quiz');
  assert.ok(award, 'expected a fresh XP award');
  assert.equal(award.points, 85);
  assert.equal(award.idempotencyKey, 'grade:student-1:task-1:xp-old');
});

test('a resubmission with unchanged points writes no new XP events', async () => {
  xpRows = [{ id: 'xp-old', student_id: 'student-1', source_id: 'task-1', source_type: 'grade', points: 85 }];
  xpAwards = [];

  await recordRevision(80);

  assert.equal(xpAwards.length, 0);
});
