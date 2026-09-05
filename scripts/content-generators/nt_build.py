# -*- coding: utf-8 -*-
"""Build questions.NT.json and flashcards.NT.json from the data modules."""
import json, sys, os

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

from nt_data_mark import MARK
from nt_data_acts import ACTS
from nt_data_rest import REST
from nt_data_theory import THEORY
from nt_data_cards import CARDS

SUBJECT = "NT"
SUBJECT_NAME = "New Testament Studies"
MANUAL = "/home/claude/mlpp/data/part2/manual.json"

# Mark questions kept, so that the unit's share stays proportional to its size
KEEP_MARK = {
    "NT-O-0001", "NT-O-0004", "NT-O-0005", "NT-O-0008", "NT-O-0009", "NT-O-0013",
    "NT-O-0015", "NT-O-0016", "NT-O-0017", "NT-O-0019", "NT-O-0020", "NT-O-0022",
    "NT-O-0023", "NT-O-0025", "NT-O-0026", "NT-O-0029", "NT-O-0030", "NT-O-0032",
    "NT-O-0034", "NT-O-0035", "NT-O-0037", "NT-O-0038", "NT-O-0039", "NT-O-0040",
    "NT-O-0041", "NT-O-0042", "NT-O-0044", "NT-O-0045", "NT-O-0047", "NT-O-0048",
    "NT-O-0050", "NT-O-0051", "NT-O-0052", "NT-O-0054", "NT-O-0055", "NT-O-0057",
    "NT-O-0058", "NT-O-0059", "NT-O-0060", "NT-O-0062", "NT-O-0064", "NT-O-0066",
    "NT-O-0067", "NT-O-0068",
}

# ---------------------------------------------------------------- manual index
with open(MANUAL, encoding="utf-8") as fh:
    manual = json.load(fh)

subject = next(s for s in manual["subjects"] if s["code"] == SUBJECT)

TOPIC_BY_ANCHOR = {}
for ch in subject["chapters"]:
    for tp in ch["topics"]:
        TOPIC_BY_ANCHOR[tp["anchor"]] = (ch, tp)


def norm_find(block_text, wanted):
    """Return the exact substring of block_text matching `wanted` up to whitespace."""
    norm, idx, prev_space = [], [], True
    for i, chx in enumerate(block_text):
        if chx.isspace():
            if not prev_space:
                norm.append(" ")
                idx.append(i)
            prev_space = True
        else:
            norm.append(chx)
            idx.append(i)
            prev_space = False
    n = "".join(norm)
    w = " ".join(wanted.split())
    p = n.find(w)
    if p < 0:
        return None
    return block_text[idx[p]: idx[p + len(w) - 1] + 1]


def resolve(topic_anchor, block_anchor, excerpt):
    ch, tp = TOPIC_BY_ANCHOR[topic_anchor]
    block = next((b for b in tp["blocks"] if b["anchor"] == block_anchor), None)
    if block is None:
        raise SystemExit("no block %s in topic %s" % (block_anchor, tp["title"]))
    exact = norm_find(block["text"], excerpt)
    if exact is None:
        raise SystemExit("EXCERPT NOT FOUND\n topic=%s block=%s\n wanted=%r\n block=%r"
                         % (tp["title"], block_anchor, excerpt, block["text"][:600]))
    return ch, tp, exact


def manual_ref(ch, tp, block_anchor, excerpt):
    return {
        "topicTitle": tp["title"],
        "chapterTitle": ch["title"],
        "anchor": block_anchor,
        "excerpt": excerpt,
        "citation": "%s — %s — %s" % (SUBJECT_NAME, ch["title"], tp["title"]),
    }


