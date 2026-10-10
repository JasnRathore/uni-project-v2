# Faculty task-of-the-day dialog

## Purpose and exports

`QuestDialog` is a controlled form dialog that creates a special same-day class task. Named export. Props: `isOpen`, `onClose()`, `accessToken`, `projectId`, and `classes`.

## State, interaction, and data

Local form state contains title, description, points (default 50), selected class, and loading. It POSTs `/api/teacher/tasks` with bearer auth, class name/ID, parsed points, today’s date, active status and task type; on success it shows assigned count, clears title/description/points and closes. `projectId` is accepted but unused.

## Use location and feedback

No in-repository caller was found, so no route or current entry point is established. Dialog open/close is controlled by caller. It validates title, description and class; loading disables cancel/submit and changes submit copy. Request failures toast; there is no dedicated initial loading or no-classes empty state.

## Responsive/accessibility behavior

Dialog is width-limited; form controls have labels, class selection is a shared select, title/description use native required indicators, and submit/cancel are buttons. It uses dialog title/description primitives. There is no dedicated narrow-screen re-layout beyond responsive max-width behavior.

## Side effects and source references

Authenticated POST to teacher task API plus toast/callback side effects. Source: `components/QuestDialog.tsx`; route registry context: `lib/api/routeRegistry.ts`.
