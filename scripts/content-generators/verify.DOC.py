# -*- coding: utf-8 -*-
"""Verification script for the DOC (Christian Doctrine) question bank.

Checks, against /home/claude/mlpp/data/part2/manual.json:
  1. every questionId and cardId is unique
  2. every excerpt appears verbatim inside some block of the named topic
  3. every chapter and topic title matches a real chapter/topic title in the subject
  4. every objective question has exactly the right number of correct options
  5. every theory question's rubric marks sum to its marks
plus a handful of structural sanity checks.

Run:  python3 verify.DOC.py
"""
import json
import sys

MANUAL = '/home/claude/mlpp/data/part2/manual.json'
GEN = '/home/claude/mlpp/data/part2/gen'
CODE = 'DOC'

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def load():
    with open(MANUAL, encoding='utf-8') as f:
        manual = json.load(f)
    subject = None
    for s in manual['subjects']:
        if s['code'] == CODE:
            subject = s
            break
    if subject is None:
        sys.exit('subject %s not found in manual.json' % CODE)
    with open('%s/questions.%s.json' % (GEN, CODE), encoding='utf-8') as f:
        questions = json.load(f)
    with open('%s/flashcards.%s.json' % (GEN, CODE), encoding='utf-8') as f:
        cards = json.load(f)
    return subject, questions, cards


