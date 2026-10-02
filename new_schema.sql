-- Proposed normalized SQLite/Turso schema for the dental-college portal.
-- This file only defines the target schema; it does not migrate existing data.

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

CREATE TABLE IF NOT EXISTS teacher_profiles (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    department      TEXT,
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
    username            TEXT COLLATE NOCASE UNIQUE,
    roll_number         TEXT,
    batch               TEXT,
    current_level       INTEGER NOT NULL DEFAULT 1,
    total_points        INTEGER NOT NULL DEFAULT 0,
    game_progress       REAL NOT NULL DEFAULT 0,
    last_active_at      TEXT,
    registered_at       TEXT,
    profile_json        TEXT NOT NULL DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch);

CREATE TABLE IF NOT EXISTS classes (
    id              TEXT PRIMARY KEY,
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    subject         TEXT,
    description     TEXT,
    grade           TEXT,
    capacity        INTEGER,
    created_at      TEXT,
    source_json     TEXT NOT NULL DEFAULT '{}',
    UNIQUE (id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);

-- Replaces each teacher's students:<teacherId> and teacher_students:<teacherId>
-- arrays. class_id is nullable for students who have not been assigned to a class.
CREATE TABLE IF NOT EXISTS teacher_students (
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        TEXT REFERENCES classes(id) ON DELETE SET NULL,
    status          TEXT,
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

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    teacher_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    class_id        TEXT REFERENCES classes(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    subject         TEXT,
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
    student_id          TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_email       TEXT NOT NULL COLLATE NOCASE,
    task_id             TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    graded_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
    subject             TEXT,
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
CREATE INDEX IF NOT EXISTS idx_grades_student_email
    ON grades(student_email);
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
