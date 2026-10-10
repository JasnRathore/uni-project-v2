# Academic catalog management

## Purpose and exports

`AcademicCatalogManagement` browses degrees, program years and subjects and conditionally exposes controls to create catalog records. Props are `accessToken` and `canManage`; named export.

## State, interactions, and routes

State includes loaded degree/year/subject options, selected degree/year, draft names, and loading/saving flags. It is rendered by the faculty workspace at `/faculty/dashboard/catalog`; the sidebar only exposes it for admin/administrator metadata, while component UI also gates create controls with `canManage`.

The component reads `/api/academic/degrees`, `/api/academic/degrees/:degreeId/program-years`, and `/api/academic/program-years/:programYearId/subjects`. Create actions post to `/api/admin/degrees`, `/api/admin/degrees/:degreeId/program-years`, and `/api/admin/program-years/:yearId/subjects`, then reload relevant options. This screen does not manage cohorts or student academic identities.

## Loading/error/empty states

Initial degrees load shows placeholder text and disables selector. Lookups and mutations show toasts on failure; button refresh reloads degrees and the selected year/subject. Empty subjects distinguish “select a year” from “no subjects registered.” No catalog-wide loading skeleton or inline error/retry state is present. Non-managers see read-only access copy.

## Responsive/accessibility behavior

Browse selectors form one/two columns; creation cards reflow from one to two/three columns. Form controls have labels, empty statuses use `role="status"`, and action buttons include pending copy. The UI gate is not a substitute for server-side authorization.

## Side effects and source references

Authenticated fetch requests use no-store and JSON parsing; async effects prevent updates after cleanup. Success toasts and refresh selected catalog data. Sources: `components/AcademicCatalogManagement.tsx`, `components/FacultyDashboard.tsx`, `app/faculty/dashboard/layout.tsx`, product terminology in `docs/product-system/product-design.md`.
