# Product design: Dental College Portal

## Purpose and how to read this document

This document describes the product visible in the current repository, for product, design, and engineering handoff. It is based on the routed pages, UI components, API route registry, authorization checks, and canonical database schema—not on an external product brief. It records existing behavior, not a proposed roadmap.

Labels used below:

- **Implemented** — behavior or data structure directly represented in the current application.
- **Inference** — a restrained interpretation of that evidence, not a stated product requirement.
- **Observed gap / open question** — behavior that is absent, incomplete, or unclear in the inspected product surface. These are not requirements.

Primary evidence: `app/page.tsx`, `components/PortalLanding.tsx`, `components/FacultyAuthPage.tsx`, `components/StudentApp.tsx`, `app/faculty/dashboard/layout.tsx`, `app/student/dashboard/layout.tsx`, `components/FacultyDashboard.tsx`, `components/StudentDashboard.tsx`, `lib/api/routeRegistry.ts`, `app/api/[...route]/route.ts`, `lib/api/middleware/authMiddleware.js`, and `new_schema.sql`.

## Product purpose and audience

**Implemented:** The product presents separate Faculty and Student portals. Its landing page describes faculty work as managing classes, student records, grades, and assignments, and student work as viewing grades, assigned work, notifications, and learning progress. The wider application adds quizzes, academic catalog management, student profiles, leaderboards, streaks, experience points (XP), levels, and daily quests.

**Inference:** This is a dental-college teaching and learning portal connecting faculty-managed class activity and assessment with student-facing academic progress. The dental-college context is supported by the product copy, dental subject/department examples, and academic data model.

### User types (only what the code supports)

| User type | Evidence-backed product need |
| --- | --- |
| Student / student applicant | Create or access a student account; view learning overview, tasks/quizzes, grades, profile, notifications, and leaderboard. Student signup collects academic identity (degree, graduation cohort, PRN) in addition to account details. |
| Faculty / teacher | Create a faculty account or sign in; manage classes and student records; create tasks and quizzes; review/record grades; view student/task activity; maintain a profile and settings. The UI says “Faculty”; API and stored role commonly use `teacher`. |
| Administrator | An account with role `admin` or `administrator` can manage the academic catalog and student academic identity. The current browser experience places that capability inside the faculty dashboard rather than a separate admin console. |

**Inference:** These roles suggest students, teaching staff, and academic administrators as the primary audiences. The source does not define age, institution size, purchasing decision-maker, or other demographic personas; none are assumed here.

## Product structure and key screens

### Entry and account access

| Route | Implemented screen / behavior |
| --- | --- |
| `/` | Portal selection cards linking to Faculty and Student sign-in. |
| `/faculty/login`, `/faculty/signup` | Faculty sign-in and account creation. Signup collects name, email, department, qualification, and password/confirmation. |
| `/student/login`, `/student/signup` | Student sign-in and signup. Signup collects name, username, email, PRN, degree, graduation cohort, and password/confirmation. Degree and cohort options are loaded from academic lookup endpoints; cohort options depend on the selected degree. |
| `/admin/login`, `/admin/signup` | Redirects to the matching faculty login/signup page. These are aliases, not separate admin authentication screens. |

Both sign-in flows use email and password and reject an account that belongs to the other portal, with a message directing the user to the correct portal. A signed-in session is checked against a profile API before showing a dashboard. Dashboard routes redirect unauthenticated users to the corresponding login page. Sign-out returns to `/`.

### Faculty workspace

The faculty dashboard uses a collapsible sidebar, a page-title header, and routed content. Its primary navigation is **Overview**, **Students**, **Classes**, **Tasks & quizzes**, and **Grades**. Account actions link to **Settings** and **Diagnostics**. Users whose role is `admin` or `administrator` also see **Academic catalog**.

