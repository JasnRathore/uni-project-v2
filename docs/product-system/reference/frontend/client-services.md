# Client services

## Purpose and exports

`components/services/api.ts` exports `API_BASE`, `apiFetch`, and an `api` object with `get`, `post`, `put`, and `delete`. `components/services/account.ts` exports `reactivateIfNeeded(session)`.

## API helper behavior

`apiFetch` prefixes non-absolute endpoint paths with `/api`, defaults `Content-Type` to JSON, calls `fetch`, parses successful JSON, and throws an error from JSON `error` or status text for non-OK responses. Convenience methods JSON-stringify post/put bodies and optionally attach a bearer token. These helpers are a separate request abstraction; no app-component call site was found in the repository search, so active screen dependencies on them are not established.

## Account reactivation behavior

`reactivateIfNeeded` returns true unless `session.user.app_metadata.accountDisabled` is truthy. For disabled accounts it uses a blocking browser confirmation; declining signs out and returns false. Accepting POSTs `/api/account/reactivate` with bearer token, throws a parsed API error on failure, and returns true on success. It is used by faculty and student auth/session flows.

## Loading, errors, route, and accessibility

Neither helper renders UI or stores state. `apiFetch` propagates errors to callers; reactivation can throw or return false and callers decide how to report it. The confirm prompt is browser-native and has no custom accessibility/responsive surface. Both helpers are client-side integration code, not a route.

## Side effects and source references

Fetch requests and, for account reactivation, browser confirmation/auth sign-out are the side effects. Sources: `components/services/api.ts`, `components/services/account.ts`, `components/FacultyAuthPage.tsx`, `components/FacultyDashboardPage.tsx`, `components/StudentApp.tsx`.
