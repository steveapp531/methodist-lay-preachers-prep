# Architecture

The design decisions behind the platform, and why each one was made.

---

## 1. Product architecture

The platform exists to close one loop:

```
        study the syllabus
                │
                ▼
        answer questions ──────▶ get it wrong
                │                     │
                │                     ▼
                │           see the correct answer, the reason,
                │           and the syllabus passage it came from
                │                     │
                │                     ▼
                │           the question returns tomorrow
                │                     │
                ▼                     │
        sit a timed paper ◀───────────┘
                │
                ▼
        find out what is still weak
```

Everything else serves that loop. Bookmarks, notes, flashcards and search exist so a candidate can
move around it faster; readiness and recommendations exist so they know where they are in it.

Three product rules follow from it and are enforced throughout:

1. **A wrong answer must teach.** The validator refuses to publish a question that carries neither
   an explanation nor a syllabus excerpt.
2. **Provenance is never blurred.** Official past-paper material and material written from the
   syllabus are labelled differently everywhere they appear.
3. **An answer nothing stands behind is not shown.** Questions whose answers could not be traced to
   the syllabus are held for review, not published with a plausible guess.

---

## 2. System architecture

```
┌──────────────────────────────┐
│  Browser                     │
│                              │
│  React 18 · Vite · Tailwind  │
│  React Router (client-side)  │
│  Access token in memory      │
└──────────────┬───────────────┘
               │ HTTPS · JSON · Bearer token
               │ httpOnly refresh cookie on /api/auth
               ▼
┌──────────────────────────────┐
│  API — Node · Express        │
│                              │
│  helmet · cors · compression │
│  rate limiting (3 budgets)   │
│  Zod validation per route    │
│  JWT auth · role guards      │
│                              │
│  controllers → services      │
└──────────────┬───────────────┘
               │ Mongoose
               ▼
┌──────────────────────────────┐        ┌────────────────────────────┐
│  MongoDB                     │        │  Anthropic API (optional)  │
│  19 collections              │        │  theory marking only       │
└──────────────────────────────┘        └────────────────────────────┘
                                             ▲
                                             │ server-side only;
                                             │ the key never reaches the browser
```

**Why a separate API rather than one Next.js application.** The examination clock has to be
authoritative. A candidate must not be able to gain time by pausing a tab, editing a system clock
or replaying a request, so the deadline is computed and stored server-side at the moment a sitting
starts, and every read re-checks it. Keeping the API a plain, separately deployable Express service
also means the question bank has a stable public interface that a future mobile client can use
unchanged.

**Why the layering is controller → service → model.** Controllers do request and response shaping
only. Everything that decides a mark, a score or what a candidate sees next lives in `services/`,
which is why 79 tests can cover that logic without touching a database or an HTTP server.

---

## 3. Database schema

19 Mongoose models. Content on the left, per-candidate records on the right.

```
Exam ──┬── Subject ──── Chapter ──── Topic ────┐
       │                                        │
       │                                        ├── Question ──┐
       │                                        │              │
       │                                   Flashcard           │
       │                                        │              │
       └── MockExam ────────────────────────────┘              │
                                                               │
   ── per candidate ───────────────────────────────────────────┤
                                                               │
   User ──┬── QuestionAttempt  (immutable log) ────────────────┤
          ├── QuestionState    (Leitner box, revision priority)│
          ├── StudyProgress    (per topic: status, mastery)    │
          ├── Quiz             (a practice session)            │
          ├── ExamAttempt      (a sitting)  ───── TheoryEvaluation
          ├── Bookmark · Note · FlashcardState
          └── Achievement

   ScriptureReference  (index of every passage the syllabus cites)
   AdminActivity       (audit trail)
```

### The decisions worth explaining

**The attempt log is immutable, and everything analytical derives from it.**
`QuestionAttempt` is written once and never updated. Accuracy, weak topics, mistake lists,
question difficulty, streaks and readiness are all computed from it. Nothing can drift out of step
with what actually happened, and a scoring change can be applied retrospectively.

`QuestionState` and `StudyProgress` are caches over that log, kept current on every attempt, so
the hot paths (which question next, what is my mastery) are a single indexed read.

**Topics store the syllabus verbatim, in anchored blocks.**

```js
blocks: [{ anchor: 535, text: "…", kind: "paragraph" }]
```

`anchor` is the paragraph index in the source document. It is what makes citation exact rather than
approximate: a question's `manualReference.anchor` points at the specific paragraph, the topic page
renders each block with `id="block-{anchor}"`, and the excerpt stored on the question is checked to
appear verbatim in that block. The syllabus text is never paraphrased on the way in.

**Every question carries its own provenance and confidence.**

