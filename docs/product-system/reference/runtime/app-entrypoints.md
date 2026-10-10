# Application route and layout entry points

This reference covers the App Router page, layout, and handler files under
`app/`. Page content and detailed interaction behavior belong to the referenced
shared components; this describes only the route-level composition, path
handling, navigation, and redirects visible in these entry points.

## Exact source coverage

| Source | URL / scope | Route-level behavior |
| --- | --- | --- |
| `app/layout.tsx` | Root layout | Sets document language, metadata, global CSS, fonts, and the shared `Providers` wrapper. It does not enforce authentication. |
| `app/page.tsx` | `/` | Renders `PortalLanding` and a Sonner `Toaster`. |
| `app/student/login/page.tsx` | `/student/login` | Renders the shared `StudentApp`; this file does not pass a login mode or redirect. |
| `app/student/signup/page.tsx` | `/student/signup` | Renders the same `StudentApp`; this file does not pass a signup mode or redirect. |
| `app/student/dashboard/layout.tsx` | `/student/dashboard` and descendants | Provides the student dashboard shell, sidebar navigation, account menu, and notifications. |
| `app/student/dashboard/[[...section]]/page.tsx` | Optional dashboard section path | Renders `StudentApp` for the base path and optional suffixes; this route file does not validate section names. |
| `app/faculty/login/page.tsx` | `/faculty/login` | Renders `FacultyAuthPage` with `mode="login"`. |
| `app/faculty/signup/page.tsx` | `/faculty/signup` | Renders `FacultyAuthPage` with `mode="signup"`. |
| `app/faculty/dashboard/layout.tsx` | `/faculty/dashboard` and descendants | Provides faculty dashboard navigation, account menu, title handling, and a catalog menu item for session roles `admin` or `administrator`. |
| `app/faculty/dashboard/[[...section]]/page.tsx` | Optional dashboard section path | Renders `FacultyDashboardPage`; the exact first section `add-class` calls `notFound()`. Other suffixes are passed through by pathname/layout behavior, not validated here. |
| `app/admin/login/page.tsx` | `/admin/login` | Redirects to `/faculty/login`. |
| `app/admin/signup/page.tsx` | `/admin/signup` | Redirects to `/faculty/signup`. |
| `app/admin/dashboard/layout.tsx` | Legacy admin dashboard alias | Passes children through without adding an admin shell or authentication check. |
| `app/admin/dashboard/[[...section]]/page.tsx` | `/admin/dashboard` and optional suffixes | Redirects to `/faculty/dashboard`, preserving suffix segments after URI-encoding each segment. |
| `app/api/[...route]/route.ts` | `/api/*` catch-all | Exposes API methods and dispatch behavior; see [API routing](./api-routing.md). |
| `app/api/health/route.ts` | `/api/health` | Dedicated API health handler; see [health endpoints](./health-endpoints.md). |
| `app/health/route.ts` | `/health` | Health handler outside the `/api` prefix; see [health endpoints](./health-endpoints.md). |

The optional catch-all route filenames use Next.js App Router conventions:
`[[...section]]` matches the dashboard base path as well as paths with one or
more remaining segments.

## Dashboard navigation and authentication boundary

- The student layout derives its active view from the first pathname segment
  after `/student/dashboard`. Its sidebar navigates to the dashboard,
  leaderboard, grades, and tasks; the account menu links to the profile. Task
  and grade notifications navigate to those respective views. Logout dispatches
  the shared `DASHBOARD_LOGOUT_EVENT`.
- The student layout reads the client session for display data, fetches
  `/api/student/notifications` when an access token is available, and posts
  notification-read updates to `/api/student/notifications/read`. This is not a
  route-level access guard.
- The faculty layout derives its active view the same way, exposes workspace
  and teaching navigation, and provides settings and diagnostics account links.
  It listens for `dashboard-title-change` to customize the class-view title.
  The catalog sidebar item is conditionally displayed from session metadata;
  this display condition does not protect a route.
- Neither dashboard layout contains a redirect for a missing session. The
  login and signup page files delegate to shared UI components without
  expressing the components' post-authentication redirects. Those outcomes
  cannot be established from these route files alone.
- The `/admin/*` pages are legacy URL aliases to faculty pages, not a separate
  admin dashboard shell. The application route files do not state whether the
  eventual destination authorizes the user; API authorization is separately
  enforced by the adapter described in [API routing](./api-routing.md).

## Boundaries

The app tree also contains shared styling and a favicon:
`app/globals.css`, `app/shadcn-tailwind.css`, and `app/favicon.ico`. Their
build/runtime role is noted in [runtime configuration](./runtime-configuration.md);
they are not routes. This inventory does not document implementation details
inside `components/`, controllers, or backend services.
