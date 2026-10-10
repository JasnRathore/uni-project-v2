# Faculty quiz authoring

## Purpose and exports

`AddQuiz` creates a timed quiz for a selected class. Named export. Props: `classData`, `onBack()`, `onAddQuiz(quiz)`, `students`, `accessToken`, and optional `embedded` (default false).

## State and interactions

Stores title, description, due date, duration, points, question count, and question objects. It supports single-choice, multiple-choice, and short-answer questions; choice questions have four editable options. Questions can be added/removed and count is bounded from 1 to 50. Correct choices/accepted answers are collected. In embedded mode it hides the standalone header/back button.

## Route and data dependencies

Used at `/faculty/dashboard/add-quiz/:classId` and inside the task/quiz management dialog. It POSTs to `/api/teacher/tasks` with bearer auth, class metadata, questions, quiz type/status and numeric duration/points. On success it invokes `onAddQuiz`, toasts the server-reported assignment count, and calls `onBack` only when embedded; standalone parent behavior handles navigation.

## Loading/error/empty states

Client validation requires title, description, due date, duration, nonempty question text, filled choice options, at least one selected correct answer, and accepted text answer for short-answer questions. Errors/success use toasts. Request failure is caught and shown; there is no dedicated submitting state or inline error block, so repeated submission is not explicitly disabled. The first question is present by default; removal of the last question is blocked.

## Responsive/accessibility behavior

Basic fields use responsive one/two/three-column layouts; question cards use one/two columns at wide widths. Inputs/selects have labels or prompt text; correct choices are selectable buttons, though question-level labels are not consistently tied to unique control IDs. Shared dialog/form primitives provide keyboard mechanics when embedded.

## Side effects and source references

Creates a server quiz and updates parent-provided data via callback. `students` is accepted for assignment copy/metadata, while actual assignment count is server-reported. Sources: `components/AddQuiz.tsx`, `components/FacultyDashboard.tsx`, `components/TasksAndQuizzesManagement.tsx`, `components/TakeQuiz.tsx`.
