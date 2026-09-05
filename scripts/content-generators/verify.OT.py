#!/usr/bin/env python3
"""Verification for the Old Testament Studies (OT) question bank.

Checks, per the content contract:
  1. every questionId and cardId is unique
  2. every excerpt appears verbatim inside some block of the named topic in manual.json
  3. every chapter and topic title matches a real chapter/topic title in the subject
  4. every objective question has exactly the right number of correct options for its type
  5. every theory question's rubric marks sum to its `marks`

Plus a set of contract sanity checks (counts, id prefixes, type mix, required fields).

Usage:  python3 verify.OT.py
Exit status 0 when clean, 1 when any error is reported.
"""
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
MANUAL = os.path.join(HERE, '..', 'manual.json')
QUESTIONS = os.path.join(HERE, 'questions.OT.json')
FLASHCARDS = os.path.join(HERE, 'flashcards.OT.json')

CODE = 'OT'
errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


# --------------------------------------------------------------- load ------
with open(MANUAL, encoding='utf-8') as fh:
    manual = json.load(fh)

subject = next((s for s in manual['subjects'] if s['code'] == CODE), None)
if subject is None:
    sys.exit('FATAL: subject %s not found in manual.json' % CODE)

# chapter title -> set of topic titles;  (chapter, topic) -> list of block texts
CHAPTER_TOPICS = {}
TOPIC_BLOCKS = {}          # (chapterTitle, topicTitle) -> [block, ...]
TOPIC_BY_TITLE = {}        # topicTitle -> [(chapterTitle, [blocks]), ...]
BLOCK_BY_ANCHOR = {}       # anchor -> (chapterTitle, topicTitle)
for ch in subject['chapters']:
    CHAPTER_TOPICS.setdefault(ch['title'], set())
    for tp in ch['topics']:
        CHAPTER_TOPICS[ch['title']].add(tp['title'])
        TOPIC_BLOCKS.setdefault((ch['title'], tp['title']), []).extend(tp['blocks'])
        TOPIC_BY_TITLE.setdefault(tp['title'], []).append((ch['title'], tp['blocks']))
        for b in tp['blocks']:
            BLOCK_BY_ANCHOR[b['anchor']] = (ch['title'], tp['title'])

with open(QUESTIONS, encoding='utf-8') as fh:
    questions = json.load(fh)
with open(FLASHCARDS, encoding='utf-8') as fh:
    flashcards = json.load(fh)


# ------------------------------------------------------- excerpt matching ---
APOS = "'\u2019\u2018\u02bc\u00b4`"
DQUO = '"\u201c\u201d\u201e'
DASH = '-\u2010\u2011\u2013\u2014'
_A = '[' + re.escape(APOS) + ']'
_D = '[' + re.escape(DQUO) + ']'
_H = '[' + re.escape(DASH) + ']'


def contains_verbatim(haystack, excerpt):
    """True if `excerpt` occurs in `haystack` as an exact substring."""
    return excerpt in haystack


def contains_loosely(haystack, excerpt):
    """Diagnostic only: match tolerant of whitespace runs (the syllabus blocks
    carry hard line breaks) and of typographic vs. ASCII quotes and dashes.
    Used to tell a near miss from a wholly invented excerpt."""
    parts = []
    for word in excerpt.split():
        chunk = ''
        for chx in word:
            if chx in APOS:
                chunk += _A
            elif chx in DQUO:
                chunk += _D
            elif chx in DASH:
                chunk += _H
            else:
                chunk += re.escape(chx)
        parts.append(chunk)
    if not parts:
        return False
    return re.search(r'\s+'.join(parts), haystack) is not None


# ------------------------------------------------------------- 1. ids ------
ids = [q.get('questionId') for q in questions]
for qid, n in Counter(ids).items():
    if n > 1:
        err('duplicate questionId: %s (x%d)' % (qid, n))
for qid in ids:
    if not qid:
        err('question with no questionId')
    elif not re.fullmatch(r'OT-[OT]-\d{4}', qid):
        err('malformed questionId: %r' % qid)

cids = [c.get('cardId') for c in flashcards]
for cid, n in Counter(cids).items():
    if n > 1:
        err('duplicate cardId: %s (x%d)' % (cid, n))