# ---------------------------------------------------------------- objective
objective = []
onum = 0
for item in MARK + ACTS + REST:
    if item["id"].startswith("NT-O-") and item["id"] not in KEEP_MARK:
        continue
    onum += 1
    qid = "NT-O-%04d" % onum
    ch, tp, exact = resolve(item["t"], item["b"], item["exc"])
    rec = {
        "questionId": qid,
        "examStage": "PART2",
        "subject": SUBJECT,
        "chapter": ch["title"],
        "topic": tp["title"],
        "questionType": item["kind"],
        "question": item["q"],
    }
    if item["kind"] == "true_false":
        rec["options"] = [
            {"key": "A", "text": "True", "isCorrect": bool(item["ans"]), "rationale": ""},
            {"key": "B", "text": "False", "isCorrect": not bool(item["ans"]), "rationale": ""},
        ]
    elif item["kind"] == "fill_blank":
        rec["acceptedAnswers"] = item["acc"]
    else:
        rec["options"] = [
            {"key": "ABCDE"[i], "text": t, "isCorrect": c, "rationale": r}
            for i, (t, c, r) in enumerate(item["opts"])
        ]
    rec["explanation"] = item["expl"]
    rec["manualReference"] = manual_ref(ch, tp, item["b"], exact)
    rec["scriptureReferences"] = item.get("scr", [])
    rec["difficulty"] = item["diff"]
    rec["tags"] = item["tags"]
    rec["sourceKind"] = "manual_derived"
    rec["answerConfidence"] = "verified"
    rec["status"] = "published"
    objective.append(rec)

# ---------------------------------------------------------------- theory
theory = []
for i, item in enumerate(THEORY, start=1):
    qid = "NT-T-%04d" % i
    ch, tp, exact = resolve(item["t"], item["b"], item["exc"])
    rubric = []
    for c in item["rubric"]:
        rubric.append({
            "id": c["id"],
            "label": c["label"],
            "description": c["description"],
            "marks": c["marks"],
            "keywords": c["keywords"],
            "synonyms": c["syn"],
            "required": c["required"],
        })
    theory.append({
        "questionId": qid,
        "examStage": "PART2",
        "subject": SUBJECT,
        "chapter": ch["title"],
        "topic": tp["title"],
        "questionType": "theory",
        "question": item["q"],
        "marks": item["marks"],
        "idealAnswer": item["ideal"],
        "keyPoints": item["keypoints"],
        "markingRubric": rubric,
        "explanation": item["expl"],
        "manualReference": manual_ref(ch, tp, item["b"], exact),
        "scriptureReferences": item.get("scr", []),
        "difficulty": item["diff"],
        "tags": item["tags"],
        "sourceKind": "manual_derived",
        "answerConfidence": "verified",
        "status": "published",
    })

# ---------------------------------------------------------------- flashcards
cards = []
for i, item in enumerate(CARDS, start=1):
    ch, tp, exact = resolve(item["t"], item["b"], item["exc"])
    cards.append({
        "cardId": "NT-C-%04d" % i,
        "subject": SUBJECT,
        "topic": tp["title"],
        "front": item["front"],
        "back": item["back"],
        "kind": item["kind"],
        "scriptureReferences": item.get("scr", []),
        "excerpt": exact,
        "tags": item["tags"],
        "order": i,
    })

questions = {
    "examStage": "PART2",
    "subject": SUBJECT,
    "subjectName": SUBJECT_NAME,
    "objective": objective,
    "theory": theory,
}
flash = {
    "examStage": "PART2",
    "subject": SUBJECT,
    "subjectName": SUBJECT_NAME,
    "cards": cards,
}

with open(os.path.join(BASE, "questions.NT.json"), "w", encoding="utf-8") as fh:
    json.dump(questions, fh, ensure_ascii=False, indent=2)
with open(os.path.join(BASE, "flashcards.NT.json"), "w", encoding="utf-8") as fh:
    json.dump(flash, fh, ensure_ascii=False, indent=2)

from collections import Counter
print("objective:", len(objective), dict(Counter(q["questionType"] for q in objective)))
print("theory:", len(theory))
print("cards:", len(cards))
print("by chapter:", dict(Counter(q["chapter"] for q in objective)))
