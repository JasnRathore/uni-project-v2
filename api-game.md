# Game API

This document describes the game-facing API currently implemented by the
portal. It is based on the route registry and controller behavior; it is not
a promise that unimplemented game-auth or game-save endpoints exist.

## Base URL and requests

Use the deployed portal origin followed by `/api`. For local development:

```text
http://localhost:3000/api
```

Send JSON request bodies with `Content-Type: application/json`. Protected
endpoints require the bearer token returned by `POST /api/auth/login`:

```http
Authorization: Bearer <access-token>
```

The current login endpoint accepts `email` and `password` and returns
`{ "success": true, "token": "...", "user": { ... } }`. The current JWT
expires after seven days. It is signed with the server's `JWT_SECRET`; clients
must treat it as a secret and must not log it.

## Authentication and authorization

All endpoints in this document except login require a valid bearer token and
an existing student profile. Calls are authorized as the student identified by
the token; do not send a student ID to choose whose data to read or modify.
Missing/invalid credentials return `401 Unauthorized`. A valid non-student
token on `/game/*` endpoints returns `403 Student access required`. Missing
student profile returns `404 Student profile not found`.

**Important integration limitation:** the current token is a general portal
JWT, not a game-specific token with an audience, scope, or refresh/revocation
contract. The API currently checks the user's student role for game routes,
but does not enforce a separate game audience or per-endpoint scope. Do not
treat this as a production-ready cross-service authentication design if the
game is deployed separately; establish a scoped game token/service-to-service
contract first.

## Endpoints

### `GET /game/progression`

Returns the authenticated student's current shared XP summary.

**Response `200`:**

```json
{
  "progression": {
    "leaderboardXp": 620,
    "tier": "scholar",
    "buffEntitlement": null,
    "rulesetVersion": "v1"
  }
}
```

`tier` is `novice` below 500 XP, `scholar` from 500, `expert` from 1000, and
`master` from 2000. The current implementation sets `buffEntitlement` to
`"xp-boost"` at `master`; otherwise it is normally `null`. It may be `null`
for a student with no initialized progression state.

**Current behavior:** `leaderboardXp` is the sum of all XP ledger events and
also drives `progression_xp`. Game progression XP is not yet stored separately
from competitive leaderboard XP. The response contains derived progression
data only; it does not expose grades.

### `POST /game/rewards`

Records an achievement reward in the shared XP ledger for the authenticated
student. Student identity is taken from the bearer token and its linked student
profile.

**Request:**

```json
{
  "points": 25,
  "sourceId": "level-3-first-clear",
  "idempotencyKey": "game:achievement:level-3-first-clear:player-event-01"
}
```

- `points`: positive whole-number reward, maximum 100.
- `sourceId`: non-empty identifier for the achievement/reward source.
- `idempotencyKey`: unique, stable key for this specific reward event. Reuse
  the same key when retrying that event after a timeout; use a different key
  for a genuinely new event. Keys are globally unique across the XP ledger,
  not scoped to a student. Generate unpredictable, unique keys and never reuse
  one for another player.

**Response `201`:**

```json
{
  "event": {
    "id": "event-uuid",
    "student_id": "student-uuid",
    "source_application": "game",
    "source_type": "achievement",
    "source_id": "level-3-first-clear",
    "points": 25,
    "ruleset_version": "v1",
    "idempotency_key": "game:achievement:level-3-first-clear:player-event-01",
    "created_by": "user-uuid",
    "created_at": "2026-10-10 00:00:00",
    "reversal_of": null
  },
  "progression": {
    "leaderboardXp": 645,
    "tier": "scholar",
    "buffEntitlement": null,
    "rulesetVersion": "v1"
  }
}
```

The event is written transactionally and updates the shared XP total and
progression state. Repeating a request with an already-used key does not add a
second event; it returns the existing event with the current progression.
The controller currently responds `201` for both a new event and an
idempotent replay.

