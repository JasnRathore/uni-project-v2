# Authentication middleware

**Source:** `lib/api/middleware/authMiddleware.ts`  
**Evidence:** JWT parsing, cookie fallback, session check, DB read, and request guards verified in source. The catch-all API runtime applies middleware; that runtime and controllers are excluded.

## Exports and contracts

Exports `getUser(authHeader, cookieHeader)`, async Express-style `requireAuth(req, res, next)`, and synchronous `requireTeacher(req, res, next)` / `requireStudent(req, res, next)`. `JWT_SECRET` is read once when the module is loaded.

## Behavior

- `getUser` takes the second whitespace-separated token from the authorization header; it does not verify the scheme name. When that is absent it falls back to the `portal_access_token` HttpOnly cookie read from the cookie header. Missing token or secret returns `null`. It calls `jsonwebtoken.verify`, loads `users` by decoded `id`, unpacks `metadata_json`, and returns ID/email, `session_id` (the token's `sid` claim, or null), user/app metadata, null last-sign-in timestamp, and creation timestamp. The selected DB role is not included in the output.
- If the token carries a `sid`, the row in `auth_sessions` is checked: a revoked or expired session is treated as unauthenticated. Tokens without `sid` predate sessions and are not checked against the table.
- Any verification, DB, session, or metadata error is swallowed and yields `null`.
- `requireAuth` calls `getUser` with both the authorization and cookie headers. Null yields HTTP 401 `{ error: 'Unauthorized' }`; truthy `user.app_metadata.accountDisabled` yields 403. Otherwise it assigns `req.user` and calls `next()`. Its outer catch returns HTTP 500 with `err.message`.
- `requireTeacher` denies only if `req.user.user_metadata.role === 'student'`; all other/missing role values pass.
- `requireStudent` permits only exact role `'student'`, otherwise returns 403.

## Dependencies and side effects

Uses `jsonwebtoken` and `authCookieService`; lazily requires `getDatabaseClient`, `unpackMetadata`, and `sessionService.isSessionActive`. Reads one user row and, when a `sid` is present, one session row. It does not update last-login information, compare JWT role claims with stored role, or refresh JWT state.

## Errors and edge cases

Since `getUser` catches all exceptions, invalid tokens, revoked sessions, and DB outages all appear as unauthorized rather than surfacing through `requireAuth`'s 500 path. `split(' ')[1]` tolerates arbitrary scheme strings and extra trailing fields but fails if the token is not in that position. Role enforcement trusts JSON metadata and the teacher guard is permissive for unknown roles.

**Verified:** these are direct source semantics. **Unknown:** token issuer/audience policy and the runtime's middleware ordering.
