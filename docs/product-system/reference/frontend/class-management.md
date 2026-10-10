# Faculty class management and class creation

## Purpose, exports, props

`ClassManagement` lists/filter classes and opens a dialog with `AddClass`. `AddClass` is the curriculum-backed creation form. Both named exports; `ManagedClass` is an exported shape containing ID, name, subject/catalog IDs and labels, grade/program year, and optional description/capacity/count/timestamp.

`ClassManagement` props: `accessToken`, `classes`, async `onAddClass(newClass): Promise<boolean>`, `onViewClass(class)`, `onDeleteClass(classId)`, optional students (supports single or multiple class IDs). `AddClass` props: `accessToken`, `onBack()`, `onAddClass(newClass): Promise<boolean>`.

## State, routes, and data dependencies

Class list holds search, program-year filter and add-dialog state. It computes counts from passed student memberships and delegates view/delete to the parent. The parent maps these actions to `/faculty/dashboard/class-view/:id` and class deletion.

The form loads degrees from `/api/academic/degrees`, selected degree program years from `/api/academic/degrees/:degreeId/program-years`, and selected year subjects from `/api/academic/program-years/:programYearId/subjects`, with bearer auth/no-store reads. Submit derives the class name from catalog subject and year unless supplied; it creates a local ID and delegates the write to the dashboard callback (`POST /api/teacher/classes/create` in `FacultyDashboard`).

## Loading, errors, and empty states

List has explicit no-classes vs no-search-match copy and a create-first-class action. Add dialog is controlled by list state. Form shows degree loading in the select and subject-empty status; option failures show toasts. It validates subject and year, disables submission until a subject is selected and while saving, and reports creation success/failure with toast. Downstream year/subject lookups do not have explicit loading indicators or empty messages for program years.

## Responsive/accessibility behavior

The list toolbar stacks on small widths; cards use one/two/three columns. Search, year filter and dialog controls use input/selection primitives; view/delete buttons include class-specific accessible labels and empty-state text describes next steps. The form uses labelled selects/inputs, status role for the no-subject case, and full-width submit. Dialog semantics/focus are delegated to the shared primitive.

## Side effects and source references

Fetch effects are cancelled from updating component state after cleanup. Create/delete callbacks and toast notifications are side effects. Capacity is collected/displayed but this UI does not enforce the limit. Sources: `components/ClassManagement.tsx`, `components/AddClass.tsx`, `components/FacultyDashboard.tsx`, `components/ui/dialog.tsx`.
