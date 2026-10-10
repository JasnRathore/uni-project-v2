const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');
const { ensureDatabaseSchema } = require('../database/services/schemaService');

const schema = fs.readFileSync(path.join(__dirname, '..', 'new_schema.sql'), 'utf8');
const { normalizeScore } = require('../lib/api/services/gradeRecordingService');
const authControllerSource = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'api', 'controllers', 'authController.js'),
  'utf8',
);
const studentControllerSource = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'api', 'controllers', 'studentController.js'),
  'utf8',
);
const routeRegistrySource = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'api', 'routeRegistry.ts'),
  'utf8',
);
const studentLeaderboardSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'StudentLeaderboard.tsx'),
  'utf8',
);
const classMembershipSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'StudentDetails.tsx'),
  'utf8',
);
const studentSignupSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'StudentSignup.tsx'),
  'utf8',
);
const studentsListSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'StudentsList.tsx'),
  'utf8',
);
const facultyDashboardSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'FacultyDashboard.tsx'),
  'utf8',
);

test('schema separates academic lifecycle state from game level', () => {
  assert.match(schema, /current_level\s+INTEGER/);
  assert.match(schema, /lifecycle_state\s+TEXT NOT NULL DEFAULT 'active'/);
  assert.match(schema, /CHECK \(lifecycle_state IN \('active', 'inactive'\)\)/);
  assert.doesNotMatch(schema, /\bstudent_status\b/);
  assert.doesNotMatch(schema, /student_lifecycle_events|schema_migrations/i);
  const studentTable = schema.match(/CREATE TABLE IF NOT EXISTS students \(([\s\S]*?)\n\);/)?.[1] || '';
  assert.doesNotMatch(schema, /\bacademic_year\b/);
});

test('schema retains effective membership dates', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS class_memberships/);
  assert.match(schema, /started_at\s+TEXT/);
  assert.match(schema, /ended_at\s+TEXT/);
});

test('grade normalization rejects unsupported values', () => {
  assert.equal(normalizeScore('A', undefined), 95);
  assert.equal(normalizeScore(undefined, 0), 0);
  assert.throws(() => normalizeScore('invalid', undefined), /valid number or supported letter grade/);
});

test('student signup does not reference removed class input', () => {
  assert.doesNotMatch(authControllerSource, /class:\s*className/);
});

test('schema defines controlled identity, class lifecycle, and append-only XP', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS degrees/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS graduation_cohorts/);
  assert.match(schema, /UNIQUE \(degree_id, label\)/);
  assert.match(schema, /class_status\s+TEXT NOT NULL DEFAULT 'active'/);
  assert.match(schema, /membership_status\s+TEXT NOT NULL DEFAULT 'active'/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS xp_events/);
  assert.match(schema, /idempotency_key\s+TEXT NOT NULL UNIQUE/);
});

test('departments are seeded and teacher profiles reference them by ID', async () => {
  const db = createClient({ url: 'file::memory:' });
  try {
    await ensureDatabaseSchema(db);
    const departments = (await db.execute(
      'SELECT id, name FROM departments ORDER BY name COLLATE NOCASE',
    )).rows;
    assert.deepEqual(departments.map(row => row.name), [
      'Conservative Dentistry', 'Oral Medicine', 'Oral Pathology', 'Oral Surgery',
      'Orthodontics', 'Pedodontics', 'Periodontics', 'Prosthodontics',
      'Public Health Dentistry',
    ]);
    const profileColumns = (await db.execute('PRAGMA table_info("teacher_profiles")'))
      .rows.map(row => row.name);
    assert(profileColumns.includes('department_id'));
    assert(!profileColumns.includes('department'));

    await db.execute("INSERT INTO users (id, email, password_hash, role) VALUES ('teacher-dept', 'dept@example.edu', 'hash', 'teacher')");
    await db.execute("INSERT INTO teacher_profiles (user_id, department_id) VALUES ('teacher-dept', 'oral-pathology')");
    await assert.rejects(db.execute(
      "INSERT INTO teacher_profiles (user_id, department_id) VALUES ('teacher-dept', 'not-a-department')",
    ));
  } finally {
    await db.close();
  }
});

