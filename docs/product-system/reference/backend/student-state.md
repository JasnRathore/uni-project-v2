# Student state helpers

**Source:** `lib/api/services/studentState.js`  
**Evidence:** Both pure helpers verified in source; used by `taskAssignmentService` and teacher controller code.

## Exports and contracts

CommonJS exports `normalizeLifecycleState(value)` and `isActiveStudent(student)`.

- `normalizeLifecycleState` returns `'active'` only for the exact string `'active'`; all other values, including missing, uppercase, and unknown status strings, normalize to `'inactive'`.
- `isActiveStudent` returns true if either camel-case `lifecycleState` or snake-case `lifecycle_state` is exactly `'active'`; otherwise false. Optional chaining makes nullish/non-object input safely false.

## Dependencies and effects

No imports, database access, mutation, or side effects. These helpers intentionally bridge camel/snake field representations rather than validating a complete student record.

**Verified:** exact equality behavior above. **Unknown:** no external enum compatibility is established by this module.
