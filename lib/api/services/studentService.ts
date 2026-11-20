/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const { readPortalData, writePortalData } = require('../../../database/services/dbService.ts');

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function hasMissedDeadline(tasks: any, today = getToday()): boolean {
  return (Array.isArray(tasks) ? tasks : []).some((task: any) =>
    !task.completed
    && task.dueDate
    && String(task.dueDate).slice(0, 10) < today,
  );
}

async function trackStudentActivity(email: string, dueDate?: string | null) {
  const streakKey = `student_streak:${email}`;
  const now = new Date();
  const today = getToday();
  const streakData = (await readPortalData(streakKey)) || { currentStreak: 0, longestStreak: 0, lastActivityDate: null, dates: [] };
  if (streakData.lastActivityDate === today && (!dueDate || String(dueDate).slice(0, 10) >= today)) return streakData;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const submittedLate = dueDate && String(dueDate).slice(0, 10) < today;
  if (submittedLate) {
    streakData.currentStreak = 1;
  } else if (streakData.lastActivityDate === yesterdayStr) {
    streakData.currentStreak += 1;
  } else {
    streakData.currentStreak = 1;
  }

  if (streakData.currentStreak > streakData.longestStreak) streakData.longestStreak = streakData.currentStreak;
  streakData.lastActivityDate = today;
  if (!streakData.dates.includes(today)) streakData.dates.push(today);

  await writePortalData(streakKey, streakData);
  return streakData;
}

async function getStudentStreak(email: string, tasks: any[] = []) {
  const streakKey = `student_streak:${email}`;
  const streakData = (await readPortalData(streakKey)) || {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    dates: [],
  };
  if (hasMissedDeadline(tasks) && streakData.currentStreak !== 0) {
    streakData.currentStreak = 0;
    await writePortalData(streakKey, streakData);
  }
  return streakData;
}

module.exports = {
  trackStudentActivity,
  getStudentStreak,
};
