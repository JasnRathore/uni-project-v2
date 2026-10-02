import serverless from 'serverless-http';
import app from '../../../server/app';

export const runtime = 'nodejs';

const handler = serverless(app);

type LambdaResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
};

async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  const forwardedFor = request.headers.get('x-forwarded-for');
  const body = request.body ? await request.text() : '';

  const result = await handler({
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    body,
    isBase64Encoded: false,
    requestContext: {
      requestId: request.headers.get('x-request-id') || '',
      http: {
        method: request.method,
        sourceIp: forwardedFor?.split(',')[0].trim() || '127.0.0.1',
      },
    },
  }, {}) as LambdaResponse;

  const responseHeaders = new Headers(result.headers);
  result.cookies?.forEach(cookie => responseHeaders.append('set-cookie', cookie));

  const responseBody = result.body
    ? Buffer.from(result.body, result.isBase64Encoded ? 'base64' : 'utf8')
    : null;

  return new Response(responseBody, {
    status: result.statusCode,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) { return dispatch(request); }
export async function POST(request: Request) { return dispatch(request); }
export async function PUT(request: Request) { return dispatch(request); }
export async function DELETE(request: Request) { return dispatch(request); }
export async function OPTIONS(request: Request) { return dispatch(request); }
