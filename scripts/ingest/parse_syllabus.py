"""
Parse the official MCG 2026 CLPE Part 2 syllabus DOCX into a structured manual.

Output shape:
  subjects[] -> chapters[] -> topics[] -> blocks[]

Every block keeps `anchor` (the source paragraph index) so the application can
cite the manual precisely: Subject > Chapter > Topic, paragraph anchor.
Nothing is paraphrased here. Text is preserved verbatim from the DOCX.
"""
import json
import re
import sys
from pathlib import Path

import docx

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/src/syllabus.docx"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/work/manual.json"

# Subject boundaries, expressed as the paragraph index (in the flattened
# non-empty-preserving list) at which each subject's body begins.
# Derived by locating the first heading of each paper in the source document.
SUBJECT_SPECS = [
    {
        "code": "OT",
        "name": "Old Testament Studies",
        "shortName": "Old Testament",
        "paper": "Old Testament Studies Part Two",
        "description": "Prophets and Prophecy in Israel: the prophetic institution, Deuteronomy and the Former Prophets, ninth-century prophetism, the Book of Amos and the Book of Malachi.",
        "startMarker": "OBJECTIVE",
        "order": 1,
    },
    {
        "code": "NT",
        "name": "New Testament Studies",
        "shortName": "New Testament",
        "paper": "New Testament Studies Part Two",
        "description": "The Gospel according to Mark, the Acts of the Apostles, Galatians, 1 Timothy and 2 Timothy.",
        "startMarker": "UNIT ONE: THE GOSPEL ACCORDING TO MARK",
        "order": 2,
    },
    {
        "code": "DOC",
        "name": "Christian Doctrine",
        "shortName": "Doctrine",
        "paper": "Doctrine Part Two",
        "description": "The Doctrine of Christ, the Holy Spirit, the Trinity, the Affirmation of Faith (the Creeds) and the Doctrine of the Last Things.",
        "startMarker": "I.   THE DOCTRINE OF CHRIST",
        "order": 3,
    },
    {
        "code": "LIT",
        "name": "Liturgics",
        "shortName": "Liturgics",
        "paper": "Liturgics Part Two",
        "description": "The Liturgy of the Word, the Methodist Sunday morning order of service, sermon preparation and delivery, selection of hymns, prayer, the Christian calendar and the relevance of culture to worship.",
        "startMarker": "I.  GENERAL INTRODUCTION TO THE LITURGY OF THE WORD",
        "order": 4,
    },
    {
        "code": "MS",
        "name": "Methodist Studies",
        "shortName": "Methodist Studies",
        "paper": "Methodist Studies Part Two",
        "description": "Key doctrinal teachings of John Wesley, Charles Wesley and Methodist hymnology, Wesley's social ethics, the controversies, and episcopal leadership in Ghana Methodism.",
        "startMarker": "UNIT ONE: KEY DOCTRINAL TEACHINGS OF JOHN WESLEY",
        "order": 5,
    },
    {
        "code": "CS",
        "name": "Church and Society",
        "shortName": "Church & Society",
        "paper": "Church and Society Part Two",
        "description": "The church and society, human rights, politics, conflict management, religious pluralism, divorce and remarriage, marriage and the biblical view of sexuality.",
        "startMarker": "I.   THE CHURCH AND THE SOCIETY",
        "order": 6,
    },
]

