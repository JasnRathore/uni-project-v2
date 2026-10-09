import { NextRequest } from 'next/server';
import authController from '@/lib/api/controllers/authController.js';
import studentController from '@/lib/api/controllers/studentController.js';
import teacherController from '@/lib/api/controllers/teacherController.js';
import { getUser } from '@/lib/api/middleware/authMiddleware.js';
import { ensureDatabaseReady, readPortalData } from '@/database/services/dbService';
import { createRouteRegistry, findRoute } from '@/lib/api/routeRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const method = request.method;
  const route = findRoute(createRouteRegistry(authController, studentController, teacherController), method, path);
  const params = route?.params || {};

  if (!route && method === 'GET' && path === '/debug/students') {
    const user = await getUser(request.headers.get('authorization'));
    if (!user) return response({ error: 'Unauthorized' }, 401);
    const students = (await readPortalData(`students:${user.id}`)) || [];
    return response({ students, count: Array.isArray(students) ? students.length : 0 });
  }
  if (!route) return response({ error: 'Not found' }, 404);

  const { handler, protectedRoute, studentOnly } = route.route;
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
  try {
    await handler(req, res);
  } catch (error: unknown) {
    console.error(`API handler failed for ${method} ${path}:`, error);
    return response({
      error: error instanceof Error ? error.message : 'Request failed',
    }, 500);
  }
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
