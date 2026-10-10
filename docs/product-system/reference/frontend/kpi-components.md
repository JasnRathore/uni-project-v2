# KPI and metric display components

## Purpose and exports

These four UI modules are grouped because `KpiCard` composes the three metric helpers:

- `KpiCard` / `KpiCardProps`: label, numeric/string value, optional fractional delta/context label, optional trend series, number format/currency, inverted delta meaning, icon, children and base Card props.
- `DeltaBadge` / `DeltaBadgeProps` and `getDeltaDirection(delta)`: direction, positive/negative/flat status, formatted change and optional icon/variant.
- `MetricValue` / `MetricValueProps` and `DEFAULT_COMPACT_FROM` (100,000): format, currency, precision, abbreviation threshold, suffix.
- `Sparkline` / `SparklineProps`: series, area/line variant, fill style, color, curve, stroke width, animation and duration.

## Application use and data

`KpiCard` is used in faculty task/quiz and grade screens with counts and an average percentage; those screens pass labels, values, and icons. Other optional delta/trend props are not supplied by those observed call sites. The components display caller-provided values only; they do not fetch or persist backend data.

## Interaction, state, and accessibility behavior

`KpiCard` composes shared card pieces and renders delta only when supplied, sparkline only for a trend with at least two points, and optional context/children. `MetricValue` renders strings as-is, formats numbers through `lib/format`, and abbreviates absolute values at/above threshold (except percentages), with full value in a tooltip. `DeltaBadge` maps finite sign to up/down/flat, optionally inverts whether direction is good, and renders a corresponding icon. `Sparkline` maps values to a responsive Recharts chart; it is `aria-hidden` and respects `prefers-reduced-motion`.

No local data-loading, error, or empty states are provided; these primitives assume valid values supplied by parent. `MetricValue` adds a tooltip only for compacted numbers. Screen responsiveness is delegated to card grid callers and the sparkline’s `ResponsiveContainer`.

## Side effects and source references

No API side effects. `Sparkline` subscribes to `matchMedia` changes for reduced motion and cleans up the listener. Sources: `components/ui/kpi-card.tsx`, `delta-badge.tsx`, `metric-value.tsx`, `sparkline.tsx`, `components/MarksManagement.tsx`, `components/TasksAndQuizzesManagement.tsx`, `lib/format.ts`.
