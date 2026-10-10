# Direct libSQL client

**Source:** `lib/db.ts`  
**Evidence:** Configuration and export verified in source. Repository search found no imports of this module; it appears separate from the main service facade.

## Export and configuration contract

Exports one `db` created by `createClient` from `@libsql/client`. It lowercases `DATABASE_TARGET`:

- `local` selects literal `file:local.db` (this helper does not read `LOCAL_DATABASE_URL`).
- `turso` selects `TURSO_DATABASE_URL`.
- An unset/other target falls back to `file:local.db` only when `TURSO_DATABASE_URL` is unset; with a remote URL set, it leaves the target URL undefined and throws.

An undefined selected URL throws `Set DATABASE_TARGET=local or DATABASE_TARGET=turso before using the database`. File URLs omit the auth token; non-file URLs use `TURSO_AUTH_TOKEN` (which can itself be undefined at this layer).

## Dependencies, differences, and effects

This is a direct client constructor; it does not import `schemaService`, call `ensureDatabaseReady`, load dotenv, expose transaction/read/write wrappers, or lazily initialize. It may create a client independently of `database/services/dbService.js`, whose target handling and local URL semantics differ. No source imports were found by searching repository JS/TS files, so active runtime use is not verified.

**Verified:** export and branch behavior. **Unknown:** whether external tools or files outside the repository import this module.