for cid in cids:
    if not cid:
        err('flashcard with no cardId')
    elif not re.fullmatch(r'OT-C-\d{4}', cid):
        err('malformed cardId: %r' % cid)

if set(ids) & set(cids):
    err('questionId/cardId collision: %s' % sorted(set(ids) & set(cids)))


# ---------------------------------------- 2/3. titles, anchors, excerpts ----
REQUIRED = ['examStage', 'subject', 'chapter', 'topic', 'questionType', 'question',
            'explanation', 'manualReference', 'scriptureReferences', 'difficulty',
            'tags', 'sourceKind', 'answerConfidence', 'status']

for q in questions:
    qid = q.get('questionId', '?')
    for field in REQUIRED:
        if field not in q:
            err('%s: missing field %r' % (qid, field))
    if q.get('subject') != CODE:
        err('%s: subject is %r, expected %r' % (qid, q.get('subject'), CODE))
    if q.get('examStage') != 'PART2':
        err('%s: examStage is %r' % (qid, q.get('examStage')))
    if q.get('difficulty') not in ('easy', 'medium', 'hard'):
        err('%s: bad difficulty %r' % (qid, q.get('difficulty')))
    if q.get('answerConfidence') not in ('verified', 'provisional'):
        err('%s: bad answerConfidence %r' % (qid, q.get('answerConfidence')))
    if q.get('answerConfidence') == 'provisional' and not q.get('reviewNotes'):
        err('%s: provisional answerConfidence with no reviewNotes' % qid)

    chapter, topic = q.get('chapter'), q.get('topic')
    if chapter not in CHAPTER_TOPICS:
        err('%s: chapter title not in manual: %r' % (qid, chapter))
    elif topic not in CHAPTER_TOPICS[chapter]:
        err('%s: topic %r not found in chapter %r' % (qid, topic, chapter))

    mr = q.get('manualReference') or {}
    if mr.get('chapterTitle') != chapter:
        err('%s: manualReference.chapterTitle %r != chapter %r' % (qid, mr.get('chapterTitle'), chapter))
    if mr.get('topicTitle') != topic:
        err('%s: manualReference.topicTitle %r != topic %r' % (qid, mr.get('topicTitle'), topic))
    if not mr.get('citation'):
        err('%s: manualReference has no citation' % qid)

    anchor = mr.get('anchor')
    if anchor is None:
        err('%s: manualReference has no anchor' % qid)
    elif anchor not in BLOCK_BY_ANCHOR:
        err('%s: anchor %r is not a block anchor in this subject' % (qid, anchor))
    elif BLOCK_BY_ANCHOR[anchor] != (chapter, topic):
        err('%s: anchor %r belongs to %s / %s, not %s / %s'
            % (qid, anchor, BLOCK_BY_ANCHOR[anchor][0], BLOCK_BY_ANCHOR[anchor][1], chapter, topic))

    excerpt = mr.get('excerpt') or ''
    if not excerpt.strip():
        err('%s: empty excerpt' % qid)
    else:
        if len(excerpt) > 400:
            err('%s: excerpt is %d characters (limit ~400)' % (qid, len(excerpt)))
        blocks = TOPIC_BLOCKS.get((chapter, topic), [])
        if not any(contains_verbatim(b['text'], excerpt) for b in blocks):
            near = any(contains_loosely(b['text'], excerpt) for b in blocks)
            err('%s: excerpt not found verbatim in any block of %s / %s%s:\n        %r'
                % (qid, chapter, topic,
                   ' (near miss - whitespace or quote characters differ)' if near else '',
                   excerpt[:120]))


