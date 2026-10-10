# Client auth shim and configuration constants

## Purpose and exports

This helper reference covers `components/utils/supabase/client.ts` and `components/utils/supabase/info.tsx`. The former exports `supabase`, an in-repository `MockAuth` object; the latter exports `projectId`, `publicAnonKey`, and `supabaseUrl`.

## Behavior and dependencies

`MockAuth.getSession()` reads `token` and JSON `user` from browser `localStorage`, returning a session shape or null. `signInWithPassword({ email, password })` POSTs `/api/auth/login`, stores response token/user on success, and returns a `{ data, error }`-style result; errors are returned rather than thrown. `signOut()` removes both storage keys. The exported shim does not implement the full Supabase Auth client API (notably no `updateUser` in this source).

The three configuration constants in `info.tsx` are empty strings and are retained for compatibility; the inline comment states they are no longer used for Supabase.

## Routes, loading/errors, accessibility, and side effects

There is no UI or route in these helper modules. Backend dependency is `/api/auth/login`; session state depends on localStorage. Server-side `getSession` returns null; browser storage access is guarded except the JSON parse itself may throw for malformed stored user data. The helper does not expose a loading state. Storage reads/writes and network auth request are the direct effects.

## Source references

Sources: `components/utils/supabase/client.ts`, `components/utils/supabase/info.tsx`, and consumers `components/FacultyAuthPage.tsx`, `components/FacultyDashboardPage.tsx`, `components/StudentApp.tsx`, `components/Settings.tsx`, and both dashboard layouts.