ROMAN = r"(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)"
RE_CHAPTER_ROMAN = re.compile(rf"^({ROMAN})\.\s*[\t ]*(.+)$")
RE_CHAPTER_UNIT = re.compile(r"^(UNIT\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN))\s*[:\-]\s*(.+)$", re.I)
RE_TOPIC_NUM = re.compile(r"^(\d{1,2}\.\d{1,2})\s*[\t ]+(\S.*)$")
RE_TOPIC_BIBLECH = re.compile(r"^CHAPTER\s*(\d{1,2})(?::[\d\-,\s]+)?$", re.I)
RE_APPENDIX = re.compile(r"^(APPENDIX|REFERENCES|BIBLIOGRAPHY)\b", re.I)
RE_SCRIPTURE = re.compile(
    r"\b("
    r"Gen(?:esis)?|Ex(?:od(?:us)?)?|Lev(?:iticus)?|Num(?:bers)?|Deut(?:eronomy)?|"
    r"Josh(?:ua)?|Judg(?:es)?|Ruth|1\s?Sam(?:uel)?|2\s?Sam(?:uel)?|1\s?Kings|2\s?Kings|"
    r"1\s?Chron(?:icles)?|2\s?Chron(?:icles)?|Ezra|Neh(?:emiah)?|Esther|Job|Ps(?:alms?|a)?|"
    r"Prov(?:erbs)?|Eccl(?:esiastes)?|Song of Songs|Song of Solomon|Isa(?:iah)?|Jer(?:emiah)?|"
    r"Lam(?:entations)?|Ezek(?:iel)?|Dan(?:iel)?|Hos(?:ea)?|Joel|Amos|Obad(?:iah)?|Jonah|"
    r"Mic(?:ah)?|Nah(?:um)?|Hab(?:akkuk)?|Zeph(?:aniah)?|Hag(?:gai)?|Zech(?:ariah)?|Mal(?:achi)?|"
    r"Matt(?:hew)?|Mk|Mark|Lk|Luke|Jn|John|Acts|Rom(?:ans)?|1\s?Cor(?:inthians)?|2\s?Cor(?:inthians)?|"
    r"Gal(?:atians)?|Eph(?:esians)?|Phil(?:ippians)?|Col(?:ossians)?|1\s?Thess(?:alonians)?|"
    r"2\s?Thess(?:alonians)?|1\s?Tim(?:othy)?|2\s?Tim(?:othy)?|Titus|Philem(?:on)?|Heb(?:rews)?|"
    r"Jas|James|1\s?Pet(?:er)?|2\s?Pet(?:er)?|1\s?Jn|1\s?John|2\s?Jn|2\s?John|3\s?Jn|3\s?John|"
    r"Jude|Rev(?:elation)?"
    r")\.?\s+(\d{1,3})(?::\s?(\d{1,3}(?:\s?[-–,]\s?\d{1,3})*))?\b"
)

BOOK_CANON = {
    "gen": "Genesis", "genesis": "Genesis", "ex": "Exodus", "exod": "Exodus", "exodus": "Exodus",
    "lev": "Leviticus", "leviticus": "Leviticus", "num": "Numbers", "numbers": "Numbers",
    "deut": "Deuteronomy", "deuteronomy": "Deuteronomy", "josh": "Joshua", "joshua": "Joshua",
    "judg": "Judges", "judges": "Judges", "ruth": "Ruth",
    "1sam": "1 Samuel", "1samuel": "1 Samuel", "2sam": "2 Samuel", "2samuel": "2 Samuel",
    "1kings": "1 Kings", "2kings": "2 Kings", "1chron": "1 Chronicles", "1chronicles": "1 Chronicles",
    "2chron": "2 Chronicles", "2chronicles": "2 Chronicles", "ezra": "Ezra",
    "neh": "Nehemiah", "nehemiah": "Nehemiah", "esther": "Esther", "job": "Job",
    "ps": "Psalms", "psa": "Psalms", "psalm": "Psalms", "psalms": "Psalms",
    "prov": "Proverbs", "proverbs": "Proverbs", "eccl": "Ecclesiastes", "ecclesiastes": "Ecclesiastes",
    "songofsongs": "Song of Songs", "songofsolomon": "Song of Songs",
    "isa": "Isaiah", "isaiah": "Isaiah", "jer": "Jeremiah", "jeremiah": "Jeremiah",
    "lam": "Lamentations", "lamentations": "Lamentations", "ezek": "Ezekiel", "ezekiel": "Ezekiel",
    "dan": "Daniel", "daniel": "Daniel", "hos": "Hosea", "hosea": "Hosea", "joel": "Joel",
    "amos": "Amos", "obad": "Obadiah", "obadiah": "Obadiah", "jonah": "Jonah",
    "mic": "Micah", "micah": "Micah", "nah": "Nahum", "nahum": "Nahum",
    "hab": "Habakkuk", "habakkuk": "Habakkuk", "zeph": "Zephaniah", "zephaniah": "Zephaniah",
    "hag": "Haggai", "haggai": "Haggai", "zech": "Zechariah", "zechariah": "Zechariah",
    "mal": "Malachi", "malachi": "Malachi",
    "matt": "Matthew", "matthew": "Matthew", "mk": "Mark", "mark": "Mark",
    "lk": "Luke", "luke": "Luke", "jn": "John", "john": "John", "acts": "Acts",
    "rom": "Romans", "romans": "Romans",
    "1cor": "1 Corinthians", "1corinthians": "1 Corinthians",
    "2cor": "2 Corinthians", "2corinthians": "2 Corinthians",
    "gal": "Galatians", "galatians": "Galatians", "eph": "Ephesians", "ephesians": "Ephesians",
    "phil": "Philippians", "philippians": "Philippians", "col": "Colossians", "colossians": "Colossians",
    "1thess": "1 Thessalonians", "1thessalonians": "1 Thessalonians",
    "2thess": "2 Thessalonians", "2thessalonians": "2 Thessalonians",
    "1tim": "1 Timothy", "1timothy": "1 Timothy", "2tim": "2 Timothy", "2timothy": "2 Timothy",
    "titus": "Titus", "philem": "Philemon", "philemon": "Philemon",
    "heb": "Hebrews", "hebrews": "Hebrews", "jas": "James", "james": "James",
    "1pet": "1 Peter", "1peter": "1 Peter", "2pet": "2 Peter", "2peter": "2 Peter",
    "1jn": "1 John", "1john": "1 John", "2jn": "2 John", "2john": "2 John",
    "3jn": "3 John", "3john": "3 John", "jude": "Jude",
    "rev": "Revelation", "revelation": "Revelation",
}


