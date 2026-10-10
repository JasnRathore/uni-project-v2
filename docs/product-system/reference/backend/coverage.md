# Backend reference inventory and coverage

This is a source-coverage manifest for the backend reference pages, not a replacement for the product-system overview or navigation index. It records the inspected scope and exclusions for todo `backend-reference`.

## Inventory and documentation coverage

| Source inventory | Reference page | Coverage |
| --- | --- | --- |
| `lib/api/services/academicCatalogService.js` | [Academic catalog](academic-catalog.md) | Fully covered |
| `lib/api/services/academicIdentityService.js` | [Academic identity](academic-identity.md) | Fully covered |
| `lib/api/services/classLifecycleService.js` | [Classes and memberships](classes-memberships.md) | Fully covered |
| `lib/api/services/gradeRecordingService.js` | [Grade recording](grade-recording.md) | Fully covered |
| `lib/api/services/leaderboardService.js` | [Leaderboards](leaderboard.md) | Fully covered |
| `lib/api/services/studentDashboardService.js` | [Student dashboard calculations](student-dashboard.md) | Fully covered |
| `lib/api/services/studentService.js` | [Student activity and streaks](student-streak.md) | Fully covered |
| `lib/api/services/studentState.js` | [Student state helpers](student-state.md) | Fully covered |
| `lib/api/services/taskAssignmentService.js` | [Task assignment](task-assignment.md) | Fully covered |
| `lib/api/services/xpService.js` | [XP and progression](xp-progression.md) | Fully covered |
| `lib/api/middleware/authMiddleware.js` | [Authentication middleware](auth-middleware.md) | Fully covered |
| `lib/api/storage/portalStore.js` | [Portal storage facade](portal-store.md) | Fully covered |
| `lib/api/routeRegistry.ts` | [Shared route registry](route-registry.md) | Fully covered |
| `lib/db.ts` | [Direct libSQL client](libsql-client.md) | Fully covered |
| `database/services/dbService.js` | [Database service facade](database-service.md) | Fully covered |
| `database/services/relationalDataService.js` | [Relational data service](relational-data-service.md) | Fully covered |
| `database/services/schemaService.js` | [Schema initialization](schema-service.md) | Fully covered |
| `database/migrations/migrate_snapshot.py` | [Snapshot migration utility](snapshot-migration.md) | Fully covered |
| `new_schema.sql` | [Canonical schema contract](schema-contract.md) | Covered as the schema dependency used by these modules |

**Totals:** 18 in-scope application modules/utilities plus one directly coupled schema file; 19 source paths documented. No small modules have been consolidated, so there are no concealed or implicit module groupings.

## Boundaries and justified omissions

- Controllers in `lib/api/controllers/`, app route/runtime handlers, and frontend/UI files are excluded as requested. Controller references below identify callers only; their behavior is not documented here.
- `lib/format.ts`, `lib/utils.ts`, and `lib/dashboard-events.ts` are general presentation/utility/event modules, not shared API helpers or persistence facades. They are outside the requested backend core scope.
- `node_modules/`, `.next/`, and `database/migrations/__pycache__/` are generated/dependency artifacts, not source modules. The Python bytecode cache is not separately documented; its source utility is.
- No other files were present under `database/services/`, `database/migrations/`, `lib/api/middleware/`, `lib/api/storage/`, or `lib/api/services/` in the inspected working tree.
- Existing product-system overview/index files were not edited. No source code or SQL schema was changed.

## Evidence notation

Each page distinguishes directly verified implementation facts from inferred or unknown behavior. “Verified” means visible in the cited source and, for DB constraints, `new_schema.sql`; it does not imply runtime integration testing. Calls to controllers or the route runtime are named only to orient module ownership.
