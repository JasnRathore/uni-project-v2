# Student quiz taking

## Purpose and exports

`TakeQuiz` is the student quiz instructions, timed response and submission surface. Props: `quiz`, `onBack()`, `onSubmit(answers)`; named export.

## State and interactions

State tracks per-question answers, seconds remaining, submission-in-progress, and whether the quiz has started. Before starting, it presents title, instructions, duration, point total, question count and due date. Starting begins the timer. Single-choice selects an option, multiple-choice toggles indices, and short-answer accepts text. Answers can be changed until submit. When time reaches zero it warns and invokes submit after a short delay.

Scoring in the browser compares answers with `quiz.questions[].correctAnswer`; short text comparison lowercases and trims, multi-choice requires exact set equality. It packages answer counts, score, percentage, points and elapsed time for the callback.

## Route and API/backend dependency

Opened inline from `/student/dashboard` or `/student/dashboard/tasks`; it replaces dashboard content rather than changing the URL. The parent `StudentDashboard` POSTs the callback payload to `/api/student/quiz/submit` with bearer token, then closes and reloads on success.

## Loading/error/empty states

No separate quiz-load/empty state: it assumes valid quiz questions and duration. Submission disables the submit button; callback errors are handled by the parent, but this component immediately toasts local score/submission success without awaiting the callback, so this toast does not itself confirm server persistence. Timer auto-submit also calls the same handler.

## Responsive/accessibility behavior

Question cards and intro summary cards reflow on smaller widths; timer header stays sticky. Answers use buttons with `aria-pressed`; typed input has a question-index label; progress and unanswered counts appear as text. Timer color changes as time decreases, but there is no explicit live-region timer announcement or focus movement after start.

## Side effects and source references

Timer interval and auto-submit timeout are managed in component code; submission callback causes the network request in the parent. Sources: `components/TakeQuiz.tsx`, `components/StudentDashboard.tsx`, `docs/product-system/product-design.md`.
