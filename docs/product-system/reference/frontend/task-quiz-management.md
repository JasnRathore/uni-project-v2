# Faculty task and quiz management

## Purpose and exports

`TasksAndQuizzesManagement` is the faculty listing, filter, summary, and action surface for tasks and quizzes. It composes `AddTask` and `AddQuiz` in a class-selection creation dialog. Named export.

## Props and state

Props: `tasks`, `classes`, `students`, `onEditTask(task)`, async `onDeleteTask(id): Promise<boolean>`, `onCreateTask(task)`, `onManageStudents(task)`, and `accessToken`. State tracks task statistics/loading, deletion ID, create type/class, search, class and status filters.

## Route, interactions, and backend data

Rendered at `/faculty/dashboard/tasks-quizzes`. It sorts tasks newest-first, splits task/quiz sets, searches title/description/class/subject, filters class and active/inactive/overdue state, and shows all/tasks/quizzes tabs. Create opens a dialog, requires choosing a class, then mounts the corresponding form. Student-management, edit, and delete actions delegate to the dashboard; delete confirmation is performed by the parent.

It reads `/api/teacher/task-stats` with bearer auth, and shows KPI counts (tasks, quizzes, active, overdue). Forms post new records to `/api/teacher/tasks`; screen-provided callbacks update parent state.

## Loading, errors, and empty states

Statistics failures are console/toast-only and the screen does not render an explicit stats retry state. Each tab distinguishes no records from no search/filter matches. Creation without classes produces a toast. Deletion has per-item busy state; add forms own their own mutation feedback.

## Responsive/accessibility behavior

KPI cards and task cards reflow responsively; toolbar controls stack on narrow widths; the create dialog becomes near-full-screen when a class is chosen and constrains its scrollable body. Tabs, labelled search/selects, tooltipped icon buttons with explicit accessible labels, and card titles provide structure. Dialog focus behavior comes from shared UI primitives.

## Side effects and source references

Fetches task stats whenever supplied task/student props change (effect triggers recalculation), makes bearer requests, and delegates mutations/navigation to parent. KPI visuals are detailed in [KPI components](kpi-components.md); class selection and task creation behavior are detailed in [Task creation](task-creation.md) and [Quiz authoring](quiz-authoring.md). Source: `components/TasksAndQuizzesManagement.tsx`.
