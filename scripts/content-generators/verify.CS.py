#!/usr/bin/env python3
"""Verification for the CS (Church and Society) question bank.

Checks, per the content authoring contract:
  1. every questionId and cardId is unique;
  2. every excerpt appears verbatim inside some block of the named topic
     in manual.json;
  3. every chapter and topic title matches a real chapter/topic title in
     the CS subject;
  4. every objective question has exactly the right number of correct
     options for its type;
  5. every theory question's rubric marks sum to its marks.

Plus structural sanity checks (ids, required fields, option keys,
scripture references drawn from the syllabus, counts).
"""
import json
import re
import sys
from collections import Counter

MANUAL = '/home/claude/mlpp/data/part2/manual.json'
QFILE = '/home/claude/mlpp/data/part2/gen/questions.CS.json'
CFILE = '/home/claude/mlpp/data/part2/gen/flashcards.CS.json'
CODE = 'CS'

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


manual = json.load(open(MANUAL))
subject = next(s for s in manual['subjects'] if s['code'] == CODE)

# (chapterTitle, topicTitle) -> list of block texts
TOPICS = {}
CHAPTERS = set()
TOPIC_TITLES = set()
ANCHORS = {}          # anchor -> (chapterTitle, topicTitle)
for ch in subject['chapters']:
    CHAPTERS.add(ch['title'])
    for tp in ch['topics']:
        TOPIC_TITLES.add(tp['title'])
        TOPICS[(ch['title'], tp['title'])] = [b['text'] for b in tp.get('blocks', [])]
        ANCHORS[tp['anchor']] = (ch['title'], tp['title'])
        for b in tp.get('blocks', []):
            ANCHORS[b['anchor']] = (ch['title'], tp['title'])

questions = json.load(open(QFILE))
cards = json.load(open(CFILE))

# ---------------------------------------------------------------- 1. unique ids
qids = [q['questionId'] for q in questions]
for qid, n in Counter(qids).items():
    if n > 1:
        err('duplicate questionId %s (%d times)' % (qid, n))
cids = [c['cardId'] for c in cards]
for cid, n in Counter(cids).items():
    if n > 1:
        err('duplicate cardId %s (%d times)' % (cid, n))

for qid in qids:
    if not re.fullmatch(r'CS-[OT]-\d{4}', qid):
        err('malformed questionId %s' % qid)
for cid in cids:
    if not re.fullmatch(r'CS-C-\d{4}', cid):
        err('malformed cardId %s' % cid)

for q in questions:
    want = 'CS-T-' if q['questionType'] == 'theory' else 'CS-O-'
    if not q['questionId'].startswith(want):
        err('%s: id prefix does not match questionType %s'
            % (q['questionId'], q['questionType']))

# --------------------------------------------- 2/3. chapter, topic and excerpt
def check_ref(label, chapter, topic, excerpt, anchor):
    if chapter not in CHAPTERS:
        err('%s: chapter title not found in manual: %r' % (label, chapter))
        return
    if topic not in TOPIC_TITLES:
        err('%s: topic title not found in manual: %r' % (label, topic))
        return
    key = (chapter, topic)
    if key not in TOPICS:
        err('%s: topic %r does not belong to chapter %r' % (label, topic, chapter))
        return
    blocks = TOPICS[key]
    if not any(excerpt in b for b in blocks):
        err('%s: excerpt not verbatim in any block of %r / %r:\n      %r'
            % (label, chapter, topic, excerpt[:160]))
    if len(excerpt) > 400:
        warn('%s: excerpt is %d characters (over ~400)' % (label, len(excerpt)))
    if anchor is not None:
        if anchor not in ANCHORS:
            err('%s: anchor %r not found in the CS subject' % (label, anchor))
        elif ANCHORS[anchor] != key:
            err('%s: anchor %r belongs to %r, not %r'
                % (label, anchor, ANCHORS[anchor], key))


for q in questions:
    mr = q.get('manualReference')
    if not mr:
        err('%s: missing manualReference' % q['questionId'])
        continue
    if mr.get('chapterTitle') != q.get('chapter'):
        err('%s: manualReference.chapterTitle disagrees with chapter field'
            % q['questionId'])
    if mr.get('topicTitle') != q.get('topic'):
        err('%s: manualReference.topicTitle disagrees with topic field'
            % q['questionId'])
    check_ref(q['questionId'], q.get('chapter'), q.get('topic'),
              mr.get('excerpt', ''), mr.get('anchor'))
    if not mr.get('citation'):
        err('%s: missing citation' % q['questionId'])

