# Past examination paper transcription contract

You are transcribing **real past papers** from the Methodist Church Ghana Connexional Lay
Preachers' Examination, Part 2, into the platform's question bank, and determining the answers
**only** where the official syllabus settles them.

These are genuine examination questions. They are the single most valuable content in the
platform, and also the most dangerous: a candidate will trust a past-paper answer more than any
other, so an invented one does real harm.

## Sources

**Question papers (these contain questions only — no answer keys anywhere):**

1. `/home/claude/mlpp/data/part2/pastpapers/*.txt` — papers from 2009 to 2014, extracted from a
   PDF with a real text layer. Files are named `<CODE>-<year>-<sitting>-p<page>.txt`. Take the
   ones whose `<CODE>` is your subject. The extraction is column-aware but imperfect: a
   two-column page may leave the first line or two of the body interleaved, and option grids
   sometimes put A and C on one line with B and D on the next. Read carefully.
2. `/tmp/ocr_2025.txt`, `/tmp/ocr_2024.txt`, `/tmp/ocr_2223.txt` — papers from 2022, 2023, 2024
   and 2025, recovered by OCR from scans. Each file holds every subject for those years, split by
   `===== PAGE n =====` markers; find your subject's papers by searching for its title. **The OCR
   is noisy** — expect mangled words (`CONNEXI(NAL`, `offichilly`, `Christiah`, `forme;|`),
   dropped letters, and stray marks. You must repair obvious OCR damage when transcribing, but
   only where the intended word is beyond doubt from context. Where a word is genuinely
   ambiguous, transcribe your best reading and note it in `reviewNotes`.

**The syllabus — the only thing that may decide an answer:**

- `/tmp/subject_<CODE>.json` — your subject's syllabus, verbatim, in the structure
  `{ code, name, chapters: [ { number, title, slug, anchor, topics: [ { number, title, slug,
  anchor, blocks: [ {anchor, text} ], scriptureReferences: [...] } ] } ] }`.
- `/home/claude/mlpp/data/part2/manual.json` — the full manual, if you need to check another paper.

## The rule that governs everything

**Never invent an answer.** For each objective question you must find the sentence in the
syllabus that settles it. If you find it, record the answer with that sentence as the excerpt.
If you do not find it, you record the question **with no answer key at all** and mark it for
review. You do not fall back on general theological knowledge, on what sounds right, or on what
you remember about Methodism.

This is not a small share of questions. Some past questions draw on material outside the
syllabus, or on a syllabus edition that differs from this one. Leaving those unanswered and
flagged is the correct outcome, and the platform is built to handle it: unanswered questions are
held at `needs_review` and never reach a candidate until a person confirms them.

Do not pad your verified count. A run of 40 verified and 25 unverified is a good result. A run of
65 verified, some of them guessed, is a failure.

## Output

Write one file:

`/home/claude/mlpp/data/part2/gen/questions.<CODE>-past.json`

A JSON array. Two record shapes.

### An objective question you could ground in the syllabus

```json
{
  "questionId": "OT-P-2014-A01",
  "examStage": "PART2",
  "subject": "OT",
  "chapter": "THE BOOK OF AMOS",
  "topic": "4.1 The Prophet Amos",
  "questionType": "multiple_choice",
  "question": "Amos was a herdsman from the town of",
  "options": [
    { "key": "A", "text": "Bethel",  "isCorrect": false, "rationale": "Bethel was where he prophesied, not his home." },
    { "key": "B", "text": "Tekoa",   "isCorrect": true,  "rationale": "" },
    { "key": "C", "text": "Samaria", "isCorrect": false, "rationale": "" },
    { "key": "D", "text": "Gilgal",  "isCorrect": false, "rationale": "" }
  ],
  "explanation": "One or two sentences, in the syllabus's own terms, saying why this is the answer.",
  "manualReference": {
    "chapterTitle": "THE BOOK OF AMOS",
    "topicTitle": "4.1 The Prophet Amos",
    "anchor": 535,
    "excerpt": "A verbatim sentence copied exactly from the block with that anchor, which states the answer.",
    "citation": "Old Testament Studies — THE BOOK OF AMOS — 4.1 The Prophet Amos"
  },
  "scriptureReferences": ["Amos 1:1"],
  "difficulty": "medium",
  "tags": ["amos", "past-paper"],
  "sourceKind": "past_paper",
  "source": {
    "label": "Old Testament Studies Part II — September 2014",
    "year": 2014,
    "sitting": "September",
    "sectionLabel": "Section A",
    "questionNumber": "1"
  },
  "answerConfidence": "verified",
  "status": "published"
}
```

