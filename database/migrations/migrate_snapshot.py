#!/usr/bin/env python3
"""Import a KV CSV and optional SQLite users backup into an isolated SQL DB."""

import argparse
import csv
import json
import sqlite3
import sys
import uuid
from collections import Counter
from pathlib import Path


NAMESPACE_ID = uuid.UUID("4f39b431-061f-4f10-9cbd-1173144ce9f0")


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def parse_value(raw):
    try:
        return json.loads(raw), "json"
    except (TypeError, json.JSONDecodeError):
        return raw, "raw"


def object_list(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def text(value):
    return None if value is None else str(value)


def number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def truth(value):
    return int(bool(value))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-csv", required=True, type=Path)
    parser.add_argument("--users-db", type=Path)
    parser.add_argument("--target-db", required=True, type=Path)
    args = parser.parse_args()

    source_csv = args.source_csv.resolve()
    target_db = args.target_db.resolve()
    users_db = args.users_db.resolve() if args.users_db else None
    schema_file = Path(__file__).resolve().parents[2] / "new_schema.sql"

    if not source_csv.is_file():
        parser.error(f"source CSV does not exist: {source_csv}")
    if users_db and not users_db.is_file():
        parser.error(f"users database does not exist: {users_db}")
    if not schema_file.is_file():
        parser.error(f"schema file does not exist: {schema_file}")
    if target_db.exists():
        parser.error(f"refusing to overwrite existing target database: {target_db}")
    target_db.parent.mkdir(parents=True, exist_ok=True)

    source_records = []
    parse_modes = Counter()
    with source_csv.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames or not {"key", "value"}.issubset(reader.fieldnames):
            parser.error("CSV must contain key and value columns")
        for row_number, row in enumerate(reader, start=2):
            key = (row.get("key") or "").strip()
            if not key:
                parser.error(f"empty KV key on CSV row {row_number}")
            value, mode = parse_value(row.get("value") or "")
            parse_modes[mode] += 1
            source_records.append((key, value, mode))

    records_by_namespace = {}
    for key, value, mode in source_records:
        namespace, separator, suffix = key.partition(":")
        records_by_namespace.setdefault(namespace, []).append((key, suffix if separator else "", value, mode))

    db = sqlite3.connect(str(target_db))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(schema_file.read_text(encoding="utf-8"))
    unresolved = Counter()
    counts = Counter()
    source_user_count = 0

    def mark_unresolved(namespace, amount=1):
        unresolved[namespace] += amount

    def provenance(key, entity_type, value):
        db.execute(
            """INSERT INTO legacy_record_map
               (legacy_key, item_index, entity_type, entity_id, source_json)
               VALUES (?, 0, ?, NULL, ?)""",
            (key, entity_type, json_text(value)),
        )

    db.execute("BEGIN")
    try:
        if users_db:
            uri = users_db.as_uri() + "?mode=ro"
            source_users = sqlite3.connect(uri, uri=True)
            source_users.row_factory = sqlite3.Row
            try:
                table_exists = source_users.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'"
                ).fetchone()
                if table_exists:
                    columns = {row["name"] for row in source_users.execute("PRAGMA table_info(users)")}
                    if not {"id", "email"}.issubset(columns):
                        raise ValueError("source users table must contain id and email columns")
                    for user in source_users.execute("SELECT * FROM users"):
                        raw = dict(user)
                        metadata, _ = parse_value(raw.get("metadata") or "{}")
                        password_hash = raw.get("password_hash") or raw.get("password")
                        if not raw.get("id") or not raw.get("email") or not password_hash:
                            mark_unresolved("users")
                            continue
                        if not isinstance(metadata, dict):
                            metadata = {"legacy_metadata": metadata}
                        role = raw.get("role") or metadata.get("role") or "student"
                        db.execute(
                            """INSERT INTO users
                               (id, email, password_hash, name, role, metadata_json, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?)
                               ON CONFLICT(id) DO NOTHING""",
                            (
                                raw["id"], raw["email"], password_hash,
                                raw.get("name") or metadata.get("name") or "",
                                role, json_text(metadata), raw.get("created_at"),
                            ),
                        )
                        source_user_count += 1
            finally:
                source_users.close()
        counts["users"] = db.execute("SELECT count(*) FROM users").fetchone()[0]

        user_by_id = {
            row["id"]: row for row in db.execute("SELECT id, email, role FROM users")
        }
        student_by_email = {}
        student_id_email = {}
        used_usernames = set()

        for key, teacher_id, value, _ in records_by_namespace.get("teacher", []):
            if teacher_id not in user_by_id:
                mark_unresolved("teacher_profiles")
                continue
            profile = value if isinstance(value, dict) else {}
            db.execute(
                """INSERT INTO teacher_profiles
                   (user_id, department, specialization, qualification, experience,
                    phone, address, bio, join_date, source_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET source_json = excluded.source_json""",
                (
                    teacher_id, text(profile.get("department")),
                    text(profile.get("specialization")), text(profile.get("qualification")),
                    text(profile.get("experience")), text(profile.get("phone")),
                    text(profile.get("address")), text(profile.get("bio")),
                    text(profile.get("joinDate")), json_text(profile),
                ),
            )
        counts["teacher_profiles"] = db.execute("SELECT count(*) FROM teacher_profiles").fetchone()[0]

        def ensure_student(email, student_id=None, name="", username=None, profile=None):
            email = text(email)
            if not email or not email.strip():
                return None
            email = email.strip()
            normalized = email.casefold()
            if normalized in student_by_email:
                existing_id = student_by_email[normalized]
                if student_id and student_id not in student_id_email:
                    student_id_email[student_id] = normalized
                source_profile = profile if isinstance(profile, dict) else {}
                candidate_username = text(username)
                if candidate_username and candidate_username.casefold() in used_usernames:
                    candidate_username = None
                    mark_unresolved("student_username")
                if candidate_username:
                    used_usernames.add(candidate_username.casefold())
                db.execute(
                    """UPDATE students SET
                         name = CASE WHEN name = '' THEN ? ELSE name END,
                         username = COALESCE(username, ?),
                         roll_number = COALESCE(roll_number, ?),
                         batch = COALESCE(batch, ?),
                         current_level = CASE WHEN current_level = 1 THEN ? ELSE current_level END,
                         total_points = CASE WHEN total_points = 0 THEN ? ELSE total_points END,
                         game_progress = CASE WHEN game_progress = 0 THEN ? ELSE game_progress END,
                         registered_at = COALESCE(registered_at, ?),
                         profile_json = ?
                       WHERE id = ?""",
                    (
                        text(name) or "", candidate_username,
                        text(source_profile.get("rollNumber")),
                        text(source_profile.get("batch")),
                        int(number(source_profile.get("currentLevel")) or 1),
                        int(number(source_profile.get("totalPoints")) or 0),
                        number(source_profile.get("gameProgress")) or 0,
                        text(source_profile.get("registeredAt")),
                        json_text(source_profile), existing_id,
                    ),
                )
                return existing_id

            matching_user = db.execute(
                "SELECT id, name, role FROM users WHERE email = ? COLLATE NOCASE",
                (email,),
            ).fetchone()
            if not student_id or (student_id in student_id_email and student_id_email[student_id] != normalized):
                student_id = str(uuid.uuid5(NAMESPACE_ID, "student:" + normalized))
            student_id_email[student_id] = normalized
            username = text(username)
            if username and username.casefold() in used_usernames:
                username = None
                mark_unresolved("student_username")
            if username:
                used_usernames.add(username.casefold())
            source_profile = profile if isinstance(profile, dict) else {}
            db.execute(
                """INSERT INTO students
                   (id, user_id, email, name, username, roll_number, batch,
                    current_level, total_points, game_progress, last_active_at,
                    registered_at, profile_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    student_id, matching_user["id"] if matching_user else None, email,
                    text(name) or (matching_user["name"] if matching_user else "") or "",
                    username, text(source_profile.get("rollNumber")),
                    text(source_profile.get("batch")),
                    int(number(source_profile.get("currentLevel")) or 1),
                    int(number(source_profile.get("totalPoints")) or 0),
                    number(source_profile.get("gameProgress")) or 0,
                    text(source_profile.get("lastActive")),
                    text(source_profile.get("registeredAt")),
                    json_text(source_profile),
                ),
            )
            student_by_email[normalized] = student_id
            return student_id

        # Registered student identities are canonicalized with profile/roster records.
        for user in db.execute("SELECT id, email, name, role, metadata_json FROM users"):
            if user["role"] == "student" and user["email"]:
                metadata, _ = parse_value(user["metadata_json"])
                metadata = metadata if isinstance(metadata, dict) else {}
                ensure_student(
                    user["email"], user["id"], user["name"],
                    metadata.get("username"), metadata,
                )

        profiles = {}
        student_objects = []
        for namespace in ("student_profile", "student"):
            for key, suffix, value, _ in records_by_namespace.get(namespace, []):
                objects = object_list(value)
                for item_index, item in enumerate(objects):
                    email = item.get("email")
                    if not email and (namespace == "student_profile" or "@" in suffix):
                        email = suffix
                    if not email:
                        candidate_id = item.get("id") or suffix
                        user = user_by_id.get(candidate_id)
                        email = user["email"] if user else None
                    if not email:
                        mark_unresolved(namespace)
                        continue
                    student_id = item.get("id") or (suffix if namespace == "student" else None)
                    old_profile = profiles.get(email.casefold(), {})
                    merged = {**old_profile, **item}
                    profiles[email.casefold()] = merged
                    student_objects.append((email, student_id, merged))
        for email, student_id, profile in student_objects:
            ensure_student(
                email, student_id, profile.get("name", ""),
                profile.get("username"), profile,
            )
        counts["students"] = db.execute("SELECT count(*) FROM students").fetchone()[0]

        class_ids = set()
        for key, teacher_id, value, _ in records_by_namespace.get("classes", []):
            classes = object_list(value)
            if teacher_id not in user_by_id:
                mark_unresolved("classes", max(1, len(classes)))
                continue
            for item in classes:
                class_id = text(item.get("id"))
                if not class_id:
                    mark_unresolved("classes")
                    continue
                db.execute(
                    """INSERT INTO classes
                       (id, teacher_id, name, subject, description, grade, capacity, created_at, source_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(id) DO NOTHING""",
                    (
                        class_id, teacher_id, text(item.get("name")) or "Imported class",
                        text(item.get("subject")), text(item.get("description")),
                        text(item.get("grade")), number(item.get("capacity")),
                        text(item.get("createdAt")), json_text(item),
                    ),
                )
                class_ids.add(class_id)
                counts["classes"] += 1

        # Import teacher rosters from either of their legacy representations.
        for namespace in ("students", "teacher_students"):
            for key, teacher_id, value, _ in records_by_namespace.get(namespace, []):
                roster = object_list(value)
                if teacher_id not in user_by_id:
                    mark_unresolved(namespace, max(1, len(roster)))
                    continue
                for item in roster:
                    email = item.get("email") or item.get("studentEmail")
                    student_id = ensure_student(
                        email, item.get("id") or item.get("studentId"), item.get("name", ""), profile=item
                    )
                    if not student_id:
                        mark_unresolved(namespace)
                        continue
                    class_id = text(item.get("classId"))
                    if class_id not in class_ids:
                        class_id = None
                    db.execute(
                        """INSERT INTO teacher_students
                           (teacher_id, student_id, class_id, status, assigned_at, updated_at, source_json)
                           VALUES (?, ?, ?, ?, ?, ?, ?)
                           ON CONFLICT(teacher_id, student_id) DO UPDATE SET
                             class_id = COALESCE(excluded.class_id, teacher_students.class_id),
                             status = COALESCE(excluded.status, teacher_students.status),
                             source_json = excluded.source_json""",
                        (
                            teacher_id, student_id, class_id, text(item.get("status")),
                            text(item.get("assignedAt") or item.get("addedAt")),
                            text(item.get("updatedAt")), json_text(item),
                        ),
                    )
                    counts["teacher_students"] += 1
        counts["students"] = db.execute("SELECT count(*) FROM students").fetchone()[0]

        # A student snapshot may be the only surviving copy of a task.
        task_sources = []
        for key, teacher_id, value, _ in records_by_namespace.get("tasks", []):
            for item in object_list(value):
                task_sources.append((item, teacher_id if teacher_id in user_by_id else None))
                if teacher_id not in user_by_id:
                    mark_unresolved("tasks_owner")
        for key, email, value, _ in records_by_namespace.get("student_tasks", []):
            for item in object_list(value):
                task_sources.append((item, text(item.get("teacherId")) if item.get("teacherId") in user_by_id else None))
        task_ids = set()
        for item, teacher_id in task_sources:
            task_id = text(item.get("id"))
            if not task_id:
                mark_unresolved("tasks")
                continue
            class_id = text(item.get("classId"))
            if class_id not in class_ids:
                class_id = None
            db.execute(
                """INSERT INTO tasks
                   (id, teacher_id, class_id, title, description, subject, due_at,
                    priority, status, max_points, total_points, created_at, updated_at, source_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     teacher_id = COALESCE(tasks.teacher_id, excluded.teacher_id),
                     class_id = COALESCE(tasks.class_id, excluded.class_id),
                     source_json = CASE WHEN length(tasks.source_json) > 2
                                        THEN tasks.source_json ELSE excluded.source_json END""",
                (
                    task_id, teacher_id, class_id, text(item.get("title")) or "Imported task",
                    text(item.get("description")), text(item.get("subject")),
                    text(item.get("dueDate")), text(item.get("priority")),
                    text(item.get("status")), number(item.get("maxPoints")),
                    number(item.get("totalPoints")), text(item.get("createdAt")),
                    text(item.get("updatedAt")), json_text(item),
                ),
            )
            task_ids.add(task_id)
        counts["tasks"] = db.execute("SELECT count(*) FROM tasks").fetchone()[0]

        assignment_count = 0
        for key, email, value, _ in records_by_namespace.get("student_tasks", []):
            student_id = student_by_email.get(email.casefold()) if email else None
            if not student_id:
                student_id = ensure_student(email) if email else None
            if not student_id:
                mark_unresolved("student_tasks_student")
                continue
            for item in object_list(value):
                task_id = text(item.get("id"))
                if not task_id or task_id not in task_ids:
                    mark_unresolved("student_tasks_task")
                    continue
                teacher_id = text(item.get("teacherId"))
                if teacher_id not in user_by_id:
                    teacher_id = None
                db.execute(
                    """INSERT INTO task_assignments
                       (task_id, student_id, assigned_by, assigned_at, due_at,
                        status, completed, score, grade, source_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(task_id, student_id) DO UPDATE SET
                         completed = MAX(task_assignments.completed, excluded.completed),
                         score = COALESCE(excluded.score, task_assignments.score),
                         grade = COALESCE(excluded.grade, task_assignments.grade),
                         source_json = excluded.source_json""",
                    (
                        task_id, student_id, teacher_id, text(item.get("createdAt")),
                        text(item.get("dueDate")), text(item.get("status")),
                        truth(item.get("completed")), number(item.get("score", item.get("grade"))),
                        text(item.get("grade")) if isinstance(item.get("grade"), str) else None,
                        json_text(item),
                    ),
                )
                assignment_count += 1
        counts["task_assignments"] = db.execute("SELECT count(*) FROM task_assignments").fetchone()[0]

        grade_rows = []
        for namespace in ("student_grades", "dental_college_grades"):
            for key, suffix, value, _ in records_by_namespace.get(namespace, []):
                for item in object_list(value):
                    email = item.get("studentEmail") or (suffix if namespace == "student_grades" else None)
                    grade_rows.append((item, text(email), suffix if namespace == "dental_college_grades" else None))
        for key, task_id, value, _ in records_by_namespace.get("task_grades", []):
            if isinstance(value, dict):
                for email, grade_value in value.items():
                    grade_rows.append(({"taskId": task_id, "grade": grade_value, "score": grade_value}, email, None))

        for item, email, graded_by in grade_rows:
            student_id = student_by_email.get(email.casefold()) if email else None
            if not student_id:
                student_id = ensure_student(email) if email else None
            if not student_id:
                mark_unresolved("grades_student")
                continue
            task_id = text(item.get("taskId") or item.get("task_id"))
            if task_id not in task_ids:
                task_id = None
                mark_unresolved("grades_task")
            if graded_by not in user_by_id:
                graded_by = None
            grade_key = f"{student_id}:{task_id or json_text(item)}"
            grade_id = text(item.get("id")) or str(uuid.uuid5(NAMESPACE_ID, "grade:" + grade_key))
            existing_grade = db.execute(
                """SELECT id FROM grades
                   WHERE student_id = ? AND task_id IS ?""",
                (student_id, task_id),
            ).fetchone() if task_id else db.execute(
                "SELECT id FROM grades WHERE id = ?", (grade_id,)
            ).fetchone()
            grade_values = (
                email, graded_by, text(item.get("subject")),
                text(item.get("assignment")),
                text(item.get("grade")) if isinstance(item.get("grade"), str) else None,
                number(item.get("score", item.get("grade"))),
                number(item.get("maxScore", item.get("maxPoints"))),
                text(item.get("gradedAt") or item.get("date")),
                json_text(item.get("answers")) if item.get("answers") is not None else None,
                json_text(item),
            )
            if existing_grade:
                db.execute(
                    """UPDATE grades SET
                         student_email = ?, graded_by = COALESCE(?, graded_by),
                         subject = COALESCE(?, subject), assignment = COALESCE(?, assignment),
                         grade = COALESCE(?, grade), score = COALESCE(?, score),
                         max_score = COALESCE(?, max_score), graded_at = COALESCE(?, graded_at),
                         answers_json = COALESCE(?, answers_json), source_json = ?
                       WHERE id = ?""",
                    (*grade_values, existing_grade["id"]),
                )
            else:
                db.execute(
                    """INSERT INTO grades
                       (id, student_id, student_email, task_id, graded_by, subject,
                        assignment, grade, score, max_score, graded_at, answers_json, source_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        grade_id, student_id, email, task_id, *grade_values[1:],
                    ),
                )
        counts["grades"] = db.execute("SELECT count(*) FROM grades").fetchone()[0]

        for key, email, value, _ in records_by_namespace.get("notifications", []):
            student_id = student_by_email.get(email.casefold()) if email else None
            if not student_id:
                student_id = ensure_student(email) if email else None
            if not student_id:
                mark_unresolved("notifications_student")
                continue
            for index, item in enumerate(object_list(value)):
                notification_id = text(item.get("id")) or str(uuid.uuid5(NAMESPACE_ID, f"notification:{key}:{index}"))
                task_id = text(item.get("taskId"))
                if task_id not in task_ids:
                    task_id = None
                db.execute(
                    """INSERT INTO notifications
                       (id, student_id, student_email, type, title, message, task_id, is_read, created_at, source_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(id) DO NOTHING""",
                    (
                        notification_id, student_id, email,
                        text(item.get("type")), text(item.get("title")),
                        text(item.get("message")), task_id, truth(item.get("read")),
                        text(item.get("createdAt")), json_text(item),
                    ),
                )
        counts["notifications"] = db.execute("SELECT count(*) FROM notifications").fetchone()[0]

        for namespace in ("student_activity", "student_streak"):
            for key, email, value, _ in records_by_namespace.get(namespace, []):
                student_id = student_by_email.get(email.casefold()) if email else None
                if not student_id and email:
                    student_id = ensure_student(email)
                if not student_id or not isinstance(value, dict):
                    mark_unresolved(namespace)
                    continue
                db.execute(
                    """INSERT INTO student_activity
                       (student_id, current_streak, longest_streak, last_activity_date, source_json)
                       VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(student_id) DO UPDATE SET
                         current_streak = MAX(student_activity.current_streak, excluded.current_streak),
                         longest_streak = MAX(student_activity.longest_streak, excluded.longest_streak),
                         last_activity_date = COALESCE(excluded.last_activity_date, student_activity.last_activity_date),
                         source_json = excluded.source_json""",
                    (
                        student_id, int(number(value.get("currentStreak")) or 0),
                        int(number(value.get("longestStreak")) or 0),
                        text(value.get("lastActivityDate")), json_text(value),
                    ),
                )
                for date in value.get("dates", []) if isinstance(value.get("dates"), list) else []:
                    db.execute(
                        "INSERT OR IGNORE INTO student_activity_days (student_id, activity_date) VALUES (?, ?)",
                        (student_id, text(date)),
                    )
        counts["student_activity"] = db.execute("SELECT count(*) FROM student_activity").fetchone()[0]
        counts["student_activity_days"] = db.execute("SELECT count(*) FROM student_activity_days").fetchone()[0]

        for key, _, value, _ in records_by_namespace.get("daily_quest", []):
            for item in object_list(value):
                quest_id = text(item.get("id"))
                if not quest_id:
                    mark_unresolved("daily_quest")
                    continue
                teacher_id = text(item.get("teacherId"))
                if teacher_id not in user_by_id:
                    teacher_id = None
                    mark_unresolved("daily_quest_owner")
                class_id = text(item.get("classId"))
                if class_id not in class_ids:
                    class_id = None
                db.execute(
                    """INSERT INTO daily_quests
                       (id, teacher_id, class_id, quest_date, title, description, points, source_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(id) DO NOTHING""",
                    (
                        quest_id, teacher_id, class_id, text(item.get("date")),
                        text(item.get("title")), text(item.get("description")),
                        number(item.get("points")), json_text(item),
                    ),
                )
        counts["daily_quests"] = db.execute("SELECT count(*) FROM daily_quests").fetchone()[0]

        for key, suffix, value, _ in records_by_namespace.get("daily_quest_seen", []):
            student_id = student_by_email.get(suffix.casefold())
            if not student_id:
                row = db.execute("SELECT id FROM students WHERE id = ?", (suffix,)).fetchone()
                student_id = row["id"] if row else None
            db.execute(
                """INSERT INTO daily_quest_views (legacy_key, student_id, quest_id, has_seen)
                   VALUES (?, ?, NULL, ?)
                   ON CONFLICT(legacy_key) DO NOTHING""",
                (key, student_id, truth(value)),
            )
            if student_id is None:
                mark_unresolved("daily_quest_seen_student")
        counts["daily_quest_views"] = db.execute("SELECT count(*) FROM daily_quest_views").fetchone()[0]

        for key, username, value, _ in records_by_namespace.get("username", []):
            user_id = value if isinstance(value, str) else None
            if not username or not user_id or user_id not in user_by_id:
                mark_unresolved("username")
                continue
            db.execute(
                "INSERT INTO usernames (username, user_id) VALUES (?, ?) ON CONFLICT(username) DO NOTHING",
                (username, user_id),
            )
        counts["usernames"] = db.execute("SELECT count(*) FROM usernames").fetchone()[0]

        for key, value, mode in source_records:
            namespace = key.partition(":")[0]
            if namespace == "username":
                entity_type = "username_index"
            elif namespace in {
                "teacher", "student", "student_profile", "students", "teacher_students",
                "classes", "tasks", "student_tasks", "dental_college_grades",
                "student_grades", "task_grades", "notifications", "student_activity",
                "student_streak", "daily_quest", "daily_quest_seen",
            }:
                entity_type = namespace
            else:
                entity_type = "unrecognized"
                mark_unresolved("unrecognized")
            provenance(key, entity_type, value)
        counts["legacy_record_map"] = db.execute("SELECT count(*) FROM legacy_record_map").fetchone()[0]
        for table in (
            "users", "teacher_profiles", "students", "classes", "teacher_students",
            "tasks", "task_assignments", "grades", "notifications",
            "student_activity", "student_activity_days", "daily_quests",
            "daily_quest_views", "usernames", "legacy_record_map",
        ):
            counts[table] = db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]

        fk_errors = list(db.execute("PRAGMA foreign_key_check"))
        if fk_errors:
            raise ValueError(f"foreign key validation failed ({len(fk_errors)} violations)")
        db.commit()
    except Exception:
        db.rollback()
        db.close()
        raise

    report = {
        "mode": "local dry run; no remote database access",
        "source_kv_rows": len(source_records),
        "source_users_rows": source_user_count,
        "kv_value_parse_modes": dict(parse_modes),
        "normalized_target_counts": dict(counts),
        "unresolved_counts_by_reason": dict(unresolved),
        "foreign_key_violations": 0,
        "target_database": str(target_db),
    }
    print(json.dumps(report, indent=2))
    db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"migration dry run failed: {error}", file=sys.stderr)
        sys.exit(1)