for c in cards:
    check_ref(c['cardId'], c.get('chapter'), c.get('topic'),
              c.get('excerpt', ''), c.get('anchor'))
    if c.get('kind') not in {'term', 'fact', 'scripture', 'definition',
                             'person', 'event'}:
        err('%s: bad kind %r' % (c['cardId'], c.get('kind')))
    for f in ('front', 'back'):
        if not c.get(f):
            err('%s: empty %s' % (c['cardId'], f))

# --------------------------------------------- 4. correct-option counts by type
EXPECTED = {'multiple_choice': (1, 1), 'true_false': (1, 1),
            'multiple_response': (2, 3)}

for q in questions:
    t = q['questionType']
    if t == 'theory':
        continue
    if t == 'fill_blank':
        if 'options' in q:
            err('%s: fill_blank must not carry options' % q['questionId'])
        acc = q.get('acceptedAnswers')
        if not acc or not all(isinstance(a, str) and a.strip() for a in acc):
            err('%s: fill_blank needs a non-empty acceptedAnswers list'
                % q['questionId'])
        if '_' not in q['question'] and '____' not in q['question']:
            warn('%s: fill_blank question has no visible blank' % q['questionId'])
        continue
    if t not in EXPECTED:
        err('%s: unknown questionType %r' % (q['questionId'], t))
        continue
    opts = q.get('options') or []
    lo, hi = EXPECTED[t]
    n = sum(1 for o in opts if o.get('isCorrect'))
    if not (lo <= n <= hi):
        err('%s (%s): %d correct options, expected %d-%d'
            % (q['questionId'], t, n, lo, hi))
    if t == 'true_false':
        if [(o.get('key'), o.get('text')) for o in opts] != [('A', 'True'), ('B', 'False')]:
            err('%s: true_false options must be exactly A/True and B/False'
                % q['questionId'])
    else:
        if t == 'multiple_choice' and len(opts) != 4:
            err('%s: multiple_choice needs 4 options, has %d'
                % (q['questionId'], len(opts)))
        if t == 'multiple_response' and len(opts) != 5:
            err('%s: multiple_response needs 5 options, has %d'
                % (q['questionId'], len(opts)))
        keys = [o.get('key') for o in opts]
        if keys != list('ABCDE'[:len(opts)]):
            err('%s: option keys out of order: %r' % (q['questionId'], keys))
        texts = [o.get('text', '').strip().lower() for o in opts]
        if len(set(texts)) != len(texts):
            err('%s: duplicate option texts' % q['questionId'])
        for o in opts:
            if not o.get('text', '').strip():
                err('%s: empty option %s' % (q['questionId'], o.get('key')))
            if not o.get('isCorrect') and not o.get('rationale', '').strip():
                warn('%s: distractor %s has no rationale'
                     % (q['questionId'], o.get('key')))

# ------------------------------------------------------- 5. theory rubric marks
for q in questions:
    if q['questionType'] != 'theory':
        continue
    rubric = q.get('markingRubric') or []
    total = sum(c.get('marks', 0) for c in rubric)
    if total != q.get('marks'):
        err('%s: rubric marks sum to %d but marks is %s'
            % (q['questionId'], total, q.get('marks')))
    if not (4 <= len(rubric) <= 6):
        warn('%s: %d rubric criteria (four to six is right)'
             % (q['questionId'], len(rubric)))
    ids = [c.get('id') for c in rubric]
    if len(set(ids)) != len(ids):
        err('%s: duplicate rubric criterion ids' % q['questionId'])
    for c in rubric:
        for f in ('label', 'description', 'keywords', 'synonyms'):
            if not c.get(f):
                err('%s/%s: missing %s' % (q['questionId'], c.get('id'), f))
    if not q.get('idealAnswer') or len(q['idealAnswer'].split()) < 200:
        warn('%s: idealAnswer is short (%d words)'
             % (q['questionId'], len(q.get('idealAnswer', '').split())))
    if not q.get('keyPoints') or len(q['keyPoints']) < 6:
        warn('%s: fewer than six keyPoints' % q['questionId'])

