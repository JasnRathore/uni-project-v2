import { NextRequest } from 'next/server';
import authController from '@/lib/api/controllers/authController.js';
import studentController from '@/lib/api/controllers/studentController.js';
import teacherController from '@/lib/api/controllers/teacherController.js';
import { getUser } from '@/lib/api/middleware/authMiddleware.js';
import { ensureDatabaseReady, readPortalData } from '@/database/services/dbService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiRequest = {
  body: Record<string, unknown>;
  params: Record<string, string>;
  user?: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
  headers: Record<string, string>;
};
type ApiResponse = {
  status(code: number): { json(value: unknown): Response | undefined };
  json(value: unknown): Response | undefined;
};
type Handler = (req: ApiRequest, res: ApiResponse) => Promise<unknown>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

async function dispatch(request: NextRequest, segments: string[]) {
  try {
    await ensureDatabaseReady();
  } catch (error: unknown) {
    console.error('Database initialization failed:', error);
    return response({ error: 'Database is not ready', detail: error instanceof Error ? error.message : String(error) }, 503);
  }

  const path = `/${segments.join('/')}`;
  if (path === '/health') return response({ status: 'ok' });

  const routes: Array<[string, string, Handler, boolean, boolean]> = [
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
  ];

  const method = request.method;
  const params: Record<string, string> = {};
  let match: [string, string, Handler, boolean, boolean] | [string, string, Handler, boolean, boolean, string] | undefined =
    routes.find(([routeMethod, routePath]) => routeMethod === method && routePath === path);
  if (!match) {
    const patterns: Array<[string, string, Handler, boolean, boolean, string]> = [
      ['DELETE', '/teacher/classes/:classId', teacherController.deleteClass, true, false, 'classId'],
      ['PUT', '/teacher/students/:studentId', teacherController.updateManualStudent, true, false, 'studentId'],
      ['PUT', '/teacher/tasks/:taskId', teacherController.updateTask, true, false, 'taskId'],
      ['DELETE', '/teacher/tasks/:taskId', teacherController.deleteTask, true, false, 'taskId'],
      ['GET', '/teacher/task-grades/:taskId', teacherController.getTaskGrades, true, false, 'taskId'],
      ['GET', '/teacher/student-streak/:email', teacherController.getStudentStreak, true, false, 'email'],
      ['GET', '/teacher/student-tasks/:email', teacherController.getStudentTasks, true, false, 'email'],
    ];
    const pattern = patterns.find(([routeMethod, routePath]) => {
      const base = routePath.replace(/:[^/]+$/, '');
      return routeMethod === method && path.startsWith(base);
    });
    if (pattern) {
      const key = pattern[5];
      params[key] = decodeURIComponent(path.slice(pattern[1].slice(0, pattern[1].indexOf(':')).length));
      match = pattern;
    }
  }

  if (!match && method === 'GET' && path === '/debug/students') {
    const user = await getUser(request.headers.get('authorization'));
    if (!user) return response({ error: 'Unauthorized' }, 401);
    const students = (await readPortalData(`students:${user.id}`)) || [];
    return response({ students, count: Array.isArray(students) ? students.length : 0 });
  }
  if (!match) return response({ error: 'Not found' }, 404);

  const [, , handler, protectedRoute, studentOnly] = match;
  let user;
  if (protectedRoute) {
    user = await getUser(request.headers.get('authorization'));
    if (!user) return response({ error: 'Unauthorized' }, 401);
    if (user.app_metadata?.accountDisabled && path !== '/account/reactivate') {
      return response({ error: 'This account has been deactivated' }, 403);
    }
    if (studentOnly && user.user_metadata?.role !== 'student') {
      return response({ error: 'Student access required' }, 403);
    }
    if (!studentOnly && path.startsWith('/teacher') && user.user_metadata?.role === 'student') {
      return response({ error: 'Teacher access required' }, 403);
    }
  }

  let body: Record<string, unknown> = {};
  if (method !== 'GET' && method !== 'DELETE') {
    try { body = await request.json(); } catch { body = {}; }
  }
  let result: Response | undefined;
  const req = {
    body,
    params,
    user,
    headers: Object.fromEntries(request.headers.entries()),
  };
  const res = {
    status(code: number) { return { json(value: unknown) { result = response(value, code); return result; } }; },
    json(value: unknown) { result = response(value); return result; },
  };
  await handler(req, res);
  return result || response({ error: 'No response returned' }, 500);
}

export async function GET(request: NextRequest, context: { params: Promise<{ route: string[] }> }) {
  return dispatch(request, (await context.params).route);
}
export async function POST(request: NextRequest, context: { params: Promise<{ route: string[] }> }) {
  return dispatch(request, (await context.params).route);
}
export async function PUT(request: NextRequest, context: { params: Promise<{ route: string[] }> }) {
  return dispatch(request, (await context.params).route);
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ route: string[] }> }) {
  return dispatch(request, (await context.params).route);
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
