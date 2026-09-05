# Content authoring contract — question bank from the official syllabus

You are writing examination practice content for the **Methodist Church Ghana Connexional Lay
Preachers' Examination, Part 2**, from the official 2026 syllabus.

## The source of truth

`/home/claude/mlpp/data/part2/manual.json` holds the syllabus, parsed and verbatim.

Shape:
```
{
  examStage: "PART2",
  subjects: [
    {
      code, slug, name, shortName, paper, description, order, wordCount,
      chapters: [
        {
          number, title, slug, anchor, order,
          topics: [
            {
              number, title, slug, anchor, order, wordCount,
              blocks: [ { anchor, text } ],          // verbatim syllabus paragraphs
              scriptureReferences: [ { book, chapter, verses, reference } ],
              reference: { subject, chapter, topic, anchor, citation }
            }
          ]
        }
      ]
    }
  ]
}
```

Read **only your assigned subject** out of that file (it is large — extract your subject with a
small Python or Node script rather than reading the whole file into context, then work from the
extract).

## The rule that matters most

**Do not invent answers.** Every question you write must be answerable from the syllabus text you
were given, and must carry the verbatim excerpt that proves it. If you find yourself reaching for
general theological knowledge or something you remember about Methodism that is not in the text
in front of you, that question does not get written.

This is a real examination that a real person is sitting. A plausible-sounding wrong answer is
worse than no question at all.

## What to produce

Two files, written with the Write tool:

1. `/home/claude/mlpp/data/part2/gen/questions.<CODE>.json`
2. `/home/claude/mlpp/data/part2/gen/flashcards.<CODE>.json`

where `<CODE>` is your subject code (OT, NT, DOC, LIT, MS or CS).

### Question record

```json
{
  "questionId": "OT-O-0001",
  "examStage": "PART2",
  "subject": "OT",
  "chapter": "INTRODUCTION TO PROPHETS AND PROPHECY IN ISRAEL",
  "topic": "Who is a Prophet?",
  "questionType": "multiple_choice",
  "question": "Which Hebrew word for a prophet carries the sense of one who is called?",
  "options": [
    { "key": "A", "text": "Nabi", "isCorrect": true,  "rationale": "" },
    { "key": "B", "text": "Roeh", "isCorrect": false, "rationale": "Roeh means a seer." },
    { "key": "C", "text": "Hozeh", "isCorrect": false, "rationale": "Hozeh also means a seer." },
    { "key": "D", "text": "Torah", "isCorrect": false, "rationale": "Torah is the law, not a prophet." }
  ],
  "explanation": "One or two sentences saying why the answer is right, in the syllabus's own terms.",
  "manualReference": {
    "topicTitle": "Who is a Prophet?",
    "chapterTitle": "INTRODUCTION TO PROPHETS AND PROPHECY IN ISRAEL",
    "anchor": 33,
    "excerpt": "A verbatim sentence or two, copied exactly from the blocks, that contains the answer.",
    "citation": "Old Testament Studies — INTRODUCTION TO PROPHETS AND PROPHECY IN ISRAEL — Who is a Prophet?"
  },
  "scriptureReferences": ["1 Kings 18"],
  "difficulty": "medium",
  "tags": ["prophets", "hebrew-terms"],
  "sourceKind": "manual_derived",
  "answerConfidence": "verified",
  "status": "published"
}
```

- `questionId` must be unique across the whole bank. Use `<CODE>-O-0001…` for objective and
  `<CODE>-T-0001…` for theory.
- `chapter` and `topic` are matched by **title**, so copy the titles from manual.json exactly.
- `anchor` is the topic's `anchor`, or the anchor of the specific block you quoted — better.
- `excerpt` must appear **verbatim** in one of the topic's blocks. This is checked. Keep it under
  about 400 characters.
- `scriptureReferences` may be plain strings like `"Amos 5:24"`, drawn from the topic's own
  scripture list or from the quoted text. Never cite a passage the syllabus does not.
- `difficulty`: `easy` for straight recall, `medium` for understanding, `hard` for questions
  needing the candidate to connect two parts of the topic.
- `answerConfidence` is `"verified"` when your excerpt states the answer plainly; use
  `"provisional"` if the excerpt supports it but requires a small inference, and say why in a
  `"reviewNotes"` field.

