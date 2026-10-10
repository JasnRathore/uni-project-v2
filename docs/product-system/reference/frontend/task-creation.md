# Faculty task creation

This page documents two related task forms: route-level `AddDailyTask` and dialog-level `AddTask`. They submit similar task data through different call paths and should not be treated as identical implementations.

## Purpose, exports, and props

Both components are named exports.

- `AddDailyTask`: optional `selectedClass`, `classes`, `students`; required `onBack()`, `onTaskCreated(task)`, `accessToken`.
- `AddTask`: `classData`, `onBack()`, `onAddTask(task)`, `students`, `accessToken`, optional `embedded` (default false).

## State, routes, interactions

`AddDailyTask` is routed at `/faculty/dashboard/add-task/:classId`, with an optional class chooser when no class is selected. It collects title, description, class, due date, priority and reward points. It explains automatic assignment to the selected class and returns to class view after success.

`AddTask` is used in the “Tasks & quizzes” create dialog after the class is selected. It collects title, description, due date, priority and maximum points. Its embedded mode suppresses the standalone header/back control and is used by `TasksAndQuizzesManagement`.

## API/data dependencies and feedback

Both POST JSON to `/api/teacher/tasks` with bearer token, class metadata, task type/status and points. `AddDailyTask` sets a timestamp ID and duplicate compatibility fields for points/date; `AddTask` sends form values with points parsed to integer. Both display assigned student count (server value where provided, otherwise `AddDailyTask` estimates from passed students), invoke parent callbacks, toast outcomes and call `onBack`. Missing fields/class or token in `AddDailyTask` stop submission with an error toast; request errors are caught and toasted. `AddTask` does not have a separate submit-loading state.

## Responsive/accessibility behavior

`AddDailyTask` stacks fields on small screens and uses two columns at `md`; `AddTask` uses a two-column desktop form. Both pair labels and controls and provide cancel/back buttons. Submit buttons are disabled while `AddDailyTask` is loading or if no class is active. No form-level inline error region or explicit screen-reader announcements beyond shared controls is present.

## Side effects and source references

Authenticated task creation and parent data updates are the only effects. Sources: `components/AddDailyTask.tsx`, `components/AddTask.tsx`, `components/FacultyDashboard.tsx`, `components/TasksAndQuizzesManagement.tsx`, product task terminology in `docs/product-system/product-design.md`.