### An objective question you could NOT ground

Identical, except:
- **omit `isCorrect` entirely** (or set every option to `false`) — no answer key,
- `"explanation": ""`,
- `manualReference` may carry the nearest relevant topic but its `excerpt` must be `""`,
- `"answerConfidence": "unverified"`,
- `"status": "needs_review"`,
- `"reviewNotes"` saying, in one sentence, what you looked for and why the syllabus did not settle
  it — for example "The syllabus does not give the date the two International Covenants came into
  effect" or "OCR damage makes option C unreadable".

Never write a partial guess. Either the syllabus settles it and you cite the sentence, or it does
not and there is no key.

### A theory question (Section B)

Transcribe the question exactly as printed, then build the marking scheme from the syllabus:

```json
{
  "questionId": "OT-PT-2014-B01",
  "examStage": "PART2",
  "subject": "OT",
  "chapter": "THE BOOK OF AMOS",
  "topic": "4.3 Socio-Economic Situation",
  "questionType": "theory",
  "question": "a. Explain the term Society. b. What are the essential characteristics of a society?",
  "marks": 25,
  "idealAnswer": "250-400 words, built only from the syllabus text, in continuous prose.",
  "keyPoints": ["six to eight points a marker would look for"],
  "markingRubric": [
    { "id": "c1", "label": "…", "description": "…", "marks": 5,
      "keywords": ["…"], "synonyms": [["…","…"]], "required": true }
  ],
  "explanation": "One sentence on what the question is testing.",
  "manualReference": { "…as above, with a real excerpt…" },
  "scriptureReferences": [],
  "difficulty": "medium",
  "tags": ["past-paper"],
  "sourceKind": "past_paper",
  "source": { "label": "…", "year": 2014, "sitting": "September",
              "sectionLabel": "Section B", "questionNumber": "1" },
  "answerConfidence": "verified",
  "status": "published"
}
```

Rubric criteria must sum to `marks`. Use the marks the paper itself states where it states them
(commonly 25 per Section B question); otherwise use 25. Where a theory question asks about
something the syllabus does not cover, transcribe it, leave `idealAnswer` and `markingRubric`
empty, set `answerConfidence` to `"unverified"` and `status` to `"needs_review"`, and say so in
`reviewNotes` — a question with no marking scheme cannot be marked, and the platform must not
pretend otherwise.

### Question types found in these papers

- Standard four-option multiple choice → `multiple_choice`.
- "True / False?" items → `true_false`, with options exactly
  `[{"key":"A","text":"True"},{"key":"B","text":"False"}]`.
- "Indicate who made the following assertions" and other fill-the-gap items (the paper prints a
  row of dots) → `fill_blank` with `acceptedAnswers` listing every reasonable phrasing, and no
  `options`. These are frequently ungroundable — be strict.
- Section B essay questions → `theory`.

## Identifiers

`<CODE>-P-<year>-A<nn>` for objective and `<CODE>-PT-<year>-B<nn>` for theory. Where two papers of
the same subject exist for one year (an April and a September sitting), add the month initial:
`CS-P-2012A-A01`. Every id must be unique across the whole file.

## Chapter and topic titles

`chapter` and `topic` are matched by title on import, so copy them **exactly** from
`/tmp/subject_<CODE>.json` — including the syllabus's own irregular spacing, which is preserved
in the data (for example `PREVENIENT  GRACE` has two spaces). Where a question does not belong to
any one topic, give the chapter and leave `topic` out.

## Before you finish

Write and run a verification script that checks:
1. every `questionId` is unique,
2. every `chapter` and `topic` title matches a real title in your subject,
3. every non-empty `excerpt` appears **verbatim** inside a block of the named topic,
4. every question marked `verified` has exactly one correct option (or, for `multiple_response`,
   two or three; for `fill_blank`, a non-empty `acceptedAnswers`) **and** a non-empty excerpt,
5. every question marked `unverified` has **no** correct option flagged, an empty excerpt, and a
   non-empty `reviewNotes`,
6. every theory rubric sums to its `marks`,
7. no question has `status: "published"` unless `answerConfidence` is `verified` or `provisional`.

Fix everything it reports and run it again until it is clean.

## Report back

State: how many papers you transcribed and from which years; how many objective and theory
questions; how many verified versus unverified, and the honest reason for the unverified ones;
and anything about the source material a reviewer should know (OCR damage, an illegible page, a
paper that appears to be from a different syllabus edition).
