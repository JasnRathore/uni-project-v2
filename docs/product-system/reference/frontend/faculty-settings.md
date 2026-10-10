# Faculty settings

## Purpose and exports

`Settings` provides faculty profile, notification, preference, and security/account controls. Props: `currentUser`, `accessToken`, async `onUpdateProfile(profile)`, `onLogout()`; named export.

## State, route, interactions, and data

Rendered at `/faculty/dashboard/settings`. State includes editable profile fields, department options, notification flags, preferences (theme/language/date/time/academic year/grading system), and password fields/visibility. Departments load from `/api/academic/departments`. Profile, notification, and preference saves delegate to the parent callback (`POST /api/teacher/profile/update` in `FacultyDashboard`). Theme changes also call `next-themes.setTheme`.

Security controls verify the current password using `supabase.auth.signInWithPassword`, then call `supabase.auth.updateUser` for the new password (minimum eight characters and matching confirmation). Account deactivation POSTs `/api/teacher/account/deactivate`; permanent deletion DELETEs `/api/teacher/account`. Both ask for browser confirmation and call `onLogout()` after success.

## Loading/error/empty states

Department lookup has a loading-disabled selector and toast on failure; no empty departments message. Save failures/success are toasts. Password validation and account confirmation are client-side. Account mutation requests parse backend error messages. Buttons do not show a consistent saving state. **Source contract caveat:** the current `components/utils/supabase/client.ts` mock exports `getSession`, `signInWithPassword`, and `signOut`, but does not define `updateUser`; password-change success is therefore not established by the checked-in client implementation.

## Responsive/accessibility behavior

Tabs and form fields use responsive layouts, labels, `Switch`/select controls and password visibility buttons. Each password field has a label; visibility buttons are icon-only and have no explicit accessible name in this file. Content is mobile single-column and expands at medium breakpoints.

## Side effects and source references

Loads departments on mount; writes profile/preferences/notifications, changes theme, reauthenticates for password update, and can deactivate/delete the teacher account followed by logout. Sources: `components/Settings.tsx`, `components/FacultyDashboard.tsx`, `components/utils/supabase/client.ts`, `app/faculty/dashboard/layout.tsx`.
