# Game controller

## Scope and evidence

Source: `lib\api\controllers\gameController.js`; route registration is in `lib\api\routeRegistry.ts`, access gates in `app\api\[...route]\route.ts`. Supporting behavior was checked in `xpService.js` and `leaderboardService.js`.

## Exports, routes, and access

| Export | Route(s) | Access |
| --- | --- | --- |
| `progression` | `GET /game/progression` | Protected; dispatcher requires student role and active student |
| `reward` | `POST /game/rewards` | Protected; dispatcher requires student role and active student |
| `leaderboard` | Handler shared by the wrapper exports; no direct route | Not directly registered |
| `cohortLeaderboard` | `GET /student/leaderboards/cohort`, `GET /leaderboards/cohort` | Protected; student-only and active-student gate |
| `classLeaderboard` | `GET /student/leaderboards/classes/:classId`, `GET /leaderboards/classes/:classId` | Protected; student-only and active-student gate |
| `activeClasses` | `GET /student/leaderboards/classes` | Protected; student-only and active-student gate |

The dispatcher enforces role/lifecycle restrictions for `/game` paths even though the route definitions mark the two game endpoints `studentOnly:false`. Other registered leaderboard routes use `studentOnly:true`.

## Methods and behavior

`studentIdFor(user)` is an internal helper, not an export. It queries `students` for an active row matching either `user_id=user.id` or case-insensitive email. Every public game handler uses it; missing active identity returns `404 { error:"Student profile not found" }`.

| Handler | Inputs and validation | Calls and response/effects |
| --- | --- | --- |
| `progression` | Authenticated user only. | Calls `getProgression(studentId)`; returns `{ progression:{ leaderboardXp,tier,buffEntitlement,rulesetVersion } }`. XP service reads progression state and sums XP events. No local catch; exceptions become dispatcher 500. |
| `reward` | Body requires `points` whose numeric value is greater than 0 and at most 100, plus truthy `sourceId` and `idempotencyKey`. | Truncates numeric points to an integer and calls `awardXp` with source application `game`, type `achievement`, actor user ID, then reads progression. Success is `201 { event, progression }`; any error in that try block, including the progression read, becomes `400 { error }`. XP award transaction deduplicates by idempotency key, inserts event, updates student total and progression state. The controller validates the numeric bound before truncation; fractional inputs within bounds are thus accepted then truncated. |
| `leaderboard` | Internal handler reads `params.scope` and optional `scopeId`. | Calls `getLeaderboard({studentId,scope,scopeId})`; returns service result `{ scope,scopeId,scopeName,rulesetVersion,calculatedAt,entries }`. Service restricts cohort scope to the current student’s cohort and class scope to active membership in that class; ranking is XP-event total with tied ranks. Service errors become 403. |
| `cohortLeaderboard` | No body; wraps the internal method with scope `cohort`. | Forwards to `leaderboard`; route result follows its 404/403/200 behavior. |
| `classLeaderboard` | Path `classId`; wraps internal method with scope `class` and that ID. | Forwards to `leaderboard`; service verifies the current student has active membership in the active class. |
| `activeClasses` | Authenticated active student only. | Calls `getActiveClasses(studentId)`; returns `{ classes:[{id,name,subject},...] }`, selected from active memberships/classes and active student rows. No local catch. |

## Dependencies, calls, side effects, and unknowns

- Direct database dependency is `getDatabaseClient`; controller SQL resolves a student identity, and leaderboard/XP services issue their own queries.
- `xpService.awardXp` performs its writes in `withTransaction`; `getProgression` is read-only.
- `leaderboardService.getLeaderboard` and `getActiveClasses` are read-only SQL paths.
- Caller mapping is exclusively through the route registry in the inspected API surface. No portal-store writes are performed here.
- The route wrapper’s general exception behavior is 500; no pagination or alternate leaderboard calculations are implemented here. Any database errors/constraints not translated by service code are not specified.
