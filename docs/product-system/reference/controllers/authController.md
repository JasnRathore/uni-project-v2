# Auth controller

## Scope and evidence

Source: `lib\api\controllers\authController.js`. Route mappings are in `lib\api\routeRegistry.ts`; authentication middleware and dispatch behavior are in `lib\api\middleware\authMiddleware.js` and `app\api\[...route]\route.ts`. Behavior described here is directly visible in those files and the called database service interface.

## Exports and entrypoints

| Export | Route | Access |
| --- | --- | --- |
| `login` | `POST /auth/login` | Public |
| `signup` | `POST /signup` | Public |
| `studentSignup` | `POST /student/signup` | Public |
| `reactivateAccount` | `POST /account/reactivate` | Protected; signed-in account required |

For protected routes, the shared dispatcher calls `getUser` first and rejects missing/invalid tokens with 401. It permits the reactivate path despite `app_metadata.accountDisabled`; the controller itself again checks `req.user`.

## Handler behavior

| Handler | Inputs and validation | Flow, result, side effects, and errors |
| --- | --- | --- |
| `login` | Body `email`, `password` required; checks `JWT_SECRET` configuration. Email is trimmed for the case-insensitive lookup. | Queries `users` for ID, email, password hash, metadata JSON. Missing user and bcrypt mismatch both return `401 { error: "Invalid login credentials" }`. Valid credentials unpack `user_metadata`, sign a JWT containing `{ id,email,role,name }` with 7-day expiry, and return `{ success:true, token, user:{ id,email,user_metadata,app_metadata:{} } }`. Missing secret returns 503; caught errors return 500 with `err.message`. Does not write login state. |
| `signup` | Body `email`, `password`, `name` required. For roles other than `student` (default `teacher`), requires `departmentId` and checks that ID exists in `departments`; removes `rest.department` before passing metadata. | Calls auth admin `createUser` with `email_confirm:true` and metadata `{name,role,...rest}`. Auth-service error becomes `400 { error: message }`; success is `{ success:true, user:data.user }`; thrown errors return 500. No controller-side email/password format or role allowlist is present. |
| `studentSignup` | Copies body and removes legacy/unsupported `class`, `degreeId`, `batch`; requires email/password/name. PRN uses `prn || rollNumber || null`. | Auth admin creates a confirmed user with student identity metadata. Then writes `student_profile:<email>` with email, name, PRN, cohort ID, active lifecycle, zero points/progress, level 1, and registration timestamp. Auth error returns 400; success `{ success:true, user }`; caught errors return 500. The auth creation and profile write are not wrapped in a visible transaction; a profile-write failure can therefore return 500 after user creation. |
| `reactivateAccount` | Uses `req.user`; no body fields. If absent, returns 401. | Auth admin `updateUserById(user.id)` sets `user_metadata.accountDisabled:false` while spreading existing user metadata; success `{ success:true }`, auth error 400, thrown error 500. It does not visibly change `app_metadata`. The dispatcher’s disabled-account gate checks `app_metadata.accountDisabled`; whether the metadata update also clears that gate is not established by this controller. |

## Dependencies, storage, and callers

- `login` uses `getDatabaseClient().execute`, `bcryptjs.compare`, `jsonwebtoken.sign`, and `unpackMetadata`.
- Signup/reactivation use `getAuthService()` and the auth admin API. `studentSignup` additionally calls `writePortalData` for the profile.
- Public signup routes do not perform role checks in the dispatcher. The route-level protected behavior for reactivation is as described above.
- Callers are the route registry and the catch-all API dispatcher. No other direct callers are established by the inspected source.
- No SQL transaction or rollback is visible in these handlers.

## Response/error boundary and unknowns

All successful/error body shapes and explicit statuses appear in the table. The dispatcher converts uncaught handler exceptions to `500 { error }`; error text is exposed as `err.message`. Request parsing in the dispatcher falls back to `{}` on invalid JSON, after which required-field checks run. Password policy, email normalization beyond login lookup, email uniqueness enforcement, token revocation, and auth-service persistence details are not defined in this controller.
