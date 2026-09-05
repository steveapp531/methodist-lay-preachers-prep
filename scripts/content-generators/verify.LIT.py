#!/usr/bin/env python3
"""Verification for the Liturgics (LIT) question bank.

Checks, as required by the content contract:
  1. every questionId and cardId is unique;
  2. every excerpt appears verbatim inside some block of the named topic in manual.json;
  3. every chapter and topic title matches a real chapter/topic title in the subject;
  4. every objective question has exactly the right number of correct options for its type;
  5. every theory question's rubric marks sum to its `marks`.

Plus a few structural sanity checks (counts, required fields, enum values).
"""
import json
import os
import sys
from collections import Counter

BASE = os.path.dirname(os.path.abspath(__file__))
MANUAL = os.path.join(os.path.dirname(BASE), 'manual.json')
QFILE = os.path.join(BASE, 'questions.LIT.json')
CFILE = os.path.join(BASE, 'flashcards.LIT.json')
CODE = 'LIT'

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


manual = json.load(open(MANUAL, encoding='utf-8'))
subject = None
for s in manual['subjects']:
    if s['code'] == CODE:
        subject = s
if subject is None:
    sys.exit('subject %s not found in manual.json' % CODE)

CHAPTERS = {}          # chapter title -> {topic title -> topic}
for ch in subject['chapters']:
    CHAPTERS[ch['title']] = {tp['title']: tp for tp in ch['topics']}

questions = json.load(open(QFILE, encoding='utf-8'))
cards = json.load(open(CFILE, encoding='utf-8'))

VALID_TYPES = {'multiple_choice', 'true_false', 'fill_blank', 'multiple_response', 'theory'}
VALID_DIFF = {'easy', 'medium', 'hard'}
VALID_CONF = {'verified', 'provisional'}
VALID_KIND = {'term', 'fact', 'scripture', 'definition', 'person', 'event'}

# ---- 1. unique ids -------------------------------------------------------
qids = [q.get('questionId') for q in questions]
for qid, n in Counter(qids).items():
    if n > 1:
        err('duplicate questionId: %s (%d times)' % (qid, n))
cids = [c.get('cardId') for c in cards]
for cid, n in Counter(cids).items():
    if n > 1:
        err('duplicate cardId: %s (%d times)' % (cid, n))
for qid in qids:
    if not qid or not qid.startswith(('LIT-O-', 'LIT-T-')):
        err('bad questionId prefix: %r' % qid)
for cid in cids:
    if not cid or not cid.startswith('LIT-C-'):
        err('bad cardId prefix: %r' % cid)


def check_ref(where, chapter, topic, excerpt, anchor=None):
    """Checks 2 and 3 for one record."""
    if chapter not in CHAPTERS:
        err('%s: chapter title not in manual: %r' % (where, chapter))
        return
    topics = CHAPTERS[chapter]
    if topic not in topics:
        err('%s: topic title %r not in chapter %r' % (where, topic, chapter))
        return
    tp = topics[topic]
    if not excerpt or not excerpt.strip():
        err('%s: empty excerpt' % where)
        return
    if len(excerpt) > 400:
        warn('%s: excerpt is %d characters (over the ~400 guideline)' % (where, len(excerpt)))
    if not any(excerpt in b['text'] for b in tp['blocks']):
        err('%s: excerpt NOT verbatim in any block of %r / %r: %r'
            % (where, chapter, topic, excerpt[:110]))
        return
    if anchor is not None:
        anchors = {b['anchor'] for b in tp['blocks']} | {tp['anchor']}
        if anchor not in anchors:
            err('%s: anchor %r is neither the topic anchor nor a block anchor of %r'
                % (where, anchor, topic))
        else:
            hit = [b for b in tp['blocks'] if b['anchor'] == anchor and excerpt in b['text']]
            if not hit:
                warn('%s: excerpt is verbatim in the topic but not in the block named by '
                     'anchor %r' % (where, anchor))


