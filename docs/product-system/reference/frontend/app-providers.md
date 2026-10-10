# App providers

## Purpose, export, and props

`Providers` exports a wrapper accepting `{ children: React.ReactNode }`. It is the application-level theme and tooltip context.

## State and behavior

Wraps children in `ThemeProvider` with class-based theme selection, `defaultTheme="light"`, system preference enabled, and theme transition suppression. A `TooltipProvider` wraps the subtree so tooltip primitives can share context.

## Route/use location and dependencies

Mounted by the root application layout (integration location: `app/layout.tsx`). It does not load product data or make API requests.

## States, accessibility, and responsive behavior

No bespoke loading/error/empty UI. The selected theme may initially be resolved by `next-themes`; no additional hydration state is introduced here. Tooltip accessibility/interaction is delegated to `components/ui/tooltip.tsx`.

## Side effects and source references

Theme provider can update the root element’s class and persist/theme-resolve through `next-themes`; exact storage policy is library configuration not restated here. Sources: `components/Providers.tsx`, `app/layout.tsx`, `components/ui/tooltip.tsx`.
