# Faculty task submissions and grading

## Purpose and exports

`TaskSubmissionsPage` lists students assigned to one task/quiz and allows a faculty member to assign a letter grade. Props: `task` (`id`, `title`, optional `className`, `type`), `accessToken`, `onBack()`. Named export.

## State, interactions, and API

Loads assigned students via POST `/api/teacher/task-students` with `{ taskId, listType: "assigned" }` and grades via GET `/api/teacher/task-grades/:taskId`. Search filters by name/email; status filter is all/pending/graded. Grade selection optimistically updates local state, POSTs `/api/teacher/task-grade` with task/student IDs and letter grade, and rolls back on failure. It shows a graded count.

## Route and states

Reached at `/faculty/dashboard/task-submissions/:taskId` through task management’s “view students” action. Initial loading displays placeholder rows. Read failures toast and stop loading, with no inline retry control. Empty states distinguish no assigned students from no filter matches. Saving is tracked per student.

## Responsive/accessibility behavior

Header and filters stack on narrow screens; row cards switch from stacked to horizontal alignment at `sm`. Search/filter controls have accessible labels; grade select label is student-specific; status count is `aria-live="polite"`; loading group is labelled busy. Result status uses text and badges.

## Side effects and source references

Per-task authenticated reads and grade writes; component prevents late state update after unmount. Sources: `components/TaskSubmissionsPage.tsx`, `components/TasksAndQuizzesManagement.tsx`, `components/FacultyDashboard.tsx`.