def main():
    subject, questions, cards = load()

    # index the subject ------------------------------------------------------
    chapter_titles = set()
    topics_by_chapter = {}          # chapter title -> {topic title: topic}
    topic_titles = set()
    topics_by_title = {}            # topic title -> list of topics (titles repeat, e.g. INTRODUCTION)
    for ch in subject['chapters']:
        chapter_titles.add(ch['title'])
        topics_by_chapter.setdefault(ch['title'], {})
        for tp in ch['topics']:
            topics_by_chapter[ch['title']][tp['title']] = tp
            topic_titles.add(tp['title'])
            topics_by_title.setdefault(tp['title'], []).append(tp)

    # 1. unique ids ----------------------------------------------------------
    seen = {}
    for q in questions:
        qid = q.get('questionId')
        if not qid:
            err('question with no questionId: %r' % q.get('question', '')[:60])
        elif qid in seen:
            err('duplicate questionId: %s' % qid)
        else:
            seen[qid] = q
        if qid and not qid.startswith(CODE + '-'):
            err('%s: id does not use the %s- prefix' % (qid, CODE))
    for q in questions:
        qid = q.get('questionId', '')
        want = '-T-' if q.get('questionType') == 'theory' else '-O-'
        if qid and want not in qid:
            err('%s: id infix does not match questionType %s' % (qid, q.get('questionType')))

    seen_c = set()
    for c in cards:
        cid = c.get('cardId')
        if not cid:
            err('card with no cardId: %r' % c.get('front', '')[:60])
        elif cid in seen_c:
            err('duplicate cardId: %s' % cid)
        else:
            seen_c.add(cid)
    overlap = seen_c & set(seen)
    if overlap:
        err('ids shared between questions and cards: %s' % sorted(overlap)[:5])

    # 2 & 3. chapter/topic titles and verbatim excerpts ----------------------
    for q in questions:
        qid = q.get('questionId', '?')
        ch = q.get('chapter')
        tp = q.get('topic')
        if ch not in chapter_titles:
            err('%s: chapter title not found in manual: %r' % (qid, ch))
            continue
        if tp not in topics_by_chapter[ch]:
            err('%s: topic %r not found in chapter %r' % (qid, tp, ch))
            continue
        topic = topics_by_chapter[ch][tp]
        ref = q.get('manualReference') or {}
        if ref.get('chapterTitle') != ch:
            err('%s: manualReference.chapterTitle %r != chapter %r' % (qid, ref.get('chapterTitle'), ch))
        if ref.get('topicTitle') != tp:
            err('%s: manualReference.topicTitle %r != topic %r' % (qid, ref.get('topicTitle'), tp))
        exc = ref.get('excerpt') or ''
        if not exc:
            err('%s: empty excerpt' % qid)
            continue
        if len(exc) > 400:
            err('%s: excerpt is %d characters (limit ~400)' % (qid, len(exc)))
        blocks = topic['blocks']
        if not any(exc in b['text'] for b in blocks):
            err('%s: excerpt not found verbatim in topic %r: %r' % (qid, tp, exc[:90]))
        anchor = ref.get('anchor')
        anchors = {b['anchor'] for b in blocks} | {topic['anchor']}
        if anchor not in anchors:
            err('%s: anchor %r is not the topic anchor nor any block anchor' % (qid, anchor))
        else:
            block = next((b for b in blocks if b['anchor'] == anchor), None)
            if block is not None and exc not in block['text']:
                warnings.append('%s: excerpt is in the topic but not in block %s' % (qid, anchor))

    for c in cards:
        cid = c.get('cardId', '?')
        tp = c.get('topic')
        if tp not in topic_titles:
            err('%s: card topic not found in manual: %r' % (cid, tp))
            continue
        exc = c.get('excerpt') or ''
        if not exc:
            err('%s: empty excerpt' % cid)
            continue
        ok = any(any(exc in b['text'] for b in t['blocks']) for t in topics_by_title[tp])
        if not ok:
            err('%s: excerpt not found verbatim in topic %r: %r' % (cid, tp, exc[:90]))
        if c.get('kind') not in ('term', 'fact', 'scripture', 'definition', 'person', 'event'):
            err('%s: bad card kind %r' % (cid, c.get('kind')))

    # 4. option counts -------------------------------------------------------
    for q in questions:
        qid = q.get('questionId', '?')
        qt = q.get('questionType')
        opts = q.get('options')
        if qt == 'multiple_choice':
            if not opts or len(opts) != 4:
                err('%s: multiple_choice needs exactly 4 options, has %s' % (qid, opts and len(opts)))
            n = sum(1 for o in opts or [] if o.get('isCorrect'))
            if n != 1:
                err('%s: multiple_choice has %d correct options, expected 1' % (qid, n))
        elif qt == 'true_false':
            if not opts or len(opts) != 2:
                err('%s: true_false needs exactly 2 options' % qid)
            elif [o['text'] for o in opts] != ['True', 'False'] or \
                 [o['key'] for o in opts] != ['A', 'B']:
                err('%s: true_false options must be A/True and B/False' % qid)
            n = sum(1 for o in opts or [] if o.get('isCorrect'))
            if n != 1:
                err('%s: true_false has %d correct options, expected 1' % (qid, n))
        elif qt == 'multiple_response':
            if not opts or len(opts) != 5:
                err('%s: multiple_response needs 5 options, has %s' % (qid, opts and len(opts)))
            n = sum(1 for o in opts or [] if o.get('isCorrect'))
            if n not in (2, 3):
                err('%s: multiple_response has %d correct options, expected 2 or 3' % (qid, n))
        elif qt == 'fill_blank':
            if opts:
                err('%s: fill_blank must not carry options' % qid)
            if not q.get('acceptedAnswers'):
                err('%s: fill_blank has no acceptedAnswers' % qid)
        elif qt == 'theory':
            if opts:
                err('%s: theory must not carry options' % qid)
        else:
            err('%s: unknown questionType %r' % (qid, qt))
        if opts:
            keys = [o.get('key') for o in opts]
            if keys != list('ABCDE'[:len(opts)]):
                err('%s: option keys are %r' % (qid, keys))

    # 5. theory rubric marks -------------------------------------------------
    for q in questions:
        if q.get('questionType') != 'theory':
            continue
        qid = q.get('questionId', '?')
        marks = q.get('marks')
        rubric = q.get('markingRubric') or []
        total = sum(c.get('marks', 0) for c in rubric)
        if total != marks:
            err('%s: rubric marks sum to %s but marks is %s' % (qid, total, marks))
        if not (4 <= len(rubric) <= 6):
            err('%s: rubric has %d criteria (expected 4-6)' % (qid, len(rubric)))
        if not q.get('idealAnswer'):
            err('%s: theory question has no idealAnswer' % qid)
        else:
            w = len(q['idealAnswer'].split())
            if not (250 <= w <= 400):
                err('%s: idealAnswer is %d words (expected 250-400)' % (qid, w))
        kp = q.get('keyPoints') or []
        if not (6 <= len(kp) <= 8):
            warnings.append('%s: %d keyPoints (6-8 suggested)' % (qid, len(kp)))
        for cri in rubric:
            for field in ('id', 'label', 'description', 'marks', 'keywords', 'synonyms', 'required'):
                if field not in cri:
                    err('%s: rubric criterion missing %r' % (qid, field))

    # extra structural checks ------------------------------------------------
    required = ['examStage', 'subject', 'chapter', 'topic', 'questionType', 'question',
                'explanation', 'manualReference', 'scriptureReferences', 'difficulty',
                'tags', 'sourceKind', 'answerConfidence', 'status']
    for q in questions:
        qid = q.get('questionId', '?')
        for field in required:
            if field not in q:
                err('%s: missing field %r' % (qid, field))
        if q.get('subject') != CODE:
            err('%s: subject is %r' % (qid, q.get('subject')))
        if q.get('difficulty') not in ('easy', 'medium', 'hard'):
            err('%s: bad difficulty %r' % (qid, q.get('difficulty')))
        if q.get('answerConfidence') == 'provisional' and not q.get('reviewNotes'):
            err('%s: provisional answerConfidence with no reviewNotes' % qid)

    # counts -----------------------------------------------------------------
    obj = [q for q in questions if q['questionType'] != 'theory']
    theory = [q for q in questions if q['questionType'] == 'theory']
    if not (60 <= len(obj) <= 90):
        err('objective question count is %d (expected 60-90)' % len(obj))
    if not (10 <= len(theory) <= 14):
        err('theory question count is %d (expected 10-14)' % len(theory))
    if not (40 <= len(cards) <= 60):
        err('flashcard count is %d (expected 40-60)' % len(cards))

    # duplicate question stems
    stems = {}
    for q in questions:
        k = q['question'].strip().lower()
        if k in stems:
            err('duplicate question text: %s and %s' % (stems[k], q['questionId']))
        stems[k] = q['questionId']

    # report -----------------------------------------------------------------
    from collections import Counter
    print('--- DOC verification ---')
    print('objective questions : %d' % len(obj))
    print('theory questions    : %d' % len(theory))
    print('flashcards          : %d' % len(cards))
    print('by type             : %s' % dict(Counter(q['questionType'] for q in questions)))
    print('by chapter          :')
    for ch, n in Counter(q['chapter'] for q in questions).most_common():
        print('    %-50s %d' % (ch, n))
    print('cards by kind       : %s' % dict(Counter(c['kind'] for c in cards)))
    print('difficulty          : %s' % dict(Counter(q['difficulty'] for q in questions)))
    if warnings:
        print('\n%d warning(s):' % len(warnings))
        for w in warnings:
            print('  ! ' + w)
    if errors:
        print('\n%d ERROR(S):' % len(errors))
        for e in errors:
            print('  * ' + e)
        sys.exit(1)
    print('\nALL CHECKS PASSED')


if __name__ == '__main__':
    main()
