# Faculty diagnostics panel

## Purpose and exports

`DebugPanel` provides a diagnostic view of student records in the application’s legacy KV-store model. It accepts `accessToken` and exports a named component.

## State, route, and data dependencies

Loaded automatically at `/faculty/dashboard/debug`; state holds the debug result, loading flag, and request error. It reads `/api/debug/students` and then `/api/teacher/all-students` with bearer token. Only the first response is displayed; the second is fetched/logged to the browser console. Displayed KV details include count, record key, ID, name, email, role, created time and expandable raw JSON.

## Loading/error/empty states

Shows spinner while fetching, an inline error card on debug read failure, and an explicit zero-record explanation/instructions. A refresh button reruns both requests. Failure of the secondary all-students request can enter the general error path after debug data was already set.

## Responsive/accessibility behavior

Content uses responsive two-column record details and scrollable raw JSON. Refresh is a labelled text button; raw data uses native disclosure `<details>/<summary>`. Error is visibly titled; status is not explicitly announced through a live region. No specialized mobile navigation is added.

## Side effects and source references

Makes diagnostic and roster API reads and writes debug detail to console. `projectId` and `publicAnonKey` are imported but unused in the current source. Sources: `components/DebugPanel.tsx`, `app/faculty/dashboard/layout.tsx`, `components/utils/supabase/info.tsx`.
