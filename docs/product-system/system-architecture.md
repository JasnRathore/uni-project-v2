# System architecture

## Scope and evidence conventions

This document describes the implementation present in this repository, not a deployed environment. Claims marked **Verified** are directly supported by source or configuration. **Inference** identifies behavior implied by the code but not confirmed by operational evidence. **Unknown** means this repository does not establish the answer. Primary evidence is linked inline using repository-relative paths.

## System context

**Verified.** The Dental College Portal is a browser-based application for students, faculty/teachers, and administrators. Its user-facing shell is a Next.js App Router application; application data and role-specific operations are exposed through same-origin HTTP endpoints and persisted in a SQLite-compatible database. The landing page renders `PortalLanding` (`app\page.tsx`), and role-specific entry points live under `app\student`, `app\faculty`, and `app\admin`. Student-facing features include profile, coursework, grades, activity/progression, notifications, and leaderboards; faculty features include student rosters, classes, tasks/quizzes, grading, and academic catalog management. Administrator endpoints manage degree/cohort/program-year/subject catalog data and student academic identity (`lib\api\routeRegistry.ts`, `lib\api\controllers\`).

**Verified.** The principal runtime actors and boundaries are:

```text
Student / faculty / administrator browser
                  |
                  | HTTPS or local HTTP; JSON; bearer JWT for protected APIs
                  v
       Next.js App Router server (Node.js)
          |                  |
          |                  +--> application services/controllers
          |                               |
          v                               v
   UI pages/components                 libSQL client
                                          |
                             local SQLite file OR Turso/libSQL
```

The actual transport security (TLS termination, network restrictions, proxy, and deployment topology) is **Unknown**. The repository does not define a separate API service or show production infrastructure.

## Technology and runtime stack

- **Web framework:** Next.js `16.3.7`, React and React DOM `19.2.8`, and TypeScript `5` (`package.json`). The app uses App Router route files and a catch-all API route.
- **Server runtime:** API route handlers explicitly select the Node.js runtime (`app\api\[...route]\route.ts`, `app\api\health\route.ts`, `app\health\route.ts`). The API catch-all is also marked `force-dynamic`.
- **Database client:** `@libsql/client`, supporting a local SQLite database file or a remote libSQL/Turso URL (`database\services\dbService.js`, `.env.example`).
- **Authentication primitives:** `bcryptjs` password hashing and `jsonwebtoken` bearer tokens (`lib\api\controllers\authController.js`, `lib\api\middleware\authMiddleware.js`).
- **Client UI:** React client components, Tailwind CSS 4, Radix/Base UI-based component dependencies, and assorted chart, icon, form, date, and theme libraries (`package.json`, `components\ui\`, `app\globals.css`). The root layout loads Public Sans and Geist Mono via `next/font/google` (`app\layout.tsx`).
- **Language arrangement:** Most UI is TypeScript/TSX; controllers and application services are primarily CommonJS JavaScript. TypeScript allows JS imports (`tsconfig.json`).
- **Testing/tooling:** Node's built-in test runner, ESLint 9, and TypeScript compiler scripts are declared in `package.json`. Python is used by the snapshot migration utility (`database\migrations\migrate_snapshot.py`).

## Repository organization

| Area | Responsibility |
| --- | --- |
| `app\` | Next.js routes, shared root layout, landing page, dashboard/login/signup entry points, API route handlers, and health handlers. |
| `components\` | Portal screens, dashboard workflows, API/account helpers, shared UI primitives, and Supabase-compatibility client. |
| `lib\api\controllers\` | Request-level auth, student, teacher, admin, and game/leaderboard behavior. |
| `lib\api\services\` | Domain operations such as academic identity/catalog, class lifecycle, assignment, grade recording, student state, XP, and leaderboards. |
| `lib\api\routeRegistry.ts` | Route/method-to-controller mapping and route-parameter matching, including per-route protection flags. |
| `lib\api\middleware\` | Bearer-token verification and user hydration/role helpers. |
| `lib\api\storage\` | Compatibility façade for legacy portal data key namespaces. |
| `database\services\` | Database client setup, schema bootstrap, and relational persistence/legacy-key translation. |
| `new_schema.sql` | Canonical SQLite/Turso schema and initial department seed records. |
| `database\migrations\` | Snapshot import utility for CSV key/value exports and an optional user-database backup. |
| `tests\` | Schema, domain-service, migration, grade, and academic-data tests. |
| `public\` | Static assets. |

`docs\` contains project discussions and plans in addition to these product-system documents. `.gitignore` keeps other documentation excluded from ordinary Git tracking while allowing Markdown files under `docs/product-system/`.

## Runtime components and responsibilities

### Browser application

`app\layout.tsx` establishes document metadata, fonts, global CSS, and the theme/tooltip providers (`components\Providers.tsx`). `app\page.tsx` renders the portal landing page. Login and dashboard route files mostly delegate to larger client components. Student and faculty screens keep navigation/state in React and request data through APIs; for example, `StudentApp` checks the current session, fetches the student profile, and redirects based on authentication/role (`components\StudentApp.tsx`).

The helper in `components\services\api.ts` targets `/api`, serializes JSON request bodies, adds an optional authorization header, and throws on non-2xx responses. A compatibility module at `components\utils\supabase\client.ts` exposes a `supabase.auth`-shaped object, but its implementation is a local `MockAuth`: it calls `/api/auth/login` and stores the returned token and user in browser `localStorage`. It is not a connection to Supabase; empty legacy project credentials are retained in `components\utils\supabase\info.tsx`.

### HTTP/API adapter

`app\api\[...route]\route.ts` is the main API boundary. It accepts GET, POST, PUT, DELETE, and OPTIONS, builds a normalized path, ensures database initialization, locates a route in the registry, performs shared token/role/active-student checks, parses non-GET/non-DELETE JSON, and adapts the request to controller-compatible `req`/`res` objects. It returns JSON responses, maps initialization failures to 503, unknown routes to 404, and uncaught controller failures to 500.

`lib\api\routeRegistry.ts` centralizes the public and protected route list. It records `protectedRoute` and `studentOnly` flags; the adapter additionally enforces teacher/student/admin boundaries by path. Controllers perform further business-level validation and access checks. The legacy Express-like middleware functions in `lib\api\middleware\authMiddleware.js` provide related auth helpers, though the Next adapter directly calls `getUser` rather than chaining that middleware.

### Domain layer and persistence

Controllers orchestrate domain services and persistence. Student operations aggregate profiles, assignments, grades, streaks, dashboard stats, and leaderboards. Faculty operations manage rosters, classes, task assignments, and grades. Academic catalog/identity services manage controlled degree, cohort, program-year, subject, department, and student identity data. Game operations use XP/progression and leaderboard services. The separation is visible in `lib\api\controllers\` and `lib\api\services\`.

`database\services\dbService.js` lazily creates a shared libSQL client and caches a promise for database/schema readiness. It also supplies an AuthService-compatible API whose user creation/deletion/update operations write to the local relational schema; this is an in-repository compatibility implementation, not a remote auth provider. `database\services\relationalDataService.js` adapts legacy namespaced calls such as `students:<teacherId>`, `student_tasks:<email>`, and `notifications:<email>` to relational rows. `lib\api\storage\portalStore.js` wraps common namespaces as a storage façade. The legacy key/value interface therefore does not imply a remote key/value service.

## Important request and data flows

### Authentication and protected requests

1. The browser submits credentials to `/api/auth/login` (the compatibility auth client does this in `components\utils\supabase\client.ts`).
2. `authController.login` requires `JWT_SECRET`, performs a case-insensitive user lookup, compares the submitted password against the stored bcrypt hash, and signs a seven-day JWT containing user identity/role/name claims.
3. The token and returned user object are written to browser `localStorage`.
4. Subsequent requests send `Authorization: Bearer <token>`. The API adapter calls `getUser`; middleware verifies the signature, reloads the user from the database, and hydrates current metadata from that database record.
5. The adapter checks account-disabled status, student-only routes and active student lifecycle, teacher restrictions, and administrator role where relevant, then invokes the controller. See `lib\api\controllers\authController.js`, `lib\api\middleware\authMiddleware.js`, and `app\api\[...route]\route.ts`.

Signup routes call the database-backed compatibility `getAuthService().auth.admin.createUser`, which hashes passwords and creates a user plus role-dependent profile/roster state in a transaction (`database\services\dbService.js`). Signup may also write a student profile through the relational compatibility service.

### Faculty assignment and grading

A faculty client loads its own keyed roster/classes/tasks/grades through the teacher API. Teacher identifiers are taken from the authenticated user, and relational tables associate teachers, students, classes, tasks, and assignments. Grade recording is delegated to `gradeRecordingService`; student grade/task views are later composed by student endpoints. The schema and services include constraints and transaction-based operations, but older controller branches also read/write through key-shaped compatibility methods. Review individual endpoint/service paths before assuming all screens use identical persistence or transactional guarantees.

### Student dashboard, activity, and game progression

The student client fetches protected profile/dashboard/data endpoints. Controllers combine task/grade records with derived completion and statistics; streak/activity operations are implemented by student services. Game endpoints resolve the authenticated user to an active student row, then read progression or award bounded XP. XP awards include a required unique idempotency key in the schema/service path to prevent duplicate events (`lib\api\controllers\gameController.js`, `lib\api\services\xpService.js`, `new_schema.sql`).

### Health checks

`app\api\health\route.ts` and `app\health\route.ts` return a static `{status:"ok"}` and permissive CORS headers; they do not probe the database. The catch-all `/api/health` dispatch path is different: it initializes the database before returning the status response. Treat the standalone route as process/HTTP liveness only, not readiness.

## Persistence and data model

**Verified.** `new_schema.sql` is the canonical schema. It enables foreign keys and seeds nine dental departments. Its principal entities and relationships include:

- **Identity:** `users` stores unique case-insensitive email, password hash, role, timestamps, and JSON metadata; `teacher_profiles` extends teacher-specific data and references departments.
- **Student and academic identity:** `students` has a unique optional user link, unique email, PRN, lifecycle state, current game level/points, cohort, and profile JSON. A student may exist as a teacher-managed roster entry without a login account. `degrees`, `graduation_cohorts`, `program_years`, `subjects`, and `departments` form the academic catalog; `academic_identity_events` records student identity changes.
- **Class membership:** `classes` belongs to a teacher and subject. `teacher_students` is the teacher-level roster/compatibility relation; `class_memberships` models a student's membership in a teacher's class, including active/ended/withdrawn state and dates.
- **Learning and grading:** `tasks` belong to classes; `task_assignments` associate tasks and students with completion/score/grade state; `grades` stores grading records and indexes support teacher/student lookup.
- **Engagement:** `notifications`, `student_activity`, `student_activity_days`, `xp_events`, `progression_states`, `daily_quests`, and `daily_quest_views` support notices, activity/streak tracking, game rewards/progression, and quest state.
- **Compatibility/provenance:** `usernames` enforces username mappings and `legacy_record_map` preserves legacy-record provenance during migration.

Foreign keys, unique constraints, checks, and indexes express important integrity rules in `new_schema.sql`. JSON columns such as `metadata_json`, `profile_json`, and `source_json` preserve flexible or source-compatible attributes alongside normalized columns. The relational compatibility layer translates legacy API storage calls to these tables rather than storing opaque blobs in a single general-purpose KV table (`database\services\relationalDataService.js`).

**Runtime initialization.** The API catch-all invokes `ensureDatabaseReady()` for each dispatched request. `dbService` caches the initialization promise for the server process. `schemaService` executes `new_schema.sql` and applies a compatibility upgrade for `teacher_profiles.department_id`; this is schema bootstrap, not evidence of a versioned migration framework. `lib\db.ts` is a second database-client module with a separate environment-selection implementation; the main API path imports `dbService`, and no claim is made here that the standalone client is used by all routes.

**Migration.** `database\migrations\migrate_snapshot.py` accepts a key/value CSV and optional SQLite user backup and writes an isolated target database, refusing to overwrite an existing target. It loads the canonical schema and records imported legacy provenance. `migration.md` documents migration context. The checked-in repository does not prove that this utility has been run in any deployed environment.

**Unknown.** No production backup/restore policy, retention schedule, replication configuration, data classification policy, or migration cutover procedure is defined in the runtime configuration inspected here.

## External services and integrations

- **Turso/libSQL:** Optional remote database mode is explicitly configured by `DATABASE_TARGET=turso`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` (`.env.example`, `database\services\dbService.js`). Local mode uses a SQLite file. This is the only external persistence service evidenced in application runtime code.
- **Supabase:** The frontend retains a Supabase-shaped compatibility interface, but actual auth calls in the checked-in client use local fetch/localStorage, and server-side user management is implemented against the app database. Empty compatibility identifiers are exported; no Supabase SDK dependency or active Supabase connection is evidenced.
- **Google Fonts:** `next/font/google` imports Public Sans and Geist Mono (`app\layout.tsx`). Their build-time/runtime delivery behavior depends on Next.js and hosting setup.
- **Other providers:** No payment, email, analytics, object-storage, queue, or third-party identity integration is evidenced in the inspected app code/config. Absence from this repository does not rule out infrastructure-managed integrations.

## Authentication and security boundaries

**Verified boundaries:**

- Login is public; most profile/data/write routes require a signed bearer JWT, as specified per route in `lib\api\routeRegistry.ts`.
- `/admin/*` requires an `admin` or `administrator` user metadata role. Student-only endpoints and `/game/*` require student role and an active student row. Teacher endpoints reject student users. Account-disabled state is checked centrally (`app\api\[...route]\route.ts`).
- Passwords are hashed with bcryptjs before persistence; login compares hashes (`database\services\dbService.js`, `lib\api\controllers\authController.js`).
- SQL operations generally use parameterized statements through libSQL. Relational foreign keys and constraints provide additional integrity controls.
- The browser stores bearer credentials in `localStorage`; they are attached by client fetch helpers. This avoids cookie-based ambient credentials but means script execution in the origin can access the token.

**Security-sensitive limits/risks evident in source:**

- `JWT_SECRET` is required to issue and verify tokens; missing configuration disables login and makes tokens unverifiable. Configure a strong unique secret in each environment and protect it (`.env.example`, auth controller/middleware).
- API CORS for catch-all endpoints defaults to `http://localhost:3000` or `NEXT_PUBLIC_APP_URL`, while standalone health handlers allow `*`. Validate production origin settings (`app\api\[...route]\route.ts`, health route files).
- The repository does not evidence rate limiting, login throttling, account lockout, CSRF controls, security-header policy, audit logging, or secret-management integration. These should not be assumed to exist at runtime.
- Build configuration explicitly ignores TypeScript and ESLint errors during `next build` (`next.config.mjs`); CI/deployment should run `npm run typecheck` and `npm run lint` separately if those checks are required.
- Authorization combines route flags/path-prefix checks in the adapter with checks inside some controllers. Changes to new routes should be reviewed for both registry declaration and adapter/controller authorization; route matching alone is not an authorization boundary.

This is an architecture inventory, not a penetration test or a claim that every endpoint has been exhaustively audited.

## Configuration and environment

`.env.example` documents:

| Variable | Purpose / behavior |
| --- | --- |
| `DATABASE_TARGET` | `local` or `turso`; if omitted and `TURSO_DATABASE_URL` is absent, `dbService` falls back to `file:local.db`. An unrecognized value with a Turso URL errors. |
| `LOCAL_DATABASE_URL` | Local libSQL/SQLite URL; `dbService` defaults it to `file:local.db`. |
| `TURSO_DATABASE_URL` | Remote libSQL database URL; required for explicit Turso target. |
| `TURSO_AUTH_TOKEN` | Remote database credential; required for explicit Turso target and omitted for `file:` connections. |
| `JWT_SECRET` | Required signing/verifying key for local API JWT authentication. |
| `PORT` | Documented as optional local API port. Next.js `dev`/`start` scripts do not explicitly pass it, though Next.js conventionally reads `PORT`. |
| `NEXT_PUBLIC_APP_URL` | Not listed in `.env.example`; used by catch-all API CORS as the allowed origin, defaulting to `http://localhost:3000`. |

The `dbService` loads a root `.env` file using dotenv. `.env*` files are ignored except `.env.example` (`.gitignore`). Never place production secrets in tracked files. Note that the separate `lib\db.ts` client chooses its URL independently and may fail with a different configuration state than `dbService`; keep the actual client path in mind when extending database access.

## Build, deployment, and runtime operations

Available scripts (`package.json`):

- `npm run dev` — Next.js development server.
- `npm run build` — production Next.js build.
- `npm run start` — serve the production build.
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — Node test runner for `tests\schema.test.js` only.

Other tests exist in `tests\` and can be invoked directly with `node --test <test-file>`; the default npm test script does not include all test files. Next build ignores type and lint errors, so build success alone does not establish either check passed.

The server needs the schema file available because initialization reads `new_schema.sql` from the current working directory or a path relative to `database\services\schemaService.js`. Local mode writes to `local.db` by default, which `.gitignore` excludes. A remote deployment must set database and JWT configuration and provide a writable/build-compatible Next.js runtime. API route handlers require Node.js rather than Edge runtime.

**Unknown / not checked in:** There are no repository-level Docker/container definitions, CI workflow/deployment manifests, hosting-provider configuration, infrastructure-as-code, database backup scripts, or documented production release/rollback procedure among the inspected root files. The actual hosting provider, process supervisor, scaling model, TLS setup, and database provisioning are therefore unknown.

## Limitations and architectural risks

1. **Mixed-era data abstraction.** The codebase exposes legacy namespaced storage APIs while progressively modeling relationships in SQL. Compatibility translation increases complexity and requires checking how each namespace maps to canonical entities before changing persistence behavior.
2. **Multiple auth/database compatibility seams.** A Supabase-shaped client and auth service remain, but the implementation is local. There are also two database client modules with different configuration handling. These names can mislead maintainers about the active provider and which path is used.
3. **Process-level schema bootstrap.** The schema is executed at runtime, with only a narrow explicit upgrade path. Coordinated/versioned migrations and multi-instance rollout behavior are not documented.
4. **Browser token exposure.** Access tokens are stored in `localStorage`, so same-origin script compromise can expose them. Token revocation/session invalidation behavior is not defined beyond expiration and the database-backed user/disabled-account checks.
5. **Operational visibility.** Health handlers are static and do not consistently represent database readiness. No observability, alerting, or production operations configuration is evidenced.
6. **Validation coverage.** The default test command selects only the schema test file, and build-time lint/type errors are ignored. A deployment pipeline should explicitly run all required checks.
7. **Unverified production guarantees.** Durability, backup/restore, availability, scaling, privacy/compliance controls, and actual external-service topology cannot be concluded from repository source alone.
