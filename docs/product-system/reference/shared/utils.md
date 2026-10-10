# Class-name utility export

## Source and export

`lib/utils.ts` re-exports `cn` from a bare module specifier, `"cn"`. This file
defines no additional transformation, validation, or conditional class-name
behavior. `app/layout.tsx` imports the re-export.

The repository also defines `cn` in `components/ui/utils.ts`, where it
combines `clsx` with `tailwind-merge`; many UI primitives import `"cn"`
directly. That implementation normalizes conditional class values and merges
conflicting Tailwind classes. The checked-in `tsconfig.json` shows an `@/*`
path mapping but does not itself define a `"cn"` mapping, so resolution of the
bare specifier must be verified from the active Next.js/tooling configuration
or installed module rather than assumed to be the local helper.

## Boundaries

This module is a compatibility/export seam, not a styling system by itself.
Changes to the module resolution/provider can affect its callers; the
component-local utility has its own direct import sites.
