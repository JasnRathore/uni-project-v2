/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const { readPortalData } = require('../../../database/services/dbService.ts');
const { portalStore } = require('../storage/portalStore.ts');
const { isActiveStudent } = require('./studentState.ts');

async function assignTaskToStudents(teacherId: string, task: any): Promise<number> {
  const allStudentsRaw = (await readPortalData(`students:${teacherId}`)) || [];
  const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
  const activeStudents = allStudents.filter(isActiveStudent);
  const eligible = task.classId
    ? activeStudents.filter((student: any) => (
      student?.classId === task.classId
      || (Array.isArray(student?.classIds) && student.classIds.includes(task.classId))
    ) && student.email)
    : activeStudents.filter((student: any) => student?.email);

  for (const student of eligible) {
    const tasks = await portalStore.readStudentTasks(student.email);
    if (tasks.some((existing: any) => existing.id === task.id)) continue;
    tasks.push({ ...task, completed: false, grade: null });
    await portalStore.writeStudentTasks(student.email, tasks);
    const notifications = await portalStore.readNotifications(student.email);
    notifications.push({
      id: `notif-${Date.now()}-${Math.random()}`,
      type: 'task',
      title: 'New Assignment',
      message: `You have been assigned: ${task.title}`,
      createdAt: new Date().toISOString(),
      read: false,
      taskId: task.id,
    });
    await portalStore.writeNotifications(student.email, notifications);
  }
  return eligible.length;
}

module.exports = { assignTaskToStudents };
