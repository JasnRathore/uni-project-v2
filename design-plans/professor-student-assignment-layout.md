# Expanding the professor student-assignment workspace

Written against: `0a5a1ea834bc99352b3975d2dcfd8708af6d492a`

## Evidence chain

- Surface: `/admin/dashboard/assign-student/[student]`, reached from Students when a professor opens a portal account.
- Problem: The supplied 1772px screenshot shows the assignment content using roughly half of the available workspace, leaving a large empty area to its right.
- Design evidence: The screenshot supplied with the request; `app/admin/dashboard/layout.tsx` gives the page a flexible `<main>`, and the existing Students directory uses a responsive `max-w-7xl` content frame.
- Owner: `components/AssignStudent.tsx`.
- Scope and affected surfaces: The professor-facing portal-student assignment view only.
- Uncertainty: The screenshot establishes the desktop width issue. Other student views were not visually audited and are not included.

## Design decision

Let the assignment page use the dashboard's available width. At large desktop widths, place student information and the class-assignment form in two peer columns; keep the current student-information-first order as a single column on smaller screens. This uses the existing dashboard shell and card components without changing assignment behavior.

## Reuse

- `Card`, `CardHeader`, `CardContent`, and spacing tokens from `components/ui/card.tsx`.
- Responsive content-frame precedent: `components/StudentsList.tsx`.
- Exemplar: the screenshot's dashboard shell, which already gives its main content the available width.

## Changes

1. `components/AssignStudent.tsx`
   - Change: Replace the `max-w-2xl` detail wrapper with a full-width responsive frame capped at `max-w-7xl`, using the existing page gutters (`p-4 sm:p-6 lg:p-8`). Place the student-information and class-assignment cards in one grid with a consistent gap; switch to two columns at `xl`, retaining the existing card order below that breakpoint.
   - Preserve: Back navigation, student and activity metrics, current-assignment summary, class selection, assign/update/unassign actions, loading states, and success/error feedback.
   - Verify: At wide desktop sizes the two cards use the available content width without stretching text fields or causing horizontal overflow; at tablet/mobile widths they stack in the current reading order.

## Scope

- Inherit: The existing admin dashboard shell, theme, and shared card primitives.
- Verify: Both registered students with an existing assignment and registered students without one; no-class state; loading and mutation-pending states; light and dark themes; 320px, 768px, 1024px, and 1440px viewports.
- Exclude: Student roster, professor editing of manual-student profiles, class views, data fetching, assignment API behavior, and unrelated dashboard cleanup.

## Validation

- Product: Open the assignment route from Students; update an assignment and unassign a student. Confirm these actions and their feedback are unchanged.
- Interface: Compare desktop width use at 1440px and wider; confirm the cards stack cleanly at 1024px and below, with no clipped controls or horizontal scrolling.
- System: Confirm the layout uses the existing dashboard shell, card primitives, and spacing conventions; do not introduce a parallel card or page-frame component.
- Repository: `npm run build` → production build succeeds; `git diff --check` → no whitespace errors.

## Stop conditions

- Stop if the route is redesigned as a shared detail-page frame for other record types; that would require an explicit broader scope.
- Stop if the student metrics cannot fit legibly in the student-information column at the chosen desktop breakpoint; retain a single-column layout rather than compressing them.

## Design documentation

- After acceptance and validation: none.
