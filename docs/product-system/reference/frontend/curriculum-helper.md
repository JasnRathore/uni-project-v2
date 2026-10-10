# Static dental curriculum helper

## Purpose and exports

`dentalClasses.ts` exports a fixed `dentalClasses` array, inferred `DentalClass` type, `getClassesByYear()`, and `getAllYears()`. The data contains sample BDS year 1–5 and MDS year 1–3 courses with static identifiers, display names, descriptions, and subject/year fields.

## State, route, interactions, and data

Pure static data: no props, state, UI, route, network access, or backend dependency. `getClassesByYear` groups available records into a fixed eight-year-key object; `getAllYears` returns those same year labels. No in-repository call site outside the helper was found; the current class creation flow instead queries the academic catalog API.

## Loading/error/empty, responsive/accessibility, side effects

Not applicable to a data-only helper. No loading/error handling or effects. Grouped arrays may be empty for a year if no static entries are supplied.

## Source references

Source: `components/utils/dentalClasses.ts`; current dynamic alternative: `components/AddClass.tsx`.