# ----------------------------------------------- 4. option correctness -----
for q in questions:
    qid = q.get('questionId', '?')
    qtype = q.get('questionType')
    opts = q.get('options')

    if qtype == 'multiple_choice':
        if not opts or len(opts) != 4:
            err('%s: multiple_choice needs exactly 4 options, has %s' % (qid, len(opts or [])))
        n = sum(1 for o in (opts or []) if o.get('isCorrect'))
        if n != 1:
            err('%s: multiple_choice has %d correct options, expected 1' % (qid, n))
        if 'acceptedAnswers' in q:
            err('%s: multiple_choice should not carry acceptedAnswers' % qid)
    elif qtype == 'true_false':
        if [(o.get('key'), o.get('text')) for o in (opts or [])] != [('A', 'True'), ('B', 'False')]:
            err('%s: true_false options must be exactly A/True and B/False' % qid)
        n = sum(1 for o in (opts or []) if o.get('isCorrect'))
        if n != 1:
            err('%s: true_false has %d correct options, expected 1' % (qid, n))
    elif qtype == 'fill_blank':
        if opts:
            err('%s: fill_blank must not carry options' % qid)
        acc = q.get('acceptedAnswers')
        if not acc or not all(isinstance(x, str) and x.strip() for x in acc):
            err('%s: fill_blank needs a non-empty acceptedAnswers list' % qid)
        if '______' not in q.get('question', '') and '___' not in q.get('question', ''):
            warn('%s: fill_blank question has no visible blank' % qid)
    elif qtype == 'multiple_response':
        if not opts or len(opts) != 5:
            err('%s: multiple_response needs 5 options, has %s' % (qid, len(opts or [])))
        n = sum(1 for o in (opts or []) if o.get('isCorrect'))
        if n not in (2, 3):
            err('%s: multiple_response has %d correct options, expected 2 or 3' % (qid, n))
    elif qtype == 'theory':
        if opts:
            err('%s: theory question must not carry options' % qid)
    else:
        err('%s: unknown questionType %r' % (qid, qtype))

    if qtype in ('multiple_choice', 'true_false', 'multiple_response'):
        keys = [o.get('key') for o in (opts or [])]
        if keys != ['A', 'B', 'C', 'D', 'E'][:len(keys)]:
            err('%s: option keys are not sequential from A: %s' % (qid, keys))
        for o in (opts or []):
            if not str(o.get('text', '')).strip():
                err('%s: option %s has empty text' % (qid, o.get('key')))
            if o.get('isCorrect') and o.get('rationale'):
                warn('%s: correct option %s carries a rationale' % (qid, o.get('key')))


# ------------------------------------------------ 5. theory rubric marks ----
theory_qs = [q for q in questions if q.get('questionType') == 'theory']
for q in theory_qs:
    qid = q['questionId']
    marks = q.get('marks')
    rubric = q.get('markingRubric') or []
    if not isinstance(marks, int) or marks <= 0:
        err('%s: theory question has bad marks %r' % (qid, marks))
    total = sum(c.get('marks', 0) for c in rubric)
    if total != marks:
        err('%s: rubric marks sum to %d but question is worth %s' % (qid, total, marks))
    if not 4 <= len(rubric) <= 6:
        err('%s: rubric has %d criteria, expected 4 to 6' % (qid, len(rubric)))
    seen = set()
    for c in rubric:
        if c.get('id') in seen:
            err('%s: duplicate rubric criterion id %r' % (qid, c.get('id')))
        seen.add(c.get('id'))
        for f in ('id', 'label', 'description', 'marks', 'keywords', 'synonyms'):
            if f not in c:
                err('%s: rubric criterion %r missing %r' % (qid, c.get('id'), f))
        if not c.get('keywords'):
            err('%s: rubric criterion %r has no keywords' % (qid, c.get('id')))
    ideal = q.get('idealAnswer', '')
    words = len(ideal.split())
    if not 250 <= words <= 400:
        err('%s: idealAnswer is %d words, expected 250-400' % (qid, words))
    kp = q.get('keyPoints') or []
    if not 6 <= len(kp) <= 8:
        err('%s: %d keyPoints, expected 6 to 8' % (qid, len(kp)))