# --------------------------------------------------- common structural checks
REQUIRED = ['examStage', 'subject', 'chapter', 'topic', 'questionType',
            'question', 'explanation', 'manualReference', 'scriptureReferences',
            'difficulty', 'tags', 'sourceKind', 'answerConfidence', 'status']
for q in questions:
    for f in REQUIRED:
        if f not in q:
            err('%s: missing field %s' % (q['questionId'], f))
    if q.get('examStage') != 'PART2' or q.get('subject') != CODE:
        err('%s: wrong examStage/subject' % q['questionId'])
    if q.get('difficulty') not in {'easy', 'medium', 'hard'}:
        err('%s: bad difficulty %r' % (q['questionId'], q.get('difficulty')))
    if q.get('answerConfidence') == 'provisional' and not q.get('reviewNotes'):
        err('%s: provisional answers need reviewNotes' % q['questionId'])
    if not q.get('tags'):
        err('%s: no tags' % q['questionId'])

# scripture references must be ones the syllabus itself cites
SYLLABUS_SCRIPTURE = set()
for ch in subject['chapters']:
    for tp in ch['topics']:
        for s in (tp.get('scriptureReferences') or []):
            SYLLABUS_SCRIPTURE.add(s['reference'])


def norm_ref(r):
    return re.sub(r'\s+', '', r).replace(',', ':').lower()


NORMED = {norm_ref(r) for r in SYLLABUS_SCRIPTURE}
for item in questions + cards:
    ident = item.get('questionId') or item.get('cardId')
    for r in item.get('scriptureReferences') or []:
        if norm_ref(r) not in NORMED:
            warn('%s: scripture %r is not in the syllabus scripture list' % (ident, r))

# duplicate stems
stems = Counter(q['question'].strip().lower() for q in questions)
for s, n in stems.items():
    if n > 1:
        err('duplicate question stem (%d times): %s' % (n, s[:90]))
fronts = Counter(c['front'].strip().lower() for c in cards)
for s, n in fronts.items():
    if n > 1:
        err('duplicate flashcard front (%d times): %s' % (n, s[:90]))

# ------------------------------------------------------------------- counts
objs = [q for q in questions if q['questionType'] != 'theory']
theos = [q for q in questions if q['questionType'] == 'theory']
types = Counter(q['questionType'] for q in objs)

if not (60 <= len(objs) <= 90):
    err('objective count %d outside 60-90' % len(objs))
if not (10 <= len(theos) <= 14):
    err('theory count %d outside 10-14' % len(theos))
if not (40 <= len(cards) <= 60):
    err('flashcard count %d outside 40-60' % len(cards))

real_chapters = [c['title'] for c in subject['chapters']
                 if c['title'].lower() not in ('references', 'appendix')]
covered_q = {q['chapter'] for q in questions}
covered_t = {q['chapter'] for q in theos}
for ch in real_chapters:
    if ch not in covered_q:
        err('chapter has no questions: %s' % ch)
    if ch not in covered_t:
        err('chapter has no theory question: %s' % ch)
for q in questions + cards:
    if (q.get('chapter') or '').lower() in ('references', 'appendix'):
        err('%s: draws on a bibliography chapter'
            % (q.get('questionId') or q.get('cardId')))

# ------------------------------------------------------------------- report
print('CS question bank verification')
print('-' * 60)
print('objective questions : %d  %s' % (len(objs), dict(types)))
print('theory questions    : %d' % len(theos))
print('flashcards          : %d' % len(cards))
print('chapters covered    : %d of %d' % (len(covered_q), len(real_chapters)))
print('per-chapter (objective + theory):')
for ch in real_chapters:
    print('   %-48s %2d obj  %d thy  %2d cards'
          % (ch[:48],
             sum(1 for q in objs if q['chapter'] == ch),
             sum(1 for q in theos if q['chapter'] == ch),
             sum(1 for c in cards if c['chapter'] == ch)))
print('difficulty          : %s' % dict(Counter(q['difficulty'] for q in questions)))
print('-' * 60)
if warnings:
    print('%d warning(s):' % len(warnings))
    for w in warnings:
        print('  WARN', w)
if errors:
    print('%d ERROR(S):' % len(errors))
    for e in errors:
        print('  ERROR', e)
    sys.exit(1)
print('OK - all checks passed.')
