# Testing, build checks, and delivery assets

This reference records the repository's test entry points and what each source
test covers at a high level, plus the verification and delivery boundaries. It
does not restate backend business logic.

## Exact source coverage

- `package.json` — available `test`, `lint`, `typecheck`, `build`, and `start`
  scripts.
- `tests/schema.test.js` — schema/setup, grade normalization, route-registry
  presence, and product boundary assertions.
- `tests/student-state.test.js` — student-state normalization and assignment
  exclusion checks.
- `tests/grade-recording.test.js` — class-linked, task-optional grade checks.
- `tests/academic-data-paths.test.js` — academic catalog and persistence
  boundary checks.
- `tests/test_migrate_snapshot.py` — snapshot-import normalization test.
- `next.config.mjs` and the repository deployment-file inventory — build
  validation and hosting evidence.

## Test and check scope

The configured `npm test` command runs only `tests/schema.test.js`. The other
three JavaScript test files use Node's built-in test runner but are not selected
by that script. The Python migration test is also not called by any
`package.json` script. To run the currently inventoried test files explicitly:

```sh
node --test tests/schema.test.js tests/student-state.test.js tests/grade-recording.test.js tests/academic-data-paths.test.js
python tests/test_migrate_snapshot.py
```

`npm run lint` invokes ESLint; `npm run typecheck` invokes `tsc --noEmit`.
Because `next.config.mjs` disables build-time TypeScript and ESLint failures,
those standalone commands are the explicit check entry points. `npm run build`
and `npm start` are the production build and serve commands, but no CI workflow
is present to establish an automated check sequence.

The JavaScript tests use Node's built-in test/assert modules and some use
`@libsql/client` with in-memory databases. The Python migration test uses
Python's standard library and creates temporary SQLite/CSV fixtures under the
repository before cleaning them up. Required Node/Python versions are not
pinned in a version file or `engines` field.

## Delivery-facing boundaries

`README.md` contains generic Next.js/Vercel instructions, but the repository
inventory contains no configured container, hosting manifest, or CI workflow.
The actual deployment platform and commands are therefore unverified. Runtime
variables and static assets are documented in
[runtime configuration](./runtime-configuration.md); route-level health-check
semantics are documented in [health endpoints](./health-endpoints.md).
