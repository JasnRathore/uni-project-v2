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
  adminController: Record<string, Handler> = {},
  gameController: Record<string, Handler> = {},
): RouteDefinition[] {
  const definitions: Array<[string, string, Handler, boolean, boolean, string?]> = [
    ['POST', '/auth/login', authController.login, false, false],
    ['POST', '/signup', authController.signup, false, false],
    ['POST', '/student/signup', authController.studentSignup, false, false],
    ['GET', '/academic/degrees', adminController.listPublicDegrees, false, false],
    ['GET', '/academic/departments', adminController.listPublicDepartments, false, false],
    ['GET', '/academic/cohorts', adminController.listAllPublicCohorts, false, false],
    ['GET', '/academic/degrees/:degreeId/cohorts', adminController.listPublicCohorts, false, false, 'degreeId'],
    ['GET', '/academic/degrees/:degreeId/program-years', adminController.listPublicProgramYears, false, false, 'degreeId'],
    ['GET', '/academic/program-years/:programYearId/subjects', adminController.listPublicSubjects, false, false, 'programYearId'],
    ['POST', '/account/reactivate', authController.reactivateAccount, true, false],
    ['GET', '/student/profile', studentController.getProfile, true, true],
    ['GET', '/student/data', studentController.getData, true, true],
    ['GET', '/student/dashboard', studentController.getDashboard, true, true],
    ['GET', '/student/leaderboard', studentController.getLeaderboard, true, true],
    ['GET', '/student/leaderboards/cohort', gameController.cohortLeaderboard, true, true],
    ['GET', '/student/leaderboards/classes', gameController.activeClasses, true, true],
    ['GET', '/student/leaderboards/classes/:classId', gameController.classLeaderboard, true, true, 'classId'],
    ['GET', '/leaderboards/cohort', gameController.cohortLeaderboard, true, true],
    ['GET', '/leaderboards/classes/:classId', gameController.classLeaderboard, true, true, 'classId'],
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
    ['POST', '/teacher/classes/create', teacherController.createClass, true, false],
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
    ['PUT', '/teacher/classes/:classId/lifecycle', teacherController.updateClassLifecycle, true, false, 'classId'],
    ['POST', '/teacher/classes/:classId/memberships', teacherController.addClassMembership, true, false, 'classId'],
    ['DELETE', '/teacher/classes/:classId/memberships/:studentId', teacherController.endClassMembership, true, false, 'classId'],
    ['GET', '/admin/degrees', adminController.listDegrees, true, false],
    ['POST', '/admin/degrees', adminController.createDegree, true, false],
    ['PUT', '/admin/degrees/:degreeId', adminController.updateDegree, true, false, 'degreeId'],
    ['GET', '/admin/degrees/:degreeId/program-years', adminController.listProgramYears, true, false, 'degreeId'],
    ['POST', '/admin/degrees/:degreeId/program-years', adminController.createProgramYear, true, false, 'degreeId'],
    ['POST', '/admin/program-years/:programYearId/subjects', adminController.createSubject, true, false, 'programYearId'],
    ['GET', '/admin/degrees/:degreeId/cohorts', adminController.listCohorts, true, false, 'degreeId'],
    ['POST', '/admin/degrees/:degreeId/cohorts', adminController.createCohort, true, false, 'degreeId'],
    ['PUT', '/admin/cohorts/:cohortId', adminController.updateCohort, true, false, 'cohortId'],
    ['PUT', '/admin/students/:studentId/identity', adminController.assignStudent, true, false, 'studentId'],
    ['GET', '/game/progression', gameController.progression, true, false],
    ['POST', '/game/rewards', gameController.reward, true, false],
  ];
  return definitions.map(([method, path, handler, protectedRoute, studentOnly, parameter]) => ({
    method, path, handler, protectedRoute, studentOnly, parameter,
  }));
}

export function findRoute(routes: RouteDefinition[], method: string, path: string) {
  const exact = routes.find(route => route.method === method && route.path === path);
  if (exact) return { route: exact, params: {} as Record<string, string> };

  for (const route of routes) {
    if (route.method !== method || !route.path.includes('/:')) continue;
    const names: string[] = [];
    const pattern = route.path.split('/').map(segment => {
      if (!segment.startsWith(':')) return segment;
      names.push(segment.slice(1));
      return '([^/]+)';
    }).join('/');
    const match = path.match(new RegExp(`^${pattern}$`));
    if (!match) continue;
    return { route, params: Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])])) };
  }
  return null;
}