test('schema initialization upgrades existing professor profiles and resolves known names', async () => {
  const db = createClient({ url: 'file::memory:' });
  try {
    await db.execute('PRAGMA foreign_keys = ON');
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute("INSERT INTO users (id, email, password_hash, role) VALUES ('legacy-teacher', 'legacy@example.edu', 'hash', 'teacher')");
    await db.execute(`CREATE TABLE teacher_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id), department TEXT, source_json TEXT NOT NULL DEFAULT '{}'
    )`);
    await db.execute("INSERT INTO teacher_profiles (user_id, department) VALUES ('legacy-teacher', 'Oral Pathology')");

    await ensureDatabaseSchema(db);

    const profile = (await db.execute(
      "SELECT department_id FROM teacher_profiles WHERE user_id='legacy-teacher'",
    )).rows[0];
    assert.equal(profile.department_id, 'oral-pathology');
    const profileColumns = (await db.execute('PRAGMA table_info("teacher_profiles")'))
      .rows.map(row => row.name);
    assert(!profileColumns.includes('department'));
  } finally {
    await db.close();
  }
});

test('teacher profile persistence uses department IDs and resolves display names', async () => {
  const previousTarget = process.env.DATABASE_TARGET;
  const previousLocalUrl = process.env.LOCAL_DATABASE_URL;
  process.env.DATABASE_TARGET = 'local';
  process.env.LOCAL_DATABASE_URL = 'file::memory:';
  const database = require('../database/services/dbService');
  try {
    await database.ensureDatabaseReady();
    const auth = database.getAuthService();
    const { data, error } = await auth.auth.admin.createUser({
      email: 'professor@example.edu',
      password: 'password',
      user_metadata: {
        name: 'Professor Example',
        role: 'teacher',
        departmentId: 'oral-pathology',
      },
    });
    assert.equal(error, null);

    const profile = await database.readPortalData(`teacher:${data.user.id}`);
    assert.equal(profile.departmentId, 'oral-pathology');
    assert.equal(profile.department, 'Oral Pathology');

    const update = await auth.auth.admin.updateUserById(data.user.id, {
      user_metadata: { departmentId: 'orthodontics' },
    });
    assert.equal(update.error, null);
    const updatedProfile = await database.readPortalData(`teacher:${data.user.id}`);
    assert.equal(updatedProfile.departmentId, 'orthodontics');
    assert.equal(updatedProfile.department, 'Orthodontics');
  } finally {
    await database.getDatabaseClient().close();
    if (previousTarget === undefined) delete process.env.DATABASE_TARGET;
    else process.env.DATABASE_TARGET = previousTarget;
    if (previousLocalUrl === undefined) delete process.env.LOCAL_DATABASE_URL;
    else process.env.LOCAL_DATABASE_URL = previousLocalUrl;
  }
});

test('student schema keeps normalized identity without legacy duplicates', () => {
  const studentTable = schema.match(/CREATE TABLE IF NOT EXISTS students \(([\s\S]*?)\n\);/)?.[1] || '';
  assert.doesNotMatch(studentTable, /\b(username|batch|admission_year|degree_id|academic_year)\b/i);
  assert.doesNotMatch(studentTable, /\broll_number\b/i);
  assert.match(studentTable, /\bprn\b/);
  assert.match(studentTable, /\bcohort_id\b/);
  assert.doesNotMatch(studentTable, /\bprogram_year_id\b/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS usernames/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS academic_identity_events/);
  assert.doesNotMatch(studentControllerSource, /'username'/);
});

