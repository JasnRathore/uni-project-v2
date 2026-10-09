/* eslint-disable @typescript-eslint/no-require-imports */
const { portalStore } = require('../storage/portalStore');
const { trackStudentActivity } = require('./studentService');

const gradeToScore = {
  'A+': 100, A: 95, 'A-': 90, 'B+': 85, B: 80, 'B-': 75,
  'C+': 70, C: 65, 'C-': 60, D: 50, F: 0,
};

function normalizeScore(grade, score) {
  const numericScore = Number(score ?? grade);
  return Number.isFinite(numericScore) ? numericScore : (gradeToScore[grade] ?? 0);
}

function buildGradeEntry({ task, student, studentEmail, teacherId, grade, score, maxScore, answers }) {
  const numericScore = normalizeScore(grade, score);
  return {
    id: `${task.id}:${studentEmail}`,
    taskId: task.id,
    task_id: task.id,
    teacherId,
    studentId: student?.id,
    studentName: student?.name,
    studentEmail,
    classId: task.classId,
    className: task.className,
    subject: task.subject || task.className || 'General',
    assignment: task.title || 'Assignment',
    grade,
    score: numericScore,
    maxScore: maxScore || 100,
    maxPoints: task.maxPoints || task.points || 100,
    date: new Date().toISOString().split('T')[0],
    gradedAt: new Date().toISOString(),
    ...(answers === undefined ? {} : { answers }),
  };
}

async function upsertByTask(records, entry) {
  const index = records.findIndex(item => item.taskId === entry.taskId || item.task_id === entry.taskId);
  if (index >= 0) records[index] = entry;
  else records.push(entry);
  return records;
}

async function recordGrade({ task, student, studentEmail, teacherId, grade, score, maxScore, answers }) {
  if (!task?.id || !studentEmail) throw new Error('A task and student email are required');
  const entry = buildGradeEntry({ task, student, studentEmail, teacherId, grade, score, maxScore, answers });
  const [studentGrades, studentTasks] = await Promise.all([
    portalStore.readStudentGrades(studentEmail),
    portalStore.readStudentTasks(studentEmail),
  ]);

  await upsertByTask(studentGrades, entry);
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

  const writes = [
    portalStore.writeStudentGrades(studentEmail, studentGrades),
    portalStore.writeStudentTasks(studentEmail, studentTasks),
    trackStudentActivity(studentEmail, task.dueDate),
  ];

  if (teacherId) {
    const [teacherGrades, taskGrades] = await Promise.all([
      portalStore.readTeacherGrades(teacherId),
      portalStore.readTaskGrades(task.id),
    ]);
    await upsertByTask(teacherGrades, entry);
    writes.push(
      portalStore.writeTeacherGrades(teacherId, teacherGrades),
      portalStore.writeTaskGrades(task.id, { ...taskGrades, [studentEmail]: entry.grade }),
    );
  }

  const notifications = await portalStore.readNotifications(studentEmail);
  notifications.push({
    id: `notif-grade-${task.id}-${Date.now()}`,
    type: 'grade',
    title: `Grade Assigned: ${entry.grade}`,
    message: `You received a grade of ${entry.grade} for "${task.title || 'your assignment'}"`,
    createdAt: new Date().toISOString(),
    read: false,
    taskId: task.id,
  });
  writes.push(portalStore.writeNotifications(studentEmail, notifications));
  await Promise.all(writes);
  return entry;
}

module.exports = { recordGrade, normalizeScore };
