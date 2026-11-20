# Auth controller

## Scope and evidence

Source: `lib\api\controllers\authController.ts`. Route mappings are in `lib\api\routeRegistry.ts`; authentication middleware and dispatch behavior are in `lib\api\middleware\authMiddleware.ts` and `app\api\[...route]\route.ts`. Session and cookie helpers are in `lib\api\services\sessionService.ts` and `lib\api\services\authCookieService.ts`. Behavior described here is directly visible in those files and the called database service interface.

## Exports and entrypoints

| Export | Route | Access |
| --- | --- | --- |
| `login` | `POST /auth/login` | Public |
| `refresh` | `POST /auth/refresh` | Public; requires the refresh cookie |
| `logout` | `POST /auth/logout` | Public; idempotently clears cookies |
| `me` | `GET /auth/me` | Protected |
| `requestSignupOtp` | `POST /auth/signup/request-otp` | Public |
| `signup` | `POST /signup` | Public |
| `studentSignup` | `POST /student/signup` | Public |
| `forgotPassword` | `POST /auth/forgot-password` | Public |
| `resetPassword` | `POST /auth/reset-password` | Public |
| `changePassword` | `POST /auth/change-password` | Protected; signed-in account required |
| `reactivateAccount` | `POST /account/reactivate` | Protected; signed-in account required |

For protected routes, the shared dispatcher calls `getUser` first and rejects missing/invalid tokens with 401. It permits the reactivate path despite `app_metadata.accountDisabled`; the controller itself again checks `req.user`.

## Handler behavior

| Handler | Inputs and validation | Flow, result, side effects, and errors |
| --- | --- | --- |
| `login` | Body `email`, `password` required; checks `JWT_SECRET` configuration. Email is trimmed for the case-insensitive lookup. | Refuses further attempts with `429` when the email has `MAX_FAILED_ATTEMPTS` (5) failures in the trailing 15 minutes. Queries `users`; missing user and bcrypt mismatch both record a failed attempt and return `401 { error: "Invalid login credentials" }`. Success records the attempt, creates an `auth_sessions` row, signs a short-lived access JWT (`{ id,email,role,name,sid }`, 15 minutes), sets the HttpOnly access/refresh cookies, and returns `{ success:true, token, expiresIn, user:{ id,email,user_metadata,app_metadata } }`. Missing secret returns 503; caught errors return 500 with `err.message`. |
| `refresh` | Reads the `portal_refresh_token` cookie. | Missing cookie returns `401 { error, code: "SESSION_EXPIRED" }` after clearing cookies. Otherwise rotates the session (rotation revokes the old row and mints a new token in the same family); a replayed revoked token revokes the entire family. Failure clears cookies and returns 401; success reloads the user, sets fresh cookies, and returns a new `token`/`user` payload. |
| `logout` | Reads the refresh cookie. | Revokes the refresh session (or the current access-token session when only a bearer token is present) and clears both cookies. Always returns `{ success:true }`; a thrown error clears cookies and returns 500. |
| `me` | Uses `req.user`. | Returns the current account `{ success:true, user:{ id,email,user_metadata,app_metadata } }`; missing user returns 401. |
| `requestSignupOtp` | Body `email`, `password`, `name`; role defaults to `teacher`. Teacher signup requires a valid `departmentId`, student signup a valid `cohortId`; password at least 6 characters. Rejects an existing email with 409. | Issues a signup OTP through `signupOtpService`, then emails it. A send failure cancels the OTP and returns 503. Success `{ success:true, email, expiresInSeconds:600, resendAfterSeconds:60 }`. |
| `signup` | Body `email`, `password`, `name`, `otp` required. For roles other than `student` (default `teacher`), requires `departmentId` and checks that ID exists in `departments`; removes `rest.department` before passing metadata. | Consumes the signup OTP, then calls auth admin `createUser` with `email_confirm:true` and metadata `{name,role,...rest}`. Auth-service error becomes `400 { error: message }`; success is `{ success:true, user:data.user }`; thrown errors return 500. |
| `studentSignup` | Copies body and removes legacy/unsupported `class`, `degreeId`, `batch`; requires email/password/name/otp. PRN uses `prn || rollNumber || null`. | Consumes the student OTP, then auth admin creates a confirmed user with student identity metadata. Then writes `student_profile:<email>` with email, name, PRN, cohort ID, active lifecycle, zero points/progress, level 1, and registration timestamp. Auth error returns 400; success `{ success:true, user }`; caught errors return 500. The auth creation and profile write are not wrapped in a visible transaction; a profile-write failure can therefore return 500 after user creation. |
| `forgotPassword` | Body `email`. | Always returns `{ success:true }` to avoid account probing. For an existing user it creates a reset token and best-effort emails it; missing config or send failure is logged only. |
| `resetPassword` | Body `token` and `password`/`newPassword` (at least 8 characters). | Verifies the signed reset token and its password-hash fingerprint, writes the new bcrypt hash, and revokes every session for the user. Invalid/expired token returns 400. |
| `changePassword` | Protected; body `currentPassword` and `password`/`newPassword` (at least 8 characters). | Verifies the current password against the stored hash (`400 "Current password is incorrect"` on mismatch), writes the new hash, and revokes every other session while keeping the caller's current session. |
| `reactivateAccount` | Uses `req.user`; no body fields. If absent, returns 401. | Auth admin `updateUserById(user.id)` sets `app_metadata.accountDisabled:false` while spreading existing app metadata, so the dispatcher's disabled-account gate is cleared. Success `{ success:true }`, auth error 400, thrown error 500. |

## Dependencies, storage, and callers

- `login` uses `getDatabaseClient().execute`, `bcryptjs.compare`, the session service, and `unpackMetadata`; `refresh`/`logout`/`changePassword`/`resetPassword` use the session service (`createSession`, `rotateSession`, `revokeSessionByToken`, `revokeSessionById`, `revokeAllUserSessions`, `signAccessToken`).
- Signup/reactivation use `getAuthService()` and the auth admin API. `studentSignup` additionally calls `writePortalData` for the profile.
- Signup OTP and password-reset logic live in `signupOtpService` and `passwordResetService` respectively.
- Public signup routes do not perform role checks in the dispatcher. The route-level protected behavior for reactivation is as described above.
- Callers are the route registry and the catch-all API dispatcher. No other direct callers are established by the inspected source.
- No SQL transaction or rollback is visible in these handlers.

## Response/error boundary and unknowns

All successful/error body shapes and explicit statuses appear in the table. The dispatcher converts uncaught handler exceptions to `500 { error }`; error text is exposed as `err.message`. Request parsing in the dispatcher falls back to `{}` on invalid JSON, after which required-field checks run. The JWT audience/scope model, per-IP (rather than per-email) throttling beyond the recorded IP, and multi-device session listing are not defined in this controller.
