/* eslint-disable @typescript-eslint/no-explicit-any */

const gradeMap: Record<string, number> = {
  'A+': 100, A: 95, 'A-': 90, 'B+': 85, B: 80, 'B-': 75,
  'C+': 70, C: 65, 'C-': 60, D: 50, F: 0,
};

function mergeTaskCompletion(tasks: any, grades: any) {
  const gradeList = Array.isArray(grades) ? grades : [];
  return (Array.isArray(tasks) ? tasks : []).map((task: any) => {
    const grade = gradeList.find((item: any) => item.taskId === task.id || item.task_id === task.id);
    return { ...task, completed: Boolean(task.completed || grade), grade: grade?.grade ?? task.grade };
  });
}

function calculateStats(grades: any, tasks: any, streak: any) {
  const gradeList = Array.isArray(grades) ? grades : [];
  const taskList = Array.isArray(tasks) ? tasks : [];
  const totalEXP = gradeList.reduce((sum: number, grade: any) => {
    const numericScore = Number(grade.score);
    const percentage = Number.isFinite(numericScore) && Number(grade.maxScore) > 0
      ? (numericScore / Number(grade.maxScore)) * 100
      : gradeMap[grade.grade] || 0;
    const bonus = percentage >= 95 ? 15 : percentage >= 90 ? 10 : percentage >= 80 ? 5 : 0;
    return sum + Math.floor(percentage) + bonus;
  }, 0);
  const completedAssignments = taskList.filter((task: any) => task.completed).length;
  return {
    totalEXP,
    level: Math.floor(totalEXP / 500) + 1,
    currentLevelEXP: totalEXP % 500,
    nextLevelEXP: 500,
    streak: streak?.currentStreak || 0,
    totalAssignments: taskList.length,
    completedAssignments,
  };
}

module.exports = { mergeTaskCompletion, calculateStats };