# ---- questions -----------------------------------------------------------
n_obj = n_theory = 0
for q in questions:
    where = q.get('questionId', '<no id>')
    for field in ('examStage', 'subject', 'chapter', 'topic', 'questionType',
                  'question', 'explanation', 'manualReference', 'difficulty',
                  'tags', 'sourceKind', 'answerConfidence', 'status'):
        if field not in q:
            err('%s: missing field %r' % (where, field))
    if q.get('examStage') != 'PART2':
        err('%s: examStage is %r' % (where, q.get('examStage')))
    if q.get('subject') != CODE:
        err('%s: subject is %r' % (where, q.get('subject')))
    qt = q.get('questionType')
    if qt not in VALID_TYPES:
        err('%s: unknown questionType %r' % (where, qt))
    if q.get('difficulty') not in VALID_DIFF:
        err('%s: bad difficulty %r' % (where, q.get('difficulty')))
    if q.get('answerConfidence') not in VALID_CONF:
        err('%s: bad answerConfidence %r' % (where, q.get('answerConfidence')))
    if q.get('answerConfidence') == 'provisional' and not q.get('reviewNotes'):
        err('%s: provisional answer without reviewNotes' % where)

    mr = q.get('manualReference') or {}
    if mr.get('chapterTitle') != q.get('chapter'):
        err('%s: manualReference.chapterTitle differs from chapter' % where)
    if mr.get('topicTitle') != q.get('topic'):
        err('%s: manualReference.topicTitle differs from topic' % where)
    check_ref(where, q.get('chapter'), q.get('topic'), mr.get('excerpt'), mr.get('anchor'))

    # ---- 4. correct-option counts ---------------------------------------
    if qt == 'theory':
        n_theory += 1
        marks = q.get('marks')
        rubric = q.get('markingRubric') or []
        if not isinstance(marks, int) or marks <= 0:
            err('%s: bad marks %r' % (where, marks))
        if not (4 <= len(rubric) <= 6):
            warn('%s: rubric has %d criteria (4-6 expected)' % (where, len(rubric)))
        total = sum(c.get('marks', 0) for c in rubric)
        if total != marks:
            err('%s: rubric marks sum to %d but question is worth %s' % (where, total, marks))
        rids = [c.get('id') for c in rubric]
        if len(set(rids)) != len(rids):
            err('%s: duplicate rubric criterion ids' % where)
        for c in rubric:
            for field in ('id', 'label', 'description', 'marks', 'keywords',
                          'synonyms', 'required'):
                if field not in c:
                    err('%s: rubric criterion %r missing %r' % (where, c.get('id'), field))
            if not c.get('keywords'):
                err('%s: rubric criterion %r has no keywords' % (where, c.get('id')))
        if not q.get('idealAnswer') or len(q['idealAnswer'].split()) < 200:
            warn('%s: idealAnswer is %d words (250-400 expected)'
                 % (where, len((q.get('idealAnswer') or '').split())))
        if not (6 <= len(q.get('keyPoints') or []) <= 9):
            warn('%s: %d keyPoints (six to eight expected)' % (where, len(q.get('keyPoints') or [])))
        if 'options' in q:
            err('%s: theory question should not carry options' % where)
    else:
        n_obj += 1
        if qt == 'fill_blank':
            if 'options' in q:
                err('%s: fill_blank must not carry options' % where)
            acc = q.get('acceptedAnswers')
            if not acc:
                err('%s: fill_blank has no acceptedAnswers' % where)
            if '______' not in q.get('question', ''):
                warn('%s: fill_blank question has no blank marker' % where)
        else:
            opts = q.get('options')
            if not opts:
                err('%s: %s has no options' % (where, qt))
                continue
            keys = [o.get('key') for o in opts]
            if keys != list('ABCDE'[:len(opts)]):
                err('%s: option keys are %r' % (where, keys))
            texts = [o.get('text') for o in opts]
            if len(set(texts)) != len(texts):
                err('%s: duplicate option texts' % where)
            ncorrect = sum(1 for o in opts if o.get('isCorrect'))
            if qt == 'multiple_choice':
                if len(opts) != 4:
                    err('%s: multiple_choice has %d options (4 expected)' % (where, len(opts)))
                if ncorrect != 1:
                    err('%s: multiple_choice has %d correct options (1 expected)'
                        % (where, ncorrect))
            elif qt == 'true_false':
                if texts != ['True', 'False']:
                    err('%s: true_false options are %r' % (where, texts))
                if ncorrect != 1:
                    err('%s: true_false has %d correct options (1 expected)' % (where, ncorrect))
                for o in opts:
                    if set(o) != {'key', 'text', 'isCorrect'}:
                        err('%s: true_false option carries unexpected fields %r'
                            % (where, sorted(o)))
            elif qt == 'multiple_response':
                if len(opts) != 5:
                    err('%s: multiple_response has %d options (5 expected)' % (where, len(opts)))
                if not (2 <= ncorrect <= 3):
                    err('%s: multiple_response has %d correct options (2 or 3 expected)'
                        % (where, ncorrect))