def slugify(text, maxlen=70):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:maxlen].strip("-")


def normalise(text):
    return text.replace(" ", " ").replace("’", "'").replace("“", '"').replace("”", '"').strip()


def extract_scriptures(text):
    found = []
    seen = set()
    for m in RE_SCRIPTURE.finditer(text):
        raw_book = re.sub(r"[\s.]", "", m.group(1)).lower()
        book = BOOK_CANON.get(raw_book)
        if not book:
            continue
        chapter = m.group(2)
        verses = m.group(3)
        ref = f"{book} {chapter}" + (f":{verses.replace(' ', '')}" if verses else "")
        if ref in seen:
            continue
        seen.add(ref)
        found.append({"book": book, "chapter": int(chapter), "verses": verses.replace(" ", "") if verses else None, "reference": ref})
    return found


def load_paragraphs(path):
    doc = docx.Document(path)
    out = []
    for idx, p in enumerate(doc.paragraphs):
        text = normalise(p.text)
        bold = any(r.bold for r in p.runs if r.bold is not None) if p.runs else False
        out.append({"index": idx, "text": text, "style": p.style.name, "bold": bold})
    return out


def find_subject_bounds(paras):
    bounds = []
    for spec in SUBJECT_SPECS:
        marker = spec["startMarker"]
        hit = None
        for p in paras:
            if p["index"] <= (bounds[-1]["start"] if bounds else -1):
                continue
            if p["text"].upper().replace("  ", " ").startswith(marker.upper().replace("  ", " ")[:40]):
                hit = p["index"]
                break
        if hit is None:
            raise SystemExit(f"Could not locate start of subject {spec['code']} (marker: {marker!r})")
        bounds.append({**spec, "start": hit})
    for i, b in enumerate(bounds):
        b["end"] = bounds[i + 1]["start"] if i + 1 < len(bounds) else len(paras)
    return bounds


def classify(text):
    """Return (kind, number, title) for a heading line, else None."""
    if RE_APPENDIX.match(text):
        return ("appendix", None, text)
    m = RE_CHAPTER_UNIT.match(text)
    if m:
        return ("chapter", m.group(1).upper(), normalise(m.group(2)))
    m = RE_CHAPTER_ROMAN.match(text)
    if m and len(text) < 120:
        title = normalise(m.group(2))
        # Guard against "V. 12: ..." verse annotations and list items like "i. ..."
        if re.match(r"^\d", title) or not title:
            return None
        if title[:1].islower():
            return None
        return ("chapter", m.group(1), title)
    m = RE_TOPIC_NUM.match(text)
    if m and len(text) < 160:
        return ("topic", m.group(1), normalise(m.group(2)))
    m = RE_TOPIC_BIBLECH.match(text)
    if m:
        return ("topic", f"ch{m.group(1)}", f"Chapter {m.group(1)}")
    if text.isupper() and 3 < len(text) < 80 and not text.startswith("V."):
        return ("topic", None, normalise(text.title()))
    return None


