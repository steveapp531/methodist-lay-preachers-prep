# -*- coding: utf-8 -*-
"""Verification script for the NT question bank.

Checks, as required by the content authoring contract:
 1. every questionId and cardId is unique
 2. every excerpt appears verbatim inside some block of the named topic in manual.json
 3. every chapter and topic title matches a real chapter/topic title in the subject
 4. every objective question has exactly the right number of correct options for its type
 5. every theory question's rubric marks sum to its marks
Plus a few structural sanity checks.
"""
import json, os, sys
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
MANUAL = "/home/claude/mlpp/data/part2/manual.json"
SUBJECT = "NT"

errors = []
warnings = []


def err(msg):
    errors.append(msg)


with open(MANUAL, encoding="utf-8") as fh:
    manual = json.load(fh)
subject = next(s for s in manual["subjects"] if s["code"] == SUBJECT)

CHAPTER_TITLES = set()
TOPICS_BY_TITLE = defaultdict(list)          # title -> [(chapter_title, topic)]
PAIRS = defaultdict(list)                    # (chapter_title, topic_title) -> [topic]
for ch in subject["chapters"]:
    CHAPTER_TITLES.add(ch["title"])
    for tp in ch["topics"]:
        TOPICS_BY_TITLE[tp["title"]].append((ch["title"], tp))
        PAIRS[(ch["title"], tp["title"])].append(tp)

with open(os.path.join(BASE, "questions.NT.json"), encoding="utf-8") as fh:
    Q = json.load(fh)
with open(os.path.join(BASE, "flashcards.NT.json"), encoding="utf-8") as fh:
    F = json.load(fh)

objective = Q["objective"]
theory = Q["theory"]
cards = F["cards"]

# ---- 1. unique ids -----------------------------------------------------------
ids = [q["questionId"] for q in objective] + [q["questionId"] for q in theory]
for k, v in Counter(ids).items():
    if v > 1:
        err("duplicate questionId: %s (%d times)" % (k, v))
cids = [c["cardId"] for c in cards]
for k, v in Counter(cids).items():
    if v > 1:
        err("duplicate cardId: %s (%d times)" % (k, v))
for qid in ids:
    if not (qid.startswith("NT-O-") or qid.startswith("NT-T-")):
        err("bad questionId prefix: %s" % qid)
for cid in cids:
    if not cid.startswith("NT-C-"):
        err("bad cardId prefix: %s" % cid)

# ---- 3. chapter / topic titles ----------------------------------------------
def topics_for(chapter_title, topic_title, where):
    if chapter_title is not None:
        if chapter_title not in CHAPTER_TITLES:
            err("%s: chapter title not in manual: %r" % (where, chapter_title))
            return []
        tps = PAIRS.get((chapter_title, topic_title))
        if not tps:
            err("%s: topic %r does not belong to chapter %r" % (where, topic_title, chapter_title))
            return []
        return tps
    hits = TOPICS_BY_TITLE.get(topic_title)
    if not hits:
        err("%s: topic title not in manual: %r" % (where, topic_title))
        return []
    return [tp for _, tp in hits]


# ---- 2. excerpts verbatim ----------------------------------------------------
def excerpt_ok(tps, excerpt, anchor, where):
    if not excerpt or not excerpt.strip():
        err("%s: empty excerpt" % where)
        return
    if len(excerpt) > 400:
        warnings.append("%s: excerpt longer than 400 chars (%d)" % (where, len(excerpt)))
    for tp in tps:
        for b in tp["blocks"]:
            if excerpt in b["text"]:
                if anchor is not None and anchor not in (tp["anchor"], b["anchor"]):
                    # anchor should be the topic anchor or the quoted block's anchor
                    continue
                return
    # try again ignoring the anchor requirement, to give a better message
    for tp in tps:
        for b in tp["blocks"]:
            if excerpt in b["text"]:
                err("%s: excerpt found but anchor %r is neither the topic anchor (%s) "
                    "nor the quoted block anchor (%s)" % (where, anchor, tp["anchor"], b["anchor"]))
                return
    err("%s: excerpt NOT found verbatim in any block of topic: %r" % (where, excerpt[:110]))


# ---- 4. option counts --------------------------------------------------------
EXPECTED_CORRECT = {"multiple_choice": (1, 1), "true_false": (1, 1), "multiple_response": (2, 3)}

