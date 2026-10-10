/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { isActiveStudent, normalizeLifecycleState } = require('../lib/api/services/studentState');

test('normalizes graduation and other non-active states to inactive', () => {
  assert.equal(normalizeLifecycleState('active'), 'active');
  assert.equal(normalizeLifecycleState('inactive'), 'inactive');
  assert.equal(normalizeLifecycleState('graduated'), 'inactive');
  assert.equal(normalizeLifecycleState('withdrawn'), 'inactive');
  assert.equal(normalizeLifecycleState(null), 'inactive');
});

test('only explicitly active students pass the active-student check', () => {
  assert.equal(isActiveStudent({ lifecycleState: 'active' }), true);
  assert.equal(isActiveStudent({ lifecycle_state: 'active' }), true);
  assert.equal(isActiveStudent({ lifecycleState: 'inactive' }), false);
  assert.equal(isActiveStudent({ lifecycle_state: 'graduated' }), false);
  assert.equal(isActiveStudent({}), false);
});

test('task assignment excludes inactive students from assignment and notification writes', async () => {
  const dbServicePath = require.resolve('../database/services/dbService');
  const portalStorePath = require.resolve('../lib/api/storage/portalStore');
  const assignmentPath = require.resolve('../lib/api/services/taskAssignmentService');
  const originalDbService = require.cache[dbServicePath];
  const originalPortalStore = require.cache[portalStorePath];
  const originalAssignmentService = require.cache[assignmentPath];
  const assignedEmails = [];
  const notifiedEmails = [];
  const studentRows = [
    { email: 'active@example.test', lifecycleState: 'active' },
    { email: 'inactive@example.test', lifecycleState: 'inactive' },
  ];
  const portalStore = {
    async readStudentTasks() { return []; },
    async writeStudentTasks(email) { assignedEmails.push(email); },
    async readNotifications() { return []; },
    async writeNotifications(email) { notifiedEmails.push(email); },
  };

  require.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: { readPortalData: async () => studentRows },
  };
  require.cache[portalStorePath] = {
    id: portalStorePath,
    filename: portalStorePath,
    loaded: true,
    exports: { portalStore },
  };
  delete require.cache[assignmentPath];

  try {
    const { assignTaskToStudents } = require(assignmentPath);
    const count = await assignTaskToStudents('teacher-1', { id: 'task-1', title: 'Quiz' });

    assert.equal(count, 1);
    assert.deepEqual(assignedEmails, ['active@example.test']);
    assert.deepEqual(notifiedEmails, ['active@example.test']);
  } finally {
    delete require.cache[assignmentPath];
    if (originalDbService) require.cache[dbServicePath] = originalDbService;
    else delete require.cache[dbServicePath];
    if (originalPortalStore) require.cache[portalStorePath] = originalPortalStore;
    else delete require.cache[portalStorePath];
    if (originalAssignmentService) require.cache[assignmentPath] = originalAssignmentService;
  }
});
