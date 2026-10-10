# Faculty grade management

## Purpose and exports

`MarksManagement` is the faculty gradebook screen (the current route label is Grades; legacy route segment `marks` also maps here). It takes `students`, `classes`, `accessToken`, and `projectId`; named export.

## State, route, and data

State covers loaded grade records, load status, search, subject/class filters, add/edit dialogs, editing record and a draft grade. On `/faculty/dashboard/grades` (also `/marks`) it reads `/api/teacher/data` for grades, then writes full grade arrays to `/api/teacher/grades`. It can add letter/numeric grade records tied to class/student, edit score/max score/feedback, filter/search, calculate summaries, and export current filtered results as CSV.

## Loading, error, empty states

If no students are supplied it returns a dedicated no-students state. Grade-load errors are logged and toasted but there is no inline error/retry state; initial loading is stored but not rendered as a dedicated skeleton. Empty grade results distinguish no grades from no filter matches. Mutations toast success/failure. The source includes `syncGradesToBackend`, but no call site is evident; normal add/edit uses `persistGrades`.

## Responsive/accessibility behavior

The top action area and filters reflow for small widths, but the grade results table itself is not replaced with a mobile list in this component and may require horizontal accommodation. Inputs/selects have associated labels or prompts; edit is presented through a dialog; CSV export is disabled when nothing matches. No explicit table caption or live status is present.

## Side effects and source references

Fetches grade data when token/project ID changes; persistent add/edit writes use bearer requests. CSV export creates a Blob URL, clicks a generated anchor, then revokes the URL. Sources: `components/MarksManagement.tsx`, `components/FacultyDashboard.tsx`, `components/ui/kpi-card.tsx`, product route terminology in `docs/product-system/product-design.md`.
