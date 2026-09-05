"""Assemble the OT question bank and flashcard deck."""
import json
import os

import ot_obj_a as obj_a          # noqa: E402  (import order fixes the id sequence)
import ot_obj_b as obj_b          # noqa: E402
import ot_theory as theory         # noqa: E402
import ot_cards as cards          # noqa: E402

OUT = '/home/claude/mlpp/data/part2/gen'
os.makedirs(OUT, exist_ok=True)

questions = obj_a.Q + obj_b.Q + theory.T
flashcards = cards.C

with open(os.path.join(OUT, 'questions.OT.json'), 'w', encoding='utf-8') as fh:
    json.dump(questions, fh, ensure_ascii=False, indent=2)
    fh.write('\n')

with open(os.path.join(OUT, 'flashcards.OT.json'), 'w', encoding='utf-8') as fh:
    json.dump(flashcards, fh, ensure_ascii=False, indent=2)
    fh.write('\n')

print('questions.OT.json  :', len(questions))
print('flashcards.OT.json :', len(flashcards))