def build():
    paras = load_paragraphs(SRC)
    bounds = find_subject_bounds(paras)
    subjects = []

    for spec in bounds:
        window = [p for p in paras if spec["start"] <= p["index"] < spec["end"]]
        subject = {
            "code": spec["code"],
            "slug": slugify(spec["name"]),
            "name": spec["name"],
            "shortName": spec["shortName"],
            "paper": spec["paper"],
            "description": spec["description"],
            "order": spec["order"],
            "sourceRange": [spec["start"], spec["end"]],
            "chapters": [],
        }

        current_chapter = None
        current_topic = None
        in_appendix = False

        def new_chapter(number, title, anchor):
            nonlocal current_chapter, current_topic
            current_chapter = {
                "number": number,
                "title": title,
                "slug": slugify(f"{spec['code']}-{number or ''}-{title}"),
                "anchor": anchor,
                "order": len(subject["chapters"]) + 1,
                "topics": [],
            }
            subject["chapters"].append(current_chapter)
            current_topic = None

        def new_topic(number, title, anchor):
            nonlocal current_topic
            if current_chapter is None:
                new_chapter(None, spec["shortName"], anchor)
            current_topic = {
                "number": number,
                "title": title,
                "slug": slugify(f"{spec['code']}-{current_chapter['number'] or ''}-{number or ''}-{title}"),
                "anchor": anchor,
                "order": len(current_chapter["topics"]) + 1,
                "blocks": [],
            }
            current_chapter["topics"].append(current_topic)

        for p in window:
            text = p["text"]
            if not text:
                continue
            info = classify(text)
            if info:
                kind, number, title = info
                if kind == "appendix":
                    in_appendix = True
                    new_chapter(None, title.title(), p["index"])
                    new_topic(None, title.title(), p["index"])
                    continue
                if kind == "chapter":
                    in_appendix = False
                    new_chapter(number, title, p["index"])
                    continue
                if kind == "topic":
                    new_topic(number, title, p["index"])
                    continue
            if current_topic is None:
                if current_chapter is None:
                    new_chapter(None, spec["shortName"], p["index"])
                new_topic(None, "Introduction", p["index"])
            current_topic["blocks"].append({"anchor": p["index"], "text": text})

        # Enrich topics
        for ch in subject["chapters"]:
            for tp in ch["topics"]:
                body = "\n\n".join(b["text"] for b in tp["blocks"])
                tp["wordCount"] = len(body.split())
                tp["scriptureReferences"] = extract_scriptures(body)
                tp["reference"] = {
                    "subject": subject["name"],
                    "chapter": f"{ch['number'] + '. ' if ch['number'] else ''}{ch['title']}".strip(),
                    "topic": f"{tp['number'] + ' ' if tp['number'] else ''}{tp['title']}".strip(),
                    "anchor": tp["anchor"],
                    "citation": f"{subject['name']} — {ch['title']} — {tp['title']} (syllabus ¶{tp['anchor']})",
                }
            ch["topics"] = [t for t in ch["topics"] if t["wordCount"] > 0 or len(ch["topics"]) == 1]
        subject["chapters"] = [c for c in subject["chapters"] if c["topics"]]
        subject["wordCount"] = sum(t["wordCount"] for c in subject["chapters"] for t in c["topics"])
        subjects.append(subject)

    manual = {
        "examStage": "PART2",
        "title": "MCG 2026 Connexional Lay Preachers' Examination — Part Two Syllabus",
        "source": {
            "file": Path(SRC).name,
            "publisher": "The Methodist Church Ghana — Lay Ministries Directorate",
            "kind": "OFFICIAL",
        },
        "subjects": subjects,
    }
    Path(OUT).write_text(json.dumps(manual, indent=1, ensure_ascii=False))

    print(f"Subjects: {len(subjects)}")
    for s in subjects:
        topics = sum(len(c["topics"]) for c in s["chapters"])
        scr = sum(len(t["scriptureReferences"]) for c in s["chapters"] for t in c["topics"])
        print(f"  {s['code']:4} {s['name']:28} chapters={len(s['chapters']):3} topics={topics:4} words={s['wordCount']:6} scripture={scr:4}")
    print("Wrote", OUT)


if __name__ == "__main__":
    build()
