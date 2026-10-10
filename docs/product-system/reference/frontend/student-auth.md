# Student authentication and entry

## Purpose and exports

This module contains `StudentApp` (session, route, and auth orchestration), `StudentLogin`, and `StudentSignup`. Named exports are those three components; signup credentials and option types are file-local. `StudentApp` accepts optional `onBackToLanding`.

## Props and state

- `StudentLogin`: `onLogin(email, password)`, `onSwitchToSignup()`, `onSwitchToFaculty()`.
- `StudentSignup`: `onSignup(credentials)`, `onSwitchToLogin()`, `onBack()`. The form passes account and academic identity values plus password to its callback; confirmation is used for client validation but omitted from its callback payload.
- `StudentApp` tracks session loading/authentication, student, access token and pathname; the forms track input values, lookup options, and submission loading.

## Routes, data, and interactions

`StudentApp` is the `/student/*` client entry. On mount it reads an auth session, applies disabled-account reactivation, rejects teacher-role sessions, validates `/api/student/profile`, and redirects an accepted session to `/student/dashboard`. Unauthenticated `/student/signup` renders the signup form; other unauthenticated student paths render login. Student signup posts `/api/student/signup` with `role: "student"` and routes to `/student/login` after success. Login uses the auth client, validates `/api/student/profile`, then enters the dashboard; it rejects teacher accounts and signs out on a profile authorization failure.

`StudentSignup` loads `/api/academic/degrees`; selecting a degree loads `/api/academic/degrees/:degreeId/cohorts`. The form validates required account and academic identity values, including name, email, PRN, degree and cohort; password must be at least six characters and match confirmation. The canonical student record stores email, name, optional PRN, and optional cohort ID; degree is resolved through the selected cohort.

## Loading, error, empty states

`StudentApp` renders `LoadingScreen` while session verification runs. Login shows a disabled/spinning submit action during auth and toast errors for invalid credentials, network failures, wrong portal, or failed profile lookup. Signup displays toasts on degree/cohort lookup failures and submission errors. Empty lookup arrays have no dedicated explanatory empty state; the cohort selector stays disabled unless a degree is selected and cohorts exist.

## Responsive and accessibility behavior

Forms use labelled inputs, native email/password types, a single-column card, and full-width actions. Signup fields for degree and cohort become a two-column row at `sm` and stack on smaller screens. Student login uses native required fields; other checks are explicit. Loading icons are accompanied by status text. Password visibility toggles are not provided in the student login/signup forms. Back/switch actions are buttons.

## Side effects and source references

Uses fetch, client-side router, toast, auth client and `reactivateIfNeeded`. While on a student dashboard route, it listens for `DASHBOARD_LOGOUT_EVENT`, signs out, clears local auth state and replaces route with `/`; listener is removed on effect cleanup. Sources: `components/StudentApp.tsx`, `components/StudentLogin.tsx`, `components/StudentSignup.tsx`, `components/services/account.ts`, `components/utils/supabase/client.ts`, `lib/dashboard-events.ts`, `app/student/login/page.tsx`, `app/student/signup/page.tsx`.
