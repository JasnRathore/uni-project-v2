# Portal storage facade

**Source:** `lib/api/storage/portalStore.js`  
**Evidence:** Key names, coercions, and methods verified in source. Underlying relational namespace contracts are in [relational data service](relational-data-service.md).

## Exports and contract

Exports `{ portalStore }`. `portalStore.key` provides builders for `student_tasks:<email>`, `student_grades:<email>`, `dental_college_grades:<teacherId>`, `task_grades:<taskId>`, `notifications:<email>`, and `student_streak:<email>`.

Methods expose typed convenience operations:

- `readStudentTasks`, `readStudentGrades`, `readTeacherGrades`, and `readNotifications` read arrays; corresponding `write...` methods replace those namespace values.
- `readTaskGrades` reads an object map; `writeTaskGrades` replaces it.
- `readStreak` returns the raw `student_streak` value; `writeStreak` writes it.
- Generic `readArray(key)` maps anything not an array to `[]`; `readObject(key)` maps null, arrays, and primitives to `{}`.
- `listStudentTasks`, `listStudentGrades`, and `listNotifications` list records by namespace prefix. `deleteTaskGrades` deletes one task's grade mapping.

## Dependencies and side effects

All operations delegate to `readPortalData`, `writePortalData`, `deletePortalData`, or `listPortalDataByPrefix` from `database/services/dbService.js`; actual storage is normalized relational data, not a KV table. Writes replace a key's complete collection according to the adapter mapping. Transaction behavior and replacement caveats are defined by that adapter.

## Edge cases

The facade does not validate email/IDs or collection members and provides no per-method error handling. Read shape coercion can make a malformed or missing stored value look like an empty collection; it does not repair the underlying database. Prefix listing returns adapter-defined `{key, value}` records.

**Verified:** method-to-key mapping and shape coercion. **Unknown:** no caching or concurrency behavior is introduced by this thin facade.