```js
sourceKind:        'past_paper' | 'manual_derived' | 'demo'
answerConfidence:  'verified'   | 'provisional'    | 'unverified'
status:            'draft' | 'needs_review' | 'published' | 'archived'
```

These are separate fields on purpose. Where a question came from, how well its answer is supported,
and whether it is visible are three different questions, and conflating them is how a guessed
answer ends up in front of a candidate.

**A question belongs to the bank, not to a test.** Nothing owns a question. Quizzes and mock
examinations reference them, so the same question can appear in a topic quiz, a revision set and a
mock paper without duplication, and its observed difficulty accumulates across all of them.

**Mock examinations are blueprints, not fixed papers.** A `dynamic` mock samples its questions when
a sitting starts, so the same paper can be retaken without seeing the same questions. A `fixed`
mock names its questions explicitly, for reproducing a real past paper exactly as it was sat.

**Deletion is refused where it would orphan history.** Deleting a question that has attempts
archives it instead; the API says so in its response rather than silently doing something else.

---

## 4. API architecture

REST, one envelope, everywhere:

```jsonc
{ "success": true,  "data": { … }, "meta": { "page": 1, "limit": 20, "total": 96, "pages": 5 } }
{ "success": false, "error": { "code": "UNPROCESSABLE", "message": "…", "details": [ … ] } }
```

`details` is an array of `{ field, message }`, which is what lets the admin editor map a server
rejection onto the exact input that caused it.

### Surface

```
POST   /api/auth/register  login  refresh  logout  forgot-password  reset-password
GET    /api/auth/me                PATCH /api/auth/me
POST   /api/auth/change-password   logout-everywhere

GET    /api/exams  /api/exams/:id                     (public)
GET    /api/subjects  /api/subjects/:id  /api/topics/:id
PATCH  /api/topics/:id/progress
GET    /api/questions  /api/questions/:id
GET    /api/scriptures  /api/scriptures/:reference
GET    /api/search

POST   /api/quizzes            GET /api/quizzes  /api/quizzes/:id
POST   /api/quizzes/:id/complete
POST   /api/questions/:id/attempt
GET    /api/mistakes

GET    /api/mock-exams         POST /api/mock-exams          (starts a sitting)
GET    /api/exam-attempts  /api/exam-attempts/:id
PATCH  /api/exam-attempts/:id                                (autosave)
POST   /api/exam-attempts/:id/submit
GET    /api/exam-attempts/:id/review

GET    /api/dashboard  /api/progress
GET    /api/bookmarks  /api/notes  /api/flashcards           + writes
POST   /api/questions/:id/bookmark                           (toggle)
POST   /api/flashcards/:id/review

/api/admin/*   — every route behind requireAuth + requireAdmin
```

**Two shapes for a question, and the difference is load-bearing.** `toCandidateJSON()` strips
`correctOptionKeys`, `acceptedAnswers`, option `isCorrect` flags, rationales, `idealAnswer` and the
marking rubric. `toReviewJSON()` includes all of it. During a sitting the candidate shape is served;
the review shape is only ever returned after an answer has been submitted. The answer key cannot
leak through the network tab.

**Three rate-limit budgets.** A general API budget, a tighter one on authentication endpoints that
only counts failures, and a separate per-minute budget on the two routes that can reach the AI
grader.

---

## 5. Authentication architecture

```
  register / login
        │
        ├──▶ access token   JWT, 30 min, Authorization header, held in memory
        └──▶ refresh token  JWT, 30 days, httpOnly cookie scoped to /api/auth
                                    │
     any 401 ──▶ POST /api/auth/refresh ──▶ new access token ──▶ replay the request
                                    │
                              still 401 ──▶ session ends, redirect to sign in
```

**The access token is never persisted.** Not in `localStorage`, not in `sessionStorage`. A
cross-site scripting bug therefore cannot walk off with a usable credential. Continuity across
reloads comes from the refresh cookie, which script cannot read at all.

**One refresh at a time.** The client shares a single in-flight refresh promise, so ten concurrent
requests that all hit a 401 produce one refresh, not ten.

**Revocation.** The refresh token carries a `version` claim compared against the user's
`tokenVersion`. Changing a password or signing out everywhere increments it, invalidating every
outstanding refresh token immediately.

**Password reset without leaking who has an account.** `forgot-password` returns the same response
whether or not the address exists. Only the SHA-256 hash of the reset token is stored, with a one
hour expiry. No mail transport is configured; in development the link is logged and returned so the
flow can be exercised end to end.

**Roles.** `requireRole` is a separate guard from `requireAuth`, so an unauthenticated request gets
401 and an under-privileged one gets 403 — a distinction the client needs to decide between
redirecting to sign-in and showing "you do not have access".

