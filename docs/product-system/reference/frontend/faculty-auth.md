# Faculty authentication

## Purpose and exports

The faculty account-access module combines `FacultyAuthPage` (mode switch and orchestration), `Login` (credentials form), and `Signup` (new faculty form). Exports: named `FacultyAuthPage`, `Login`, `Signup`, and the `SignupCredentials` type.

## Props and local state

- `FacultyAuthPage({ mode })`: `mode` is `"login" | "signup"`.
- `Login`: `onLogin(email, password): Promise<void>`, `onSwitchToSignup()`, `onBack()`.
- `Signup`: `onSignup(credentials)`, `onSwitchToLogin()`, `onBack()`. `SignupCredentials` includes `name`, `email`, `password`, `confirmPassword`, `departmentId`, and `qualification`.
- Login state holds email/password, password visibility, submit loading, and whether to show the connection test. Signup state holds the fields, visibility toggles, department choices/loading, and submit loading.

## Route and behavior

`FacultyAuthPage` is the faculty auth route entry (`/faculty/login` or `/faculty/signup`); it routes between the two forms and returns to `/`. Login calls the Supabase-compatible client’s password login, checks/re-activates disabled accounts through `reactivateIfNeeded`, rejects student-role accounts, then verifies `/api/teacher/profile` before replacing the route with `/faculty/dashboard`. Signup posts JSON to `/api/signup` and on success routes to `/faculty/login`.

`Signup` loads `/api/academic/departments` on mount. Required fields are name, email, department and password; password confirmation must match, and password length must be at least six. Qualification is optional. The callback owns submission persistence.

## Loading, errors, empty states

Login validates non-empty email/password, shows busy copy and disables form controls while awaiting the callback. Auth/connection/wrong-role/profile errors are surfaced by Sonner; connection-like failures switch the form to the `ConnectionTest` surface. If the profile response fails, the session is signed out. Signup has a department-loading state, toast for lookup failure (with refresh guidance), client-side validation, and callback errors logged; on signup request failure, `FacultyAuthPage` shows a toast and throws.

There is no explicit no-departments empty message; an empty list leaves the select without choices. No form-level inline error region is rendered.

## Responsive and accessibility behavior

Forms use a centered single-column card constrained to a mobile-friendly max width, labelled inputs, native email/password input types, and full-width primary actions. Password visibility controls are buttons, but their icon-only accessible labels are not explicitly set. Back controls are buttons. Requiredness is validated in code (the faculty form does not consistently use native `required` attributes). Responsive layout is fluid; no alternate desktop form layout is defined.

## Side effects and source references

Uses router navigation, browser fetch, toast notifications, the auth client, and `reactivateIfNeeded`; no direct storage logic here. Sources: `components/FacultyAuthPage.tsx`, `components/Login.tsx`, `components/Signup.tsx`, `components/services/account.ts`, `components/ConnectionTest.tsx`, `app/faculty/login/page.tsx`, `app/faculty/signup/page.tsx`, `docs/product-system/product-design.md`.
