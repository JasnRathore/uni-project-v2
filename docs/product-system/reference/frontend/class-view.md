# Faculty class view

## Purpose and exports

`ClassView` is the roster, activity summary, assignment, task/quiz entry, and quick-grade surface for one class. Named export.

## Props and state

Required props: `classData`, `students`, `onAddTask(task)`, `onAddQuiz(quiz)`, `accessToken`, `projectId`; optional `onStudentAssigned()` and `onViewStudent(student)`. Local state tracks selected student, assign and grade dialogs, candidate student, loading flags, student activity/task lists, refresh key, and a grade draft.

## Route, data, and interactions

Mounted on `/faculty/dashboard/class-view/:id`; parent supplies class/students and sets routes for task/quiz creation. Students matching the class ID(s) are sorted by PRN then name. Batch activity is fetched from POST `/api/teacher/students-batch-data`; selecting a student for quick grading loads `/api/teacher/student-tasks/:email`. Assigning a student POSTs `/api/teacher/classes/:classId/memberships`. Quick grade POSTs `/api/teacher/task-grade`. `onStudentAssigned` lets the parent reload workspace data.

## Loading, errors, and empty states

Activity failure falls back to original students and zero activity; student/task fetch failures toast and clear task data. The class view displays empty roster guidance, count/progress/grade summary cards, and assignment dialog no-match feedback. Assignment and activity have busy UI; quick-grade task load has an explicit loading state. Some data-read errors are console/toast feedback rather than inline retry.

## Responsive/accessibility behavior

Summary cards stack then become three columns; action groups wrap. Student assignment uses a searchable combobox; dialogs have titles/descriptions and buttons, and screen metrics have labels. The source sets a dashboard header title by dispatching `dashboard-title-change`; app layout consumes it.

## Side effects and source references

Fetches batch student activity when class data changes, reads task list when grade dialog opens, posts assignments/grades, and dispatches/cleans up a timer-backed title event. `projectId` and `onViewStudent` are accepted; this component’s observed requests use `accessToken`, and there is no evidence of project ID dependence. Sources: `components/ClassView.tsx`, `components/FacultyDashboard.tsx`, `app/faculty/dashboard/layout.tsx`.
