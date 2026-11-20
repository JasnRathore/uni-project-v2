# Client auth shim and configuration constants

## Purpose and exports

This helper reference covers `components/utils/supabase/client.ts`, which exports `supabase`, an in-repository `MockAuth` object. The former `components/utils/supabase/info.tsx` compatibility constants no longer exist.

## Behavior and dependencies

`MockAuth` is a cookie-session client. The access token and its expiry are held only in module memory; nothing is written to `localStorage`. On load, `getSession()` returns the cached session when it is not near expiry and otherwise calls `POST /api/auth/refresh` (which carries the HttpOnly `portal_refresh_token` cookie) to obtain a new access token. Refreshes are single-flight, so concurrent callers share one rotation, and a timer silently refreshes before the 15-minute access token expires.

`signInWithPassword({ email, password })` POSTs `/api/auth/login`; the server sets the HttpOnly access/refresh cookies and the client keeps the returned token in memory. `signOut()` POSTs `/api/auth/logout` and clears the in-memory session. `updateUser({ password, currentPassword })` POSTs `/api/auth/change-password` with the bearer access token; the server verifies the current password. All three return `{ data, error }`-style results and return errors rather than throwing. The shim does not implement the full Supabase Auth client API (`getUser` and `onAuthStateChange` are absent).

## Routes, loading/errors, accessibility, and side effects

There is no UI or route in this helper module. Backend dependencies are `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, and `/api/auth/change-password`. Session state depends on the HttpOnly refresh cookie and in-memory access token; server-side `getSession` returns a null session. There is no exposed loading state. Network auth requests, cookie transport, and a refresh timer are the direct effects.

## Source references

Sources: `components/utils/supabase/client.ts` and consumers `components/FacultyAuthPage.tsx`, `components/FacultyDashboardPage.tsx`, `components/StudentApp.tsx`, `components/Settings.tsx`, and both dashboard layouts.