# ---------------------------------------------------------- flashcards -----
CARD_KINDS = {'term', 'fact', 'scripture', 'definition', 'person', 'event'}
for c in flashcards:
    cid = c.get('cardId', '?')
    for field in ('subject', 'topic', 'front', 'back', 'kind', 'scriptureReferences',
                  'excerpt', 'tags', 'order'):
        if field not in c:
            err('%s: flashcard missing field %r' % (cid, field))
    if c.get('subject') != CODE:
        err('%s: flashcard subject is %r' % (cid, c.get('subject')))
    if c.get('kind') not in CARD_KINDS:
        err('%s: flashcard kind %r not one of %s' % (cid, c.get('kind'), sorted(CARD_KINDS)))
    topic = c.get('topic')
    if topic not in TOPIC_BY_TITLE:
        err('%s: flashcard topic not in manual: %r' % (cid, topic))
    else:
        excerpt = c.get('excerpt') or ''
        if not excerpt.strip():
            err('%s: flashcard has an empty excerpt' % cid)
        else:
            pool = [b for _chapter, blocks in TOPIC_BY_TITLE[topic] for b in blocks]
            if not any(contains_verbatim(b['text'], excerpt) for b in pool):
                near = any(contains_loosely(b['text'], excerpt) for b in pool)
                err('%s: flashcard excerpt not found verbatim in topic %r%s:\n        %r'
                    % (cid, topic,
                       ' (near miss - whitespace or quote characters differ)' if near else '',
                       excerpt[:120]))
    if not str(c.get('front', '')).strip() or not str(c.get('back', '')).strip():
        err('%s: flashcard front or back is empty' % cid)

orders = [c.get('order') for c in flashcards]
if sorted(orders) != list(range(1, len(flashcards) + 1)):
    err('flashcard order values are not 1..%d without gaps' % len(flashcards))


# ----------------------------------------------- contract sanity checks ----
objective = [q for q in questions if q.get('questionType') != 'theory']
if not 60 <= len(objective) <= 90:
    err('objective question count is %d, contract asks for 60 to 90' % len(objective))
if not 10 <= len(theory_qs) <= 14:
    err('theory question count is %d, contract asks for 10 to 14' % len(theory_qs))
if not 40 <= len(flashcards) <= 60:
    err('flashcard count is %d, contract asks for 40 to 60' % len(flashcards))

SKIP = {'References', 'Appendix', 'Old Testament'}
substantive = [ch['title'] for ch in subject['chapters'] if ch['title'] not in SKIP]
per_chapter = Counter(q['chapter'] for q in questions)
for title in substantive:
    if per_chapter.get(title, 0) == 0:
        err('chapter has no questions at all: %r' % title)
for title in SKIP & set(per_chapter):
    err('questions were written for a skipped chapter: %r' % title)

theory_chapters = Counter(q['chapter'] for q in theory_qs)
for title in substantive:
    if theory_chapters.get(title, 0) == 0:
        err('chapter has no theory question: %r' % title)

mix = Counter(q['questionType'] for q in objective)
for qtype, low, high in (('multiple_choice', 0.50, 0.72),
                         ('true_false', 0.12, 0.28),
                         ('fill_blank', 0.08, 0.22),
                         ('multiple_response', 0.02, 0.10)):
    share = mix.get(qtype, 0) / len(objective)
    if not low <= share <= high:
        warn('%s is %.1f%% of objective questions (target band %.0f-%.0f%%)'
             % (qtype, share * 100, low * 100, high * 100))


# --------------------------------------------------------------- report ----
print('OT verification')
print('  questions file : %s' % QUESTIONS)
print('  flashcards file: %s' % FLASHCARDS)
print('  objective      : %d  %s' % (len(objective), dict(mix)))
print('  theory         : %d' % len(theory_qs))
print('  flashcards     : %d  %s' % (len(flashcards), dict(Counter(c['kind'] for c in flashcards))))
print('  per chapter    :')
for ch in subject['chapters']:
    if ch['title'] in SKIP:
        continue
    print('      %-50s %3d objective, %d theory'
          % (ch['title'][:50],
             sum(1 for q in objective if q['chapter'] == ch['title']),
             theory_chapters.get(ch['title'], 0)))
print('  difficulty     : %s' % dict(Counter(q['difficulty'] for q in questions)))

if warnings:
    print('\n%d warning(s):' % len(warnings))
    for w in warnings:
        print('  ! %s' % w)

if errors:
    print('\n%d ERROR(S):' % len(errors))
    for e in errors:
        print('  x %s' % e)
    sys.exit(1)

print('\nAll checks passed.')