---

## 6. Quiz and scoring architecture

### Objective marking

`gradeObjective(question, response)` is a pure function returning the same shape for every type:

```js
{ isCorrect, score /* 0..1 */, marksAwarded, marksAvailable, detail }
```

| Type | Rule |
| --- | --- |
| Multiple choice, true/false | Exact match on the option key, case-insensitive |
| Multiple response | `max(0, hits − misses) / correctCount` — partial credit, but selecting everything scores zero |
| Fill in the blank | Case, punctuation and leading articles ignored; Levenshtein tolerance of 1–2 by length, so a typing slip does not cost the mark |
| Matching | Fraction of pairs correct |

Because every type returns the same shape, no caller — quiz, mock examination, or single-question
practice — branches on question type.

### Session selection

`selectQuestions()` narrows one published pool by mode:

| Mode | Draws from |
| --- | --- |
| `practice` | The pool, sampled at random |
| `topic_quiz` | One topic |
| `mistakes` | Questions with `incorrect > 0`, highest revision priority first |
| `weak_areas` | The five topics with the lowest mastery |
| `bookmarks` | Bookmarked questions |
| `unseen` | Questions with no `QuestionState` |
| `daily_revision` | 40% previously wrong · 30% weak areas · 20% falling due · 10% new |

Every history-driven mode tops up from the general pool when history is thin, so a new candidate
never opens an empty quiz — and the response says when that happened.

### Spaced revision

A Leitner scheme over intervals `[0, 1, 3, 7, 16, 35]` days. A correct answer promotes one box; a
wrong answer drops to box 0 and the question returns tomorrow. Partial credit on a theory answer
counts as "not yet" — a half-remembered answer is still worth revisiting.

`revisionPriority` blends error rate, how overdue the question is, and a recency penalty so
something answered minutes ago cannot immediately reappear. Mastered questions are damped down
rather than removed.

### Readiness

Four measured components, weighted by the examination's own configuration rather than by constants
in the code:

| Component | Default weight | Measured from |
| --- | --- | --- |
| Objective accuracy | 40% | The last 200 attempts |
| Syllabus coverage | 25% | Mastery summed across all topics |
| Mock performance | 25% | The last five sittings |
| Consistency | 10% | Days studied in the last fourteen |

Then an **evidence cap**: `min(1, 0.25 + attempts / 150)`. Twelve correct answers cannot make
someone look exam-ready, and when the cap binds the dashboard says so. Readiness that flatters is
worse than useless before an examination.

---

## 7. Theory evaluation architecture

```
  answer submitted
        │
        ├── AI configured? ──no──┐
        │        │yes            │
        │        ▼               │
        │   AI adapter           │
        │   · question, ideal answer, rubric, syllabus excerpt only
        │   · must quote the candidate for every criterion it credits
        │   · marks recomputed server-side against the rubric
        │        │               │
        │   inconclusive? ──yes──┤
        │        │no             │
        ▼        ▼               ▼
    use AI result          rubric engine
                                 │
                                 ▼
                        TheoryEvaluation
   { marksAwarded, criteria[], covered[], partial[], missing[],
     feedback, engine, confidence }
```

**The rubric engine is the floor, not the fallback of last resort.** Each criterion carries
keywords and groups of synonyms. A criterion is `covered` when at least 60% of its distinct idea
groups appear, `partial` at 25%, `missing` below. It marks the idea rather than the vocabulary: a
rubric listing `["prosperity", "affluence", "wealth"]` scores all three the same.

A length allowance — six words per mark, well below what anyone actually writes — stops a one-line
answer containing every keyword from scoring like a full essay, and tells the candidate that is
what happened.

**The AI adapter is bounded, not trusted.** It is given only the question, the ideal answer, the
rubric and the syllabus excerpt. It is instructed that it may not introduce doctrine, may not mark
against anything but the supplied rubric, and must return `inconclusive` rather than guess. Then,
server-side: unknown criterion ids are discarded, marks are recomputed from the rubric rather than
taken from the model, and **any criterion whose quoted evidence does not actually appear in the
candidate's answer is downgraded to `missing`**. A model cannot award marks for something the
candidate did not write.

If the result is inconclusive the rubric mark is used and the substitution is recorded on the
evaluation.

---

## 8. Content ingestion architecture

