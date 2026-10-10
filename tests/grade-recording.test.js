/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');

const dbServicePath = require.resolve('../database/services/dbService');
const portalStorePath = require.resolve('../lib/api/storage/portalStore');
const studentServicePath = require.resolve('../lib/api/services/studentService');
const xpServicePath = require.resolve('../lib/api/services/xpService');
const dbService = require(dbServicePath);
require(portalStorePath);
const studentService = require(studentServicePath);
const xpService = require(xpServicePath);
let dbQueries = [];
let storedGrades;

require.cache[dbServicePath].exports = {
  ...dbService,
  getDatabaseClient: () => ({
    execute: async query => {
      dbQueries.push(query);
      if (query.sql.includes('FROM students')) return { rows: [{ id: 'student-1', email: 'student@example.edu', name: 'A Student' }] };
      if (query.sql.includes('FROM classes')) {
        return { rows: [{ id: 'class-1', name: 'BDS 1 tutorial', teacher_id: 'teacher-1', subject_name: 'Oral Pathology' }] };
      }
      return { rows: [] };
    },
  }),
};

const createStore = () => ({
  readStudentGrades: async () => [],
  writeStudentGrades: async (_email, grades) => { storedGrades = grades; },
  readStudentTasks: async () => [],
  writeStudentTasks: async () => assert.fail('A class grade without a task must not write task assignments'),
  readTeacherGrades: async () => [],
  writeTeacherGrades: async () => {},
  readTaskGrades: async () => ({}),
  writeTaskGrades: async () => assert.fail('A class grade without a task must not write task grades'),
  readNotifications: async () => [],
  writeNotifications: async () => {},
});

require.cache[portalStorePath].exports = { portalStore: createStore() };
require.cache[studentServicePath].exports = { ...studentService, trackStudentActivity: async () => {} };
require.cache[xpServicePath].exports = { ...xpService, awardXp: async () => {} };
const { recordGrade } = require('../lib/api/services/gradeRecordingService');

test('a grade can be recorded for a class without linking a task or duplicating student email', async () => {
  dbQueries = [];
  storedGrades = undefined;

  const grade = await recordGrade({
    student: { id: 'student-1', name: 'A Student' },
    classId: 'class-1',
    teacherId: 'teacher-1',
    assignment: 'Practical exam',
    assignment: 'Practical exam',
    grade: 'A',
    score: 95,
    maxScore: 100,
  });

  assert.equal(grade.studentId, 'student-1');
  assert.equal(grade.classId, 'class-1');
  assert.equal(grade.taskId, null);
  assert.equal(grade.assignment, 'Practical exam');
  assert.equal(grade.subject, 'Oral Pathology');
  assert.equal(Object.hasOwn(grade, 'studentEmail'), false);
  assert.equal(storedGrades[0].id, grade.id);
  assert.ok(dbQueries.every(query => !/student_email/i.test(query.sql)));
});

test('recording a grade without a student ID and class is rejected', async () => {
  await assert.rejects(
    recordGrade({ student: { email: 'student@example.edu' }, grade: 80 }),
    /student ID and class are required/,
  );
});
