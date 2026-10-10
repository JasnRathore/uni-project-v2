# Frontend component references

These references describe application-authored source in `components/`. Terminology follows [Product design](../../product-design.md): **Faculty** is the product-facing role (commonly stored as `teacher`), **Student** is the student portal, and **program year**, **graduation cohort**, and **academic year** are distinct concepts. The references record behavior present in source; gaps or uncertain behavior are labeled.

## Inventory and coverage

Inventory is based on the checked-in TypeScript/TSX files under `components/`, not build output or dependencies.

| Scope | Files inventoried | Coverage |
| --- | ---: | --- |
| App components directly under `components/` | 34 | Covered below by the app-component references |
| App helpers, services, config, and image helper (`services/`, `utils/`, `figma/`) | 6 | Covered below by helper references |
| UI primitives under `components/ui/` | 56 | Listed in [UI primitives catalogue](ui-primitives.md); material KPI behavior is detailed in [KPI components](kpi-components.md) |
| **Total** | **96** | **40 application-authored component/helper files and 56 UI primitive files** |

There are **31 dedicated component/helper reference pages** (covering all 40 app component/helper files), plus the grouped UI-primitives catalogue and this coverage page. Every app component/helper source is mapped once below. The KPI row also cross-references UI source modules whose custom behavior is documented separately; the catalogue remains the complete inventory of all UI primitives.

| Reference | Source coverage |
| --- | --- |
| [Portal landing](portal-landing.md) | `components/PortalLanding.tsx` |
| [Faculty authentication](faculty-auth.md) | `components/FacultyAuthPage.tsx`, `components/Login.tsx`, `components/Signup.tsx` |
| [Connection test](connection-test.md) | `components/ConnectionTest.tsx` |
| [Student authentication](student-auth.md) | `components/StudentApp.tsx`, `components/StudentLogin.tsx`, `components/StudentSignup.tsx` |
| [Faculty dashboard](faculty-dashboard.md) | `components/FacultyDashboardPage.tsx`, `components/FacultyDashboard.tsx` |
| [Student dashboard](student-dashboard.md) | `components/StudentDashboard.tsx` |
| [Dashboard account menu](dashboard-account-menu.md) | `components/DashboardAccountMenu.tsx` |
| [Role avatar](role-avatar.md) | `components/RoleAvatar.tsx` |
| [Student records](student-records.md) | `components/StudentsList.tsx`, `components/StudentDetails.tsx` |
| [Student profile](student-profile.md) | `components/StudentProfile.tsx` |
| [Student leaderboard](student-leaderboard.md) | `components/StudentLeaderboard.tsx` |
| [Class management](class-management.md) | `components/ClassManagement.tsx`, `components/AddClass.tsx` |
| [Class view](class-view.md) | `components/ClassView.tsx` |
| [Task and quiz management](task-quiz-management.md) | `components/TasksAndQuizzesManagement.tsx` |
| [Task creation](task-creation.md) | `components/AddDailyTask.tsx`, `components/AddTask.tsx` |
| [Quiz authoring](quiz-authoring.md) | `components/AddQuiz.tsx` |
| [Task editing](task-editing.md) | `components/EditTask.tsx` |
| [Quiz taking](quiz-taking.md) | `components/TakeQuiz.tsx` |
| [Task submissions](task-submissions.md) | `components/TaskSubmissionsPage.tsx` |
| [Grade management](grades-management.md) | `components/MarksManagement.tsx` |
| [Academic catalog](academic-catalog.md) | `components/AcademicCatalogManagement.tsx` |
| [Faculty settings](faculty-settings.md) | `components/Settings.tsx` |
| [Diagnostics panel](debug-panel.md) | `components/DebugPanel.tsx` |
| [Notifications dropdown](notifications-dropdown.md) | `components/NotificationsDropdown.tsx` |
| [Quest dialog](quest-dialog.md) | `components/QuestDialog.tsx` |
| [App providers](app-providers.md) | `components/Providers.tsx` |
| [Client services](client-services.md) | `components/services/api.ts`, `components/services/account.ts` |
| [Client auth configuration](client-config.md) | `components/utils/supabase/client.ts`, `components/utils/supabase/info.tsx` |
| [Static curriculum helper](curriculum-helper.md) | `components/utils/dentalClasses.ts` |
| [Image fallback](image-fallback.md) | `components/figma/ImageWithFallback.tsx` |
| [KPI components](kpi-components.md) | `components/ui/kpi-card.tsx`, `delta-badge.tsx`, `metric-value.tsx`, `sparkline.tsx` |
| [UI primitives catalogue](ui-primitives.md) | All 56 files under `components/ui/` |

## Coverage notes

- The app component/helper inventory excludes generated build artifacts and dependencies; there are no such files included in this count.
- Generic `components/ui/` wrappers are catalogued by name and path rather than given repetitive behavior references. `KpiCard` and its supporting metric primitives are detailed separately because Faculty task/quiz and grade screens use them for product-facing metrics.
- Source references are paths from the repository root. Route associations are based on the product design overview, route layouts, and component call sites; where a component has no in-repository caller, that is called out as an observed limitation rather than an assumed route.
- These pages do not claim server authorization or persistence behavior beyond the frontend requests shown; consult API/controller documentation and source for enforcement details.