| Screen / route family | Main implemented capability |
| --- | --- |
| `/faculty/dashboard` | Summary counts for students, classes, and tasks/quizzes; links into student records; onboarding copy says students sign up themselves and can then be assigned to classes. |
| `/faculty/dashboard/students` | Browse/filter registered students, refresh the list, open student details, and assign students to classes. |
| `/faculty/dashboard/student-details/:id` | View an individual student and perform class assignment; a student not resolved from the loaded lists produces a loading or not-found message. |
| `/faculty/dashboard/classes` | Search classes and filter by program year; open a class, add a class from a catalog subject, or delete a class. Deletion is blocked in the UI while enrolled students remain. |
| `/faculty/dashboard/class-view/:id` | Inspect a class, its students and activity, and enter task/quiz creation. |
| `/faculty/dashboard/add-task/:classId`, `/add-quiz/:classId` | Create work for a selected class. The daily task form requires a class, title, description, and due date; it selects priority and XP points. Quiz creation supports single-choice, multiple-choice, and short-answer questions, accepted answers, due date, duration, and total points. |
| `/faculty/dashboard/tasks-quizzes` | Search/filter task and quiz records by class and status, inspect statistics, create work, edit/delete it, or open task submissions/management. |
| `/faculty/dashboard/edit-task/:id`, `/task-submissions/:id` | Edit an item or manage/view its student task-grade/submission data. |
| `/faculty/dashboard/grades` (also `marks`) | Manage marks/grades for students and classes. |
| `/faculty/dashboard/catalog` | For administrator-role accounts, manage degrees, program years, subjects, cohorts, and student academic identity. |
| `/faculty/dashboard/settings`, `/debug` | Profile/preferences/account settings and diagnostics. |

The dashboard route is a catch-all that renders the same faculty workspace; the legacy `/admin/dashboard` path redirects to its faculty equivalent. `/faculty/dashboard/add-class` is explicitly not found; class creation is launched from Classes instead.

### Student workspace

The student workspace shares a dashboard shell with collapsible navigation for **Dashboard**, **Leaderboard**, **My Grades**, **Tasks & Quizzes**, and **Notifications**. The account menu provides **My profile**.

| Screen / route family | Main implemented capability |
| --- | --- |
| `/student/dashboard` | Learning summary: level and progress, XP, streak, task completion, an administration message when present, and up to four outstanding-work cards. |
| `/student/dashboard/tasks` | Separates ongoing from completed work, showing class/subject context, due dates, priority, points, and grade/submission status. A quiz can be started from here. |
| `/student/dashboard/grades` | Shows reviewed assignments/quizzes, average score and count, with refresh, loading skeleton, retryable error, empty state, and responsive table/list presentation. |
| `/student/dashboard/leaderboard` | Student leaderboard surface. The API supports cohort and class leaderboards; the component is `StudentLeaderboard`. |
| `/student/dashboard/profile` | Student profile, including editable contact/profile fields exposed by the profile component. |
| Quiz-taking overlay | Selecting a quiz opens `TakeQuiz` in place of the dashboard view; submitting posts the answers, shows success/failure feedback, closes the quiz on success, and reloads student data. |
| Notifications dialog | Loaded from the student notification API. Shows read/unread state, date, title and message; task and grade notifications navigate to their corresponding pages and are marked read. |

## Core user journeys and flows

### Student: account creation to learning activity

1. Choose Student on `/`, then open sign-up from the student login screen.
2. Enter account and academic identity details. The degree list is loaded first; selecting a degree loads its graduation cohorts.
3. Client validation checks required fields, password length (at least six characters), and matching password confirmation. The signup request creates a student account; on success the UI asks the user to sign in.
4. Sign in with email/password. A session is checked for student access and a student profile is loaded. Wrong-portal accounts are signed out and shown a portal-specific error.
5. On the dashboard, review learning metrics and upcoming tasks/quizzes. Navigate to tasks, grades, leaderboard, profile, or notifications using the sidebar/account menu.
6. Start an available quiz, answer it in `TakeQuiz`, and submit. Success closes the quiz and refreshes student data; failure produces an error toast.

