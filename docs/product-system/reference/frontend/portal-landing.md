# Portal landing

## Purpose and exports

`PortalLanding` is the public role-selection surface. It renders two link cards, Faculty and Student, with brief role-specific descriptions. The only export is the named `PortalLanding` component; its internal `PortalLink` helper and props type are file-local.

## Props, state, and interactions

No props or local state. The whole card is a Next `Link`: Faculty goes to `/faculty/login`, Student goes to `/student/login`. No backend data or mutation is involved.

## Route and use location

Mounted at `/` by `app/page.tsx`; the page also mounts the shared Sonner toaster.

## States, responsive behavior, and accessibility

There are no loading, error, or empty states. The cards stack on narrow viewports and become two columns at the `md` breakpoint. Links are keyboard-focusable with a visible focus ring; decorative icons and the arrow are hidden from assistive technology. Each link has a title and description.

## Side effects and source references

No side effects beyond client-side navigation. Sources: `components/PortalLanding.tsx`, `app/page.tsx`, and terminology in `docs/product-system/product-design.md` (“Faculty portal” and “Student”).