**Errors:** `400` for invalid reward fields or a rejected ledger write;
`401`, `403`, or `404` as described above.

**Trust boundary:** the current endpoint accepts student bearer tokens and
lets the authenticated student submit any qualifying `sourceId` and
`idempotencyKey`; it does not verify that an achievement was actually granted
by a trusted game server. The game must not use this endpoint as proof that a
player legitimately earned a reward. Before public deployment, move reward
submission behind trusted game-server authorization and validate rewards
against server-approved achievements/rules. The API enforces an upper bound,
but game-side policy and rate limits are not implemented here.

**Validation detail:** send integer `points` only. The current implementation
converts the input to a number and truncates decimals rather than rejecting
them (for example, `12.9` is recorded as `12`); this should not be relied on
as an input-validation feature. The idempotency lookup is global and does not
check that an existing key belongs to the requesting student, so key reuse
across accounts can return another event. Both behaviors should be tightened
before an untrusted game client can call this endpoint.

### `GET /leaderboards/cohort`

Returns the current student's active cohort leaderboard. The student must
have a cohort; otherwise the response has an empty `entries` array and null
scope ID/name.

**Response `200`:**

```json
{
  "scope": "cohort",
  "scopeId": "cohort-uuid",
  "scopeName": "Bachelor of Dental Surgery · 2026-2031",
  "rulesetVersion": "v1",
  "calculatedAt": "2026-10-10T00:00:00.000Z",
  "entries": [
    {
      "studentId": "student-uuid",
      "displayName": "Student Name",
      "leaderboardXp": 645,
      "rank": 1,
      "isCurrentStudent": true
    }
  ]
}
```

Only active students in the requesting student's cohort appear. Entries are
ordered by XP descending, then display name and student ID. Equal XP shares a
rank; the next rank is the row's one-based position (for example `1, 1, 3`).

### `GET /leaderboards/classes/:classId`

Returns the leaderboard for an active class to which the authenticated
student has an active membership. The API verifies membership and returns
`403` if the student cannot access the requested class leaderboard.

The response uses the same shape as the cohort leaderboard, with
`"scope": "class"`, `scopeId` set to the class ID, and `scopeName` set to the
class name. Only active students with active membership in that class appear.

### `GET /student/leaderboards/classes`

Returns active classes available to the authenticated student. Use these IDs
to request class leaderboard results.

**Response `200`:**

```json
{
  "classes": [
    {
      "id": "class-uuid",
      "name": "Anatomy",
      "subject": "Anatomy"
    }
  ]
}
```

`subject` may be `null`.

### Student-prefixed leaderboard aliases

The portal also exposes equivalent protected routes:

- `GET /student/leaderboards/cohort`
- `GET /student/leaderboards/classes/:classId`

These return the same leaderboard shapes and access rules as their
`/leaderboards/...` counterparts. The global paths above are the concise
routes for game clients.

## Common errors

Responses use JSON, generally with an `error` field:

```json
{ "error": "Unauthorized" }
```

| Status | Meaning |
|---|---|
| `400` | Invalid reward payload or rejected reward write |
| `401` | Missing, invalid, or expired bearer token |
| `403` | Student-only endpoint used by a non-student, or class leaderboard access denied |
| `404` | Route not found or authenticated account has no linked student profile |
| `503` | Database initialization failed |
| `500` | Unexpected request-handler error |

## Not currently provided

There are no game-specific signup/session, refresh, logout/revocation,
inventory, save-state, grade, or game-progress write endpoints in the current
route registry. Do not connect directly to the database or import portal
database services from the game. Academic grades and class/cohort records
remain portal-owned; the game should consume approved derived progression and
leaderboard data through the API.

## Source of truth

The routes and behavior documented here are implemented in
`lib/api/routeRegistry.ts`, `lib/api/controllers/gameController.js`,
`lib/api/services/xpService.js`, `lib/api/services/leaderboardService.js`,
and `app/api/[...route]/route.ts`. Update this document when those API
contracts change.