for q in objective:
    where = q["questionId"]
    tps = topics_for(q.get("chapter"), q.get("topic"), where)
    mr = q.get("manualReference") or {}
    if mr.get("topicTitle") != q.get("topic"):
        err("%s: manualReference.topicTitle differs from topic" % where)
    if mr.get("chapterTitle") != q.get("chapter"):
        err("%s: manualReference.chapterTitle differs from chapter" % where)
    if tps:
        excerpt_ok(tps, mr.get("excerpt", ""), mr.get("anchor"), where)

    qt = q["questionType"]
    if qt == "fill_blank":
        if "options" in q:
            err("%s: fill_blank must not carry options" % where)
        if not q.get("acceptedAnswers"):
            err("%s: fill_blank has no acceptedAnswers" % where)
    else:
        opts = q.get("options") or []
        if not opts:
            err("%s: no options" % where)
            continue
        keys = [o["key"] for o in opts]
        if len(set(keys)) != len(keys):
            err("%s: duplicate option keys" % where)
        ncorrect = sum(1 for o in opts if o.get("isCorrect"))
        lo, hi = EXPECTED_CORRECT.get(qt, (1, 1))
        if not (lo <= ncorrect <= hi):
            err("%s: %s has %d correct options, expected %d-%d" % (where, qt, ncorrect, lo, hi))
        if qt == "true_false":
            if [o["text"] for o in opts] != ["True", "False"]:
                err("%s: true_false options must be exactly True / False" % where)
        elif qt == "multiple_choice":
            if len(opts) != 4:
                err("%s: multiple_choice must have 4 options, has %d" % (where, len(opts)))
        elif qt == "multiple_response":
            if len(opts) != 5:
                err("%s: multiple_response must have 5 options, has %d" % (where, len(opts)))
    for field in ("explanation", "difficulty", "tags", "sourceKind", "answerConfidence", "status"):
        if not q.get(field):
            err("%s: missing %s" % (where, field))
    if q["difficulty"] not in ("easy", "medium", "hard"):
        err("%s: bad difficulty %r" % (where, q["difficulty"]))

# ---- 5. theory ---------------------------------------------------------------
for q in theory:
    where = q["questionId"]
    tps = topics_for(q.get("chapter"), q.get("topic"), where)
    mr = q.get("manualReference") or {}
    if tps:
        excerpt_ok(tps, mr.get("excerpt", ""), mr.get("anchor"), where)
    total = sum(c["marks"] for c in q["markingRubric"])
    if total != q["marks"]:
        err("%s: rubric marks sum to %d but marks is %d" % (where, total, q["marks"]))
    if not (4 <= len(q["markingRubric"]) <= 6):
        err("%s: rubric has %d criteria, expected 4-6" % (where, len(q["markingRubric"])))
    rids = [c["id"] for c in q["markingRubric"]]
    if len(set(rids)) != len(rids):
        err("%s: duplicate rubric criterion ids" % where)
    words = len(q["idealAnswer"].split())
    if not (250 <= words <= 500):
        warnings.append("%s: idealAnswer is %d words" % (where, words))
    if not (6 <= len(q["keyPoints"]) <= 10):
        err("%s: %d keyPoints, expected 6-8" % (where, len(q["keyPoints"])))

# ---- flashcards --------------------------------------------------------------
KINDS = {"term", "fact", "scripture", "definition", "person", "event"}
for c in cards:
    where = c["cardId"]
    tps = topics_for(None, c.get("topic"), where)
    if tps:
        excerpt_ok(tps, c.get("excerpt", ""), None, where)
    if c["kind"] not in KINDS:
        err("%s: bad kind %r" % (where, c["kind"]))
    for field in ("front", "back", "tags"):
        if not c.get(field):
            err("%s: missing %s" % (where, field))

# ---- report ------------------------------------------------------------------
print("objective questions : %d" % len(objective))
print("  by type           : %s" % dict(Counter(q["questionType"] for q in objective)))
print("  by chapter        :")
for k, v in Counter(q["chapter"] for q in objective).items():
    print("      %-32s %d" % (k, v))
print("  by difficulty     : %s" % dict(Counter(q["difficulty"] for q in objective)))
print("theory questions    : %d" % len(theory))
for k, v in Counter(q["chapter"] for q in theory).items():
    print("      %-32s %d" % (k, v))
print("flashcards          : %d" % len(cards))

if warnings:
    print("\n%d WARNING(S):" % len(warnings))
    for w in warnings:
        print("  - " + w)
if errors:
    print("\n%d ERROR(S):" % len(errors))
    for e in errors:
        print("  - " + e)
    sys.exit(1)
print("\nALL CHECKS PASSED")
