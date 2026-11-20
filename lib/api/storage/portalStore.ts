/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const {
  readPortalData,
  writePortalData,
  deletePortalData,
  listPortalDataByPrefix,
} = require('../../../database/services/dbService.ts');

const key = {
  studentTasks: (email: string) => `student_tasks:${email}`,
  studentGrades: (email: string) => `student_grades:${email}`,
  teacherGrades: (teacherId: string) => `dental_college_grades:${teacherId}`,
  taskGrades: (taskId: string) => `task_grades:${taskId}`,
  notifications: (email: string) => `notifications:${email}`,
  streak: (email: string) => `student_streak:${email}`,
};

const readArray = async (recordKey: string): Promise<any[]> => {
  const value = await readPortalData(recordKey);
  return Array.isArray(value) ? value : [];
};

const readObject = async (recordKey: string): Promise<Record<string, any>> => {
  const value = await readPortalData(recordKey);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const portalStore = {
  key,
  readArray,
  readObject,
  readStudentTasks: (email: string) => readArray(key.studentTasks(email)),
  writeStudentTasks: (email: string, tasks: any[]) => writePortalData(key.studentTasks(email), tasks),
  readStudentGrades: (email: string) => readArray(key.studentGrades(email)),
  writeStudentGrades: (email: string, grades: any[]) => writePortalData(key.studentGrades(email), grades),
  readTeacherGrades: (teacherId: string) => readArray(key.teacherGrades(teacherId)),
  writeTeacherGrades: (teacherId: string, grades: any[]) => writePortalData(key.teacherGrades(teacherId), grades),
  readTaskGrades: (taskId: string) => readObject(key.taskGrades(taskId)),
  writeTaskGrades: (taskId: string, grades: Record<string, any>) => writePortalData(key.taskGrades(taskId), grades),
  readNotifications: (email: string) => readArray(key.notifications(email)),
  writeNotifications: (email: string, notifications: any[]) => writePortalData(key.notifications(email), notifications),
  readStreak: (email: string) => readPortalData(key.streak(email)),
  writeStreak: (email: string, streak: any) => writePortalData(key.streak(email), streak),
  listStudentTasks: () => listPortalDataByPrefix('student_tasks:'),
  listStudentGrades: () => listPortalDataByPrefix('student_grades:'),
  listNotifications: () => listPortalDataByPrefix('notifications:'),
  deleteTaskGrades: (taskId: string) => deletePortalData(key.taskGrades(taskId)),
};

module.exports = { portalStore };
