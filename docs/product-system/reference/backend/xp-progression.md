# XP and progression service

**Source:** `lib/api/services/xpService.js`  
**Evidence:** Transaction and query logic verified; table constraints in `new_schema.sql`. Called from game controller and grade recording; their behaviors are documented separately.

## Exports and contracts

Exports `awardXp(input)`, `getProgression(studentId)`, and `tierFor(xp)`. Tiers are thresholds: novice below 500, scholar from 500, expert from 1,000, master from 2,000.

## Award flow

`awardXp` accepts student ID, integer points, optional source application/type/ID, required idempotency key, optional creator/ruleset/reversal ID. It coerces points with `Number`, requiring an integer and a truthy key. In a write transaction it first returns any event already using the idempotency key (without checking that its student or payload matches). Otherwise it requires an active student, inserts a UUID `xp_events` row, recomputes the student's all-time point sum, updates `students.total_points`, and upserts `progression_states` with XP, derived tier, and `xp-boost` entitlement only at master tier. It returns the inserted event.

## Reads and consistency

`getProgression` reads progression state and separately sums `xp_events`; output is `{ leaderboardXp, tier, buffEntitlement, rulesetVersion: 'v1' }`. The sum is authoritative for leaderboard XP; tier falls back to a calculation from the sum when no state tier exists, while entitlement does not get recalculated in that fallback. Read statements are not in a transaction.

DB dependency is `getDatabaseClient`/`withTransaction` from `database/services/dbService.js`. The event's unique idempotency key plus event/student/cache updates are committed together. The schema permits signed integer points and reversal references but this function does not require positive amounts or validate reversal semantics.

## Errors and edge cases

Non-integer points or missing key throw a shared validation error; inactive/missing student throws `Student not found`; SQL errors propagate. `Number(null)` is zero and is accepted; a numeric string is accepted if integer. A pre-existing idempotency key short-circuits even if the retried request uses different arguments.

**Verified:** described behavior. **Unknown:** product rules for reversals, negative awards, or stale progression-state repair.
