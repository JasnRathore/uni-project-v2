# Authentication middleware

**Source:** `lib/api/middleware/authMiddleware.js`  
**Evidence:** JWT parsing, DB read, and request guards verified in source. The catch-all API runtime applies middleware; that runtime and controllers are excluded.

## Exports and contracts

Exports `getUser(authHeader)`, async Express-style `requireAuth(req, res, next)`, and synchronous `requireTeacher(req, res, next)` / `requireStudent(req, res, next)`. `JWT_SECRET` is read once when the module is loaded.

## Behavior

- `getUser` takes the second whitespace-separated token from the authorization header; it does not verify the scheme name. Missing token or secret returns `null`. It calls `jsonwebtoken.verify`, loads `users` by decoded `id`, unpacks `metadata_json`, and returns ID/email, user/app metadata, null last-sign-in timestamp, and creation timestamp. The selected DB role is not included in the output. Any verification, DB, or metadata error is swallowed and yields `null`.
- `requireAuth` calls `getUser`. Null yields HTTP 401 `{ error: 'Unauthorized' }`; truthy `user.app_metadata.accountDisabled` yields 403. Otherwise it assigns `req.user` and calls `next()`. Its outer catch returns HTTP 500 with `err.message`.
- `requireTeacher` denies only if `req.user.user_metadata.role === 'student'`; all other/missing role values pass.
- `requireStudent` permits only exact role `'student'`, otherwise returns 403.

## Dependencies and side effects

Uses `jsonwebtoken`; lazily requires `getDatabaseClient` and `unpackMetadata` from `database/services/dbService.js`. Reads one user row. It does not update last-login information, compare JWT role claims with stored role, or refresh JWT state.

## Errors and edge cases

Since `getUser` catches all exceptions, invalid tokens and DB outages both appear as unauthorized rather than surfacing through `requireAuth`'s 500 path. `split(' ')[1]` tolerates arbitrary scheme strings and extra trailing fields but fails if the token is not in that position. Role enforcement trusts JSON metadata and the teacher guard is permissive for unknown roles.

**Verified:** these are direct source semantics. **Unknown:** token issuer/expiration policy and the runtime's middleware ordering.
