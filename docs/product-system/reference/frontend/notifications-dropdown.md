# Notifications dropdown

## Purpose and exports

`NotificationsDropdown` is a presentational notifications dialog exported as a named component. It receives `notifications`, `isOpen`, `onClose`, `onNotificationClick(notification)`, and `onMarkAsRead(id)`; the source does not declare a typed props interface.

## State, interactions, and data

No local state or data fetch. It partitions supplied notifications into unread and read, displays title/message/date plus optional points and teacher name, and calls click and mark-read callbacks when an item is selected. It uses a bell icon except for quest notifications.

## Route and states

No in-repository caller was found. The active student dashboard layout implements its own notification dialog instead, so this component’s intended route/owner is not established. Empty input renders “No notifications”; there is no loading or error state.

## Responsive/accessibility behavior

Dialog width is capped and content scrolls within a viewport-height bound. Dialog semantics come from the shared primitive. Notification items are clickable `<div>` elements, not buttons, and the component does not add keyboard activation or an explicit accessible name for each item; this is an observed accessibility limitation.

## Side effects and source references

All persistence, navigation, and read mutations are callback-owned; the component itself has no side effects. Sources: `components/NotificationsDropdown.tsx`, active layout implementation in `app/student/dashboard/layout.tsx`, `components/ui/dialog.tsx`.