test('fresh schema initialization is complete, idempotent, and enforces catalog relationships', async () => {
  const db = createClient({ url: 'file::memory:' });
  try {
    await ensureDatabaseSchema(db);
    await ensureDatabaseSchema(db);

    const tables = (await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    )).rows.map(row => row.name);
    assert(tables.includes('program_years'));
    assert(tables.includes('subjects'));
    assert(tables.includes('academic_identity_events'));
    assert(!tables.includes('schema_migrations'));
    assert(!tables.includes('student_lifecycle_events'));

    const studentColumns = (await db.execute('PRAGMA table_info("students")'))
      .rows.map(row => row.name);
    assert(studentColumns.includes('lifecycle_state'));
    assert(!studentColumns.includes('student_status'));
    assert(!studentColumns.includes('program_year_id'));
    const taskColumns = (await db.execute('PRAGMA table_info("tasks")'))
      .rows.map(row => row.name);
    const gradeColumns = (await db.execute('PRAGMA table_info("grades")'))
      .rows.map(row => row.name);
    assert(!taskColumns.includes('subject'));
    assert(!gradeColumns.includes('subject'));
    assert(!gradeColumns.includes('student_email'));
    assert(taskColumns.includes('class_id'));
    assert(gradeColumns.includes('class_id'));

    await db.execute("INSERT INTO users (id, email, password_hash, role) VALUES ('teacher', 't@example.edu', 'hash', 'teacher')");
    await db.execute("INSERT INTO degrees (id, name) VALUES ('degree-1', 'Degree 1'), ('degree-2', 'Degree 2')");
    await db.execute("INSERT INTO program_years (id, degree_id, label) VALUES ('year-1', 'degree-1', 'Year 1'), ('year-2', 'degree-1', 'Year 2'), ('year-other', 'degree-2', 'Year 1')");
    await db.execute("INSERT INTO subjects (id, degree_id, program_year_id, name) VALUES ('subject-1', 'degree-1', 'year-1', 'Anatomy')");
    await assert.rejects(db.execute(
      "INSERT INTO subjects (id, degree_id, program_year_id, name) VALUES ('bad-subject', 'degree-2', 'year-1', 'Anatomy')",
    ));
    await assert.rejects(db.execute(
      "INSERT INTO subjects (id, degree_id, program_year_id, name) VALUES ('duplicate-subject', 'degree-1', 'year-1', 'anatomy')",
    ));
    await db.execute("INSERT INTO subjects (id, degree_id, program_year_id, name) VALUES ('subject-2', 'degree-1', 'year-2', 'Anatomy')");

    await db.execute("INSERT INTO classes (id, teacher_id, name, subject_id) VALUES ('class-1', 'teacher', 'Class 1', 'subject-1'), ('class-2', 'teacher', 'Class 2', 'subject-1')");
    await assert.rejects(db.execute(
      "INSERT INTO tasks (id, title) VALUES ('no-class-task', 'Needs a class')",
    ));
    await db.execute("INSERT INTO tasks (id, class_id, title) VALUES ('task-1', 'class-1', 'Task 1')");
    await db.execute("INSERT INTO students (id, email) VALUES ('student-1', 'student@example.edu')");
    await assert.rejects(db.execute(
      "INSERT INTO students (id, email, lifecycle_state) VALUES ('student-2', 'student2@example.edu', 'graduated')",
    ));
    await assert.rejects(db.execute(
      "INSERT INTO grades (id, student_id, grade) VALUES ('no-class-grade', 'student-1', 'A')",
    ));
    await db.execute("INSERT INTO grades (id, student_id, class_id, grade) VALUES ('grade-1', 'student-1', 'class-1', 'A')");
  } finally {
    await db.close();
  }
});

test('route registry exposes scoped academic and game boundaries', () => {
  assert.match(routeRegistrySource, /\/admin\/degrees/);
  assert.match(routeRegistrySource, /\/academic\/departments/);
  assert.match(routeRegistrySource, /\/teacher\/classes\/:classId\/memberships/);
  assert.match(routeRegistrySource, /\/leaderboards\/cohort/);
  assert.match(routeRegistrySource, /\/student\/leaderboards\/classes/);
  assert.match(routeRegistrySource, /\/game\/progression/);
  assert.match(routeRegistrySource, /\/game\/rewards/);
});

test('student leaderboard offers cohort and active class scopes', () => {
  assert.match(studentLeaderboardSource, /\/api\/student\/leaderboards\/classes/);
  assert.match(studentLeaderboardSource, /\/api\/student\/leaderboards\/cohort/);
  assert.match(studentLeaderboardSource, /Class rankings/);
});

test('teacher assignment writes authoritative class memberships', () => {
  assert.match(classMembershipSource, /\/api\/teacher\/classes\/\$\{encodeURIComponent\(selectedAvailableClassId\)\}\/memberships/);
});