```
  syllabus .docx
        │
        │  scripts/ingest/parse_syllabus.py   (deterministic, verbatim)
        ▼
  data/part2/manual.json          subjects → chapters → topics → anchored blocks
        │
        │  backend/src/seed/loadManual.js     (idempotent upsert by slug)
        ▼
  Exam · Subject · Chapter · Topic · ScriptureReference


  past paper .pdf
        │
        │  scripts/ingest/ocr_pdf.py          (scans only)
        │  scripts/ingest/split_papers.py     (column-aware, gutter detection)
        ▼
  data/part2/pastpapers/*.txt
        │
        │  transcription against the syllabus
        ▼
  data/part2/gen/questions.*.json
        │
        │  scripts/merge-content.mjs          (refuses duplicate ids)
        ▼
  data/part2/questions.manual.json
        │
        │  backend/src/services/importService.js
        ▼
  Question
```

**Content is referenced by title, never by id.** An import row names its subject by code and its
chapter and topic by title. A question can therefore be written in a spreadsheet by someone who has
never seen the database, and the same file re-imports cleanly after a reseed.

**Rows fail individually.** One malformed row reports its own line number and reason; the other 499
still import. A 500-question import does not fail because of a typo on line 212.

**Validation is about what reaches a candidate.** A published question must have an explanation or
a syllabus excerpt. An objective question must have an answer key, and the key must refer to
options that exist. A theory question must have something to mark against. A past-paper question
imported with no key is kept but forced to `unverified` / `needs_review` — the one case where
missing data is expected rather than an error.

**Re-import is safe.** Everything upserts on a stable key (`questionId`, `cardId`, slugs), so
correcting the source and reseeding updates content in place without disturbing anybody's progress,
which references topics and questions by id.

---

## 9. Frontend architecture

```
main.jsx
  └── BrowserRouter → ToastProvider → AuthProvider → App
                                                      │
                          ┌───────────────────────────┼──────────────────┐
                          ▼                           ▼                  ▼
                    AuthLayout                  AppLayout          ExamLayout
                    sign in, register       sidebar, search      nothing at all
                                            34 study screens     one sitting
```

**Three shells, because the three contexts are genuinely different.** The study area has
navigation and search. A sitting has neither — no route out of a timed paper by accident, and
nothing on screen but the question.

**Every page is code-split** via `React.lazy`, so the initial load carries the shell and the route
you asked for. `recharts` is in its own chunk; screens without charts never download it.

**One design system, in `components/ui/index.jsx`.** Every button, badge, card, modal, tab, empty
state and skeleton in the application comes from there. Icons are inline SVG paths from a single
map rather than an icon dependency.

**Data loading is `useAsync`**, which aborts the in-flight request when dependencies change or the
component unmounts, so a slow response can never overwrite newer data. Every screen handles
loading, error, empty and loaded — the skeletons mirror the real layout rather than showing a
spinner.

**The examination clock is derived from an absolute deadline**, re-read on every tick and re-synced
when the tab becomes visible, so a backgrounded tab or a sleeping laptop cannot buy extra time.
Answers batch and autosave every 15 seconds and on every question change; a failed save returns
the answers to the dirty queue rather than dropping them.

**Accessibility is structural, not a pass at the end.** Correctness is always shown by an icon as
well as a colour. Modals trap focus and restore it on close. Tabs respond to arrow keys. Every
input has a real label and errors are tied to it. Charts state their figures in prose and expose
the series as a screen-reader list, so no number is conveyed by the picture alone.

---

## 10. Deployment architecture

```
  GitHub
    ├──▶ Vercel / Netlify ── frontend/dist ── static, CDN
    │         VITE_API_URL ─────────────┐
    │                                    ▼
    └──▶ Render ────────────── backend ── Express
                                    │  CORS_ORIGINS, TRUST_PROXY
                                    ▼
                              MongoDB Atlas
```

Three settings account for almost every failed deployment, so they are called out in
[DEPLOYMENT.md](DEPLOYMENT.md): `CORS_ORIGINS` must list the web address exactly; the refresh
cookie is `SameSite=None; Secure` in production, so both ends must be HTTPS; and `TRUST_PROXY` must
be on behind Render's proxy or rate limiting sees one client address for everybody.

---

## 11. Extending the platform

**Another examination.** Insert an `Exam` document, attach `Subject`s to it, import its questions.
The stage picker, dashboards, quizzes, mock examinations and analytics are all scoped by `exam` and
need no change. Part 1 already exists as a stage awaiting content.

**Another question type.** Add it to `QUESTION_TYPES`, add a branch to `gradeObjective`, add a
renderer branch in `QuestionRenderer`. Nothing else looks at the type.

**Another AI provider.** Add an adapter beside `aiGrader.js` returning the same normalised shape.
The selection logic in `theory/index.js` is the only place that needs to know.

**Study groups, leaderboards, certificates, announcements.** All read from `QuestionAttempt` and
`StudyProgress`, which are already indexed by user, exam, subject and topic.
