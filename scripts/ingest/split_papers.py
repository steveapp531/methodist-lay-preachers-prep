"""
Column-aware extraction of the CLPE past-question PDFs.

pdftotext -layout interleaves two-column exam papers, which destroys question
order. This walks words with x/y coordinates, detects whether a page is one or
two columns from the horizontal gap histogram, and emits reading-order text.
Then it splits the stream into individual papers (subject + year).
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

SUBJECT_PATTERNS = [
    ("OT", re.compile(r"OLD\s+TESTAMENT", re.I)),
    ("NT", re.compile(r"NEW\s+TESTAMENT", re.I)),
    ("DOC", re.compile(r"\bDOCTRINE\b", re.I)),
    ("LIT", re.compile(r"LITURGIC", re.I)),
    ("MS", re.compile(r"METHODIST\s+STUDIES", re.I)),
    ("CS", re.compile(r"CHURCH\s*(?:AND|&)\s*SOCIETY", re.I)),
]
RE_YEAR = re.compile(r"\b(20[0-2]\d)\b")
RE_MONTH = re.compile(r"\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b", re.I)
RE_HEADER_HINT = re.compile(r"PART\s*(?:TWO|II|2)", re.I)
RE_FOOTER = re.compile(r"CLPE\s*[–\-]|Page\s+\d+\s+of\s+\d+|^\s*CamScanner\s*$", re.I)


def _group(ws):
    """Words -> lines, top-to-bottom, left-to-right."""
    rows = {}
    for w in ws:
        rows.setdefault(round(w["top"] / 4.0), []).append(w)
    out = []
    for key in sorted(rows):
        row = sorted(rows[key], key=lambda w: w["x0"])
        out.append(" ".join(w["text"] for w in row))
    return out


def _find_gutter(words, width):
    """
    Locate a real column gutter rather than assuming it sits at the page centre.
    Builds a 1pt occupancy histogram across x and returns the midpoint of the
    widest empty run lying in the middle half of the page.
    """
    if len(words) < 40:
        return None
    bins = int(width) + 1
    # Count *rows* covering each x rather than a binary mask: a single full-width
    # footer or rule would otherwise erase an obvious gutter.
    rows = {}
    for w in words:
        rows.setdefault(round(w["top"] / 4.0), []).append(w)
    counts = [0] * bins
    for row in rows.values():
        touched = set()
        for w in row:
            for x in range(max(0, int(w["x0"])), min(bins, int(w["x1"]) + 1)):
                touched.add(x)
        for x in touched:
            counts[x] += 1

    tolerance = max(1, int(len(rows) * 0.06))
    lo, hi = int(width * 0.33), int(width * 0.67)
    best = None
    run_start = None
    for x in range(lo, hi + 1):
        if counts[x] <= tolerance:
            if run_start is None:
                run_start = x
        else:
            if run_start is not None:
                run = (run_start, x - 1)
                if best is None or (run[1] - run[0]) > (best[1] - best[0]):
                    best = run
                run_start = None
    if run_start is not None:
        run = (run_start, hi)
        if best is None or (run[1] - run[0]) > (best[1] - best[0]):
            best = run
    if best is None or (best[1] - best[0]) < 8:
        return None

    split_at = (best[0] + best[1]) / 2
    left = sum(1 for w in words if w["x1"] <= split_at)
    right = sum(1 for w in words if w["x0"] >= split_at)
    if left < len(words) * 0.25 or right < len(words) * 0.25:
        return None
    return split_at


def page_lines(page):
    """
    Exam papers mix full-width headers with two-column question bodies. Testing
    the whole page for a gutter fails because the header always crosses it, so
    the header band is separated first and only the body is column-tested.
    """
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return []
    width, height = page.width, page.height
    mid = width / 2

    # Find where the full-width header block ends: the last row in the top 35%
    # of the page that spans the gutter.
    band_lo, band_hi = mid - width * 0.05, mid + width * 0.05
    header_bottom = 0.0
    for w in words:
        if w["top"] < height * 0.35 and w["x0"] < band_hi and w["x1"] > band_lo:
            header_bottom = max(header_bottom, w["bottom"])

    header = [w for w in words if w["bottom"] <= header_bottom]
    body = [w for w in words if w["bottom"] > header_bottom]

    lines = _group(header)
    gutter = _find_gutter(body, width)
    if gutter:
        lines += _group([w for w in body if w["x1"] <= gutter])
        lines += _group([w for w in body if w["x0"] > gutter])
    else:
        lines += _group(body)
    return lines


def extract(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            lines = [re.sub(r"\s+", " ", ln).strip() for ln in page_lines(page)]
            lines = [ln for ln in lines if ln and not RE_FOOTER.search(ln)]
            pages.append({"page": i, "lines": lines})
    return pages


def title_line(line):
    """If this single line is a paper title line, return (subjectCode, year, month)."""
    up = line.upper()
    if len(up) > 130 or not RE_HEADER_HINT.search(up):
        return None
    matches = [code for code, pat in SUBJECT_PATTERNS if pat.search(up)]
    if len(matches) != 1:
        return None
    year = RE_YEAR.search(up)
    month = RE_MONTH.search(up)
    return matches[0], (year.group(1) if year else None), (month.group(1).title() if month else None)


def split(pages):
    """Flatten to a line stream, then cut at each paper title line."""
    stream = []
    for pg in pages:
        for ln in pg["lines"]:
            stream.append((pg["page"], ln))

    cuts = []
    for i, (page, ln) in enumerate(stream):
        hit = title_line(ln)
        if hit:
            # Reject a title line that merely repeats within a paper body
            if cuts and i - cuts[-1][0] < 12:
                continue
            cuts.append((i, page, hit))

    papers = []
    for n, (i, page, (code, year, month)) in enumerate(cuts):
        end = cuts[n + 1][0] if n + 1 < len(cuts) else len(stream)
        # Look a few lines back for a year/sitting printed above the title
        context = " ".join(ln for _, ln in stream[max(0, i - 6):i + 6]).upper()
        if not year:
            m = RE_YEAR.search(context)
            year = m.group(1) if m else None
        if not month:
            m = RE_MONTH.search(context)
            month = m.group(1).title() if m else None
        papers.append({
            "subjectCode": code,
            "year": int(year) if year else None,
            "sitting": month,
            "startPage": page,
            "lines": [ln for _, ln in stream[i:end]],
        })
    return papers


def main():
    out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/work/papers")
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = extract(sys.argv[1])
    papers = split(pages)
    index = []
    for p in papers:
        name = f"{p['subjectCode']}-{p['year'] or 'unknown'}-{(p['sitting'] or 'na').lower()}-p{p['startPage']}"
        path = out_dir / f"{name}.txt"
        path.write_text("\n".join(p["lines"]))
        index.append({
            "file": path.name,
            "subjectCode": p["subjectCode"],
            "year": p["year"],
            "sitting": p["sitting"],
            "startPage": p["startPage"],
            "lineCount": len(p["lines"]),
        })
        print(f"{name:34} lines={len(p['lines']):4}")
    idx_path = out_dir / "index.json"
    existing = json.loads(idx_path.read_text()) if idx_path.exists() else []
    existing = [e for e in existing if e["file"] not in {i["file"] for i in index}]
    idx_path.write_text(json.dumps(existing + index, indent=1))
    print(f"\n{len(papers)} papers -> {out_dir}")


if __name__ == "__main__":
    main()
