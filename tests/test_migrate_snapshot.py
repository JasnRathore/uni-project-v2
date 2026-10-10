import csv
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORTER = ROOT / "database" / "migrations" / "migrate_snapshot.py"


class SnapshotImporterAcademicTests(unittest.TestCase):
    def test_imports_only_class_linked_tasks_and_grades(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as work:
            work = Path(work)
            users_db = work / "users.sqlite"
            source_csv = work / "snapshot.csv"
            target_db = work / "target.sqlite"

            users = sqlite3.connect(users_db)
            users.execute(
                """CREATE TABLE users (
                    id TEXT, email TEXT, password_hash TEXT, name TEXT, role TEXT
                )"""
            )
            users.executemany(
                "INSERT INTO users VALUES (?, ?, ?, ?, ?)",
                [
                    ("teacher-1", "teacher@example.test", "hash", "Teacher", "teacher"),
                    ("student-1", "student@example.test", "hash", "Student", "student"),
                ],
            )
            users.commit()
            users.close()

            rows = [
                ("teacher:teacher-1", {
                    "department": "Oral Pathology",
                    "specialization": "Oral diagnostics",
                }),
                ("degrees:catalog", [{"id": "dds", "name": "DDS"}]),
                ("program_years:catalog", [{"id": "year-1", "degreeId": "dds", "label": "BDS 1"}]),
                ("subjects:catalog", [
                    {"id": "anatomy", "degreeId": "dds", "programYearId": "year-1", "name": "Anatomy"},
                    {"id": "physiology", "degreeId": "dds", "programYearId": "year-1", "name": "Physiology"},
                ]),
                ("classes:teacher-1", [
                    {"id": "class-1", "name": "Anatomy A", "subjectId": "anatomy"},
                    {
                        "id": "class-2", "name": "Physiology A", "subject": "Physiology",
                        "degree": "DDS", "programYearLabel": "BDS 1",
                    },
                    {"id": "class-unresolved", "name": "Legacy class", "subject": "Unmapped text"},
                    {
                        "id": "class-invalid-subject-id", "name": "Invalid catalog reference",
                        "subjectId": "unknown-subject", "subject": "Anatomy",
                        "degree": "DDS", "programYearLabel": "BDS 1",
                    },
                ]),
                ("tasks:teacher-1", [
                    {"id": "task-1", "classId": "class-1", "title": "Task one"},
                    {"id": "task-2", "classId": "class-2", "title": "Task two"},
                    {"id": "task-without-class", "title": "Orphan task"},
                    {"id": "task-bad-class", "classId": "class-unresolved", "title": "Invalid class"},
                ]),
                ("dental_college_grades:teacher-1", [
                    {
                        "id": "grade-linked", "studentEmail": "student@example.test",
                        "classId": "class-1", "taskId": "task-1", "grade": "A",
                    },
                    {
                        "id": "grade-class-from-task", "studentEmail": "student@example.test",
                        "taskId": "task-2", "grade": "B",
                    },
                    {
                        "id": "grade-taskless", "studentEmail": "student@example.test",
                        "classId": "class-2", "grade": "C",
                    },
                    {
                        "id": "grade-mismatch", "studentEmail": "student@example.test",
                        "classId": "class-2", "taskId": "task-1", "grade": "D",
                    },
                    {
                        "id": "grade-no-class", "studentEmail": "student@example.test",
                        "grade": "F",
                    },
                    {
                        "id": "grade-invalid-class", "studentEmail": "student@example.test",
                        "classId": "class-unresolved", "taskId": "task-1", "grade": "F",
                    },
                    {
                        "id": "grade-stale-task", "studentEmail": "student@example.test",
                        "classId": "class-2", "taskId": "missing-task", "grade": "C",
                    },
                ]),
            ]
            with source_csv.open("w", newline="", encoding="utf-8") as source:
                writer = csv.writer(source)
                writer.writerow(("key", "value"))
                writer.writerows((key, json.dumps(value)) for key, value in rows)

            result = subprocess.run(
                [
                    sys.executable, str(IMPORTER), "--source-csv", str(source_csv),
                    "--users-db", str(users_db), "--target-db", str(target_db),
                ],
                cwd=ROOT,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["normalized_target_counts"]["classes"], 2)
            self.assertEqual(report["normalized_target_counts"]["teacher_profiles"], 1)
            self.assertEqual(report["normalized_target_counts"]["tasks"], 2)
            self.assertEqual(report["normalized_target_counts"]["grades"], 4)
            unresolved = report["unresolved_counts_by_reason"]
            self.assertEqual(unresolved["classes_subject"], 2)
            self.assertEqual(unresolved["tasks_class"], 2)
            self.assertEqual(unresolved["grades_class_task_mismatch"], 1)
            self.assertEqual(unresolved["grades_class"], 2)
            self.assertEqual(unresolved["grades_task"], 1)

            db = sqlite3.connect(target_db)
            self.assertEqual(
                db.execute(
                    "SELECT department_id FROM teacher_profiles WHERE user_id='teacher-1'"
                ).fetchone()[0],
                "oral-pathology",
            )
            classes = dict(db.execute("SELECT id, subject_id FROM classes"))
            self.assertEqual(classes, {"class-1": "anatomy", "class-2": "physiology"})
            task_rows = db.execute("SELECT id, class_id FROM tasks").fetchall()
            self.assertEqual(set(task_rows), {("task-1", "class-1"), ("task-2", "class-2")})
            grade_rows = db.execute(
                "SELECT id, class_id, task_id FROM grades"
            ).fetchall()
            self.assertEqual(
                set(grade_rows),
                {
                    ("grade-linked", "class-1", "task-1"),
                    ("grade-class-from-task", "class-2", "task-2"),
                    ("grade-taskless", "class-2", None),
                    ("grade-stale-task", "class-2", None),
                },
            )
            grade_columns = {
                row[1] for row in db.execute("PRAGMA table_info(grades)")
            }
            task_columns = {
                row[1] for row in db.execute("PRAGMA table_info(tasks)")
            }
            self.assertNotIn("student_email", grade_columns)
            self.assertNotIn("subject", grade_columns)
            self.assertNotIn("subject", task_columns)
            db.close()


if __name__ == "__main__":
    unittest.main()
