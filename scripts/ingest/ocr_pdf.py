import sys, os, subprocess
from pdf2image import convert_from_path
import pytesseract
src, out = sys.argv[1], sys.argv[2]
pages = convert_from_path(src, dpi=300)
texts = []
for i, img in enumerate(pages, 1):
    t = pytesseract.image_to_string(img, lang='eng', config='--psm 6')
    texts.append(f"\n\n===== PAGE {i} =====\n{t}")
    print(f"page {i}/{len(pages)} done", flush=True)
open(out, 'w').write("".join(texts))
print("WROTE", out)
