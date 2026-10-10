# Connection test

## Purpose and exports

`ConnectionTest` is a diagnostics panel reachable from `Login` after a callback error whose message contains `"fetch"`. It exports a single component and accepts no props.

## State and interactions

Local state tracks whether checks are running and the most recent result object. “Run Connection Test” runs a health request and an OPTIONS request, then displays the project-ID/public-key configuration presence, status, response/error detail, and timestamp. Login owns the back button that returns from this panel to the form.

## Route and dependencies

Not a separate route. API dependencies are `GET /api/health` with a bearer header and `OPTIONS /api/health`. It reads `projectId` and `publicAnonKey` from `components/utils/supabase/info.tsx`; both are currently empty string constants. This is a same-origin application health/CORS probe, not a direct external Supabase ping.

## Loading, error, responsive, and accessibility behavior

While testing, the action is disabled and shows a spinner. Each request independently records passed/failed/error state, and errors are rendered in the result panel. No results appear before the first run. The card is width-limited and its action spans available width; no special narrow-screen layout is needed. Status uses text plus icons; an explicit live region is not present.

## Side effects and source references

Issues two fetches and logs request failures to the console. Source: `components/ConnectionTest.tsx`; caller and fallback state: `components/Login.tsx`; constants: `components/utils/supabase/info.tsx`.
