# Number and delta formatting

## Source and exports

`lib/format.ts` exports `formatNumber`, `formatDelta`, `computeDelta`, and the
`NumberFormat` and `FormatNumberOptions` types. These helpers provide locale-aware display formatting for numeric dashboard
metrics; they do not change or persist the underlying values. The metric
components `MetricValue` and `DeltaBadge` call `formatNumber` and
`formatDelta`; the product-specific composition and screen usage are covered
in [KPI components](../frontend/kpi-components.md).

## Formatter cache

The module keeps an in-memory `Map` of `Intl.NumberFormat` instances. A
formatter is keyed by locale plus a JSON serialization of its options, then
reused for later formatting requests with the same pair. The cache is local to
the running JavaScript module instance and has no eviction policy.

## `formatNumber(value, options)`

Options are:

| Option | Default | Behavior |
| --- | --- | --- |
| `format` | `number` | Selects ordinary number, compact notation, currency, or percentage formatting. |
| `currency` | `USD` | ISO 4217 currency code used for currency formatting. |
| `locale` | `en-US` | Locale passed to `Intl.NumberFormat`. |
| `maximumFractionDigits` | Format-specific | Overrides the fraction-digit maximum where supported. |
| `compact` | `false` | Requests compact notation alongside number/currency formatting. |

Non-finite values return an em dash (`—`). Compact format uses compact
notation and defaults to one maximum fractional digit. Currency defaults to
two fraction digits; percent defaults to one. Ordinary numbers default to zero
fraction digits. Compact number/currency formatting uses three significant
digits unless `maximumFractionDigits` is provided. `Intl.NumberFormat`
validates locale, currency, and option combinations; invalid values may throw
instead of being converted to a fallback string.

## `formatDelta(delta, locale)`

Interprets `delta` as a fractional change and formats it as a percentage with
one decimal place. Positive and negative values include a sign; zero is
unsigned. Non-finite values return an em dash. For example, `0.124` becomes
`+12.4%` in the default locale.

## `computeDelta(current, previous)`

Returns `(current - previous) / abs(previous)`. A falsy baseline, including
zero, returns `0` to avoid division by zero. The helper does not guard against
non-finite inputs; subsequent display via `formatDelta` renders a non-finite
result as an em dash.

## Boundaries

The helpers are presentation utilities only. They do not define business
rounding, score precision, currency policy, or the source/time window of a
metric. Callers must select the appropriate format and provide meaningful
values.
