# Health endpoints

## Exact source coverage

- `app/health/route.ts` — `/health`.
- `app/api/health/route.ts` — `/api/health`.
- `app/api/[...route]/route.ts` — catch-all dispatch's `/health` branch and
  its database-initialization ordering.

All handlers explicitly select the Node.js runtime. The two concrete health
route files each export `GET` and `OPTIONS`. Their `GET` response is
`{"status":"ok"}` with status `200`; `OPTIONS` returns an empty `204`.

## What the response verifies—and does not

The two concrete handlers return a fixed status payload. They do not query the
database, validate credentials or schema, check downstream services, report
build/version information, or measure readiness. A successful response
therefore confirms only that the route handler can respond, not that the full
application can serve API requests.

Both concrete handlers use wildcard `Access-Control-Allow-Origin: *` and allow
`GET, OPTIONS` plus `Content-Type, Authorization`. This differs from the
catch-all API adapter's app-origin CORS policy.

The catch-all adapter separately contains a `GET` branch for joined route
segments equal to `/health`, but it runs only after `ensureDatabaseReady()`.
That branch would return the same status payload, without the concrete
health-file OPTIONS implementation. The more specific `app/api/health/route.ts`
also owns `/api/health`; route precedence means the catch-all branch should
not be assumed to be an independent public endpoint. No deployment probe or
live runtime test was used to establish routing precedence beyond the source
layout.
