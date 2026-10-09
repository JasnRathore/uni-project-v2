/* eslint-disable @typescript-eslint/no-require-imports */
const {
  readPortalData,
  writePortalData,
  deletePortalData,
  listPortalDataByPrefix,
} = require('../../../database/services/dbService');

const key = {
  studentTasks: email => `student_tasks:${email}`,
  studentGrades: email => `student_grades:${email}`,
  teacherGrades: teacherId => `dental_college_grades:${teacherId}`,
  taskGrades: taskId => `task_grades:${taskId}`,
  notifications: email => `notifications:${email}`,
  streak: email => `student_streak:${email}`,
};

const readArray = async recordKey => {
  const value = await readPortalData(recordKey);
  return Array.isArray(value) ? value : [];
};

const readObject = async recordKey => {
  const value = await readPortalData(recordKey);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const portalStore = {
  key,
  readArray,
  readObject,
  readStudentTasks: email => readArray(key.studentTasks(email)),
  writeStudentTasks: (email, tasks) => writePortalData(key.studentTasks(email), tasks),
  readStudentGrades: email => readArray(key.studentGrades(email)),
  writeStudentGrades: (email, grades) => writePortalData(key.studentGrades(email), grades),
  readTeacherGrades: teacherId => readArray(key.teacherGrades(teacherId)),
  writeTeacherGrades: (teacherId, grades) => writePortalData(key.teacherGrades(teacherId), grades),
  readTaskGrades: taskId => readObject(key.taskGrades(taskId)),
  writeTaskGrades: (taskId, grades) => writePortalData(key.taskGrades(taskId), grades),
  readNotifications: email => readArray(key.notifications(email)),
  writeNotifications: (email, notifications) => writePortalData(key.notifications(email), notifications),
  readStreak: email => readPortalData(key.streak(email)),
  writeStreak: (email, streak) => writePortalData(key.streak(email), streak),
  listStudentTasks: () => listPortalDataByPrefix('student_tasks:'),
  listStudentGrades: () => listPortalDataByPrefix('student_grades:'),
  listNotifications: () => listPortalDataByPrefix('notifications:'),
  deleteTaskGrades: taskId => deletePortalData(key.taskGrades(taskId)),
};

module.exports = { portalStore };
