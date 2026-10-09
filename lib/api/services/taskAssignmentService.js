/* eslint-disable @typescript-eslint/no-require-imports */
const { readPortalData } = require('../../../database/services/dbService');
const { portalStore } = require('../storage/portalStore');

async function assignTaskToStudents(teacherId, task) {
  const allStudentsRaw = (await readPortalData(`students:${teacherId}`)) || [];
  const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
  const eligible = task.classId
    ? allStudents.filter(student => (
      student?.classId === task.classId
      || (Array.isArray(student?.classIds) && student.classIds.includes(task.classId))
    ) && student.email)
    : allStudents.filter(student => student?.email);

  for (const student of eligible) {
    const tasks = await portalStore.readStudentTasks(student.email);
    if (tasks.some(existing => existing.id === task.id)) continue;
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
