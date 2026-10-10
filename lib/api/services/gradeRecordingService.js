/* eslint-disable @typescript-eslint/no-require-imports */
const { portalStore } = require('../storage/portalStore');
const { trackStudentActivity } = require('./studentService');
const { awardXp } = require('./xpService');
const { getDatabaseClient } = require('../../../database/services/dbService');

const gradeToScore = {
  'A+': 100, A: 95, 'A-': 90, 'B+': 85, B: 80, 'B-': 75,
  'C+': 70, C: 65, 'C-': 60, D: 50, F: 0,
};

function normalizeScore(grade, score) {
  const numericScore = Number(score ?? grade);
  if (Number.isFinite(numericScore)) return numericScore;
  if (typeof grade === 'string' && Object.prototype.hasOwnProperty.call(gradeToScore, grade)) {
    return gradeToScore[grade];
  }
  throw new Error('Grade must be a valid number or supported letter grade');
}

function buildGradeEntry({ task, assignment, classData, student, teacherId, grade, score, maxScore, answers }) {
  const numericScore = normalizeScore(grade, score);
  const taskId = task?.id || null;
  return {
    id: taskId ? `${taskId}:${student.id}` : `grade:${student.id}:${classData.id}:${Date.now()}`,
    taskId,
    task_id: taskId,
    teacherId,
    studentId: student?.id,
    studentName: student?.name,
    classId: classData.id,
    className: classData.name,
    subject: classData.subject_name,
    assignment: task?.title || task?.assignment || assignment || 'Assignment',
    grade,
    score: numericScore,
    maxScore: maxScore || 100,
    maxPoints: task?.maxPoints || task?.points || 100,
    date: new Date().toISOString().split('T')[0],
    gradedAt: new Date().toISOString(),
    ...(answers === undefined ? {} : { answers }),
  };
}

async function upsertByTask(records, entry) {
  const index = entry.taskId
    ? records.findIndex(item => item.taskId === entry.taskId || item.task_id === entry.taskId)
    : records.findIndex(item => item.id === entry.id);
  if (index >= 0) records[index] = entry;
  else records.push(entry);
  return records;
}

async function recordGrade({ task = null, assignment, student, studentId, classId, teacherId, grade, score, maxScore, answers }) {
  const resolvedStudentId = studentId || student?.id;
  const resolvedClassId = classId || task?.classId;
  if (!resolvedStudentId || !resolvedClassId) throw new Error('A student ID and class are required');
  if (task && (!task.id || String(task.classId) !== String(resolvedClassId))) {
    throw new Error('Grade class must match the task class');
  }
  const db = getDatabaseClient();
  const [studentResult, classResult] = await Promise.all([
    db.execute({
      sql: "SELECT id, email, name FROM students WHERE id=? AND lifecycle_state='active'",
      args: [resolvedStudentId],
    }),
    db.execute({
      sql: `SELECT c.id, c.name, c.teacher_id, s.name AS subject_name
        FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.id=?`,
      args: [resolvedClassId],
    }),
  ]);
  const studentRow = studentResult.rows[0];
  if (!studentRow) throw new Error('Active student not found');
  const classData = classResult.rows[0];
  if (!classData || (teacherId && classData.teacher_id !== teacherId)) throw new Error('Class not found');
  const canonicalStudent = { ...student, id: studentRow.id, email: studentRow.email, name: student?.name || studentRow.name };
  const maximum = Number(maxScore || task?.maxPoints || task?.points || 100);
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error('Maximum score must be positive');
  const entry = buildGradeEntry({ task, assignment, classData, student: canonicalStudent, teacherId, grade, score, maxScore, answers });
  if (entry.score < 0 || entry.score > maximum) throw new Error('Score must be between zero and the maximum score');
  const studentEmail = studentRow.email;
  const studentGrades = await portalStore.readStudentGrades(studentEmail);
  const studentTasks = task ? await portalStore.readStudentTasks(studentEmail) : [];

  await upsertByTask(studentGrades, entry);
  if (task) {
    const taskIndex = studentTasks.findIndex(item => item.id === task.id);
    const completedTask = {
      ...task,
      ...(taskIndex >= 0 ? studentTasks[taskIndex] : {}),
      completed: true,
      grade: entry.grade,
      score: entry.score,
    };
    if (taskIndex >= 0) studentTasks[taskIndex] = completedTask;
    else studentTasks.push(completedTask);
  }

  const writes = [
    portalStore.writeStudentGrades(studentEmail, studentGrades),
    ...(task ? [portalStore.writeStudentTasks(studentEmail, studentTasks)] : []),
    trackStudentActivity(studentEmail, task?.dueDate),
  ];

  if (teacherId) {
    const [teacherGrades, taskGrades] = await Promise.all([
      portalStore.readTeacherGrades(teacherId),
      task ? portalStore.readTaskGrades(task.id) : Promise.resolve({}),
    ]);
    await upsertByTask(teacherGrades, entry);
    writes.push(portalStore.writeTeacherGrades(teacherId, teacherGrades));
    if (task) writes.push(portalStore.writeTaskGrades(task.id, { ...taskGrades, [studentRow.id]: entry.grade }));
  }

  const notifications = await portalStore.readNotifications(studentEmail);
  const label = task?.title || entry.assignment;
  notifications.push({
    id: `notif-grade-${entry.id}`,
    type: 'grade',
    title: `Grade Assigned: ${entry.grade}`,
    message: `You received a grade of ${entry.grade} for "${label}"`,
    createdAt: new Date().toISOString(),
    read: false,
    ...(task ? { taskId: task.id } : {}),
  });
  writes.push(portalStore.writeNotifications(studentEmail, notifications));
  await Promise.all(writes);
  const percentage = Math.round((entry.score / maximum) * 100);
  const points = percentage + (percentage >= 95 ? 15 : percentage >= 90 ? 10 : percentage >= 80 ? 5 : 0);
  await awardXp({
    studentId: studentRow.id,
    points,
    sourceApplication: 'portal',
    sourceType: task?.type === 'quiz' ? 'quiz' : 'grade',
    sourceId: task?.id || entry.id,
    idempotencyKey: `grade:${studentRow.id}:${task?.id || entry.id}`,
    createdBy: teacherId || null,
  });
  return entry;
}

module.exports = { recordGrade, normalizeScore };
