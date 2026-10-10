# Student dashboard

## Purpose and exports

`StudentDashboard` exports the student workspace content component. Required props: `student`, `accessToken`, `projectId`; the current student entry passes an empty project ID. The shell/sidebar, top-level notifications and profile account menu are in `app/student/dashboard/layout.tsx`.

## Routes, state, and interactions

The active final path segment selects Dashboard, Grades, Tasks & Quizzes, Leaderboard, or Profile. It owns grades, tasks, dashboard statistics, admin message, quest data, profile update state, and an inline `selectedQuiz`. Clicking a quiz starts `TakeQuiz`; successful submit posts answers and reloads data. Profile renders `StudentProfile`. Dashboard shows XP/level progress, streak, completed work, up to four outstanding items and admin broadcast. Tasks separate ongoing and completed work; grades show reviewed results; leaderboard delegates to `StudentLeaderboard`.

## API/data dependencies

Bearer-token requests load `/api/student/data` (grades, tasks, optional stats/streak and admin message) and `/api/quest`; quiz submissions POST `/api/student/quiz/submit`; profile saves POST `/api/student/profile/update`. If server stats are absent, a local fallback derives XP/level/completion from grades, tasks, and streak data. `projectId` is forwarded to `StudentProfile`, but this component’s own API requests do not use it.

## Loading, error, and empty states

The student data request sets `isGradesLoading` and uses one `gradesError` state. The grades view has skeletons, a retryable error card, reviewed-work empty state, and results summary. Dashboard shows a no-outstanding-work card; tasks shows an empty ongoing section and only renders completed section when nonempty. A failed top-level request sets the grades error even though the data bundle includes tasks; the task and overview views do not render the same explicit retry state. Quest lookup errors are console-only.

**Observed gap:** `showDailyQuestDialog` starts false and no code in this component sets it true; the dialog markup and “mark seen” callback exist, but the callback has no persistence. Do not assume the daily quest dialog is reachable.

## Responsive and accessibility behavior

Student pages use responsive card grids; grades render a semantic table from `md` upward and a compact list below it. A small-screen header exposes the sidebar trigger, while the shell’s desktop header is in the layout. Section labels, table caption, status/loading roles, refresh button labels, and decorative `aria-hidden` icons support assistive technology. Quiz timer state is detailed in [Quiz taking](quiz-taking.md).

## Side effects and source references

Mount loads student data and quest data. Mutations post bearer-authenticated requests, toast outcomes, and refresh data after quiz/profile save. Navigation updates the URL via Next router. Sources: `components/StudentDashboard.tsx`, `components/TakeQuiz.tsx`, `components/StudentProfile.tsx`, `components/StudentLeaderboard.tsx`, `app/student/dashboard/layout.tsx`, `docs/product-system/product-design.md`.
