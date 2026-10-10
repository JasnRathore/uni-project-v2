# Role avatar

## Purpose and exports

`RoleAvatar` produces deterministic, role-themed DiceBear illustrations with initials as fallback. Named export. Props: `role: "professor" | "student"`, `name`, optional `identifier`, `className`, and `fallbackClassName`.

## State and behavior

It has no mutable state. A memoized FNV-style hash of the identifier (or name, or `"user"`) selects one of the local DiceBear styles; email identifiers are normalized to lowercase. Student avatars may also receive a deterministic pastel background. Initials derive from the first two name parts and fall back to `?`.

## Use location and dependencies

Used throughout faculty/student dashboard account, student records, student profile and leaderboard screens. No API or backend dependency; illustration definitions come from installed `@dicebear` packages and the shared avatar primitive.

## States, responsive/accessibility behavior, side effects

Image failure falls through the shared `AvatarFallback` initials. The generated image uses empty alt text because it is decorative; callers may size/style it through class props. No loading/error/empty UI beyond the fallback and no external side effects.

Source: `components/RoleAvatar.tsx`.
