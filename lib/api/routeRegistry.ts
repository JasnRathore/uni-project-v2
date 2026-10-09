export type Handler = (req: unknown, res: unknown) => Promise<unknown>;

export type RouteDefinition = {
  method: string;
  path: string;
  handler: Handler;
  protectedRoute: boolean;
  studentOnly: boolean;
  parameter?: string;
};

export function createRouteRegistry(
  authController: Record<string, Handler>,
  studentController: Record<string, Handler>,
  teacherController: Record<string, Handler>,
): RouteDefinition[] {
  return [
    ['POST', '/auth/login', authController.login, false, false],
    ['POST', '/signup', authController.signup, false, false],
    ['POST', '/student/signup', authController.studentSignup, false, false],
    ['POST', '/account/reactivate', authController.reactivateAccount, true, false],
    ['GET', '/student/profile', studentController.getProfile, true, true],
    ['GET', '/student/data', studentController.getData, true, true],
    ['GET', '/student/dashboard', studentController.getDashboard, true, true],
    ['GET', '/student/leaderboard', studentController.getLeaderboard, true, true],
    ['GET', '/student/notifications', studentController.getNotifications, true, true],
    ['POST', '/student/notifications/read', studentController.markNotificationRead, true, true],
    ['POST', '/student/profile/update', studentController.updateProfile, true, true],
    ['POST', '/student/quiz/submit', studentController.submitQuiz, true, true],
    ['GET', '/student/quest', studentController.getQuest, true, true],
    ['GET', '/quest', studentController.getQuest, true, true],
    ['GET', '/teacher/profile', teacherController.getProfile, true, false],
    ['GET', '/teacher/data', teacherController.getData, true, false],
    ['POST', '/teacher/students', teacherController.saveStudents, true, false],
    ['POST', '/teacher/classes', teacherController.saveClasses, true, false],
    ['POST', '/teacher/tasks', teacherController.createTask, true, false],
    ['POST', '/teacher/add-task', teacherController.addTask, true, false],
    ['POST', '/teacher/quest', teacherController.addTask, true, false],
    ['POST', '/teacher/task-students', teacherController.getTaskStudents, true, false],
    ['POST', '/teacher/grades', teacherController.saveGrades, true, false],
    ['GET', '/teacher/all-students', teacherController.getAllStudents, true, false],
    ['GET', '/teacher/task-stats', teacherController.getTaskStats, true, false],
    ['POST', '/teacher/profile/update', teacherController.updateProfile, true, false],
    ['POST', '/teacher/account/deactivate', teacherController.deactivateAccount, true, false],
    ['DELETE', '/teacher/account', teacherController.deleteAccount, true, false],
    ['POST', '/teacher/assign-student', teacherController.assignStudent, true, false],
    ['POST', '/teacher/unassign-student', teacherController.unassignStudent, true, false],
    ['POST', '/teacher/students-batch-data', teacherController.batchStudentData, true, false],
    ['POST', '/teacher/task-grade', teacherController.saveSingleTaskGrade, true, false],
    ['DELETE', '/teacher/classes/:classId', teacherController.deleteClass, true, false, 'classId'],
    ['PUT', '/teacher/students/:studentId', teacherController.updateManualStudent, true, false, 'studentId'],
    ['PUT', '/teacher/tasks/:taskId', teacherController.updateTask, true, false, 'taskId'],
    ['DELETE', '/teacher/tasks/:taskId', teacherController.deleteTask, true, false, 'taskId'],
    ['GET', '/teacher/task-grades/:taskId', teacherController.getTaskGrades, true, false, 'taskId'],
    ['GET', '/teacher/student-streak/:email', teacherController.getStudentStreak, true, false, 'email'],
    ['GET', '/teacher/student-tasks/:email', teacherController.getStudentTasks, true, false, 'email'],
  ].map(([method, path, handler, protectedRoute, studentOnly, parameter]) => ({
    method, path, handler, protectedRoute, studentOnly, parameter,
  }));
}

export function findRoute(routes: RouteDefinition[], method: string, path: string) {
  const exact = routes.find(route => route.method === method && route.path === path);
  if (exact) return { route: exact, params: {} as Record<string, string> };

  for (const route of routes) {
    if (!route.parameter || route.method !== method) continue;
    const prefix = route.path.slice(0, route.path.indexOf('/:'));
    if (!path.startsWith(`${prefix}/`)) continue;
    return {
      route,
      params: { [route.parameter]: decodeURIComponent(path.slice(prefix.length + 1)) },
    };
  }
  return null;
}
