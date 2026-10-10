# API route adapter and registry

The API entry point is a Next.js catch-all adapter backed by an explicit
method/path registry. This reference covers the adapter, route registry, and
the token middleware module that supplies its user lookup; it does not describe
controller or service implementations.

## Exact source coverage

- `app/api/[...route]/route.ts` — Node.js, force-dynamic adapter; HTTP method
  exports, request dispatch, CORS, auth/role checks, and response conversion.
- `lib/api/routeRegistry.ts` — 66 method/path definitions and the exact-first,
  parameterized route matcher.
- `lib/api/middleware/authMiddleware.js` — token verification, database-backed
  user lookup, and Express-shaped `requireAuth` / role helper exports.

## Adapter behavior

The catch-all exports `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`. The first
four call the same dispatcher with the route segments and method. `OPTIONS`
returns `204` without database initialization. Other responses are JSON and
include these CORS headers:

- Allowed origin: `NEXT_PUBLIC_APP_URL`, falling back to
  `http://localhost:3000`.
- Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`.
- Allowed headers: `Content-Type, Authorization`.

For dispatched methods the adapter initializes the database before matching
any route; initialization failure returns `503` with `Database is not ready`
and a detail string. It joins catch-all segments with `/`, checks an exact
method/path match first, then tries parameterized paths in registry order.
Each `:parameter` matches one non-slash segment, which is URI-decoded into
`req.params`. A path/method pair absent from the registry normally returns
JSON `404` (there is no adapter-level `405` distinction).

For non-`GET`, non-`DELETE` requests, invalid or absent JSON is treated as an
empty object. The controller-compatible request shape contains `body`,
`params`, `user`, and request headers; adapter responses are wrapped with the
shared JSON/CORS helper. A handler exception is logged and converted to JSON
`500`; a handler that does not write a response also yields `500`.

## Registered method/path coverage

The 66 registered routes are grouped below by the registry's access flags.
`:name` denotes a single path segment parameter.

| Access classification | Methods and paths |
| --- | --- |
| Public | `POST /auth/login`, `POST /signup`, `POST /student/signup`; `GET /academic/degrees`, `/academic/departments`, `/academic/cohorts`, `/academic/degrees/:degreeId/cohorts`, `/academic/degrees/:degreeId/program-years`, `/academic/program-years/:programYearId/subjects` |
| Authenticated, not student-only | `POST /account/reactivate`; `GET /teacher/profile`, `/teacher/data`, `/teacher/all-students`, `/teacher/task-stats`, `/teacher/task-grades/:taskId`, `/teacher/student-streak/:email`, `/teacher/student-tasks/:email`; `POST /teacher/students`, `/teacher/classes`, `/teacher/classes/create`, `/teacher/tasks`, `/teacher/add-task`, `/teacher/quest`, `/teacher/task-students`, `/teacher/grades`, `/teacher/profile/update`, `/teacher/account/deactivate`, `/teacher/assign-student`, `/teacher/unassign-student`, `/teacher/students-batch-data`, `/teacher/task-grade`, `/teacher/classes/:classId/memberships`; `PUT /teacher/students/:studentId`, `/teacher/tasks/:taskId`, `/teacher/classes/:classId/lifecycle`; `DELETE /teacher/account`, `/teacher/classes/:classId`, `/teacher/tasks/:taskId`, `/teacher/classes/:classId/memberships/:studentId`; `GET /admin/degrees`, `/admin/degrees/:degreeId/program-years`, `/admin/degrees/:degreeId/cohorts`; `POST /admin/degrees`, `/admin/degrees/:degreeId/program-years`, `/admin/program-years/:programYearId/subjects`, `/admin/degrees/:degreeId/cohorts`; `PUT /admin/degrees/:degreeId`, `/admin/cohorts/:cohortId`, `/admin/students/:studentId/identity`; `GET /game/progression`; `POST /game/rewards` |
| Authenticated and student-only | `GET /student/profile`, `/student/data`, `/student/dashboard`, `/student/leaderboard`, `/student/leaderboards/cohort`, `/student/leaderboards/classes`, `/student/leaderboards/classes/:classId`, `/leaderboards/cohort`, `/leaderboards/classes/:classId`, `/student/notifications`, `/student/quest`, `/quest`; `POST /student/notifications/read`, `/student/profile/update`, `/student/quiz/submit` |

`GET /debug/students` is an additional adapter-only special case, not one of the
66 registry entries. It requires a resolvable user but is not checked for role
or disabled status by this branch. `GET /health` is another special case in
the adapter; its effective URL considerations are covered in
[health endpoints](./health-endpoints.md).

## Authentication and authorization

The adapter calls `getUser` for routes with `protectedRoute: true`.
`getUser` expects the second space-delimited authorization-header token to be a
JWT, verifies it with `JWT_SECRET`, and then reads the user's stored identity
and metadata. Missing token/secret, a failed verification, or a missing user
returns no user; protected calls receive `401 Unauthorized`.

After authentication, the adapter:

- Rejects a disabled account with `403`, except for `/account/reactivate`.
- Requires `user_metadata.role === "student"` for registry entries flagged
  `studentOnly`, and for all `/game/*` paths.
- Requires an active student database row for student-only routes and
  `/game/*`.
- Rejects students from `/teacher/*`.
- Requires role `admin` or `administrator` on `/admin/*`.

The game path check makes `/game/progression` and `/game/rewards` student-only
at dispatch time even though their registry entries have `studentOnly: false`.
Teacher paths only explicitly reject student-role users in this adapter; it
does not require the role string to equal `teacher`.

`authMiddleware.js` also exports `requireAuth`, `requireTeacher`, and
`requireStudent`, but this adapter imports and calls only `getUser`. The
Express-shaped helpers should not be mistaken for a separate Next middleware
layer. No `middleware.ts`/`proxy.ts` routing guard is present in the inventoried
app entry points.

## Verified limits

Registry matching and the adapter behaviors above are visible in these files.
Controller-specific validation, response contracts, and data effects are
outside this reference. The adapter exports no `PATCH` handler, and its
registry has no `HEAD` routes.
