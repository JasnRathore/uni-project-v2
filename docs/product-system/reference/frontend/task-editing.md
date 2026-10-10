# Faculty task and quiz editing

## Purpose and exports

`EditTask` is the edit form for one task or quiz. Props: `task`, `onBack()`, async `onSave(updatedTask)`; named export.

## State, route, and interactions

Initial values are copied from the task into local form state: title, description, due date, priority, subject, total points, duration, status and optional questions. Quiz-specific fields render only when `task.type === "quiz"`. Quiz questions can be added/removed, text/options/correct choice edited. Save normalizes numeric points/duration and attaches `updatedAt`, then delegates to parent.

Rendered at `/faculty/dashboard/edit-task/:id`; `FacultyDashboard` performs PUT `/api/teacher/tasks/:id`, replaces its local task on success, and routes back to task/quiz management.

## Loading/error/empty states

Title, description and due date are checked; quizzes also require question text and nonempty options. Validation failures toast. `EditTask` itself has no loading state and does not catch callback errors; parent shows success/error toasts. The last quiz question cannot be removed. The form assumes a resolved task; parent handles missing-task lookup.

## Responsive/accessibility behavior

Fields stack on narrow screens and use two/three-column grids for date/score/duration on larger screens. Labels accompany inputs and selects; form actions are buttons. No explicit live error region or responsive alternate editing mode is present.

## Side effects and source references

Local state only until `onSave`; API, route, and error side effects belong to `FacultyDashboard`. Source: `components/EditTask.tsx`, `components/FacultyDashboard.tsx`.
