import json, re, sys

SUBJ = json.load(open('/tmp/subject_CS.json'))
SUBJECT_NAME = SUBJ['name']

BLOCKS = {}          # anchor -> text
BLOCK_LOC = {}       # anchor -> (chapterTitle, topicTitle, topicAnchor)
TOPIC_SCRIPT = {}    # (chapterTitle, topicTitle) -> [refs]
CH_OF_TOPIC = {}

for ch in SUBJ['chapters']:
    for tp in ch['topics']:
        TOPIC_SCRIPT[(ch['title'], tp['title'])] = [s['reference'] for s in (tp.get('scriptureReferences') or [])]
        for b in tp.get('blocks', []):
            BLOCKS[b['anchor']] = b['text']
            BLOCK_LOC[b['anchor']] = (ch['title'], tp['title'], tp['anchor'])


def _norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def repair(anchor, excerpt):
    """Return the exact verbatim substring of block `anchor` matching `excerpt`
    up to whitespace differences."""
    block = BLOCKS[anchor]
    if excerpt in block:
        return excerpt
    # build normalised form with index map
    norm_chars = []
    idx = []
    prev_space = True
    for i, c in enumerate(block):
        if c.isspace():
            if prev_space:
                continue
            norm_chars.append(' ')
            idx.append(i)
            prev_space = True
        else:
            norm_chars.append(c)
            idx.append(i)
            prev_space = False
    norm = ''.join(norm_chars).strip()
    # recompute idx aligned with stripped norm
    full = ''.join(norm_chars)
    lead = len(full) - len(full.lstrip())
    idx = idx[lead:lead + len(norm)]
    e = _norm(excerpt)
    pos = norm.find(e)
    if pos < 0:
        raise SystemExit('EXCERPT NOT FOUND in block %s:\n  want: %r\n  have: %r' % (anchor, e, norm))
    start = idx[pos]
    end = idx[pos + len(e) - 1] + 1
    return block[start:end]


def mref(anchor, excerpt):
    chT, tpT, _ = BLOCK_LOC[anchor]
    return {
        "topicTitle": tpT,
        "chapterTitle": chT,
        "anchor": anchor,
        "excerpt": repair(anchor, excerpt),
        "citation": "%s \u2014 %s \u2014 %s (syllabus \u00b6%d)" % (SUBJECT_NAME, chT, tpT, anchor),
    }


_oc = [0]
_tc = [0]
_cc = [0]

QUESTIONS = []
CARDS = []


def _base(anchor):
    chT, tpT, _ = BLOCK_LOC[anchor]
    return chT, tpT


def obj(qtype, anchor, question, excerpt, explanation, difficulty, tags,
        options=None, accepted=None, scripture=None, confidence="verified", review=None):
    _oc[0] += 1
    chT, tpT = _base(anchor)
    rec = {
        "questionId": "CS-O-%04d" % _oc[0],
        "examStage": "PART2",
        "subject": "CS",
        "chapter": chT,
        "topic": tpT,
        "questionType": qtype,
        "question": question,
    }
    if qtype == 'fill_blank':
        rec["acceptedAnswers"] = accepted
    else:
        rec["options"] = [
            {"key": k, "text": t, "isCorrect": c, "rationale": r}
            for (k, t, c, r) in options
        ]
    rec["explanation"] = explanation
    rec["manualReference"] = mref(anchor, excerpt)
    rec["scriptureReferences"] = scripture or []
    rec["difficulty"] = difficulty
    rec["tags"] = tags
    rec["sourceKind"] = "manual_derived"
    rec["answerConfidence"] = confidence
    if review:
        rec["reviewNotes"] = review
    rec["status"] = "published"
    QUESTIONS.append(rec)
    return rec


def theory(anchor, excerpt, question, marks, ideal, keypoints, rubric, explanation,
           difficulty, tags, scripture=None, confidence="verified"):
    _tc[0] += 1
    chT, tpT = _base(anchor)
    rec = {
        "questionId": "CS-T-%04d" % _tc[0],
        "examStage": "PART2",
        "subject": "CS",
        "chapter": chT,
        "topic": tpT,
        "questionType": "theory",
        "question": question,
        "marks": marks,
        "idealAnswer": ideal,
        "keyPoints": keypoints,
        "markingRubric": [
            {"id": "c%d" % (i + 1), "label": lab, "description": desc, "marks": m,
             "keywords": kw, "synonyms": syn, "required": req}
            for i, (lab, desc, m, kw, syn, req) in enumerate(rubric)
        ],
        "explanation": explanation,
        "manualReference": mref(anchor, excerpt),
        "scriptureReferences": scripture or [],
        "difficulty": difficulty,
        "tags": tags,
        "sourceKind": "manual_derived",
        "answerConfidence": confidence,
        "status": "published",
    }
    QUESTIONS.append(rec)
    return rec


def card(anchor, front, back, kind, tags, excerpt, scripture=None):
    _cc[0] += 1
    chT, tpT = _base(anchor)
    CARDS.append({
        "cardId": "CS-C-%04d" % _cc[0],
        "subject": "CS",
        "chapter": chT,
        "topic": tpT,
        "front": front,
        "back": back,
        "kind": kind,
        "scriptureReferences": scripture or [],
        "excerpt": repair(anchor, excerpt),
        "anchor": anchor,
        "tags": tags,
        "order": _cc[0],
    })


def mc(anchor, question, excerpt, explanation, difficulty, tags, opts, scripture=None,
       confidence="verified"):
    """opts: list of (text, isCorrect, rationale) in order A..D"""
    keys = "ABCDE"
    options = [(keys[i], t, c, r) for i, (t, c, r) in enumerate(opts)]
    return obj('multiple_choice', anchor, question, excerpt, explanation, difficulty, tags,
               options=options, scripture=scripture, confidence=confidence)


def mr(anchor, question, excerpt, explanation, difficulty, tags, opts, scripture=None):
    keys = "ABCDE"
    options = [(keys[i], t, c, r) for i, (t, c, r) in enumerate(opts)]
    return obj('multiple_response', anchor, question, excerpt, explanation, difficulty, tags,
               options=options, scripture=scripture)


def tf(anchor, statement, answer, excerpt, explanation, difficulty, tags, scripture=None):
    options = [("A", "True", answer is True, ""), ("B", "False", answer is False, "")]
    return obj('true_false', anchor, statement, excerpt, explanation, difficulty, tags,
               options=options, scripture=scripture)


def fb(anchor, question, accepted, excerpt, explanation, difficulty, tags, scripture=None):
    return obj('fill_blank', anchor, question, excerpt, explanation, difficulty, tags,
               accepted=accepted, scripture=scripture)
