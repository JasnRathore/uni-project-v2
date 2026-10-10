# Student profile

## Purpose and exports

`StudentProfile` is a shared editable student information form for student self-service and faculty-assisted editing. Named export. Props: `student`, `accessToken`, `projectId`, `onUpdate(data)`, optional `isTeacherEditing` (defaults false).

## State and interactions

Initial local form data includes name, email, PRN, phone, address, and bio. Email is disabled; other values are editable. Save disables the submit button and shows progress. Avatar photo buttons are visual only: no upload handler or photo API is wired in this component.

## Route, API, and outcomes

Student profile is reached at `/student/dashboard/profile`; faculty renders the same component on `/faculty/dashboard/profile`. Student save POSTs `/api/student/profile/update`; teacher edit PUTs `/api/teacher/students/:studentId`, both with bearer token and JSON profile data. On success it toasts and calls `onUpdate(profileData)`; failure/exception yields toast feedback. `projectId` is accepted but not used in source.

## Loading/error/empty states; responsive/accessibility

There is a save-in-progress label/spinner but no initial loading or empty record state; the parent is expected to provide a resolved profile. The form uses a responsive one-to-two-column field grid, semantic labels, disabled email input, labelled photo button, and a full-width-to-right-aligned save action. No inline field validation is shown.

## Side effects and source references

Performs authenticated fetch on save only; parent determines whether to refresh or update records. Sources: `components/StudentProfile.tsx`, `components/StudentDashboard.tsx`, `components/FacultyDashboard.tsx`.
