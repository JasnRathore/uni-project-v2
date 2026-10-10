# Dashboard account menu

## Purpose and exports

`DashboardAccountMenu` is a shared account dropdown mounted in both dashboard sidebar footers. Named export; its props are `role: "professor" | "student"`, `displayName`, `email`, `identifier`, a list of `{ label, href, icon }` links, `onNavigate(path)`, and `onLogout()`.

## State and interactions

It renders a `RoleAvatar`, identity, supplied navigation items, an Appearance submenu for Light/Dark/System, and Log out. Theme state comes from `next-themes`; navigation/logout remain callbacks owned by the containing dashboard layout. The menu’s placement changes based on `useSidebar().isMobile`.

## Route, loading/error, and data

Used at `/faculty/dashboard/*` and `/student/dashboard/*` by their layouts. It does not fetch data, and has no local loading/error/empty states. Faculty supplies Settings and Diagnostics links; student supplies My profile.

## Responsive/accessibility behavior and side effects

Dropdown appears below on mobile and above on desktop; collapsed sidebar hides textual identity and chevron. Trigger has accessible name/title “Account menu”; icons are decorative, dropdown items provide text labels, and theme options use a radio group. Changing appearance calls `setTheme`; no additional persistence logic is implemented here.

Sources: `components/DashboardAccountMenu.tsx`, `components/RoleAvatar.tsx`, `app/faculty/dashboard/layout.tsx`, `app/student/dashboard/layout.tsx`.