### Faculty: create a class and assign work

1. Choose Faculty on `/`, sign in or use faculty signup (name, email, department, qualification, password).
2. After authentication and teacher-profile verification, land on the faculty overview. The app loads teacher data and registered students.
3. Open Classes and add a class based on a subject from the academic catalog; inspect its roster from the class detail screen.
4. Create a task or quiz from a class. The UI describes new tasks as automatically assigned to students enrolled in that class; quiz creation likewise reports the number assigned.
5. Use Tasks & quizzes to find and filter work, edit/delete it, or open its student-management/submission view. Use Grades to record or review marks.

### Faculty: student onboarding and class assignment

1. A student creates their own portal account.
2. Faculty opens Students and selects the student record.
3. Faculty assigns the student to a class. Class detail and student screens provide views back into the student/class context.

### Administrator: maintain academic structure

1. An account with `admin` or `administrator` role signs in through the faculty auth flow.
2. The faculty shell exposes Academic catalog only for those roles.
3. The catalog API supports listing/creating/updating degree and cohort state, creating program years and subjects, and assigning a student’s degree/cohort identity. The server independently checks administrator role for `/admin/*` endpoints.

## Interaction, state, and feedback behaviors

- **Navigation:** Dashboard sections are represented in the URL and updated with client-side routing. Selected student/class/task IDs are encoded into detail routes. Sidebar active states and page titles reflect the first route segment.
- **Authentication:** Dashboards show a loading screen while session/profile checks run. A student is not allowed through teacher routes and vice versa. Protected APIs require a bearer token; disabled accounts are rejected. Student-only APIs also require an active student record.
- **Data loading and failure:** Faculty data loads before the main workspace is rendered. Errors are generally surfaced through toasts, and some data failures fall back to empty arrays. Student grades have explicit loading, retryable failure, and no-grades states; student overview has an outstanding-work empty state.
- **Forms and mutations:** Forms validate required fields client-side and show toast feedback. Faculty task edit/delete and student quiz/profile mutations call APIs; task deletion also asks for confirmation. Some forms disable controls or show loading indicators while submitting.
- **Notifications:** The student shell loads notifications after obtaining a session token, displays an unread count, and marks a selected notification read after navigating (or dismissing the dialog for unsupported notification types).
- **Responsive/accessibility cues:** Dashboard sidebars collapse; student dashboard includes a mobile header. Navigation exposes active-page semantics, and key content includes labels/status roles, loading semantics, accessible button labels, and focus-visible styles.
- **Student progress:** XP/level/streak/task totals are displayed from server data when available; the student component also contains a fallback calculation from grades, tasks, and streak data. The schema separately tracks XP events and progression state.

## Roles, permissions, and product boundaries

| Capability | Student | Teacher / faculty | Administrator |
| --- | --- | --- | --- |
| Student profile, dashboard, quiz submission, notifications, leaderboard/game APIs | Yes, for an active student account | No; student-only routes are rejected | Not granted by admin role alone; active student status is required |
| Teacher profile/data, roster, classes, tasks, grades | No; server rejects student role | Yes for authenticated non-student accounts | Also passes the current teacher-route role gate unless account/profile state prevents it |
| Academic catalog administration (`/admin/*`) | No | No | Yes, role must be `admin` or `administrator` |
| Public academic lookups used by signup | Available without authentication | Available without authentication | Available without authentication |

**Important boundary:** The application has role-gated APIs, but the faculty UI is not a separately modeled administrator console. The source does not show a finer-grained faculty permission model for individual classes or department scope. Do not assume one from the UI labels alone.

Student lifecycle is separate from authentication role: the schema stores `active`/`inactive` state, and student/game API access checks for an active student. Class memberships have active/ended/withdrawn states; classes and academic catalog entries also have lifecycle/status fields.

## Product and data constraints relevant to design

