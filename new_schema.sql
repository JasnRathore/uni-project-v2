-- Canonical SQLite/Turso schema for the dental-college portal.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL,
    metadata_json   TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO departments (id, name) VALUES
    ('oral-pathology', 'Oral Pathology'),
    ('orthodontics', 'Orthodontics'),
    ('conservative-dentistry', 'Conservative Dentistry'),
    ('prosthodontics', 'Prosthodontics'),
    ('periodontics', 'Periodontics'),
    ('oral-surgery', 'Oral Surgery'),
    ('pedodontics', 'Pedodontics'),
    ('public-health-dentistry', 'Public Health Dentistry'),
    ('oral-medicine', 'Oral Medicine');

CREATE TABLE IF NOT EXISTS teacher_profiles (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    department_id   TEXT REFERENCES departments(id) ON DELETE RESTRICT,
    specialization  TEXT,
    qualification   TEXT,
    experience      TEXT,
    phone           TEXT,
    address         TEXT,
    bio             TEXT,
    join_date       TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}'
);

-- A student can have a portal account or only a teacher-managed roster entry.
-- A single canonical student row is shared by all teachers who manage that student.
CREATE TABLE IF NOT EXISTS students (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    email               TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name                TEXT NOT NULL DEFAULT '',
    prn                 TEXT,
    current_level       INTEGER NOT NULL DEFAULT 1,
    cohort_id           TEXT REFERENCES graduation_cohorts(id) ON DELETE SET NULL,
    lifecycle_state     TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_state IN ('active', 'inactive')),
    total_points        INTEGER NOT NULL DEFAULT 0,
    game_progress       REAL NOT NULL DEFAULT 0,
    last_active_at      TEXT,
    registered_at       TEXT,
    profile_json        TEXT NOT NULL DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_lifecycle ON students(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_students_cohort ON students(cohort_id);

CREATE TABLE IF NOT EXISTS classes (
    id              TEXT PRIMARY KEY,
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    description     TEXT,
    grade           TEXT,
    capacity        INTEGER,
    class_status    TEXT NOT NULL DEFAULT 'active'
        CHECK (class_status IN ('active', 'completed', 'archived')),
    starts_at       TEXT,
    ends_at         TEXT,
    created_at      TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}',
    UNIQUE (id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(class_status);

-- Replaces each teacher's students:<teacherId> and teacher_students:<teacherId>
-- arrays. class_id is nullable for students who have not been assigned to a class.
CREATE TABLE IF NOT EXISTS teacher_students (
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        TEXT REFERENCES classes(id) ON DELETE SET NULL,
    status          TEXT,
    started_at      TEXT,
    ended_at        TEXT,
    assigned_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_json     TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_students_student
    ON teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class
    ON teacher_students(class_id);

-- A student may belong to multiple classes for the same teacher. Keep the
-- legacy teacher_students row as the teacher-level roster/compatibility view.
CREATE TABLE IF NOT EXISTS class_memberships (
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status          TEXT,
    membership_status TEXT NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'ended', 'withdrawn')),
    created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    started_at      TEXT,
    ended_at        TEXT,
    assigned_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_json     TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (teacher_id, student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_class_memberships_student
    ON class_memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_class
    ON class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_active
    ON class_memberships(class_id, student_id, membership_status);

CREATE TABLE IF NOT EXISTS degrees (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL COLLATE NOCASE UNIQUE,
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS graduation_cohorts (
    id              TEXT PRIMARY KEY,
    degree_id       TEXT NOT NULL REFERENCES degrees(id) ON DELETE RESTRICT,
    label           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (degree_id, label)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_degree ON graduation_cohorts(degree_id);

CREATE TABLE IF NOT EXISTS program_years (
    id              TEXT PRIMARY KEY,
    degree_id       TEXT NOT NULL REFERENCES degrees(id) ON DELETE RESTRICT,
    label           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (degree_id, label),
    UNIQUE (id, degree_id)
);

CREATE INDEX IF NOT EXISTS idx_program_years_degree ON program_years(degree_id);

CREATE TABLE IF NOT EXISTS subjects (
    id              TEXT PRIMARY KEY,
    degree_id       TEXT NOT NULL REFERENCES degrees(id) ON DELETE RESTRICT,
    program_year_id TEXT NOT NULL,
    name            TEXT NOT NULL COLLATE NOCASE,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_year_id, degree_id)
        REFERENCES program_years(id, degree_id) ON DELETE RESTRICT,
    UNIQUE (name, degree_id, program_year_id)
);

CREATE INDEX IF NOT EXISTS idx_subjects_program_year
    ON subjects(program_year_id);
CREATE INDEX IF NOT EXISTS idx_subjects_degree
    ON subjects(degree_id);

CREATE TABLE IF NOT EXISTS academic_identity_events (
    id              TEXT PRIMARY KEY,
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    old_degree_id   TEXT REFERENCES degrees(id) ON DELETE SET NULL,
    new_degree_id   TEXT REFERENCES degrees(id) ON DELETE SET NULL,
    old_cohort_id   TEXT REFERENCES graduation_cohorts(id) ON DELETE SET NULL,
    new_cohort_id   TEXT REFERENCES graduation_cohorts(id) ON DELETE SET NULL,
    actor_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
    reason          TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    teacher_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    due_at          TEXT,
    priority        TEXT,
    status          TEXT,
    max_points      REAL,
    total_points    REAL,
    created_at      TEXT,
    updated_at      TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_teacher ON tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);

-- Replaces each student's student_tasks:<email> snapshot. Keep assignment state
-- here rather than duplicating task content for every student.
CREATE TABLE IF NOT EXISTS task_assignments (
    task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assigned_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at     TEXT,
    due_at          TEXT,
    status          TEXT,
    completed       INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    score           REAL,
    grade           TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (task_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_student
    ON task_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by
    ON task_assignments(assigned_by);

-- One canonical grade record per student/task. Import logic must reconcile the
-- mirrored teacher, student, and task grade stores before upserting here.
CREATE TABLE IF NOT EXISTS grades (
    id                  TEXT PRIMARY KEY,
    student_id          TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id            TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    task_id             TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    graded_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
    assignment          TEXT,
    grade               TEXT,
    score               REAL,
    max_score           REAL,
    graded_at           TEXT,
    answers_json        TEXT,
    source_json         TEXT NOT NULL DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_student_task
    ON grades(student_id, task_id)
    WHERE student_id IS NOT NULL AND task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grades_graded_by
    ON grades(graded_by);

CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY,
    student_id      TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_email   TEXT NOT NULL COLLATE NOCASE,
    type            TEXT,
    title           TEXT,
    message         TEXT,
    task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    is_read         INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at      TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_notifications_student
    ON notifications(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_email
    ON notifications(student_email);

CREATE TABLE IF NOT EXISTS student_activity (
    student_id          TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    longest_streak      INTEGER NOT NULL DEFAULT 0,
    last_activity_date  TEXT,
    source_json         TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS student_activity_days (
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    activity_date   TEXT NOT NULL,
    PRIMARY KEY (student_id, activity_date)
);

CREATE TABLE IF NOT EXISTS xp_events (
    id                  TEXT PRIMARY KEY,
    student_id          TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    source_application   TEXT NOT NULL CHECK (source_application IN ('portal', 'game', 'admin')),
    source_type         TEXT NOT NULL CHECK (source_type IN ('task', 'quiz', 'grade', 'streak', 'achievement', 'bonus', 'reversal')),
    source_id           TEXT,
    points              INTEGER NOT NULL,
    ruleset_version     TEXT NOT NULL DEFAULT 'v1',
    idempotency_key     TEXT NOT NULL UNIQUE,
    created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reversal_of         TEXT REFERENCES xp_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_xp_events_student ON xp_events(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_xp_events_source ON xp_events(source_type, source_id);

CREATE TABLE IF NOT EXISTS progression_states (
    student_id          TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    progression_xp      INTEGER NOT NULL DEFAULT 0,
    tier                TEXT NOT NULL DEFAULT 'novice',
    buff_entitlement    TEXT,
    updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_quests (
    id              TEXT PRIMARY KEY,
    teacher_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    class_id        TEXT REFERENCES classes(id) ON DELETE SET NULL,
    quest_date      TEXT,
    title           TEXT,
    description     TEXT,
    points          REAL,
    source_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_daily_quests_date ON daily_quests(quest_date);
CREATE INDEX IF NOT EXISTS idx_daily_quests_class ON daily_quests(class_id);

CREATE TABLE IF NOT EXISTS daily_quest_views (
    legacy_key      TEXT PRIMARY KEY,
    student_id      TEXT REFERENCES students(id) ON DELETE CASCADE,
    quest_id        TEXT REFERENCES daily_quests(id) ON DELETE SET NULL,
    has_seen        INTEGER NOT NULL CHECK (has_seen IN (0, 1)),
    updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_daily_quest_views_student
    ON daily_quest_views(student_id);

-- The legacy username:<name> keys are an index over account IDs, not profiles.
CREATE TABLE IF NOT EXISTS usernames (
    username        TEXT PRIMARY KEY COLLATE NOCASE,
    user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keeps exact source provenance (including duplicate array entries) while
-- importing/reconciling legacy values. This is not a runtime key-value store.
CREATE TABLE IF NOT EXISTS legacy_record_map (
    legacy_key      TEXT NOT NULL,
    item_index      INTEGER NOT NULL DEFAULT 0,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT,
    source_json     TEXT NOT NULL,
    imported_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (legacy_key, item_index)
);

CREATE INDEX IF NOT EXISTS idx_legacy_record_map_entity
    ON legacy_record_map(entity_type, entity_id);