# duplicate question stems
for stem, n in Counter(q.get('question') for q in questions).items():
    if n > 1:
        err('duplicate question text (%d times): %r' % (n, stem[:90]))

# ---- flashcards ----------------------------------------------------------
for c in cards:
    where = c.get('cardId', '<no id>')
    for field in ('subject', 'topic', 'front', 'back', 'kind', 'scriptureReferences',
                  'excerpt', 'tags', 'order'):
        if field not in c:
            err('%s: missing field %r' % (where, field))
    if c.get('subject') != CODE:
        err('%s: subject is %r' % (where, c.get('subject')))
    if c.get('kind') not in VALID_KIND:
        err('%s: bad kind %r' % (where, c.get('kind')))
    # topic must exist somewhere in the subject, and the excerpt must be in that topic
    owners = [ch for ch, tps in CHAPTERS.items() if c.get('topic') in tps]
    if not owners:
        err('%s: topic %r not in the subject' % (where, c.get('topic')))
        continue
    exc = c.get('excerpt') or ''
    ok = False
    for ch in owners:
        tp = CHAPTERS[ch][c['topic']]
        if exc and any(exc in b['text'] for b in tp['blocks']):
            ok = True
    if not ok:
        err('%s: excerpt NOT verbatim in topic %r: %r' % (where, c.get('topic'), exc[:110]))

for front, n in Counter(c.get('front') for c in cards).items():
    if n > 1:
        err('duplicate flashcard front (%d times): %r' % (n, front[:90]))
orders = [c.get('order') for c in cards]
if orders != list(range(1, len(cards) + 1)):
    err('flashcard order values are not 1..N in sequence')

# ---- counts --------------------------------------------------------------
if not (60 <= n_obj <= 90):
    err('objective count %d outside the required 60-90' % n_obj)
if not (10 <= n_theory <= 14):
    err('theory count %d outside the required 10-14' % n_theory)
if not (40 <= len(cards) <= 60):
    err('flashcard count %d outside the required 40-60' % len(cards))

examinable = [ch['title'] for ch in subject['chapters'] if ch['title'] != 'References']
covered = {q['chapter'] for q in questions}
for ch in examinable:
    if ch not in covered:
        err('chapter with no questions: %r' % ch)
theory_ch = {q['chapter'] for q in questions if q['questionType'] == 'theory'}
for ch in examinable:
    if ch not in theory_ch:
        err('chapter with no theory question: %r' % ch)
if 'References' in covered:
    err('the References chapter must be skipped')

# ---- report --------------------------------------------------------------
print('LIT verification')
print('  objective questions : %d' % n_obj)
print('  theory questions    : %d' % n_theory)
print('  flashcards          : %d' % len(cards))
print('  types               : %s'
      % dict(Counter(q['questionType'] for q in questions)))
print('  objective/chapter   : %s'
      % dict(Counter(q['chapter'] for q in questions if q['questionType'] != 'theory')))
print('  difficulty          : %s' % dict(Counter(q['difficulty'] for q in questions)))
print('  card kinds          : %s' % dict(Counter(c['kind'] for c in cards)))

if warnings:
    print('\n%d warning(s):' % len(warnings))
    for w in warnings:
        print('  ~', w)
if errors:
    print('\n%d ERROR(S):' % len(errors))
    for e in errors:
        print('  !', e)
    sys.exit(1)
print('\nAll checks passed.')