- The product is explicitly branded for a dental-college setting; departments and subject examples use dental disciplines.
- Student account identity includes a unique email and optional PRN, plus a graduation cohort; a degree is derived through that cohort in the canonical data model. Username maps to an account, rather than being a duplicate student field.
- A degree contains program years and subjects. Program year, graduation cohort, calendar academic year, and the student’s gamification level are distinct concepts.
- A class belongs to a teacher and requires a subject from the catalog. A student can be associated with multiple classes; class membership records can be ended or withdrawn. Class capacity is present as data/UI, but enforcement is not established by the inspected screen.
- Tasks belong to a class. Task assignments track per-student completion and score. Grades require a student and class; a grade may optionally be linked to a task.
- Student records can be active or inactive. Current student access/leaderboard flows filter for active status; the product’s intended handling of historical/inactive students in history screens is not fully evident.
- Student signup currently has a six-character minimum password in client validation; faculty signup uses the same minimum. Settings password change uses an eight-character minimum.
- The app relies on a configured database/authentication backend and environment configuration; these are runtime dependencies, not a defined offline mode.

## Observable UX gaps and open questions

These are repository observations for follow-up, not requirements or claims about intended behavior.

1. **Regular task completion path is unclear.** Student task cards display regular tasks and label them “View task,” but that action returns to the task list; the visible task view has no submission/completion control. Quizzes have a dedicated attempt-and-submit flow. The schema can record task completion, but a non-quiz student submission path is not evident in the inspected UI.
2. **Student daily-quest dialog appears unwired.** The dashboard fetches a quest and defines a dialog and “mark seen” handler, but in the inspected component the dialog-open state is initialized false and no visible action sets it true; the handler itself contains no persistence. Verify whether this is intentionally dormant or incomplete before designing around it.
3. **Student profile navigation is not in the main student sidebar.** It is available through the account menu, while the other primary student views are in sidebar navigation.
4. **Administrator entry terminology may confuse users.** Public entry cards say Faculty and Student; `/admin/login` and `/admin/signup` redirect to faculty forms, and admin catalog controls appear conditionally inside the faculty dashboard. No distinct admin landing/dashboard is implemented.
5. **Faculty data-load recovery is uneven.** The workspace can show an error toast and replace failed datasets with empty arrays; unlike student grades, a consistent inline error/retry state for core faculty data is not visible. A failed load can therefore resemble a genuinely empty workspace.
6. **Task labels and states need product interpretation.** Student task cards use “submitted” when completed without a linked grade, while the visible regular-task workflow is unclear. Task status, overdue logic, assignment completion, and grades are represented in multiple data fields; their user-facing rules should be confirmed before expanding the experience.
7. **Notifications are only deeply linked for task and grade types.** Other types are displayed and marked read, but the notification click handler has no destination for them.
8. **Academic history behavior is open.** The schema retains active/inactive student state and academic identity-change history, while user-facing historical views are not established by the inspected routes. Whether inactive students and prior academic identities should remain browsable is unresolved.

## Repository references for follow-up

- Entry/auth and navigation: `components/PortalLanding.tsx`, `components/FacultyAuthPage.tsx`, `components/StudentApp.tsx`, `app/*/dashboard/layout.tsx`
- Faculty/student screen composition: `components/FacultyDashboard.tsx`, `components/StudentDashboard.tsx`
- Assessment and management: `components/ClassManagement.tsx`, `components/AddDailyTask.tsx`, `components/AddQuiz.tsx`, `components/TasksAndQuizzesManagement.tsx`, `components/MarksManagement.tsx`, `components/TaskSubmissionsPage.tsx`, `components/TakeQuiz.tsx`
- API and access control: `lib/api/routeRegistry.ts`, `app/api/[...route]/route.ts`, `lib/api/middleware/authMiddleware.js`
- Academic and product data model: `new_schema.sql`, `lib/api/controllers/adminController.js`, `docs/schema-discussion.md`
