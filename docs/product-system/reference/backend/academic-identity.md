# Academic identity service

**Source:** `lib/api/services/academicIdentityService.js`  
**Evidence:** Exported object, statements, and transaction boundaries verified in source; related constraints verified in `new_schema.sql`. `lib/api/controllers/adminController.js` is the caller; controller behavior is excluded.

## Exports and contracts

The module exports `identityService`, an object with `listDegrees(includeInactive = false)`, `createDegree({ name, status = 'active' })`, `setDegreeStatus(id, status)`, `listCohorts(degreeId, includeInactive = false)`, `createCohort({ degreeId, label, status = 'active' })`, `setCohortStatus(id, status)`, and `assignStudent({ studentId, degreeId, cohortId, actorId, reason })`.

## Behavior

- Degree listing left-joins cohorts, counts them, optionally filters inactive degrees, groups by degree ID, and orders by name. The cohort count includes inactive cohorts.
- Degree creation trims and requires the name, generates a UUID, inserts the supplied/default status, and fetches the row. Status is not application-validated on create; the schema limits it to active/inactive.
- Degree status update accepts only `active` or `inactive`, writes `updated_at`, and returns the row or `null` when the ID did not match.
- Cohort listing is degree-scoped, joins the degree name, optionally filters inactive cohorts, and orders by label.
- Cohort creation requires degree ID and nonblank label, trims the label, inserts a UUID and supplied/default status, then fetches the row. It does not precheck degree existence or validate status; FK/unique/check constraints report those conditions.
- Cohort status update has the same status check and nullable return behavior as degree update.
- Student reassignment requires a nonblank reason and runs within `withTransaction`. It reads the student and the student's current cohort/degree; rejects missing students; fetches the requested cohort and rejects missing cohorts or a mismatch when a `degreeId` argument was supplied. It updates `students.cohort_id`, then inserts an `academic_identity_events` audit row with old/new degree/cohort, actor, and trimmed reason. It returns a spread of the pre-update student projection with new degree/cohort values.

## Data and consistency

Dependencies: `randomUUID`, `getDatabaseClient`, and `withTransaction` from the DB service facade. Tables are `degrees`, `graduation_cohorts`, `students`, and `academic_identity_events`. Cohorts have unique `(degree_id, label)` and restrict deletion of their degree; student cohort references are nullable on cohort deletion. Reassignment's student change and audit event are atomic through the shared write transaction.

## Errors and edge cases

Application errors include missing degree name, invalid statuses, missing cohort inputs, required correction reason, missing student, and cohort-degree mismatch. Unknown IDs on status changes are not errors (return `null`). Reassignment does not verify that the cohort is active, that the student is active, or that the actor is authorized; supplied `degreeId` is optional, so if omitted the cohort's actual degree is accepted. Those are source-level behaviors, not recommendations.

## Verified / inferred / unknown

**Verified:** return shapes and checks above. **Unknown:** concurrent write behavior beyond the transaction API's contract and the external caller's role checks.
