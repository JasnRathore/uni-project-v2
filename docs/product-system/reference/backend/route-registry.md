# Shared API route registry

**Source:** `lib/api/routeRegistry.ts`  
**Evidence:** Types, route declarations, and matcher verified in source. The catch-all route handler invokes the registry; its runtime behavior is excluded.

## Exports and contracts

- `Handler` is `(req: unknown, res: unknown) => Promise<unknown>`.
- `RouteDefinition` contains method, path, handler, `protectedRoute`, `studentOnly`, and optional `parameter`.
- `createRouteRegistry(authController, studentController, teacherController, adminController = {}, gameController = {})` returns an ordered array of route definitions. The first three controller records are required; admin/game default to empty objects.
- `findRoute(routes, method, path)` returns `{ route, params }` or `null`. Exact routes return empty params; dynamic routes return decoded named parameters.

## Registry contents and behavior

The registry binds POST login/signup/student-signup and public academic catalog GETs; protected account reactivation; student profile/data/dashboard/leaderboard/notifications/quiz/quest routes; teacher profile/data, roster/class/task/grade, account, identity and membership operations; admin degree/cohort/program-year/subject and student-identity operations; and game progression/reward endpoints. Student routes set `studentOnly`; other protected routes set `protectedRoute` without that flag. Cohort/class leaderboard paths include legacy aliases. Methods, full paths, route order, selected handler property, and flags are explicit in the source array.

`findRoute` searches exact method/path first. Otherwise, it checks routes containing `/:`, replaces each parameter segment with a single non-slash capture, anchors the regex, and decodes captured values with `decodeURIComponent`. It returns the first match, so declaration order resolves any overlaps.

## Caller/dependency and edge cases

Controller handlers are injected as property values; this module does not import controllers or apply authorization. If an optional admin/game object omits a referenced property, the route still appears with an undefined handler. The matcher assumes `path` is a pathname without query string; it does not normalize slashes or HTTP methods. Malformed percent escapes can throw during decoding. Literal route segments are not regex-escaped, although current literal paths use safe characters.

**Verified:** route flags/mappings and matching algorithm. **Unknown:** how the caller handles an undefined handler, path normalization, or matcher exceptions.
