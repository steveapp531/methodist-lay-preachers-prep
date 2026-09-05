# Lay Preachers' Examination Preparation

A study and examination-preparation platform for the **Methodist Church Ghana Connexional Lay
Preachers' Examination**, built around one principle:

> Don't just tell the candidate whether they are right or wrong. Teach them why.

Every question in the bank carries the passage of the official syllabus its answer comes from, so
getting something wrong sends you back to the exact paragraph rather than simply costing you a
mark.

Part 2 is loaded and complete. The architecture is not built around one examination: adding Part 1,
another Methodist Church Ghana examination, or an entirely different training programme means
adding content, not changing code.

---

## Contents

- [What it does](#what-it-does)
- [What is in the question bank](#what-is-in-the-question-bank)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Seeding and content](#seeding-and-content)
- [Creating an administrator](#creating-an-administrator)
- [Adding your own questions](#adding-your-own-questions)
- [Theory marking](#theory-marking)
- [Voice answers](#voice-answers)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Honesty about the content](#honesty-about-the-content)

---

## What it does

**Study.** The official syllabus, verbatim, organised into papers, chapters and topics with key
points, key terms, scripture references and reading-time estimates. Mark a topic Not started, In
progress, Completed or Needs revision; time spent reading is banked against it.

**Practise.** Quizzes you can aim at a paper, a chapter, a topic or a difficulty — or at your own
history: questions you got wrong, questions from your weak areas, questions you have bookmarked,
questions you have never seen. Every answer is followed immediately by the correct answer, the
reason, the syllabus reference and any scripture.

**Revise.** A Leitner spaced-repetition scheme decides when a question comes back. Answer it right
and it recedes; answer it wrong and it returns tomorrow. Daily Revision mixes previously missed
questions, weak areas, questions falling due, and a few new ones.

**Sit mock examinations.** Timed papers in the real format — Section A objective and compulsory,
Section B offering five theory questions of which three are answered. The clock runs on the
server, so closing the tab does not pause it, and the paper submits itself when time runs out.
Answers save as you go.

**Answer theory questions** by typing or by dictating them, and get them marked against the
examiner's rubric criterion by criterion: what you covered, what you touched on, what you missed,
and what a full-mark answer contains.

**Track where you stand.** A readiness score built from four measured components, an honest
evidence cap so a handful of correct answers cannot make you look ready, weak and strong topics,
accuracy trends, streaks, and recommendations that name the next thing to do and give you the
button that starts it.

**Administer.** A content management system for questions, papers, topics, mock examinations and
theory rubrics; bulk import with dry-run validation; user management; and analytics covering
engagement, the hardest questions and the topics candidates struggle with most.

---

## What is in the question bank

**1,392 questions and 360 flashcards.** Two kinds, always labelled as such in the interface.

### Written from the syllabus

| Paper | Objective | Theory | Flashcards |
| --- | --- | --- | --- |
| Old Testament Studies | 88 | 13 | 59 |
| New Testament Studies | 99 | 14 | 65 |
| Christian Doctrine | 90 | 13 | 59 |
| Liturgics | 90 | 14 | 60 |
| Methodist Studies | 88 | 14 | 58 |
| Church and Society | 80 | 14 | 59 |
| **Total** | **535** | **82** | **360** |

Each carries a verbatim excerpt of the sentence that settles it, checked programmatically against
the source text.

### Transcribed from real past papers

| Paper | 2011 | 2012 | 2013 | 2014 | 2022 | 2023 | 2024 | 2025 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Christian Doctrine | 29 | 29 | 29 | 34 | 33 | 31 | 27 | 27 | **239** |
| Church and Society | · | · | 30 | 31 | 32 | 32 | 32 | 31 | **188** |
| New Testament Studies | · | · | · | · | · | 29 | 34 | 43 | **106** |
| Old Testament Studies | · | · | · | · | · | 34 | 29 | 36 | **99** |
| Liturgics | · | · | · | · | · | 31 | 31 | 31 | **93** |
| Methodist Studies | · | · | · | · | · | · | · | 50 | **50** |

**775 past-paper questions**, every paper including its September 2025 sitting, and 118 of them
Section B theory questions with full marking schemes.

665 have answers traced to a syllabus passage. The other **110 are held at `needs_review` with no
answer key at all**, because the syllabus did not settle them — each records why in `reviewNotes`.
They never appear in a quiz until a person confirms them. That count is high in New Testament by
design: the syllabus covers only Mark, Acts, Galatians and the two letters to Timothy, and only
through its own commentary, so a question about anything else is out of scope for this edition
however well known the biblical fact.

Earlier years for the four papers marked `·` are extracted and ready under
`data/part2/pastpapers/`. [docs/PAST_PAPER_TRANSCRIPTION.md](docs/PAST_PAPER_TRANSCRIPTION.md) is
the brief that governs that work.

### The syllabus itself

Loaded in full and verbatim: **6 papers, 48 chapters, 317 topics, about 127,000 words, and 1,010
distinct scripture references** indexed to the places that cite them.

### Scripture

**977 passages carry their actual text**, in the Authorised (King James) Version — free of
copyright, and the version the syllabus itself quotes. Each is stored verse by verse, so the
scripture pages show numbered verses rather than a wall of prose, and the passage appears wherever
a question cites it.

Six references carry no text because the syllabus mis-cites them — it asks for Malachi 5, and
Malachi has four chapters. Those say so plainly rather than being quietly dropped.

Only the passages the syllabus cites are bundled, so there is no whole-Bible payload and no
runtime dependency. To regenerate after adding content:

```bash
npm install kjv --no-save
node scripts/build-scripture-texts.mjs
```

---

## Quick start

You need **Node.js 18.17 or newer**. You do not need to install MongoDB.

```bash
git clone <your-repository-url>
cd methodist-lay-preachers-prep

cp .env.example .env          # the defaults work as they are for local use

npm install                   # installs the API and the web client together
npm run seed                  # loads the syllabus, questions and mock exams
npm run dev                   # starts both servers
```

Then open **http://localhost:5173**.

| | |
| --- | --- |
| Web client | http://localhost:5173 |
| API | http://localhost:5000 |
| API health check | http://localhost:5000/api/health |

`npm run dev` runs the API and the web client together through `concurrently`, with output
labelled `api` and `web`.

Register an account, choose **Lay Preachers' Examination Part 2**, set your examination date, and
you are studying.

To get into the administration area, create an administrator:

```bash
npm run create:admin
```

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐        ┌──────────────┐
│  Web client             │  REST   │  API                     │        │  MongoDB     │
│  React 18 · Vite        │────────▶│  Node · Express          │───────▶│  Mongoose    │
│  React Router · Tailwind│  JSON   │  JWT + refresh cookie    │        │              │
└─────────────────────────┘         └──────────────────────────┘        └──────────────┘
                                              │
                                              │ optional, server-side only
                                              ▼
                                    ┌──────────────────────────┐
                                    │  AI marking adapter      │
                                    │  (falls back to rubric)  │
                                    └──────────────────────────┘
```

**Content model.** `Exam → Subject → Chapter → Topic`, with `Question` attached at whichever level
fits and every question carrying a `manualReference` back to a syllabus paragraph. Nothing is
hard-coded to Part 2; the six papers are rows, not branches in the code.

**Marking.** Objective marking is one pure function (`scoringService`) returning the same shape for
every question type, so no caller branches on type. Theory marking is a deterministic rubric
engine with an optional AI adapter layered on top.

**Progress.** Every answer writes an immutable `QuestionAttempt`. Everything analytical is derived
from that log, so no statistic can drift out of step with what actually happened. Two derived
records sit alongside it: `QuestionState` (per-question Leitner box and revision priority) and
`StudyProgress` (per-topic status and mastery).

**Authentication.** A short-lived access token in the `Authorization` header plus a long-lived
refresh token in an httpOnly cookie that script cannot read. The refresh token carries a version
claim; incrementing the user's `tokenVersion` signs them out everywhere at once.

For the full picture — database schema, API surface, scoring and readiness formulas, the theory
marking pipeline and the content ingestion route — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Project structure

```
methodist-lay-preachers-prep/
├── backend/
│   ├── src/
│   │   ├── config/           env, database connection, logger
│   │   ├── controllers/      request handling, one file per area
│   │   ├── middleware/       auth, validation, rate limiting, errors
│   │   ├── models/           19 Mongoose schemas
│   │   ├── routes/           REST routing
│   │   ├── services/         the actual logic (see below)
│   │   ├── seed/             seeding, manual loading, import, admin creation
│   │   ├── utils/            errors, HTTP helpers, text and date helpers
│   │   └── validators/       Zod schemas for every request body
│   └── tests/                79 tests over the logic that decides marks
├── frontend/
│   └── src/
│       ├── components/       ui/ design system · quiz/ · dashboard/
│       ├── context/          authentication, toasts
│       ├── hooks/            async, countdown, speech recognition, storage
│       ├── layouts/          application shell, auth shell, examination shell
│       ├── pages/            34 screens, including admin/
│       ├── services/         the API client
│       └── utils/            formatting
├── shared/constants.js       vocabulary shared by both sides
├── data/part2/
│   ├── manual.json             the syllabus, parsed and verbatim
│   ├── questions.manual.json   1,392 questions
│   ├── flashcards.json         360 flashcards
│   ├── scripture-texts.json    977 passages, Authorised Version
│   ├── gen/                    per-paper source files
│   └── pastpapers/             extracted past-paper text, 2009-2025
├── scripts/
│   ├── ingest/                 syllabus and past-paper extraction (Python)
│   ├── content-generators/     the generators that produced data/part2/gen
│   ├── merge-content.mjs       merges gen/ into the seed files
│   ├── verify-content.mjs      checks every citation against the syllabus
│   ├── shuffle-options.mjs     spreads correct answers across the options
│   ├── repair-excerpts.mjs     re-anchors citations that are not byte-exact
│   └── build-scripture-texts.mjs  resolves references to verse text
└── docs/
```

The services are where the thinking lives:

| File | What it decides |
| --- | --- |
| `scoringService.js` | How every objective question type is marked |
| `theory/rubricEngine.js` | Criterion-by-criterion marking with no AI |
| `theory/aiGrader.js` | The optional AI adapter, and its guard rails |
| `spacedRepetition.js` | When a question comes back |
| `progressService.js` | Topic mastery, streaks, study time |
| `adaptiveService.js` | Readiness, recommendations, adaptive difficulty |
| `quizService.js` | Which questions a session gets |
| `mockExamService.js` | Sitting lifecycle, "answer three of five", marking |
| `importService.js` | Validating content before it can reach a candidate |

---

## Environment variables

Everything is documented inline in [`.env.example`](.env.example). The ones that matter:

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | in production | Empty locally starts an embedded MongoDB |
| `JWT_ACCESS_SECRET` | in production | ≥ 16 characters; the server refuses to start without it |
| `JWT_REFRESH_SECRET` | in production | Must differ from the access secret |
| `CORS_ORIGINS` | in production | Comma-separated; must list your deployed web address exactly |
| `TRUST_PROXY` | behind a proxy | So rate limiting sees the real client address |
| `AI_PROVIDER` | no | `none` (default) or `anthropic` |
| `ANTHROPIC_API_KEY` | only with AI | Server-side only, never exposed to the browser |
| `VITE_API_URL` | in production | Your deployed API including `/api` |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Database setup

**Option 1 — nothing to install (default).** Leave `MONGODB_URI` empty. On first run the server
downloads and starts an embedded MongoDB, keeping its data in `.data/mongodb`, so your progress
survives restarts. Best for studying on your own machine.

**Option 2 — a local MongoDB.** Install MongoDB Community Edition, then set:

```
MONGODB_URI=mongodb://127.0.0.1:27017/mlpp
```

**Option 3 — MongoDB Atlas.** Create a free M0 cluster, add a database user, allow your IP (or
`0.0.0.0/0` for a hosted API), and set the connection string:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/mlpp?retryWrites=true&w=majority
```

Required in production. The embedded database is refused there deliberately.

---

## Seeding and content

```bash
npm run seed            # load everything; safe to run repeatedly
npm run seed:reset      # clear content first (never touches users or progress)
```

Seeding creates both examination stages, loads the syllabus into papers, chapters and topics,
builds the scripture index, imports the questions and flashcards, and builds one mock examination
per paper sized to the questions actually available.

Content lives in `data/part2/` as plain JSON so it can be edited, reviewed in a pull request, and
re-imported. After changing anything in `data/part2/gen/`:

```bash
node scripts/merge-content.mjs   # refuses to write on a duplicate id
npm run seed
```

To re-derive the syllabus from the source document (you supply the file):

```bash
python3 scripts/ingest/parse_syllabus.py path/to/syllabus.docx data/part2/manual.json
```

---

## Creating an administrator

```bash
npm run create:admin
```

It prompts for a name, email and password so nothing ends up in your shell history. It will also
promote and reset the password of an existing account, after confirming.

Alternatively set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before `npm run seed`.

---

## Adding your own questions

Three routes, all reaching the same validator.

**1. The admin editor.** Administration → Questions → New question. Adapts to the question type,
prefills the syllabus reference from the topic you choose, and shows a live preview of what a
candidate sees before and after answering.

**2. Bulk import in the interface.** Administration → Import. Paste a JSON array, press
**Validate** to dry-run it, read the per-row errors, then import.

**3. The command line.**

```bash
npm run import:content -- ./my-questions.json --dry-run
npm run import:content -- ./my-questions.json --publish
```

JSON and CSV are both accepted. In CSV, separate list values with `|` and use dotted headers
(`source.year`) for nested fields.

A minimal record:

```json
{
  "questionId": "DOC-O-1001",
  "examStage": "PART2",
  "subject": "DOC",
  "chapter": "THE DOCTRINE OF THE TRINITY",
  "topic": "1.2 Some Heresies (False Views about the Trinity)",
  "questionType": "multiple_choice",
  "question": "Which view holds that Father, Son and Spirit are three modes of one person?",
  "options": [
    { "key": "A", "text": "Modalism", "isCorrect": true },
    { "key": "B", "text": "Tri-theism", "isCorrect": false },
    { "key": "C", "text": "Arianism", "isCorrect": false },
    { "key": "D", "text": "Docetism", "isCorrect": false }
  ],
  "explanation": "Why this is the answer, in the syllabus's own terms.",
  "manualReference": { "excerpt": "The verbatim sentence that settles it." },
  "difficulty": "medium",
  "sourceKind": "manual_derived",
  "answerConfidence": "verified",
  "status": "published"
}
```

Subjects, chapters and topics are matched **by title**, so you never need a database id.

The validator refuses to publish a question that cannot teach anything: a published question must
carry an explanation or a syllabus excerpt, and an objective question must have an answer key.
A past-paper question imported without a key is kept, flagged `unverified` and held at
`needs_review` — never quietly published.

Theory questions additionally take `idealAnswer`, `keyPoints`, `marks` and `markingRubric`. See
[docs/CONTENT_AUTHORING_BRIEF.md](docs/CONTENT_AUTHORING_BRIEF.md) for the full field reference
and the standard the existing bank was written to.

---

## Theory marking

Two engines, in order of preference.

**The rubric engine** always runs. Each rubric criterion carries keywords and groups of synonyms;
a criterion is covered when enough of its distinct ideas appear in the answer, half-covered when
some do. It rewards the idea, not the vocabulary — a candidate who writes "affluence" scores the
same as one who writes "prosperity" — and a length allowance stops a one-line answer stuffed with
keywords from scoring like a full essay. No API key, no network, deterministic.

**The AI adapter** runs first when `AI_PROVIDER=anthropic` and a key is set. It is given only the
question, the ideal answer, the rubric and the syllabus excerpt, and asked one thing: does the
answer cover each criterion? It may not introduce doctrine, may not mark against anything but the
supplied rubric, and must quote the candidate's own words as evidence — a criterion with no
quotable evidence scores zero. Its arithmetic is recomputed server-side, and if it returns
anything inconclusive the rubric result is used instead and the fact is recorded.

The candidate is never shown a mark that nothing stands behind.

---

## Voice answers

Theory answers can be dictated using the browser's own speech recognition. Nothing is sent
anywhere by the platform: the browser transcribes, the transcript is shown for editing, and only
what the candidate accepts becomes the answer.

It works in Chrome and Edge, and in Safari on recent versions. Where it is unavailable — Firefox,
most in-app browsers — the recording controls simply do not appear and typing is the whole
interface. Microphone refusal, silence and network failures each get a message the candidate can
act on.

---

## Testing

```bash
npm test
```

79 tests over the parts where a mistake would quietly cost a candidate marks: objective marking of
every question type including partial credit and typo tolerance, rubric marking and its length
allowance, spaced-repetition priority, adaptive difficulty, streaks across month and year
boundaries, readiness bands, token signing and expiry, role guards, and request validation.

They need no database.

---

## Deployment

The intended shape is Vercel or Netlify for the web client, Render for the API, MongoDB Atlas for
the database. Full step-by-step instructions, including the CORS and cookie settings that catch
people out, are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The short version:

**API on Render** — root directory `backend`, build `npm install`, start `npm start`. Set
`NODE_ENV=production`, `MONGODB_URI`, both JWT secrets, `CORS_ORIGINS` (your web address), and
`TRUST_PROXY=true`.

**Web client on Vercel** — build `npm run build`, output `frontend/dist`. Set
`VITE_API_URL=https://your-api.onrender.com/api`. Add a rewrite so client-side routing works.

Then seed once against Atlas and create your administrator.

---

## Troubleshooting

**`npm run dev` fails on the database.** If you left `MONGODB_URI` empty, the embedded MongoDB is
downloading on first run and needs internet access. Behind a restrictive network that download can
fail; install MongoDB locally or use Atlas and set `MONGODB_URI` instead. The error message says
which.

**"There are no published questions matching that selection."** The filter is narrower than the
bank. Widen it, or check Administration → Questions that the questions you expect are `published`.

**A mock examination will not start.** It needs enough published questions to fill each section.
The error names the section and the shortfall. Publish more questions or reduce the section size
in Administration → Mock Exams.

**Signed out immediately after signing in.** In production this is almost always CORS or cookies:
`CORS_ORIGINS` must list your web address exactly, the API must be served over HTTPS, and
`VITE_API_URL` must point at the API including `/api`.

**Voice input does nothing.** Speech recognition is unavailable in that browser. Type instead; the
platform never requires it.

**Theory marks look harsh.** With no AI key the rubric engine is judging keyword and synonym
coverage. Improve the rubric's `synonyms` for the criteria being missed, or configure AI marking.

**The seed reports rows skipped.** It prints the line number and the reason. The usual causes are a
subject or topic title that does not match the syllabus exactly, or a published question with no
explanation and no excerpt.

---

## Honesty about the content

The platform distinguishes three kinds of content and labels every question with which it is:

- **Official past paper** — transcribed from a real examination paper.
- **From the official syllabus** — written from the syllabus, carrying the verbatim sentence that
  settles it.
- **Demo content** — illustrative only, never presented as official.

It also records how well each answer is supported: `verified` when the answer is traced to a
syllabus passage, `provisional` when the passage supports it but a small inference is needed, and
`unverified` when no supporting passage was found. Unverified questions are held at `needs_review`
and do not reach candidates until a person confirms them, and the administrator dashboard surfaces
the count.

Everything currently in the bank was written from the official 2026 syllabus and its excerpt was
checked programmatically against the source text. Two caveats worth knowing: the source document
carries some scanning damage, so a few excerpts reproduce an OCR artefact verbatim rather than
silently correcting the syllabus; and where the syllabus states a list across several paragraphs,
a single excerpt anchors the list rather than proving every item.

**This is a study aid, not an authority.** Check anything that matters against your printed
syllabus before the examination.

---

## Licence and attribution

The syllabus content reproduced here is the property of **The Methodist Church Ghana, Lay
Ministries Directorate**, and is included for the personal study of candidates. It is not licensed
for redistribution. The source documents are excluded from version control by `.gitignore`.

Scripture passages are bundled in the Authorised (King James) Version, which is free of
copyright. `ScriptureReference.translation` records which version the stored text belongs to, so a
differently licensed translation can be loaded in its place.
