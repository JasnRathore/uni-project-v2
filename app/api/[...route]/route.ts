import { NextRequest } from 'next/server';
import { stringifySetCookie, type SetCookie } from 'cookie';
import { createRouteRegistry, findRoute } from '@/lib/api/routeRegistry';

/* eslint-disable @typescript-eslint/no-require-imports */
const authController = require('../../../lib/api/controllers/authController.ts');
const studentController = require('../../../lib/api/controllers/studentController.ts');
const teacherController = require('../../../lib/api/controllers/teacherController.ts');
const adminController = require('../../../lib/api/controllers/adminController.ts');
const gameController = require('../../../lib/api/controllers/gameController.ts');
const { getUser } = require('../../../lib/api/middleware/authMiddleware.ts');
const { readAuthCookies } = require('../../../lib/api/services/authCookieService.ts');
const { ensureDatabaseReady, getDatabaseClient } = require('../../../database/services/dbService.ts');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function response(body: unknown, status = 200, setCookies: string[] = []) {
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'application/json');
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
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
  const route = findRoute(createRouteRegistry(authController, studentController, teacherController, adminController, gameController), method, path);
  const params = route?.params || {};

  if (!route) return response({ error: 'Not found' }, 404);

  const { handler, protectedRoute, studentOnly } = route.route;
  const authCookies = readAuthCookies(request.headers.get('cookie'));
  const bearer = request.headers.get('authorization');
  let user;
  if (protectedRoute) {
    user = await getUser(bearer || (authCookies.accessToken ? `Bearer ${authCookies.accessToken}` : null));
    if (!user) return response({ error: 'Unauthorized' }, 401);
    if (user.app_metadata?.accountDisabled && path !== '/account/reactivate') {
      return response({ error: 'This account has been deactivated' }, 403);
    }
    if (studentOnly && user.user_metadata?.role !== 'student') {
      return response({ error: 'Student access required' }, 403);
    }
    if (path.startsWith('/game') && user.user_metadata?.role !== 'student') {
      return response({ error: 'Student access required' }, 403);
    }
    if (studentOnly || path.startsWith('/game')) {
      const activeStudent = await getDatabaseClient().execute({
        sql: "SELECT id FROM students WHERE (user_id = ? OR email = ? COLLATE NOCASE) AND lifecycle_state = 'active'",
        args: [user.id, user.email],
      });
      if (!activeStudent.rows.length) {
        return response({ error: 'An active student account is required' }, 403);
      }
    }
    if (!studentOnly && path.startsWith('/teacher') && user.user_metadata?.role === 'student') {
      return response({ error: 'Teacher access required' }, 403);
    }
    if (path.startsWith('/admin') && !['admin', 'administrator'].includes(user.user_metadata?.role)) {
      return response({ error: 'Administrator access required' }, 403);
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
    cookies: authCookies,
    headers: Object.fromEntries(request.headers.entries()),
  };
  const setCookies: string[] = [];
  const extraHeaders: Record<string, string> = {};
  const finalize = (value: unknown, code = 200) => {
    const apiResponse = response(value, code, setCookies);
    for (const [name, headerValue] of Object.entries(extraHeaders)) apiResponse.headers.set(name, headerValue);
    return apiResponse;
  };
  const res: Record<string, unknown> = {
    cookie(name: string, value: string, options: Omit<SetCookie, 'name' | 'value'> = {}) {
      setCookies.push(stringifySetCookie({ name, value, ...options }));
      return res;
    },
    clearCookie(name: string, options: Omit<SetCookie, 'name' | 'value'> = {}) {
      setCookies.push(stringifySetCookie({ name, value: '', ...options, maxAge: 0 }));
      return res;
    },
    setHeader(name: string, value: string | string[]) {
      if (name.toLowerCase() === 'set-cookie') {
        setCookies.push(...(Array.isArray(value) ? value : [value]));
      } else {
        extraHeaders[name] = String(value);
      }
      return res;
    },
    status(code: number) {
      return { json(value: unknown) { result = finalize(value, code); return result; } };
    },
    json(value: unknown) { result = finalize(value); return result; },
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
