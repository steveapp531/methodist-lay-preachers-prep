"""Shared helpers for building the OT question bank."""
import json
import os
import re
import sys

SUBJ = next(s for s in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'manual.json')))['subjects'] if s['code'] == 'OT')
SUBJECT_NAME = SUBJ['name']  # "Old Testament Studies"

BLOCKS = {}          # anchor -> (chapterTitle, topicTitle, text)
TOPIC_OF_BLOCK = {}
for _c in SUBJ['chapters']:
    for _t in _c['topics']:
        for _b in _t['blocks']:
            BLOCKS[_b['anchor']] = (_c['title'], _t['title'], _b['text'])


APOS = "'’‘ʼ´`"
DQUO = '"“”„'
DASH = '-‐‑–—'
_APOS_CLS = '[' + re.escape(APOS) + ']'
_DQUO_CLS = '[' + re.escape(DQUO) + ']'
_DASH_CLS = '[' + re.escape(DASH) + ']'


def _pattern(phrase):
    """Whitespace-, quote- and dash-insensitive pattern for a phrase."""
    parts = []
    for word in phrase.split():
        chunk = ''
        for ch in word:
            if ch in APOS:
                chunk += _APOS_CLS
            elif ch in DQUO:
                chunk += _DQUO_CLS
            elif ch in DASH:
                chunk += _DASH_CLS
            else:
                chunk += re.escape(ch)
        parts.append(chunk)
    return re.compile(r'\s+'.join(parts))


def _find(anchor, phrase):
    """Return the verbatim substring of block `anchor` matching `phrase`
    (whitespace-insensitive), plus the chapter and topic titles."""
    if anchor not in BLOCKS:
        sys.exit('NO SUCH BLOCK ANCHOR: %r' % anchor)
    ch, tp, text = BLOCKS[anchor]
    m = _pattern(phrase).search(text)
    if not m:
        sys.exit('EXCERPT NOT FOUND in block %s (%s / %s):\n  %s' % (anchor, ch, tp, phrase[:120]))
    return m.group(0), ch, tp


def ref(anchor, phrase):
    excerpt, ch, tp = _find(anchor, phrase)
    if len(excerpt) > 400:
        sys.exit('EXCERPT TOO LONG (%d) at block %s: %s' % (len(excerpt), anchor, phrase[:80]))
    return {
        'topicTitle': tp,
        'chapterTitle': ch,
        'anchor': anchor,
        'excerpt': excerpt,
        'citation': '%s — %s — %s' % (SUBJECT_NAME, ch, tp),
    }, ch, tp


_counters = {'O': 0, 'T': 0, 'C': 0}


def _nid(kind):
    _counters[kind] += 1
    return 'OT-%s-%04d' % (kind, _counters[kind])


def _base(anchor, phrase, question, qtype, explanation, difficulty, tags, scripture, confidence, notes):
    mr, ch, tp = ref(anchor, phrase)
    rec = {
        'questionId': None,
        'examStage': 'PART2',
        'subject': 'OT',
        'chapter': ch,
        'topic': tp,
        'questionType': qtype,
        'question': question,
    }
    rec['_tail'] = {
        'explanation': explanation,
        'manualReference': mr,
        'scriptureReferences': scripture or [],
        'difficulty': difficulty,
        'tags': tags,
        'sourceKind': 'manual_derived',
        'answerConfidence': confidence,
        'status': 'published',
    }
    if notes:
        rec['_tail']['reviewNotes'] = notes
    return rec


def _finish(rec, extra):
    tail = rec.pop('_tail')
    rec.update(extra)
    rec.update(tail)
    return rec


KEYS = ['A', 'B', 'C', 'D', 'E']


def mc(anchor, phrase, question, options, correct, explanation,
       difficulty='medium', tags=(), scripture=None, confidence='verified', notes=None):
    """options: list of (text, rationale); correct: 0-based index."""
    rec = _base(anchor, phrase, question, 'multiple_choice', explanation,
                difficulty, list(tags), scripture, confidence, notes)
    rec['questionId'] = _nid('O')
    opts = []
    for i, (text, rat) in enumerate(options):
        opts.append({'key': KEYS[i], 'text': text, 'isCorrect': i == correct,
                     'rationale': '' if i == correct else rat})
    return _finish(rec, {'options': opts})


def tf(anchor, phrase, question, answer, explanation,
       difficulty='easy', tags=(), scripture=None, confidence='verified', notes=None):
    rec = _base(anchor, phrase, question, 'true_false', explanation,
                difficulty, list(tags), scripture, confidence, notes)
    rec['questionId'] = _nid('O')
    return _finish(rec, {'options': [
        {'key': 'A', 'text': 'True', 'isCorrect': bool(answer)},
        {'key': 'B', 'text': 'False', 'isCorrect': not bool(answer)},
    ]})


def fb(anchor, phrase, question, accepted, explanation,
       difficulty='medium', tags=(), scripture=None, confidence='verified', notes=None):
    rec = _base(anchor, phrase, question, 'fill_blank', explanation,
                difficulty, list(tags), scripture, confidence, notes)
    rec['questionId'] = _nid('O')
    return _finish(rec, {'acceptedAnswers': list(accepted)})


def mr(anchor, phrase, question, options, explanation,
       difficulty='medium', tags=(), scripture=None, confidence='verified', notes=None):
    """options: list of (text, isCorrect, rationale) — five options, 2-3 correct."""
    rec = _base(anchor, phrase, question, 'multiple_response', explanation,
                difficulty, list(tags), scripture, confidence, notes)
    rec['questionId'] = _nid('O')
    opts = []
    for i, (text, ok, rat) in enumerate(options):
        opts.append({'key': KEYS[i], 'text': text, 'isCorrect': bool(ok),
                     'rationale': '' if ok else rat})
    return _finish(rec, {'options': opts})


def theory(anchor, phrase, question, marks, ideal, key_points, rubric, explanation,
           difficulty='medium', tags=(), scripture=None, confidence='verified', notes=None):
    rec = _base(anchor, phrase, question, 'theory', explanation,
                difficulty, list(tags), scripture, confidence, notes)
    rec['questionId'] = _nid('T')
    crit = []
    for i, (label, desc, m, kws, syns, required) in enumerate(rubric, 1):
        crit.append({'id': 'c%d' % i, 'label': label, 'description': desc,
                     'marks': m, 'keywords': list(kws), 'synonyms': [list(s) for s in syns],
                     'required': bool(required)})
    return _finish(rec, {'marks': marks, 'idealAnswer': ideal,
                         'keyPoints': list(key_points), 'markingRubric': crit})


_card_order = {'n': 0}


def card(topic_title, front, back, kind, anchor, phrase, tags=(), scripture=None):
    excerpt, ch, tp = _find(anchor, phrase)
    if tp != topic_title:
        sys.exit('CARD topic mismatch: gave %r, block %s belongs to %r' % (topic_title, anchor, tp))
    _card_order['n'] += 1
    return {
        'cardId': _nid('C'),
        'subject': 'OT',
        'topic': tp,
        'front': front,
        'back': back,
        'kind': kind,
        'scriptureReferences': scripture or [],
        'excerpt': excerpt,
        'tags': list(tags),
        'order': _card_order['n'],
    }
