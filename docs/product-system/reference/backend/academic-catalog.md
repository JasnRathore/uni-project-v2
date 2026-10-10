# Academic catalog service

**Source:** `lib/api/services/academicCatalogService.js`  
**Evidence:** Implementation and SQL statements verified in source. Schema relationships verified in `new_schema.sql`. Route caller is `lib/api/controllers/adminController.js`; controller-level authorization and request parsing are out of scope.

## Exports and contracts

CommonJS exports: `listProgramYears(degreeId, includeInactive = false)`, `createProgramYear({ degreeId, label })`, `listSubjects(programYearId)`, `listCatalogSubjects()`, and `createSubject({ programYearId, name })`. The async methods return the database driver's `rows` arrays or the inserted row. Creation methods return `rows[0]`, which may be undefined if a driver does not return a row for the follow-up query.

## Behavior and invariants

- `listProgramYears` selects each program year plus degree name for the supplied degree, ordered case-insensitively by label. Unless `includeInactive` is truthy, both the program year and parent degree must be active.
- `createProgramYear` rejects a falsey degree ID and a missing/whitespace-only label. It separately verifies that the degree exists and is active, creates a random UUID, inserts the trimmed label, then fetches the row. There is no encompassing transaction for check/insert/read.
- `listSubjects` returns the requested program year's subjects with degree/year labels. The join enforces matching subject/degree IDs, and active degree and program-year status are required; results sort case-insensitively by subject name.
- `listCatalogSubjects` returns subjects under active degrees and years, ordered by degree, year, and subject names.
- `createSubject` requires a program-year ID and nonblank name, verifies that the program year and its degree are both active, derives the degree ID from that row, inserts a UUID-backed subject with trimmed name, and fetches its joined catalog representation. The precheck/insert/fetch are separate statements.

## Data, dependencies, and side effects

Uses `node:crypto.randomUUID` and `getDatabaseClient()` from `database/services/dbService.js`. Reads/writes `degrees`, `program_years`, and `subjects`; the schema's composite `(program_year_id, degree_id)` foreign key prevents a subject from pairing a year with a different degree. Unique constraints also reject duplicate program-year labels per degree and subject names within a degree/year. This module has no explicit transaction and no external side effects beyond SQL writes.

## Errors and edge cases

Validation throws ordinary `Error`s (`Degree is required`, `Program-year label is required`, `Active degree not found`, and equivalent subject/program-year messages). SQL constraint/driver failures propagate. `includeInactive` is interpreted by JavaScript truthiness, not parsed as a strict boolean. Active checks are enforced for create operations, but these methods do not validate caller authorization; that belongs to their excluded caller.

## Verified / inferred / unknown

**Verified:** predicates, SQL joins/order, UUID generation, trimming, and checks above.  
**Unknown:** transaction isolation/race behavior of the installed libSQL driver and controller-facing error translation; neither is defined here.