test('professors open student details with their scoped class memberships', () => {
  assert.match(facultyDashboardSource, /setActiveView\('student-details'/);
  assert.match(classMembershipSource, /student\.classMemberships/);
  assert.match(classMembershipSource, /Classes this professor has added the student to/);
  assert.match(classMembershipSource, /Only your active classes are available/);
  assert.match(classMembershipSource, /Programme and cohort/);
  assert.doesNotMatch(classMembershipSource, /label: '(?:Batch|Department|Semester|Specialization|Qualification|Academic year|Admission year)'/);
});

test('student identity is labeled and submitted as PRN', () => {
  assert.match(classMembershipSource, /label: 'PRN', value: student\.prn/);
  assert.match(studentSignupSource, /htmlFor="prn"[\s\S]*?PRN/);
  assert.match(studentSignupSource, /prn: formData\.prn\.trim\(\)/);
  assert.doesNotMatch(studentSignupSource, /formData\.rollNumber/);
});

test('student filters use database cohorts instead of hardcoded BDS years', () => {
  assert.match(routeRegistrySource, /\/academic\/cohorts/);
  assert.match(studentsListSource, /\/api\/academic\/cohorts/);
  assert.match(studentsListSource, /student\.cohortId === cohortFilter/);
  assert.doesNotMatch(studentsListSource, /I BDS|II BDS|III BDS|IV BDS/);
});

test('student directory uses portal accounts without roster-only registration filters', () => {
  assert.match(facultyDashboardSource, /return registeredStudents\.filter/);
  assert.doesNotMatch(studentsListSource, /Portal accounts|Roster entries|RegistrationFilter|registrationFilter/);
  assert.doesNotMatch(facultyDashboardSource, /handleAddStudent|AddStudent|add-student/);
});



test('faculty routes use /faculty/dashboard path canonical and /teacher/* API backend', () => {
  assert.match(facultyDashboardSource, /\/faculty\/dashboard/);
  assert.match(facultyDashboardSource, /\/api\/teacher\//);
  assert.doesNotMatch(facultyDashboardSource, /userRole\s*!==\s*[''"]teacher['""]/);
});

test('portal copy references faculty terminology and not admin portal', () => {
  const portalLandingSource = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'PortalLanding.tsx'),
    'utf8',
  );
  const studentLoginSource = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'StudentLogin.tsx'),
    'utf8',
  );
  assert.match(portalLandingSource, /Faculty portal/);
  assert.match(portalLandingSource, /\/faculty\/login/);
  assert.match(studentLoginSource, /Faculty Portal/);
  assert.doesNotMatch(portalLandingSource, /Admin Portal|Admin Panel/);
  assert.doesNotMatch(studentLoginSource, /Admin Portal|onSwitchToAdmin/);
});

test('legacy admin pages redirect to the corresponding faculty routes', () => {
  const readAppFile = (...segments) => fs.readFileSync(
    path.join(__dirname, '..', 'app', ...segments),
    'utf8',
  );
  const dashboardAlias = readAppFile('admin', 'dashboard', '[[...section]]', 'page.tsx');
  const loginAlias = readAppFile('admin', 'login', 'page.tsx');
  const signupAlias = readAppFile('admin', 'signup', 'page.tsx');
  const facultyDashboardRoute = readAppFile('faculty', 'dashboard', '[[...section]]', 'page.tsx');
  const facultyLoginRoute = readAppFile('faculty', 'login', 'page.tsx');
  const facultySignupRoute = readAppFile('faculty', 'signup', 'page.tsx');

  assert.match(dashboardAlias, /redirect\(`\/faculty\/dashboard\$\{suffix\}`\)/);
  assert.match(dashboardAlias, /section\.map\(segment => encodeURIComponent\(segment\)\)/);
  assert.match(loginAlias, /redirect\('\/faculty\/login'\)/);
  assert.match(signupAlias, /redirect\('\/faculty\/signup'\)/);
  assert.match(facultyDashboardRoute, /FacultyDashboardPage/);
  assert.match(facultyLoginRoute, /FacultyAuthPage/);
  assert.match(facultySignupRoute, /FacultyAuthPage/);
});

test('student notifications are opened from the sidebar', () => {
  const studentLayoutSource = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'student', 'dashboard', 'layout.tsx'),
    'utf8',
  );
  const studentDashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'StudentDashboard.tsx'),
    'utf8',
  );

  assert.match(studentLayoutSource, /SidebarGroupLabel>Updates<\/SidebarGroupLabel>/);
  assert.match(studentLayoutSource, /Notifications\$\{unreadCount/);
  assert.match(studentLayoutSource, /\/api\/student\/notifications/);
  assert.match(studentLayoutSource, /Dialog open=\{showNotifications\}/);
  assert.doesNotMatch(studentDashboardSource, /setShowNotifications|Notifications Dialog/);
});
