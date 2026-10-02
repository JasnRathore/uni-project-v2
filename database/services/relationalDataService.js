const { createHash } = require('node:crypto');
const { getDatabaseClient } = require('./dbService');

const parseJson = value => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid relational JSON value: ${error.message}`);
  }
};

const sourceOf = row => parseJson(row.source_json) || {};
const finiteNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const asText = value => value == null ? null : String(value);
const splitKey = key => {
  const separator = key.indexOf(':');
  return separator < 0
    ? { namespace: key, suffix: '' }
    : { namespace: key.slice(0, separator), suffix: key.slice(separator + 1) };
};
const stableStudentId = email => {
  const hex = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const parseArray = value => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array value');
  return value;
};

const readRows = async (sql, args = []) => {
  const result = await getDatabaseClient().execute({ sql, args });
  return result.rows;
};
const run = async (executor, sql, args = []) => executor.execute({ sql, args });

let transactionQueue = Promise.resolve();
const withTransaction = operation => {
  const pending = transactionQueue.then(async () => {
    const transaction = await getDatabaseClient().transaction('write');
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });
  transactionQueue = pending.catch(() => {});
  return pending;
};

const findStudent = async (executor, email) => {
  if (!email) return null;
  const result = await run(executor, 'SELECT * FROM students WHERE email = ? COLLATE NOCASE', [email]);
  return result.rows[0] || null;
};

const ensureStudent = async (executor, email, record = {}) => {
  if (!email || !String(email).trim()) throw new Error('Student records require an email address');
  const normalizedEmail = String(email).trim();
  const userResult = await run(executor, 'SELECT id, name, role FROM users WHERE email = ? COLLATE NOCASE', [normalizedEmail]);
  const user = userResult.rows[0] || null;
  const existing = await findStudent(executor, normalizedEmail);
  const id = existing?.id || record.id || user?.id || stableStudentId(normalizedEmail);
  const source = { ...record, email: normalizedEmail };
  const username = asText(record.username) || null;
  const name = asText(record.name) || existing?.name || user?.name || normalizedEmail.split('@')[0];
  const profile = { ...parseJson(existing?.profile_json), ...source };
  if (existing) {
    await run(executor, `UPDATE students SET
      user_id = COALESCE(user_id, ?), name = ?, username = COALESCE(?, username),
      roll_number = COALESCE(?, roll_number), batch = COALESCE(?, batch),
      current_level = ?, total_points = ?, game_progress = ?, last_active_at = COALESCE(?, last_active_at),
      registered_at = COALESCE(?, registered_at), profile_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [
      user?.id || null, name, username, asText(record.rollNumber), asText(record.batch),
      Math.trunc(finiteNumber(record.currentLevel) ?? finiteNumber(existing.current_level) ?? 1),
      Math.trunc(finiteNumber(record.totalPoints) ?? finiteNumber(existing.total_points) ?? 0),
      finiteNumber(record.gameProgress) ?? finiteNumber(existing.game_progress) ?? 0,
      asText(record.lastActive), asText(record.registeredAt), JSON.stringify(profile), id,
    ]);
  } else {
    await run(executor, `INSERT INTO students
      (id, user_id, email, name, username, roll_number, batch, current_level,
       total_points, game_progress, last_active_at, registered_at, profile_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, user?.id || null, normalizedEmail, name, username,
      asText(record.rollNumber), asText(record.batch),
      Math.trunc(finiteNumber(record.currentLevel) ?? 1),
      Math.trunc(finiteNumber(record.totalPoints) ?? 0),
      finiteNumber(record.gameProgress) ?? 0,
      asText(record.lastActive), asText(record.registeredAt), JSON.stringify(profile),
    ]);
  }
  return (await findStudent(executor, normalizedEmail));
};

const classToLegacy = row => ({ ...sourceOf(row), id: row.id, name: row.name, subject: row.subject, description: row.description, grade: row.grade, capacity: row.capacity, createdAt: row.created_at });
const taskToLegacy = row => ({
  ...sourceOf(row), id: row.id, title: row.title, description: row.description,
  subject: row.subject, dueDate: row.due_at, classId: row.class_id,
  priority: row.priority, status: row.status, maxPoints: row.max_points,
  totalPoints: row.total_points, createdAt: row.created_at, updatedAt: row.updated_at,
  teacherId: row.teacher_id,
});
const studentToLegacy = row => ({ ...sourceOf(row), id: row.id, email: row.email, name: row.name, username: row.username || '', rollNumber: row.roll_number || '', batch: row.batch || '', currentLevel: row.current_level, totalPoints: row.total_points, gameProgress: row.game_progress, lastActive: row.last_active_at, registeredAt: row.registered_at });
const assignmentToLegacy = row => ({
  ...sourceOf(row), id: row.task_id, taskId: row.task_id, teacherId: row.assigned_by,
  dueDate: row.due_at, status: row.status, completed: Boolean(row.completed),
  score: row.score, grade: row.grade,
});
const gradeToLegacy = row => ({ ...sourceOf(row), id: row.id, studentId: row.student_id, studentEmail: row.student_email, taskId: row.task_id, task_id: row.task_id, teacherId: row.graded_by, subject: row.subject, assignment: row.assignment, grade: row.grade ?? row.score, score: row.score, maxScore: row.max_score, gradedAt: row.graded_at });
const notificationToLegacy = row => ({ ...sourceOf(row), id: row.id, type: row.type, title: row.title, message: row.message, taskId: row.task_id, read: Boolean(row.is_read), createdAt: row.created_at });

const readPortalData = async key => {
  const { namespace, suffix } = splitKey(key);
  let rows;
  switch (namespace) {
    case 'classes':
      return (await readRows('SELECT * FROM classes WHERE teacher_id = ? ORDER BY rowid', [suffix])).map(classToLegacy);
    case 'students':
    case 'teacher_students':
      rows = await readRows(`SELECT s.*, ts.class_id AS membership_class_id,
        ts.status AS membership_status, ts.assigned_at, ts.source_json AS membership_json
        FROM teacher_students ts JOIN students s ON s.id = ts.student_id
        WHERE ts.teacher_id = ? ORDER BY ts.rowid`, [suffix]);
      return rows.map(row => {
        const membership = parseJson(row.membership_json) || {};
        return { ...studentToLegacy(row), ...membership, id: membership.id || row.id,
          email: row.email, name: membership.name || row.name,
          classId: row.membership_class_id || membership.classId || null,
          className: membership.className || null,
          status: row.membership_status || membership.status || 'active',
          addedAt: row.assigned_at || membership.addedAt,
        };
      });
    case 'tasks':
      return (await readRows('SELECT * FROM tasks WHERE teacher_id = ? ORDER BY rowid', [suffix])).map(taskToLegacy);
    case 'student_tasks':
      rows = await readRows(`SELECT ta.*, t.source_json AS task_json, t.title, t.description, t.subject,
        t.class_id, t.priority, t.max_points, t.total_points, t.created_at AS task_created_at,
        t.teacher_id
        FROM students s JOIN task_assignments ta ON ta.student_id = s.id
        JOIN tasks t ON t.id = ta.task_id WHERE s.email = ? COLLATE NOCASE ORDER BY ta.rowid`, [suffix]);
      return rows.map(row => ({
        ...parseJson(row.task_json), ...assignmentToLegacy(row), id: row.task_id,
        title: row.title, description: row.description, subject: row.subject,
        classId: row.class_id, priority: row.priority, maxPoints: row.max_points,
        totalPoints: row.total_points, createdAt: row.task_created_at,
        teacherId: row.assigned_by || row.teacher_id,
      }));
    case 'student_profile': {
      const student = await findStudent(getDatabaseClient(), suffix);
      if (!student) return null;
      const profile = parseJson(student.profile_json) || {};
      return {
        ...profile, id: student.id, email: student.email, name: student.name,
        username: student.username || profile.username || '',
        rollNumber: student.roll_number || profile.rollNumber || '',
        batch: student.batch || profile.batch || '',
        currentLevel: student.current_level, totalPoints: student.total_points,
        gameProgress: student.game_progress,
      };
    }
    case 'student': {
      const result = await readRows('SELECT * FROM students WHERE id = ?', [suffix]);
      return result[0] ? studentToLegacy(result[0]) : null;
    }
    case 'teacher': {
      const result = await readRows(`SELECT u.id, u.email, u.name, u.role, u.metadata_json, tp.source_json
        FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id WHERE u.id = ?`, [suffix]);
      if (!result[0]) return null;
      const storedMetadata = parseJson(result[0].metadata_json);
      const userMetadata = storedMetadata?.user_metadata || storedMetadata;
      return { ...userMetadata, ...parseJson(result[0].source_json),
        id: result[0].id, email: result[0].email, name: result[0].name, role: result[0].role };
    }
    case 'student_grades': {
      const result = await readRows('SELECT * FROM grades WHERE student_email = ? COLLATE NOCASE ORDER BY rowid', [suffix]);
      return result.map(gradeToLegacy);
    }
    case 'dental_college_grades': {
      const result = await readRows('SELECT * FROM grades WHERE graded_by = ? ORDER BY rowid', [suffix]);
      return result.map(gradeToLegacy);
    }
    case 'task_grades': {
      const result = await readRows(`SELECT g.student_email, g.grade, g.score FROM grades g
        WHERE g.task_id = ? ORDER BY g.rowid`, [suffix]);
      return Object.fromEntries(result.map(row => [row.student_email, row.grade ?? row.score]));
    }
    case 'notifications': {
      const result = await readRows('SELECT * FROM notifications WHERE student_email = ? COLLATE NOCASE ORDER BY rowid', [suffix]);
      return result.map(notificationToLegacy);
    }
    case 'student_streak':
    case 'student_activity': {
      const result = await readRows(`SELECT sa.* FROM student_activity sa
        JOIN students s ON s.id = sa.student_id WHERE s.email = ? COLLATE NOCASE`, [suffix]);
      if (!result[0]) return null;
      const days = await readRows('SELECT activity_date FROM student_activity_days WHERE student_id = ? ORDER BY activity_date', [result[0].student_id]);
      return { ...parseJson(result[0].source_json), currentStreak: result[0].current_streak,
        longestStreak: result[0].longest_streak, lastActivityDate: result[0].last_activity_date,
        dates: days.map(day => day.activity_date) };
    }
    case 'daily_quest': {
      const result = await readRows('SELECT * FROM daily_quests ORDER BY rowid DESC LIMIT 1');
      if (!result[0]) return null;
      return { ...sourceOf(result[0]), id: result[0].id, teacherId: result[0].teacher_id,
        classId: result[0].class_id, date: result[0].quest_date, title: result[0].title,
        description: result[0].description, points: result[0].points };
    }
    case 'daily_quest_seen': {
      const result = await readRows('SELECT has_seen FROM daily_quest_views WHERE legacy_key = ?', [key]);
      return result[0] ? Boolean(result[0].has_seen) : null;
    }
    case 'username': {
      const result = await readRows('SELECT user_id FROM usernames WHERE username = ? COLLATE NOCASE', [suffix]);
      return result[0]?.user_id || null;
    }
    default:
      throw new Error(`No relational storage mapping is defined for "${namespace}"`);
  }
};

const deleteByIds = async (tx, table, idColumn, ids, where = '', whereArgs = []) => {
  const existing = await run(tx, `SELECT ${idColumn} FROM ${table} ${where}`, whereArgs);
  for (const row of existing.rows) {
    if (!ids.has(row[idColumn])) {
      await run(tx, `DELETE FROM ${table} WHERE ${idColumn} = ?`, [row[idColumn]]);
    }
  }
};

const writeClasses = async (tx, teacherId, records) => {
  const teacher = await run(tx, 'SELECT id FROM users WHERE id=?', [teacherId]);
  if (!teacher.rows.length) throw new Error(`Cannot save classes: teacher ${teacherId} does not exist`);
  const ids = new Set();
  for (const item of parseArray(records)) {
    if (!item?.id || !item.name) throw new Error('Every class requires an id and name');
    ids.add(String(item.id));
    await run(tx, `INSERT INTO classes
      (id, teacher_id, name, subject, description, grade, capacity, created_at, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, subject=excluded.subject,
      description=excluded.description, grade=excluded.grade, capacity=excluded.capacity,
      created_at=excluded.created_at, source_json=excluded.source_json
      WHERE classes.teacher_id = excluded.teacher_id`, [
      String(item.id), teacherId, String(item.name), asText(item.subject), asText(item.description),
      asText(item.grade), finiteNumber(item.capacity), asText(item.createdAt), JSON.stringify(item),
    ]);
    const persisted = await run(tx, 'SELECT teacher_id FROM classes WHERE id=?', [String(item.id)]);
    if (persisted.rows[0]?.teacher_id !== teacherId) {
      throw new Error(`Class ID ${item.id} is already owned by another teacher`);
    }
  }
  await deleteByIds(tx, 'classes', 'id', ids, 'WHERE teacher_id = ?', [teacherId]);
};

const writeRoster = async (tx, teacherId, records) => {
  const teacher = await run(tx, 'SELECT id FROM users WHERE id = ?', [teacherId]);
  if (!teacher.rows.length) throw new Error(`Cannot save roster: teacher ${teacherId} does not exist`);
  const emails = new Set();
  for (const item of parseArray(records)) {
    if (!item?.email) throw new Error('Every roster student requires an email address');
    const email = String(item.email).trim();
    const student = await ensureStudent(tx, email, item);
    emails.add(email.toLowerCase());
    const requestedClassId = asText(item.classId);
    const classExists = requestedClassId
      ? (await run(tx, 'SELECT id FROM classes WHERE id=? AND teacher_id=?', [requestedClassId, teacherId])).rows.length > 0
      : false;
    await run(tx, `INSERT INTO teacher_students
      (teacher_id, student_id, class_id, status, assigned_at, updated_at, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(teacher_id, student_id) DO UPDATE SET
      class_id=excluded.class_id, status=excluded.status, assigned_at=excluded.assigned_at,
      updated_at=excluded.updated_at, source_json=excluded.source_json`, [
      teacherId, student.id, classExists ? requestedClassId : null, asText(item.status),
      asText(item.addedAt || item.assignedAt), asText(item.updatedAt) || new Date().toISOString(), JSON.stringify(item),
    ]);
  }
  const existing = await run(tx, `SELECT ts.student_id, s.email FROM teacher_students ts
    JOIN students s ON s.id=ts.student_id WHERE ts.teacher_id=?`, [teacherId]);
  for (const row of existing.rows) {
    if (!emails.has(String(row.email).toLowerCase())) {
      await run(tx, 'DELETE FROM teacher_students WHERE teacher_id=? AND student_id=?', [teacherId, row.student_id]);
    }
  }
};

const writeTasks = async (tx, teacherId, records) => {
  const ids = new Set();
  for (const item of parseArray(records)) {
    if (!item?.id || !item.title) throw new Error('Every task requires an id and title');
    ids.add(String(item.id));
    const requestedClassId = asText(item.classId);
    if (requestedClassId) {
      const classExists = await run(tx, 'SELECT id FROM classes WHERE id=? AND teacher_id=?', [requestedClassId, teacherId]);
      if (!classExists.rows.length) throw new Error(`Class ${requestedClassId} does not belong to teacher ${teacherId}`);
    }
    await run(tx, `INSERT INTO tasks
      (id, teacher_id, class_id, title, description, subject, due_at, priority,
       status, max_points, total_points, created_at, updated_at, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET class_id=excluded.class_id, title=excluded.title,
      description=excluded.description, subject=excluded.subject, due_at=excluded.due_at,
      priority=excluded.priority, status=excluded.status, max_points=excluded.max_points,
      total_points=excluded.total_points, created_at=excluded.created_at,
      updated_at=excluded.updated_at, source_json=excluded.source_json
      WHERE tasks.teacher_id=excluded.teacher_id`, [
      String(item.id), teacherId, asText(item.classId), String(item.title), asText(item.description),
      asText(item.subject), asText(item.dueDate || item.date), asText(item.priority),
      asText(item.status), finiteNumber(item.maxPoints || item.points),
      finiteNumber(item.totalPoints), asText(item.createdAt), asText(item.updatedAt),
      JSON.stringify(item),
    ]);
    const persisted = await run(tx, 'SELECT teacher_id FROM tasks WHERE id=?', [String(item.id)]);
    if (persisted.rows[0]?.teacher_id !== teacherId) {
      throw new Error(`Task ID ${item.id} is already owned by another teacher`);
    }
  }
  await deleteByIds(tx, 'tasks', 'id', ids, 'WHERE teacher_id = ?', [teacherId]);
};

const writeStudentTasks = async (tx, email, records) => {
  const student = await ensureStudent(tx, email);
  const taskIds = new Set();
  for (const item of parseArray(records)) {
    if (!item?.id || !item.title) throw new Error('Every assigned task requires an id and title');
    const taskId = String(item.id);
    taskIds.add(taskId);
    const requestedTeacherId = asText(item.teacherId);
    const teacherExists = requestedTeacherId
      ? (await run(tx, 'SELECT id FROM users WHERE id=?', [requestedTeacherId])).rows.length > 0
      : false;
    const teacherId = teacherExists ? requestedTeacherId : null;
    const requestedClassId = asText(item.classId);
    const classExists = requestedClassId
      ? (await run(tx, 'SELECT id FROM classes WHERE id=?', [requestedClassId])).rows.length > 0
      : false;
    await run(tx, `INSERT INTO tasks
      (id, teacher_id, class_id, title, description, subject, due_at, priority, status,
       max_points, total_points, created_at, updated_at, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING`, [
      taskId, teacherId, classExists ? requestedClassId : null, String(item.title), asText(item.description),
      asText(item.subject), asText(item.dueDate || item.date), asText(item.priority),
      asText(item.status), finiteNumber(item.maxPoints || item.points), finiteNumber(item.totalPoints),
      asText(item.createdAt), asText(item.updatedAt), JSON.stringify(item),
    ]);
    await run(tx, `INSERT INTO task_assignments
      (task_id, student_id, assigned_by, assigned_at, due_at, status, completed, score, grade, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, student_id) DO UPDATE SET
      assigned_by=COALESCE(excluded.assigned_by, task_assignments.assigned_by),
      due_at=excluded.due_at, status=excluded.status, completed=excluded.completed,
      score=excluded.score, grade=excluded.grade, source_json=excluded.source_json`, [
      taskId, student.id, teacherId, asText(item.createdAt), asText(item.dueDate),
      asText(item.status), item.completed ? 1 : 0, finiteNumber(item.score),
      typeof item.grade === 'string' ? item.grade : null, JSON.stringify(item),
    ]);
  }
  const current = await run(tx, 'SELECT task_id FROM task_assignments WHERE student_id=?', [student.id]);
  for (const row of current.rows) {
    if (!taskIds.has(row.task_id)) {
      await run(tx, 'DELETE FROM task_assignments WHERE student_id=? AND task_id=?', [student.id, row.task_id]);
    }
  }
};

const writeGrades = async (tx, namespace, suffix, records) => {
  const grades = namespace === 'task_grades'
    ? Object.entries(records && typeof records === 'object' && !Array.isArray(records) ? records : {}).map(([email, value]) => ({ studentEmail: email, taskId: suffix, grade: value, score: finiteNumber(value) }))
    : parseArray(records);
  let existingTaskGrades = [];
  if (namespace === 'student_grades') {
    await run(tx, 'DELETE FROM grades WHERE student_email=? COLLATE NOCASE', [suffix]);
  } else if (namespace === 'dental_college_grades') {
    await run(tx, 'DELETE FROM grades WHERE graded_by=?', [suffix]);
  } else if (namespace === 'task_grades') {
    const existing = await run(tx, 'SELECT * FROM grades WHERE task_id=?', [suffix]);
    existingTaskGrades = existing.rows;
    const emails = new Set(grades.map(grade => String(grade.studentEmail).toLowerCase()));
    for (const row of existingTaskGrades) {
      if (!emails.has(String(row.student_email).toLowerCase())) {
        await run(tx, 'DELETE FROM grades WHERE id=?', [row.id]);
      }
    }
  }
  for (const grade of grades) {
    const email = namespace === 'student_grades' ? suffix : grade.studentEmail;
    if (!email) throw new Error('Grade records require a student email');
    const student = await ensureStudent(tx, email, { id: grade.studentId, name: grade.studentName });
    const existingTaskGrade = namespace === 'task_grades'
      ? existingTaskGrades.find(row => row.student_email.toLowerCase() === String(email).toLowerCase())
      : null;
    const taskId = asText(grade.taskId || grade.task_id || (namespace === 'task_grades' ? suffix : null));
    const taskExists = taskId
      ? (await run(tx, 'SELECT id FROM tasks WHERE id=?', [taskId])).rows.length > 0
      : false;
    const gradeId = String(grade.id || existingTaskGrade?.id || `${taskId || 'grade'}:${email.toLowerCase()}`);
    const teacherId = asText(
      grade.teacherId
      || (namespace === 'dental_college_grades' ? suffix : null)
      || existingTaskGrade?.graded_by,
    );
    const params = [
      gradeId, student.id, email, taskExists ? taskId : null, teacherId,
      asText(grade.subject || existingTaskGrade?.subject),
      asText(grade.assignment || existingTaskGrade?.assignment),
      typeof grade.grade === 'string' ? grade.grade : null,
      finiteNumber(grade.score ?? grade.grade) ?? finiteNumber(existingTaskGrade?.score),
      finiteNumber(grade.maxScore ?? grade.maxPoints) ?? finiteNumber(existingTaskGrade?.max_score),
      asText(grade.gradedAt || grade.date || existingTaskGrade?.graded_at),
      grade.answers === undefined ? null : JSON.stringify(grade.answers),
      JSON.stringify({ ...parseJson(existingTaskGrade?.source_json), ...grade }),
    ];
    const existingStudentTaskGrade = taskExists ? await run(tx, `SELECT id FROM grades
      WHERE student_id=? AND task_id=?`, [student.id, taskId]) : { rows: [] };
    if (existingStudentTaskGrade.rows[0] && existingStudentTaskGrade.rows[0].id !== gradeId) {
      await run(tx, 'DELETE FROM grades WHERE id=?', [existingStudentTaskGrade.rows[0].id]);
    }
    await run(tx, `INSERT INTO grades
      (id, student_id, student_email, task_id, graded_by, subject, assignment, grade,
       score, max_score, graded_at, answers_json, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET grade=excluded.grade, score=excluded.score,
      max_score=excluded.max_score, graded_at=excluded.graded_at,
      graded_by=COALESCE(excluded.graded_by, grades.graded_by),
      subject=COALESCE(excluded.subject, grades.subject),
      assignment=COALESCE(excluded.assignment, grades.assignment),
      source_json=excluded.source_json`, params);
  }
};

const writeNotifications = async (tx, email, records) => {
  const student = await ensureStudent(tx, email);
  await run(tx, 'DELETE FROM notifications WHERE student_email=? COLLATE NOCASE', [email]);
  for (const item of parseArray(records)) {
    const id = String(item.id || `notification-${Date.now()}-${Math.random()}`);
    const taskId = asText(item.taskId);
    const exists = taskId ? (await run(tx, 'SELECT id FROM tasks WHERE id=?', [taskId])).rows.length > 0 : false;
    await run(tx, `INSERT INTO notifications
      (id, student_id, student_email, type, title, message, task_id, is_read, created_at, source_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, student.id, email, asText(item.type), asText(item.title), asText(item.message),
      exists ? taskId : null, item.read ? 1 : 0, asText(item.createdAt), JSON.stringify(item),
    ]);
  }
};

const writeActivity = async (tx, email, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Activity data must be an object');
  const student = await ensureStudent(tx, email);
  await run(tx, `INSERT INTO student_activity
    (student_id, current_streak, longest_streak, last_activity_date, source_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET current_streak=excluded.current_streak,
    longest_streak=excluded.longest_streak, last_activity_date=excluded.last_activity_date,
    source_json=excluded.source_json`, [
    student.id, Math.trunc(finiteNumber(value.currentStreak) ?? 0),
    Math.trunc(finiteNumber(value.longestStreak) ?? 0), asText(value.lastActivityDate),
    JSON.stringify(value),
  ]);
  await run(tx, 'DELETE FROM student_activity_days WHERE student_id=?', [student.id]);
  for (const date of Array.isArray(value.dates) ? value.dates : []) {
    await run(tx, 'INSERT OR IGNORE INTO student_activity_days (student_id, activity_date) VALUES (?, ?)', [student.id, String(date)]);
  }
};

const writeProfile = async (tx, email, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Student profile must be an object');
  const student = await ensureStudent(tx, email, value);
  const profile = { ...value, email: String(email) };
  const username = value.username === undefined ? student.username : (asText(value.username) || null);
  await run(tx, `UPDATE students SET
    name=?, username=?, roll_number=?, batch=?, current_level=?, total_points=?, game_progress=?,
    registered_at=?, profile_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
    asText(value.name) || student.name, username,
    asText(value.rollNumber), asText(value.batch),
    Math.trunc(finiteNumber(value.currentLevel) ?? student.current_level),
    Math.trunc(finiteNumber(value.totalPoints) ?? student.total_points),
    finiteNumber(value.gameProgress) ?? student.game_progress, asText(value.registeredAt),
    JSON.stringify(profile), student.id,
  ]);
  if (student.user_id) {
    if (username) {
      await run(tx, `INSERT INTO usernames (username, user_id) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET username=excluded.username`, [username, student.user_id]);
    } else {
      await run(tx, 'DELETE FROM usernames WHERE user_id=?', [student.user_id]);
    }
  }
};

const writePortalData = (key, value) => {
  const { namespace, suffix } = splitKey(key);
  return withTransaction(async tx => {
    switch (namespace) {
      case 'classes':
        await writeClasses(tx, suffix, value); return;
      case 'students':
      case 'teacher_students':
        await writeRoster(tx, suffix, value); return;
      case 'tasks':
        await writeTasks(tx, suffix, value); return;
      case 'student_tasks':
        await writeStudentTasks(tx, suffix, value); return;
      case 'student_profile':
        await writeProfile(tx, suffix, value); return;
      case 'student': {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !value.email) {
          throw new Error('Student records require an email address');
        }
        await ensureStudent(tx, value.email, { ...value, id: value.id || suffix });
        return;
      }
      case 'teacher': {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new TypeError('Teacher profile must be an object');
        }
        const user = await run(tx, 'SELECT id FROM users WHERE id=? AND role != ?', [suffix, 'student']);
        if (!user.rows.length) throw new Error(`Teacher ${suffix} does not exist`);
        await run(tx, `INSERT INTO teacher_profiles (user_id, source_json)
          VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET source_json=excluded.source_json`,
        [suffix, JSON.stringify(value)]);
        return;
      }
      case 'student_grades':
      case 'dental_college_grades':
      case 'task_grades':
        await writeGrades(tx, namespace, suffix, value); return;
      case 'notifications':
        await writeNotifications(tx, suffix, value); return;
      case 'student_streak':
      case 'student_activity':
        await writeActivity(tx, suffix, value); return;
      case 'daily_quest': {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !value.id) throw new Error('Daily quest requires an id');
        const teacherId = asText(value.teacherId);
        await run(tx, `INSERT INTO daily_quests
          (id, teacher_id, class_id, quest_date, title, description, points, source_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET teacher_id=excluded.teacher_id, class_id=excluded.class_id,
          quest_date=excluded.quest_date, title=excluded.title, description=excluded.description,
          points=excluded.points, source_json=excluded.source_json`, [
          String(value.id), teacherId, asText(value.classId), asText(value.date),
          asText(value.title), asText(value.description), finiteNumber(value.points), JSON.stringify(value),
        ]);
        return;
      }
      case 'daily_quest_seen':
        await run(tx, `INSERT INTO daily_quest_views (legacy_key, student_id, has_seen)
          VALUES (?, ?, ?) ON CONFLICT(legacy_key) DO UPDATE SET has_seen=excluded.has_seen`, [
          key, null, value ? 1 : 0,
        ]);
        return;
      case 'username': {
        const userId = typeof value === 'string' ? value : null;
        if (!userId) throw new Error('Username index requires a user ID');
        await run(tx, 'INSERT INTO usernames (username, user_id) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET user_id=excluded.user_id', [suffix, userId]);
        return;
      }
      default:
        throw new Error(`No relational storage mapping is defined for "${namespace}"`);
    }
  });
};

const deletePortalData = (key) => {
  const { namespace, suffix } = splitKey(key);
  return withTransaction(async tx => {
    switch (namespace) {
      case 'classes':
        await run(tx, 'DELETE FROM classes WHERE teacher_id=?', [suffix]); return;
      case 'students':
      case 'teacher_students':
        await run(tx, 'DELETE FROM teacher_students WHERE teacher_id=?', [suffix]); return;
      case 'tasks':
        await run(tx, 'DELETE FROM tasks WHERE teacher_id=?', [suffix]); return;
      case 'student_tasks':
        await run(tx, `DELETE FROM task_assignments WHERE student_id IN
          (SELECT id FROM students WHERE email=? COLLATE NOCASE)`, [suffix]); return;
      case 'student_profile':
        await run(tx, 'DELETE FROM students WHERE email=? COLLATE NOCASE', [suffix]); return;
      case 'student':
        await run(tx, 'DELETE FROM students WHERE id=?', [suffix]); return;
      case 'teacher':
        await run(tx, 'DELETE FROM teacher_profiles WHERE user_id=?', [suffix]); return;
      case 'student_grades':
        await run(tx, 'DELETE FROM grades WHERE student_email=? COLLATE NOCASE', [suffix]); return;
      case 'dental_college_grades':
        await run(tx, 'DELETE FROM grades WHERE graded_by=?', [suffix]); return;
      case 'task_grades':
        await run(tx, 'DELETE FROM grades WHERE task_id=?', [suffix]); return;
      case 'notifications':
        await run(tx, 'DELETE FROM notifications WHERE student_email=? COLLATE NOCASE', [suffix]); return;
      case 'student_streak':
      case 'student_activity':
        await run(tx, `DELETE FROM student_activity WHERE student_id IN
          (SELECT id FROM students WHERE email=? COLLATE NOCASE)`, [suffix]); return;
      case 'daily_quest':
        await run(tx, 'DELETE FROM daily_quests'); return;
      case 'daily_quest_seen':
        await run(tx, 'DELETE FROM daily_quest_views WHERE legacy_key=?', [key]); return;
      case 'username':
        await run(tx, 'DELETE FROM usernames WHERE username=? COLLATE NOCASE', [suffix]); return;
      default:
        throw new Error(`No relational delete mapping is defined for "${namespace}"`);
    }
  });
};

const listPortalDataByPrefix = async prefix => {
  const { namespace } = splitKey(prefix.endsWith(':') ? prefix.slice(0, -1) : prefix);
  let suffixes = [];
  switch (namespace) {
    case 'classes':
      suffixes = (await readRows('SELECT DISTINCT teacher_id AS suffix FROM classes')).map(row => row.suffix); break;
    case 'students':
    case 'teacher_students':
      suffixes = (await readRows('SELECT DISTINCT teacher_id AS suffix FROM teacher_students')).map(row => row.suffix); break;
    case 'tasks':
      suffixes = (await readRows('SELECT DISTINCT teacher_id AS suffix FROM tasks WHERE teacher_id IS NOT NULL')).map(row => row.suffix); break;
    case 'student_tasks':
    case 'student_grades':
    case 'notifications':
    case 'student_streak':
    case 'student_activity':
    case 'student_profile':
      suffixes = (await readRows(`SELECT DISTINCT email AS suffix FROM students
        ${namespace === 'student_tasks' ? 'WHERE id IN (SELECT student_id FROM task_assignments)' : ''}
        ${namespace === 'student_grades' ? 'WHERE id IN (SELECT student_id FROM grades)' : ''}
        ${namespace === 'notifications' ? 'WHERE email COLLATE NOCASE IN (SELECT student_email COLLATE NOCASE FROM notifications)' : ''}
        ${namespace === 'student_streak' || namespace === 'student_activity' ? 'WHERE id IN (SELECT student_id FROM student_activity)' : ''}`)).map(row => row.suffix); break;
    case 'dental_college_grades':
      suffixes = (await readRows('SELECT DISTINCT graded_by AS suffix FROM grades WHERE graded_by IS NOT NULL')).map(row => row.suffix); break;
    case 'task_grades':
      suffixes = (await readRows('SELECT DISTINCT task_id AS suffix FROM grades WHERE task_id IS NOT NULL')).map(row => row.suffix); break;
    case 'username':
      suffixes = (await readRows('SELECT username AS suffix FROM usernames')).map(row => row.suffix); break;
    case 'daily_quest_seen':
      return (await readRows('SELECT legacy_key AS key, has_seen FROM daily_quest_views WHERE legacy_key LIKE ?', [`${prefix}%`]))
        .map(row => ({ key: row.key, value: Boolean(row.has_seen) }));
    case 'teacher':
      suffixes = (await readRows('SELECT id AS suffix FROM users WHERE role != ?', ['student'])).map(row => row.suffix); break;
    case 'student':
      suffixes = (await readRows('SELECT id AS suffix FROM students')).map(row => row.suffix); break;
    case 'daily_quest': {
      const value = await readPortalData('daily_quest');
      return value ? [{ key: 'daily_quest', value }] : [];
    }
    default:
      throw new Error(`No relational prefix mapping is defined for "${namespace}"`);
  }
  const results = [];
  for (const suffix of suffixes) {
    const key = `${namespace}:${suffix}`;
    results.push({ key, value: await readPortalData(key) });
  }
  return results;
};

module.exports = {
  readPortalData,
  writePortalData,
  deletePortalData,
  listPortalDataByPrefix,
  withTransaction,
  ensureStudent,
};
