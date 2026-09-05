import json, os
import lib
import ch01_02, ch03_04, ch05_07, ch08_09
import theory_a, theory_b, theory_c, theory_d
import cards_a, cards_b, cards_c

# Trim flashcards to proportional coverage; drop those that duplicate an
# objective question testing exactly the same fact in the same way.
DROP = {4794, 4797, 4806,            # ch II
        4952, 4988,                  # ch IV
        5043, 5067,                  # ch V
        5092, 5099, 5104, 5111, 5137,  # ch VI
        5207, 5209, 5215, 5227, 5237,  # ch VIII
        5286}                        # ch IX

cards = [c for c in lib.CARDS if c['anchor'] not in DROP]
for i, c in enumerate(cards, 1):
    c['cardId'] = "CS-C-%04d" % i
    c['order'] = i

qs = lib.QUESTIONS
objs = [q for q in qs if q['questionType'] != 'theory']
theos = [q for q in qs if q['questionType'] == 'theory']
questions = objs + theos

OUT = '/home/claude/mlpp/data/part2/gen'
os.makedirs(OUT, exist_ok=True)
json.dump(questions, open(os.path.join(OUT, 'questions.CS.json'), 'w'),
          indent=2, ensure_ascii=False)
json.dump(cards, open(os.path.join(OUT, 'flashcards.CS.json'), 'w'),
          indent=2, ensure_ascii=False)

print('objective:', len(objs), 'theory:', len(theos), 'cards:', len(cards))
