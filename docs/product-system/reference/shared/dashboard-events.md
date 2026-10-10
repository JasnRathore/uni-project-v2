# Dashboard event contract

## Source

`lib/dashboard-events.ts`

## Export

The module exports the constant `DASHBOARD_LOGOUT_EVENT` with the string value
`dashboard:logout`. It centralizes the event name used to signal dashboard
logout across UI modules so callers can share one contract rather than repeat
an uncoordinated literal.

The file does not implement event dispatch, event subscription, authentication
state clearing, or navigation. Those behaviors belong to the code that emits
or handles this event. The event's string is the complete implementation in
this module.

## Boundaries

This is a browser presentation-layer coordination constant, not an
authentication mechanism or server-side session invalidation API. The
faculty dashboard layout and student dashboard layout dispatch a `window`
event with this name on logout. `FacultyDashboardPage` and `StudentApp`
subscribe to it and run their local logout handling; each removes its listener
when the component is cleaned up. These call sites are in
`app/faculty/dashboard/layout.tsx`, `app/student/dashboard/layout.tsx`,
`components/FacultyDashboardPage.tsx`, and `components/StudentApp.tsx`.

The event therefore coordinates local client logout handling, but does not
revoke a JWT or invalidate credentials on the server. Other logout flows
should be checked at their call sites rather than assumed to use this event.
