# Faculty student records

This reference covers the closely coupled Students list and Student details screen.

## Purpose, exports, and props

`StudentsList` is a searchable/filterable roster card grid. Props: `students`, `accessToken`, `onSelectStudent(student)`, `classes`, optional `onRefresh()`. `StudentDetails` is a selected student’s academic/activity/membership detail view. Props: `student`, `classes`, `onAssignSuccess()`, `accessToken`. Both are named exports.

## State, interactions, and data

`StudentsList` stores search text, graduation cohort/class/assignment filters, loaded cohorts and per-email activity, and activity loading. It loads `/api/academic/cohorts` and POSTs student email batches to `/api/teacher/students-batch-data`; failures are logged and activity defaults to zero values. It filters the supplied roster on name/email/class/PRN, cohort, class, and assignment; Refresh delegates to the parent and opening a record calls `onSelectStudent`.

`StudentDetails` derives active memberships from the selected record and supplied class list, with a fallback for older single-class student data. Only active faculty-owned classes not already assigned are choices. It loads `/api/teacher/student-streak/:email` and `/api/teacher/student-tasks/:email`, assigns through POST `/api/teacher/classes/:classId/memberships` with student ID, and removes through DELETE `/api/teacher/classes/:classId/memberships/:studentId`. Success calls the parent refresh callback.

## Route and feedback states

Used under `/faculty/dashboard/students` and `/faculty/dashboard/student-details/:id`. The parent resolves the selected record from registered and teacher data; while unresolved it shows “Loading student…” or a not-found message. List shows a live activity loading message, filtered-empty vs no-records copy, and default/zero activity after API failure. Details displays loading placeholders for activity, a no-active-memberships message, and explanatory text if no eligible class exists. Mutation failures appear as toasts.

## Responsive/accessibility behavior

Student cards use one/two/three-column responsive grids; filters expand from two to four columns. Inputs/selects are labelled; detail and refresh icon controls have accessible names. Progress uses `role="progressbar"` with a name and bounded value. Details rearranges academic/activity/class panels into a single column then two-column layout; class membership actions have labelled buttons.

## Side effects and source references

Both screens use effects for authenticated fetches. Student list aborts the cohort request on unmount and prevents late batch updates; details aborts on unmount/student change. Mutations have updating states and toast feedback. Sources: `components/StudentsList.tsx`, `components/StudentDetails.tsx`, `components/FacultyDashboard.tsx`.
