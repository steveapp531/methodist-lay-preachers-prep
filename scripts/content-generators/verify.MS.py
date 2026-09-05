#!/usr/bin/env python3
"""Verification script for the Methodist Studies (MS) question bank.

Checks, as required by the content contract:
  1. every questionId and cardId is unique;
  2. every excerpt appears verbatim inside some block of the named topic
     in manual.json;
  3. every chapter and topic title matches a real chapter/topic title in
     the MS subject;
  4. every objective question has exactly the right number of correct
     options for its type;
  5. every theory question's rubric marks sum to its `marks`.

Plus a few structural sanity checks (counts, id prefixes, type mix,
required fields, duplicate question text).
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
MANUAL = os.path.join(os.path.dirname(HERE), 'manual.json')
QUESTIONS = os.path.join(HERE, 'questions.MS.json')
FLASHCARDS = os.path.join(HERE, 'flashcards.MS.json')
CODE = 'MS'

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


# --------------------------------------------------------------- load
manual = json.load(open(MANUAL, encoding='utf-8'))
subject = None
for s in manual['subjects']:
    if s['code'] == CODE:
        subject = s
        break
if subject is None:
    sys.exit('subject %s not found in manual.json' % CODE)

# (chapterTitle, topicTitle) -> topic
topics = {}
chapter_titles = set()
for ch in subject['chapters']:
    chapter_titles.add(ch['title'])
    for tp in ch['topics']:
        topics[(ch['title'], tp['title'])] = tp

questions = json.load(open(QUESTIONS, encoding='utf-8'))
cards = json.load(open(FLASHCARDS, encoding='utf-8'))

objective = [q for q in questions if q['questionType'] != 'theory']
theory = [q for q in questions if q['questionType'] == 'theory']

# ------------------------------------------------- 1. unique identifiers
seen = Counter(q['questionId'] for q in questions)
for qid, n in seen.items():
    if n > 1:
        err('duplicate questionId %s (%d times)' % (qid, n))
seen = Counter(c['cardId'] for c in cards)
for cid, n in seen.items():
    if n > 1:
        err('duplicate cardId %s (%d times)' % (cid, n))

for q in questions:
    prefix = 'MS-T-' if q['questionType'] == 'theory' else 'MS-O-'
    if not re.fullmatch(re.escape(prefix) + r'\d{4}', q['questionId']):
        err('bad questionId format: %s (expected %s####)' % (q['questionId'], prefix))
for c in cards:
    if not re.fullmatch(r'MS-C-\d{4}', c['cardId']):
        err('bad cardId format: %s' % c['cardId'])


# ------------------------- 2 & 3. chapter/topic titles and verbatim excerpts
def check_reference(label, chapter, topic, anchor, excerpt):
    if chapter not in chapter_titles:
        err('%s: chapter title not in manual: %r' % (label, chapter))
        return
    tp = topics.get((chapter, topic))
    if tp is None:
        err('%s: topic %r not found under chapter %r' % (label, topic, chapter))
        return
    blocks = tp['blocks']
    anchors = {b['anchor'] for b in blocks} | {tp['anchor']}
    if anchor not in anchors:
        err('%s: anchor %r is neither the topic anchor nor a block anchor of %r'
            % (label, anchor, topic))
    if not excerpt or not excerpt.strip():
        err('%s: empty excerpt' % label)
        return
    if not any(excerpt in b['text'] for b in blocks):
        err('%s: excerpt not verbatim in any block of topic %r:\n     %r'
            % (label, topic, excerpt[:160]))
    if len(excerpt) > 400:
        warn('%s: excerpt is %d characters (over ~400)' % (label, len(excerpt)))


for q in questions:
    ref = q.get('manualReference')
    if not ref:
        err('%s: missing manualReference' % q['questionId'])
        continue
    if ref.get('chapterTitle') != q.get('chapter'):
        err('%s: manualReference.chapterTitle does not match chapter field'
            % q['questionId'])
    if ref.get('topicTitle') != q.get('topic'):
        err('%s: manualReference.topicTitle does not match topic field'
            % q['questionId'])
    check_reference(q['questionId'], q.get('chapter'), q.get('topic'),
                    ref.get('anchor'), ref.get('excerpt', ''))

# flashcards carry only a topic title, so locate it by topic name
topic_names = defaultdict(list)
for (ct, tt), tp in topics.items():
    topic_names[tt].append((ct, tp))

for c in cards:
    label = c['cardId']
    matches = topic_names.get(c.get('topic'), [])
    if not matches:
        err('%s: topic %r not found in subject' % (label, c.get('topic')))
        continue
    exc = c.get('excerpt', '')
    if not exc or not exc.strip():
        err('%s: empty excerpt' % label)
        continue
    if not any(any(exc in b['text'] for b in tp['blocks']) for _, tp in matches):
        err('%s: excerpt not verbatim in any block of topic %r:\n     %r'
            % (label, c.get('topic'), exc[:160]))


# ------------------------- 4. correct option counts per objective type
VALID_TYPES = {'multiple_choice', 'true_false', 'fill_blank', 'multiple_response'}
for q in objective:
    qt = q['questionType']
    qid = q['questionId']
    if qt not in VALID_TYPES:
        err('%s: unknown questionType %r' % (qid, qt))
        continue
    if qt == 'fill_blank':
        if 'options' in q:
            err('%s: fill_blank must not carry options' % qid)
        acc = q.get('acceptedAnswers')
        if not acc or not isinstance(acc, list):
            err('%s: fill_blank needs a non-empty acceptedAnswers list' % qid)
        if '____' not in q['question']:
            warn('%s: fill_blank question has no visible blank' % qid)
        continue
    opts = q.get('options')
    if not opts:
        err('%s: missing options' % qid)
        continue
    n_correct = sum(1 for o in opts if o.get('isCorrect'))
    keys = [o.get('key') for o in opts]
    if len(set(keys)) != len(keys):
        err('%s: duplicate option keys %r' % (qid, keys))
    if qt == 'multiple_choice':
        if len(opts) != 4:
            err('%s: multiple_choice needs 4 options, found %d' % (qid, len(opts)))
        if n_correct != 1:
            err('%s: multiple_choice needs exactly 1 correct option, found %d'
                % (qid, n_correct))
    elif qt == 'true_false':
        if len(opts) != 2:
            err('%s: true_false needs 2 options, found %d' % (qid, len(opts)))
        else:
            if opts[0].get('key') != 'A' or opts[0].get('text') != 'True':
                err('%s: true_false option A must be exactly "True"' % qid)
            if opts[1].get('key') != 'B' or opts[1].get('text') != 'False':
                err('%s: true_false option B must be exactly "False"' % qid)
        if n_correct != 1:
            err('%s: true_false needs exactly 1 correct option, found %d'
                % (qid, n_correct))
    elif qt == 'multiple_response':
        if len(opts) != 5:
            err('%s: multiple_response needs 5 options, found %d' % (qid, len(opts)))
        if n_correct not in (2, 3):
            err('%s: multiple_response needs 2 or 3 correct options, found %d'
                % (qid, n_correct))


# ------------------------- 5. theory rubric marks sum to `marks`
for q in theory:
    qid = q['questionId']
    rubric = q.get('markingRubric') or []
    if not rubric:
        err('%s: theory question has no markingRubric' % qid)
        continue
    total = sum(c.get('marks', 0) for c in rubric)
    if total != q.get('marks'):
        err('%s: rubric marks sum to %s but marks is %s' % (qid, total, q.get('marks')))
    if not 4 <= len(rubric) <= 6:
        warn('%s: rubric has %d criteria (4-6 expected)' % (qid, len(rubric)))
    ids = [c.get('id') for c in rubric]
    if len(set(ids)) != len(ids):
        err('%s: duplicate rubric criterion ids %r' % (qid, ids))
    if not q.get('idealAnswer') or len(q['idealAnswer'].split()) < 200:
        warn('%s: idealAnswer is short (%d words)'
             % (qid, len((q.get('idealAnswer') or '').split())))
    if not q.get('keyPoints'):
        err('%s: theory question has no keyPoints' % qid)


# ------------------------- structural sanity
REQUIRED = ['questionId', 'examStage', 'subject', 'chapter', 'topic',
            'questionType', 'question', 'explanation', 'manualReference',
            'scriptureReferences', 'difficulty', 'tags', 'sourceKind',
            'answerConfidence', 'status']
for q in questions:
    for f in REQUIRED:
        if f not in q:
            err('%s: missing required field %r' % (q['questionId'], f))
    if q.get('subject') != CODE:
        err('%s: subject field is %r' % (q['questionId'], q.get('subject')))
    if q.get('examStage') != 'PART2':
        err('%s: examStage is %r' % (q['questionId'], q.get('examStage')))
    if q.get('difficulty') not in ('easy', 'medium', 'hard'):
        err('%s: bad difficulty %r' % (q['questionId'], q.get('difficulty')))
    if q.get('answerConfidence') == 'provisional' and not q.get('reviewNotes'):
        err('%s: provisional answers need reviewNotes' % q['questionId'])

CARD_KINDS = {'term', 'fact', 'scripture', 'definition', 'person', 'event'}
for c in cards:
    for f in ['cardId', 'subject', 'topic', 'front', 'back', 'kind',
              'scriptureReferences', 'excerpt', 'tags', 'order']:
        if f not in c:
            err('%s: missing required field %r' % (c['cardId'], f))
    if c.get('kind') not in CARD_KINDS:
        err('%s: bad kind %r' % (c['cardId'], c.get('kind')))

# duplicate wording
dupes = [t for t, n in Counter(q['question'].strip().lower()
                               for q in questions).items() if n > 1]
for d in dupes:
    err('duplicate question text: %r' % d[:100])
dupes = [t for t, n in Counter(c['front'].strip().lower()
                               for c in cards).items() if n > 1]
for d in dupes:
    err('duplicate flashcard front: %r' % d[:100])

# scripture references must be ones the syllabus itself cites
syllabus_refs = set()
for tp in topics.values():
    for sr in tp.get('scriptureReferences', []):
        syllabus_refs.add(sr['reference'])
        syllabus_refs.add('%s %s' % (sr['book'], sr['chapter']))
for rec, idkey in [(q, 'questionId') for q in questions] + \
                  [(c, 'cardId') for c in cards]:
    for ref in rec.get('scriptureReferences', []):
        if ref not in syllabus_refs:
            err('%s: cites %r, which the MS syllabus does not' % (rec[idkey], ref))

# counts
if not 60 <= len(objective) <= 90:
    err('objective count %d outside 60-90' % len(objective))
if not 10 <= len(theory) <= 14:
    err('theory count %d outside 10-14' % len(theory))
if not 40 <= len(cards) <= 60:
    err('flashcard count %d outside 40-60' % len(cards))

substantive = [ch for ch in subject['chapters'] if ch['title'] != 'References']
covered = {q['chapter'] for q in questions}
for ch in substantive:
    if ch['title'] not in covered:
        err('chapter has no questions: %r' % ch['title'])
if any(q['chapter'] == 'References' for q in questions):
    err('References chapter must be skipped')

# ------------------------------------------------------------- report
print('Methodist Studies (MS) verification')
print('-' * 60)
print('objective questions : %d' % len(objective))
print('theory questions    : %d' % len(theory))
print('flashcards          : %d' % len(cards))
print()
print('type mix:')
mix = Counter(q['questionType'] for q in objective)
for t, n in mix.most_common():
    print('  %-18s %3d  (%4.1f%%)' % (t, n, 100.0 * n / len(objective)))
print()
print('per chapter (objective + theory):')
per = Counter(q['chapter'] for q in questions)
for ch in substantive:
    print('  %-45s %3d' % (ch['title'][:45], per.get(ch['title'], 0)))
print()
print('difficulty:', dict(Counter(q['difficulty'] for q in questions)))
print('card kinds:', dict(Counter(c['kind'] for c in cards)))
print()

for w in warnings:
    print('WARNING: %s' % w)
if warnings:
    print()

if errors:
    for e in errors:
        print('FAIL: %s' % e)
    print()
    print('%d error(s)' % len(errors))
    sys.exit(1)

print('All checks passed.')
