# Admin controller

## Scope and evidence

Source: `lib\api\controllers\adminController.js`. Route mappings are defined in `lib\api\routeRegistry.ts`; the shared dispatcher is `app\api\[...route]\route.ts`. The behaviors below are verified against those files and the directly called `academicIdentityService`, `academicCatalogService`, and `dbService` implementations. “Unknown” marks validation or behavior not visible at this controller/service boundary.

## Exports and entrypoints

The module exports 16 handlers:

| Handler | Route(s) | Access |
| --- | --- | --- |
| `listPublicDegrees` | `GET /academic/degrees` | Public |
| `listPublicCohorts` | `GET /academic/degrees/:degreeId/cohorts` | Public |
| `listAllPublicCohorts` | `GET /academic/cohorts` | Public |
| `listPublicDepartments` | `GET /academic/departments` | Public |
| `listPublicProgramYears` | `GET /academic/degrees/:degreeId/program-years` | Public |
| `listPublicSubjects` | `GET /academic/program-years/:programYearId/subjects` | Public |
| `listDegrees` | `GET /admin/degrees` | Protected; administrator |
| `createDegree` | `POST /admin/degrees` | Protected; administrator |
| `updateDegree` | `PUT /admin/degrees/:degreeId` | Protected; administrator |
| `listProgramYears` | `GET /admin/degrees/:degreeId/program-years` | Protected; administrator |
| `createProgramYear` | `POST /admin/degrees/:degreeId/program-years` | Protected; administrator |
| `createSubject` | `POST /admin/program-years/:programYearId/subjects` | Protected; administrator |
| `listCohorts` | `GET /admin/degrees/:degreeId/cohorts` | Protected; administrator |
| `createCohort` | `POST /admin/degrees/:degreeId/cohorts` | Protected; administrator |
| `updateCohort` | `PUT /admin/cohorts/:cohortId` | Protected; administrator |
| `assignStudent` | `PUT /admin/students/:studentId/identity` | Protected; administrator |

The dispatcher handles authentication and role rejection before invoking protected routes. In addition, each `admin/*` handler calls the controller-local `requireAdmin`, which accepts only `user_metadata.role` equal to `admin` or `administrator` and writes a `403 { error: "Administrator access required" }` response otherwise. Public catalog handlers do not require an account.

## Handler responsibilities and behavior

All successful list methods return a JSON object containing the named collection. Uncaught errors in public/admin list methods are handled by the shared dispatcher as `500 { error }`; list handlers do not add local error translation.

| Handler | Inputs and validation | Calls, response, and effects |
| --- | --- | --- |
| `listPublicDegrees` | No inputs. | Calls `identity.listDegrees(false)`; returns `{ degrees }`, active degrees with cohort counts. |
| `listPublicCohorts` | Path `degreeId`; no controller validation. | Calls `identity.listCohorts(degreeId, false)`; returns `{ cohorts }` for active cohorts of that degree. |
| `listAllPublicCohorts` | No inputs. | Direct SQL selects active cohorts joined to active degrees, sorted by degree and cohort labels; returns `{ cohorts: rows }`. |
| `listPublicDepartments` | No inputs. | Direct SQL selects department `id,name`, sorted by name; returns `{ departments: rows }`. No status filter is applied by this query. |
| `listPublicProgramYears` | Path `degreeId`. | Calls `catalog.listProgramYears(degreeId)` (default excludes inactive year/degree rows); returns `{ programYears }`. |
| `listPublicSubjects` | Path `programYearId`. | Calls `catalog.listSubjects(programYearId)`; returns `{ subjects }` for subjects whose program year and degree are active. |
| `listDegrees` | Reads `req.body.includeInactive`. The route is GET and dispatcher supplies an empty body for GET, so this is normally false through the registered API. | Calls `identity.listDegrees(includeInactive)`; returns `{ degrees }`. |
| `listProgramYears` | Path `degreeId`; query `includeInactive=true` enables inactive records. | Calls `catalog.listProgramYears(degreeId, flag)`; returns `{ programYears }`. |
| `createProgramYear` | Path `degreeId`; body spread into service with path ID overriding any body `degreeId`. Service requires nonempty label and an active degree. | Inserts a new program-year row and reads it back; returns `201 { programYear }`. Caught service errors become `400 { error }`. |
| `createSubject` | Path `programYearId`; body spread with path ID overriding body ID. Service requires nonempty name and active program year/degree. | Inserts subject and reads joined subject/year/degree data; returns `201 { subject }`. Caught errors become 400. |
| `createDegree` | Body object or `{}`. Service requires a nonempty name; accepts status defaulting to `active` without a service-level enum check. | Inserts degree and reads it back; returns `201 { degree }`. Caught errors become 400. |
| `updateDegree` | Path `degreeId`; body `status`; service accepts only `active` or `inactive`. | Updates status and timestamp, then reads row; returns `{ degree }`, 404 if missing, or 400 on service validation/error. |
| `listCohorts` | Path `degreeId`; reads `req.body.includeInactive`. As a GET, the shared dispatcher normally passes `{}`, so inactive cohorts are excluded via the registered route. | Calls `identity.listCohorts(degreeId, includeInactive)`; returns `{ cohorts }`. |
| `createCohort` | Path `degreeId` takes precedence over body value. Service requires a degree ID and nonempty label; status defaults to active but has no visible enum validation here. | Inserts cohort and reads it back; returns `201 { cohort }`; caught errors become 400. |
| `updateCohort` | Path `cohortId`; body `status`; service accepts only `active` or `inactive`. | Updates status/timestamp and reads row; returns `{ cohort }`, 404 if missing, or 400 on errors. |
| `assignStudent` | Path `studentId`; body spread, with `studentId` and `actorId` overwritten from path and authenticated user. Service requires a nonempty `reason`; `cohortId` is required in practice and must match optional `degreeId`. | Calls `identity.assignStudent`; returns `{ student }`. Service transaction updates `students.cohort_id` and inserts an `academic_identity_events` audit row; errors become 400. Missing student/cohort or a cohort-degree mismatch is reported as a service error (400). |

## Storage, transactions, and dependencies

- `academicIdentityService` reads/writes `degrees`, `graduation_cohorts`, `students`, and `academic_identity_events`. Only student identity assignment uses `withTransaction`; it records prior/new degree and cohort, actor, and required reason.
- `academicCatalogService` reads/writes `program_years`, `subjects`, and associated degree rows. Catalog creates use separate insert/read statements; no transaction is visible in that service.
- `listAllPublicCohorts` and `listPublicDepartments` call `getDatabaseClient().execute` directly.
- No portal key/value writes or external auth-service calls occur in this controller.
- Dependencies/callers: `lib\api\routeRegistry.ts` supplies handler references; `app\api\[...route]\route.ts` dispatches the registered paths. No additional callers are established by these source files.

## Error/status notes and unknowns

Status handling is explicit as listed above; other handler exceptions flow through the dispatcher’s generic 500 response. Invalid/missing path IDs on read methods are not separately validated and generally produce empty arrays from the SQL/service query. No request schema library or pagination is used in this controller. Database constraints and behavior for malformed status values on create are not determined here.
