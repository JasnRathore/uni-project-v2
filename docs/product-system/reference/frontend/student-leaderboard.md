# Student leaderboard

## Purpose and exports

`StudentLeaderboard` shows XP rankings scoped to the student’s cohort or an active class. Props: `{ accessToken: string }`; named export.

## State, interactions, and data

It loads active leaderboard classes from `/api/student/leaderboards/classes` and selected-scope rankings from `/api/student/leaderboards/cohort` or `/api/student/leaderboards/classes/:classId`, both with bearer auth and no-store caching. Scope buttons update the selection; retry/refresh increments a reload counter. It shows current student rank/XP when present, total ranked students, timestamps, and a highlighted “You” entry.

## Route and states

Rendered at `/student/dashboard/leaderboard`. Both requests use abort controllers. Classes have independent loading/error state; rankings have skeleton, retryable error, and no-rankings states. If no active classes, cohort ranking remains available and an explanation is shown. A class scope without an active membership has its own empty explanation.

## Responsive/accessibility behavior

Scope controls form a horizontally scrollable button row with `aria-pressed`; ranking results are ordered-list entries and mark the current student. Summary cards use responsive columns. Skeleton container announces busy/loading; refresh/retry controls have text labels.

## Side effects and source references

Makes two bearer API reads; aborts outstanding requests when scope/access token changes or component unmounts. Sources: `components/StudentLeaderboard.tsx`, `components/StudentDashboard.tsx`, `docs/product-system/product-design.md`.
