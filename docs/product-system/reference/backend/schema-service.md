# Schema initialization service

**Source:** `database/services/schemaService.js`  
**Evidence:** File resolution and post-schema migration verified in source. Canonical DDL details are covered by [schema contract](schema-contract.md).

## Export and sequence

Exports `ensureDatabaseSchema(db)`. It resolves `new_schema.sql` by checking first `process.cwd()/new_schema.sql`, then a path two directories above this module. If neither exists it throws an error listing both checked paths. It synchronously reads the SQL as UTF-8 and calls `db.executeMultiple` with the full script.

After the script, it reads `PRAGMA table_info("teacher_profiles")`. If `department_id` is absent it adds that nullable FK column referencing `departments(id)` with `ON DELETE RESTRICT`. If the pre-add column list included legacy `department`, it then copies department IDs by case-insensitive name and drops the old column.

## Dependencies and consistency

Uses Node `fs` and `path`; its caller is `ensureDatabaseReady` in `database/services/dbService.js`. The service itself does not create a transaction, maintain a migration ledger/version, or catch/retry SQL errors. The outer facade caches the promise and clears it on rejection.

## Edge cases

Path resolution depends on process working directory for the first candidate but has a source-relative fallback. The compatibility ALTER assumes the database supports `ADD COLUMN ... REFERENCES` and `DROP COLUMN`; unsupported SQLite/libSQL features propagate as errors. If the column exists, the compatibility copy/drop path is skipped.

**Verified:** SQL execution and conditional migration steps. **Unknown:** whether `executeMultiple` wraps the DDL script atomically and how existing deployments are versioned outside this function.
