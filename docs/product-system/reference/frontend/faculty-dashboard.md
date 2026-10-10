# Faculty dashboard and protected entry

## Purpose and exports

`FacultyDashboardPage` is the authenticated faculty route gate; `FacultyDashboard` is the routed workspace screen and data owner. Both are named exports. The page supplies the dashboard with `{ currentUser, onLogout, accessToken }`; `FacultyDashboard` takes `currentUser`, `onLogout`, and `accessToken`.

## State, routing, and screen composition

The entry checks the auth session, attempts account reactivation, rejects student-role accounts, and verifies `/api/teacher/profile`. It stores the teacher profile/token and renders `LoadingScreen` until settled; unauthenticated or invalid sessions are signed out or redirected to `/faculty/login`. Logout clears auth state, routes to `/`, and emits a success/error toast. It listens for and cleans up `DASHBOARD_LOGOUT_EVENT`.

The workspace derives its active view and encoded detail ID from `/faculty/dashboard/*`, pushes routes for navigation, and resolves selected class/task/student from loaded data. It hosts Overview, Students, Student details/profile, Classes, Class view, task/quiz creation, edit and submissions, Grades/legacy Marks, Academic catalog, Settings, and Diagnostics. The surrounding navigation/sidebar, responsive collapsible shell, current header labels, and account menu are in `app/faculty/dashboard/layout.tsx`, not this component.

## API/data dependencies and mutations

Using bearer `accessToken`, it loads `/api/teacher/data` and `/api/teacher/all-students`. It creates/deletes classes via `/api/teacher/classes/create` and `/api/teacher/classes/:id`, saves student/class arrays via POST `/api/teacher/students` and `/api/teacher/classes` when corresponding loaded state changes, updates tasks via `/api/teacher/tasks/:id` (PUT/DELETE), and updates profile via `/api/teacher/profile/update`. Child screens own the other operations described in their references. It filters duplicate student emails and excludes records whose role identifies them as teachers.

## Loading, error, and empty states

Initial workspace data load blocks content with `LoadingScreen`. Failed fetches show toasts and generally replace datasets with empty arrays, so failure can resemble a genuinely empty view. Missing route IDs show loading/not-found messages while required data resolves. Overview explicitly explains the no-student state; screen-specific empty/error states are described in each child reference. Class deletion is prevented in the UI when enrolled records exist; task deletion uses browser confirmation.

## Responsive and accessibility behavior

Responsive behavior is primarily in the app layout sidebar and individual child screens. Overview uses responsive card grids, truncated identity text, semantic sections, labelled totals, keyboard buttons, and visible focus styles for student links. This component does not add a global live error region; toast and child-screen semantics provide feedback.

## Side effects and source references

Fetches are triggered on mount/token change; state changes can persist whole student/class arrays. Mutations update local route data and show toasts. Page also handles auth session, browser logout event subscription, and router replacement. Sources: `components/FacultyDashboardPage.tsx`, `components/FacultyDashboard.tsx`, `app/faculty/dashboard/layout.tsx`, `lib/dashboard-events.ts`, and the route terminology in `docs/product-system/product-design.md`.