Question types to use, roughly in this mix:
- `multiple_choice` — about 60%. Four options, exactly one correct. Distractors must be plausible
  and drawn from the same topic, never absurd. Give a short `rationale` on the wrong options where
  it teaches something.
- `true_false` — about 20%. Options must be exactly `{"key":"A","text":"True"}` and
  `{"key":"B","text":"False"}`.
- `fill_blank` — about 15%. Use `"acceptedAnswers": ["…", "…"]` listing every reasonable
  phrasing, and no `options`.
- `multiple_response` — about 5%. Two or three correct options out of five; mark each with
  `isCorrect`.

### Theory question record

```json
{
  "questionId": "OT-T-0001",
  "examStage": "PART2",
  "subject": "OT",
  "chapter": "THE BOOK OF AMOS",
  "topic": "4.3 Socio-Economic Situation",
  "questionType": "theory",
  "question": "Describe the socio-economic situation in Israel during the ministry of Amos.",
  "marks": 25,
  "idealAnswer": "A model answer of 250-400 words, written strictly from the syllabus text, in continuous prose.",
  "keyPoints": ["Six to eight bullet points a marker would look for"],
  "markingRubric": [
    {
      "id": "c1",
      "label": "Prosperity under Jeroboam II",
      "description": "Explains the material prosperity of the northern kingdom.",
      "marks": 5,
      "keywords": ["prosperity", "Jeroboam", "wealth"],
      "synonyms": [["prosperity", "affluence", "wealth"], ["Jeroboam II", "Jeroboam"]],
      "required": true
    }
  ],
  "explanation": "One or two sentences on what the question is really testing.",
  "manualReference": { … as above … },
  "scriptureReferences": ["Amos 5:24"],
  "difficulty": "medium",
  "tags": ["amos", "social-justice"],
  "sourceKind": "manual_derived",
  "answerConfidence": "verified",
  "status": "published"
}
```

Rubric criteria must sum to `marks` (use 25 unless the topic is small). Four to six criteria is
right. `keywords` and `synonyms` drive a deterministic marker, so list the words a candidate would
actually write, including alternative phrasings — a candidate who writes "affluence" should score
the same as one who writes "prosperity".

### Flashcard record

```json
{
  "cardId": "OT-C-0001",
  "subject": "OT",
  "topic": "Who is a Prophet?",
  "front": "What are the three Hebrew words used for a prophet?",
  "back": "Nabi, Roeh and Hozeh.",
  "kind": "term",
  "scriptureReferences": [],
  "excerpt": "verbatim supporting sentence",
  "tags": ["prophets"],
  "order": 1
}
```
`kind` is one of: `term`, `fact`, `scripture`, `definition`, `person`, `event`.

## How much

For your subject:
- **60 to 90 objective questions**, spread across every chapter in proportion to its size.
  A chapter that is a page of references gets none; a chapter with twelve substantial topics gets
  the most.
- **10 to 14 theory questions**, at least one per major chapter, phrased the way the past papers
  phrase them ("Explain…", "Discuss…", "Describe…", "What are…? ", "Outline…", "Give an account of…").
- **40 to 60 flashcards** covering the definitions, names, dates, lists and scripture the
  syllabus emphasises.

Skip chapters titled "References", "Appendix" or similar — they are bibliography, not examinable
content.

## Quality bar

- Questions must read like examination questions, not like quiz-app filler.
- Vary what you ask about: definitions, causes, consequences, lists, people, places, dates,
  scripture, distinctions between similar ideas, and the syllabus's own emphases.
- Never write a question whose answer is a matter of opinion.
- Never write two questions that test the same fact in the same way.
- Watch spelling of proper nouns and Hebrew/Greek terms; copy them from the syllabus.
- British English.

## Before you finish

Write a small verification script that loads your two JSON files and checks:
1. every `questionId` and `cardId` is unique,
2. every `excerpt` appears verbatim inside some block of the named topic in manual.json,
3. every `chapter` and `topic` title matches a real chapter/topic title in your subject,
4. every objective question has exactly the right number of correct options for its type,
5. every theory question's rubric marks sum to its `marks`.

Fix everything it reports, run it again until it is clean, and say so in your reply.
Report the final counts.
