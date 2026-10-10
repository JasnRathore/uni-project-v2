# UI primitives catalogue

`components/ui/` contains **56** local UI primitive modules. They provide shared visual/interaction building blocks; application-specific behavior is described in the component references. No generated build output or vendored dependency source is included.

## Composition, navigation, and layout

| Primitive | Source |
| --- | --- |
| Accordion | `components/ui/accordion.tsx` |
| Aspect ratio | `components/ui/aspect-ratio.tsx` |
| Breadcrumb | `components/ui/breadcrumb.tsx` |
| Card | `components/ui/card.tsx` |
| Collapsible | `components/ui/collapsible.tsx` |
| Resizable panels | `components/ui/resizable.tsx` |
| Scroll area | `components/ui/scroll-area.tsx` |
| Separator | `components/ui/separator.tsx` |
| Sidebar | `components/ui/sidebar.tsx` |
| Tabs | `components/ui/tabs.tsx` |
| Carousel | `components/ui/carousel.tsx` |
| Navigation menu | `components/ui/navigation-menu.tsx` |

## Buttons, menus, and overlays

| Primitive | Source |
| --- | --- |
| Alert dialog | `components/ui/alert-dialog.tsx` |
| Button | `components/ui/button.tsx` |
| Context menu | `components/ui/context-menu.tsx` |
| Dialog | `components/ui/dialog.tsx` |
| Drawer | `components/ui/drawer.tsx` |
| Dropdown menu | `components/ui/dropdown-menu.tsx` |
| Hover card | `components/ui/hover-card.tsx` |
| Menubar | `components/ui/menubar.tsx` |
| Popover | `components/ui/popover.tsx` |
| Sheet | `components/ui/sheet.tsx` |
| Toast | `components/ui/toast.tsx` |
| Sonner toaster | `components/ui/sonner.tsx` |
| Tooltip | `components/ui/tooltip.tsx` |

## Forms and input

| Primitive | Source |
| --- | --- |
| Checkbox | `components/ui/checkbox.tsx` |
| Combobox | `components/ui/combobox.tsx` |
| Command | `components/ui/command.tsx` |
| Form helpers | `components/ui/form.tsx` |
| Input | `components/ui/input.tsx` |
| Input group | `components/ui/input-group.tsx` |
| OTP input | `components/ui/input-otp.tsx` |
| Label | `components/ui/label.tsx` |
| Radio group | `components/ui/radio-group.tsx` |
| Select | `components/ui/select.tsx` |
| Slider | `components/ui/slider.tsx` |
| Switch | `components/ui/switch.tsx` |
| Textarea | `components/ui/textarea.tsx` |
| Toggle | `components/ui/toggle.tsx` |
| Toggle group | `components/ui/toggle-group.tsx` |
| Calendar | `components/ui/calendar.tsx` |

## Status, data, and feedback

| Primitive | Source |
| --- | --- |
| Alert | `components/ui/alert.tsx` |
| Avatar | `components/ui/avatar.tsx` |
| Badge | `components/ui/badge.tsx` |
| Chart helpers | `components/ui/chart.tsx` |
| Progress | `components/ui/progress.tsx` |
| Skeleton | `components/ui/skeleton.tsx` |
| Table | `components/ui/table.tsx` |
| Pagination | `components/ui/pagination.tsx` |
| Loading indicators | `components/ui/loading.tsx` |
| KPI card | `components/ui/kpi-card.tsx` |
| Delta badge | `components/ui/delta-badge.tsx` |
| Metric value | `components/ui/metric-value.tsx` |
| Sparkline | `components/ui/sparkline.tsx` |

## Shared utility

| Primitive/helper | Source |
| --- | --- |
| `useIsMobile` hook | `components/ui/use-mobile.ts` |
| `cn` class combiner | `components/ui/utils.ts` |
| Delta direction helper | `components/ui/delta-badge.tsx` |

`KpiCard`, `DeltaBadge`, `MetricValue`, and `Sparkline` have custom data-display behavior and are used together by app screens; see [KPI components](kpi-components.md). Most other entries are shared primitives, not standalone application screens. This catalogue intentionally does not restate each primitive’s full generic API.
