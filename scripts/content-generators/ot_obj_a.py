"""Objective questions: Chapters I, II and III."""
from ot_common import mc, tf, fb, mr

Q = []

# ===================== CHAPTER I =====================================
# --- 1.0 INTRODUCTION ---
Q.append(mc(26,
    'The word used for the prophets of Baal is exactly the same as that for the prophets of Israel (Nabi).',
    'The Old Testament records that Baal also had prophets. What does the syllabus say about the word used for them?',
    [('It is exactly the same word as that used for the prophets of Israel, Nabi', ''),
     ('It is a Canaanite term for which Hebrew has no equivalent', 'The syllabus says the very same word is used of both.'),
     ('It is rõ’eh, a word reserved for seers', 'Rõ’eh is one of the three Hebrew words for a prophet, but it is not the word the syllabus points to here.'),
     ('It is a term of contempt invented by the writer of Kings', 'The syllabus makes no such claim; its point is that the phenomenon of prophecy was not confined to Israel.')],
    0,
    'The syllabus opens by insisting that prophecy was not confined to Israel: the Old Testament itself speaks of the prophets of Baal, and uses of them the same word, Nabi, that it uses of Israel’s prophets.',
    difficulty='medium', tags=['prophecy', 'ancient-near-east', 'baal'],
    scripture=['1 Kings 18']))

# --- 1.1 Who is a Prophet? ---
Q.append(mc(29,
    'In the Old Testament, three Hebrew words are normally used to designate the Prophets. These are Nāvi, rõ’eh and hõzeh.',
    'Which three Hebrew words are normally used in the Old Testament to designate the prophets?',
    [('Nāvi, rõ’eh and hõzeh', ''),
     ('Man of God, seer and soothsayer', 'These are among the various names given to prophets in the Old Testament, but they are not the three Hebrew designations.'),
     ('Rõ’eh, hõzeh and fortune-teller', 'Fortune-teller is listed among the various names given to prophets, not among the three Hebrew words.'),
     ('Nāvi, hevel and “sons of the prophets”', 'Hevel is the word for the bands of prophets, and “sons of the prophets” describes the companies attached to Elijah and Elisha.')],
    0,
    'The syllabus names Nāvi, rõ’eh and hõzeh as the three Hebrew words normally used to designate a prophet.',
    difficulty='easy', tags=['prophets', 'hebrew-terms']))

Q.append(tf(29,
    'Rõ’eh and hõzeh are properly rendered as "seer", and are practically synonymous in meaning.',
    'Rõ’eh and hõzeh are both properly rendered as “seer” and are practically synonymous in meaning.',
    True,
    'The syllabus states that rõ’eh and hõzeh are properly rendered “seer” and are practically synonymous, while Nāvi is the word that is difficult to explain etymologically.',
    difficulty='easy', tags=['prophets', 'hebrew-terms']))

Q.append(fb(31,
    'The use of these two words may refer to sight, but they usually refer to insight.',
    'Complete the statement from the syllabus: the use of the words rõ’eh and hõzeh may refer to sight, but they usually refer to ______.',
    ['insight', 'to insight'],
    'The seeing of the seer is not primarily physical sight; the syllabus says these words usually refer to insight into the mind of God.',
    difficulty='medium', tags=['prophets', 'hebrew-terms']))

Q.append(mc(33,
    'A prophet in the Old Testament then is a person who receives a message from God and utters the actual words that God has given to him, without any modification or interpretation on his part.',
    'According to the syllabus, how does an Old Testament prophet deliver the message he has received from God?',
    [('He utters the actual words God has given him, without any modification or interpretation on his part', ''),
     ('He interprets the message for his hearers before he utters it', 'The syllabus expressly excludes any interpretation on the prophet’s part.'),
     ('He may speak only after he has received a vision', 'The message sometimes came through a vision, but the syllabus says the insight may come “by vision or otherwise”.'),
     ('He speaks only in answer to what the people have come to enquire about', 'Giving oracles on request was one role of the prophets, but they also declared God’s will unasked.')],
    0,
    'Deuteronomy 18:18 is cited: “I will put my words in his mouth, and he will tell them everything I command him.” The prophet is a mouthpiece, not an editor.',
    difficulty='medium', tags=['prophets', 'definition'],
    scripture=['Deuteronomy 18:18']))

# --- 1.2 The Establishment of the Prophetic Institution ---
Q.append(mc(41,
    'This inadequacy was not due to any inherent weakness in the Law itself, but simply to the fact that the Law did not speak in detail on every possible situation that would arise in Israel’s life.',
    'Why, according to the syllabus, was the Law by itself not adequate for Israel’s life in the Promised Land?',
    [('Because the Law did not speak in detail on every possible situation that would arise in Israel’s life', ''),
     ('Because there was an inherent weakness in the Law itself', 'The syllabus expressly denies this: the inadequacy was not due to any inherent weakness in the Law.'),
     ('Because the Ten Commandments had been replaced by rules for particular situations', 'The Ten Commandments remained the basis of ethics and morality; the other laws simply covered particular situations.'),
     ('Because the Law had been lost during the settlement of Canaan', 'The syllabus says Israel entered Canaan with the Law as a precious possession.')],
    0,
    'Because the Law could not cover every situation, occasions would arise needing a specific revelation of God — and that revelation God gave through his servants the prophets.',
    difficulty='medium', tags=['prophetic-institution', 'law']))

Q.append(mc(45,
    'Just as the priests represented the people before God, so the prophets represented God to the people.',
    'How does the syllabus distinguish the mediating work of the priest from that of the prophet?',
    [('The priests represented the people before God; the prophets represented God to the people', ''),
     ('The priests represented God to the people; the prophets represented the people before God', 'This exactly reverses the syllabus’s statement.'),
     ('Both priests and prophets represented the people before God', 'The syllabus sets the two offices in contrast, not in parallel.'),
     ('Neither priest nor prophet acted as a mediator; only Moses did', 'The prophets were to be like Moses, serving as mediators between God and the nation.')],
    0,
    'The prophets whom the Lord would raise up were to be like Moses, a mediator between God and the nation, but the direction of their mediation is the reverse of the priest’s.',
    difficulty='medium', tags=['prophetic-institution', 'priesthood']))

Q.append(mc(50,
    'For this reason bands (hevel) of prophets were raised up. It is believed that Samuel was the founder of such groups.',
    'Who is believed to have been the founder of the bands (hevel) of prophets raised up after Israel settled in the Promised Land?',
    [('Samuel', ''),
     ('Moses', 'Moses is the pattern for the prophetic office, but the syllabus does not credit him with founding the bands.'),
     ('Elijah', 'Bands of prophets reappeared in Elijah’s day, but he was not their founder.'),
     ('Joshua', 'Joshua led the conquest and settlement; the bands arose later, in the days of the judges.')],
    0,
    'The bands were raised up when “everyone did as he saw fit”, and the syllabus attributes their founding to Samuel; after his death they seem to have disbanded.',
    difficulty='easy', tags=['prophetic-institution', 'samuel'],
    scripture=['Judges 21:25']))

Q.append(mc(50,
    'We do not hear of them until the times of Elijah and Elisha. During the days of these men, groups of prophets appeared again. During Elijah’s day these bands of prophets appeared only in the Northern Kingdom.',
    'In whose days did the bands of prophets reappear, and in which part of the divided kingdom did they appear?',
    [('In the days of Elijah and Elisha, and only in the Northern Kingdom', ''),
     ('In the days of Samuel, and only in the Southern Kingdom', 'Samuel founded the earlier groups, which had disbanded after his death.'),
     ('In the days of David, and only in Jerusalem', 'The syllabus places the reappearance in the divided kingdom, long after David.'),
     ('In the days of Jeroboam the son of Nebat, and only in Judah', 'Jeroboam’s rebellion divided the kingdom, but the bands are associated with Elijah and Elisha in the North.')],
    0,
    'Elijah and Elisha needed support against the Tyrian Baal and the calf worship at Dan and Bethel, and found it in the companies called “sons of the prophets”.',
    difficulty='medium', tags=['prophetic-institution', 'elijah', 'elisha']))

# --- 1.3 Forms of Prophets and Prophetic Groups in Israel ---
Q.append(mr(53,
    'broadly speaking the Old Testament prophecy falls into three main forms: The Company of Prophets, the Royal Cults or Court Prophets and Individual Prophets.',
    'Broadly speaking, Old Testament prophecy falls into three main forms. Select the three named by the syllabus.',
    [('The Company of Prophets', True, ''),
     ('The Royal Cults or Court Prophets', True, ''),
     ('Individual Prophets', True, ''),
     ('The Writing Prophets', False, 'The “writing prophets” is another name for the Latter Prophets in the Hebrew arrangement of the canon, not one of these three forms.'),
     ('The Priestly Prophets', False, 'The syllabus distinguishes the work of the priest from that of the prophet; it names no such group.')],
    'The syllabus groups the varied forms of Old Testament prophecy under three heads: the Company of Prophets, the Royal or Court Prophets, and Individual Prophets.',
    difficulty='easy', tags=['prophetic-groups', 'classification']))

Q.append(mc(58,
    'For example, Nathan, who gave advice to David and Solomon, was honest and straight.',
    'Which court prophet does the syllabus single out as honest and straight in the advice he gave to David and Solomon?',
    [('Nathan', ''),
     ('Micaiah', 'Micaiah stood alone against four hundred false prophets before Ahab and Jehoshaphat; he did not advise David and Solomon.'),
     ('Jeremiah', 'Jeremiah condemned the royal prophets, but he is classed among the individual prophets.'),
     ('Samuel', 'Samuel appears as a leader of the company of prophets and as king maker, not as a court prophet to David and Solomon.')],
    0,
    'The court prophets had special responsibility for guiding the king; Nathan is the syllabus’s example of one who did so honestly, in contrast to those who told kings what they wanted to hear.',
    difficulty='easy', tags=['court-prophets', 'nathan']))

Q.append(mc(86,
    'A commonly held meaning of the word is: To Predict the Future. Although this understanding is popular these days, it is not the proper meaning of the word. In the Old Testament the word means To Speak the Word of God.',
    'What does the word “prophecy” properly mean in the Old Testament?',
    [('To speak the word of God', ''),
     ('To predict the future', 'This is the commonly held meaning today, but the syllabus says it is not the proper meaning of the word.'),
     ('To interpret dreams and visions', 'A message might come by vision, but this is not what the word means.'),
     ('To intercede for the people before God', 'Interceding was one of the roles of the prophets, not the meaning of the word prophecy.')],
    0,
    'Because prophecy means speaking the word of God, it takes many forms — explanation of past events, warning, admonition, appeal, advice or exhortation — and is not confined to prediction.',
    difficulty='easy', tags=['prophecy', 'definition']))

Q.append(mc(80,
    'The prophetic action is itself creative of what it depicts. For example, Ezekiel builds a city on sand with mud and makes a toy soldier (Ezekiel 4)',
    'What is meant by “prophetic action” or prophetic symbolism?',
    [('An acted sign which is itself creative of what it depicts, so that performing it contributes to bringing it about', ''),
     ('A visual aid used only to help the hearers remember the spoken oracle', 'The syllabus insists these actions were not just illustrations.'),
     ('The ritual gestures which accompanied sacrifice at the sanctuary', 'Sacrifice and ritual belonged to the work of the priest.'),
     ('The prophet’s habit of dramatising the sins of the king before the court', 'The syllabus describes prophetic action as creative of the future, not as satire.')],
    0,
    'Ezekiel’s model siege of Jerusalem is the syllabus’s example: the prophetic actions were believed to contain power to shape the future.',
    difficulty='medium', tags=['prophetic-action', 'ezekiel'],
    scripture=['Ezekiel 4']))

Q.append(mc(98,
    'even if the prophet performed some signs to give validation to what he was saying, if his message contradicted Mosaic theology - the truth known about the Lord who brought his people out of Egypt - the prophet was false.',
    'What did the theological test (Deuteronomy 13) require of a prophet’s message?',
    [('That it must agree with Mosaic theology — the truth known about the Lord who brought his people out of Egypt', ''),
     ('That his prediction must in fact come to pass', 'That is the practical test of Deuteronomy 18:20ff.'),
     ('That his own life must be morally upright', 'That is the moral test drawn from Jeremiah 23:9ff.'),
     ('That he must perform signs to validate what he said', 'The syllabus says that even a prophet who performed signs was false if his message contradicted Mosaic theology.')],
    0,
    'The theological test measured the message against the revelation already given through Moses; signs and wonders could not override it.',
    difficulty='hard', tags=['true-and-false-prophets', 'tests']))

Q.append(tf(100,
    'It must be noted that, this is a negative test. It does not say that fulfillment is proof that the Lord has spoken',
    'The practical test of Deuteronomy 18:20ff is a negative test: what is not fulfilled is not from the Lord, but fulfilment by itself is not proof that the Lord has spoken.',
    True,
    'The syllabus is careful here: fulfilment might be offered by a false prophet as evidence for his own word, so only non-fulfilment is decisive.',
    difficulty='hard', tags=['true-and-false-prophets', 'tests']))

Q.append(fb(104,
    'For example, in 1 Kings 22, there were 400 false prophets and Micaiah was the only true prophet.',
    'In 1 Kings 22 there were ______ false prophets, and Micaiah son of Imlah was the only true prophet.',
    ['400', 'four hundred', '400 (four hundred)'],
    'The syllabus uses this incident to show that the false prophets were often greater in number than the true, and far more popular.',
    difficulty='easy', tags=['true-and-false-prophets', 'micaiah'],
    scripture=['1 Kings 22']))

Q.append(mc(108,
    'Above all, the false prophets had not "stood in the council of the Lord" (23:18-22). This was why they prophesied lies. They did not know God personally, nor did they understand His ways.',
    'What, above all else, did Jeremiah say was wrong with the false prophets of his day?',
    [('They had not “stood in the council of the Lord”, and so did not know God personally', ''),
     ('They had never been trained in the schools of the prophets', 'The syllabus nowhere makes training a mark of a true prophet; Amos was called though he was no prophet’s son.'),
     ('They refused to perform prophetic actions', 'Prophetic action is discussed as a feature of true prophecy, but it is not the fault named here.'),
     ('They had failed to write down their prophecies', 'Writing is what distinguishes the Latter Prophets, not true prophets from false.')],
    0,
    'Because they had not stood in the Lord’s council they had no word from him; hence the lying dreams, the vain hopes of peace and the hypocritical use of “the burden of the Lord”.',
    difficulty='medium', tags=['true-and-false-prophets', 'jeremiah'],
    scripture=['Jeremiah 23:18-19']))

# ===================== CHAPTER II ====================================
# --- 2.0 INTRODUCTION ---
Q.append(mc(120,
    'The books of the Hebrew Old Testament are arranged in three parts - the Law, the Prophets and the Writings.',
    'Into which three parts are the books of the Hebrew Old Testament arranged?',
    [('The Law, the Prophets and the Writings', ''),
     ('The Law, the Former Prophets and the Latter Prophets', 'The Former and Latter Prophets are the two divisions within the Prophets, not of the whole canon.'),
     ('The Law, the History and the Poetry', 'These are divisions of the English Bible, not the arrangement the syllabus gives for the Hebrew Old Testament.'),
     ('The Law, the Prophets and the Gospels', 'The Gospels belong to the New Testament.')],
    0,
    'The syllabus works from the Hebrew arrangement — Law, Prophets, Writings — and then divides the Prophets into Former and Latter.',
    difficulty='easy', tags=['canon', 'hebrew-bible']))

# --- 2.1 The Books that Constitute the Prophets ---
Q.append(mc(125,
    'The Former Prophets: The books are: Joshua, Judges, I & II Samuel and I & II Kings',
    'Which books make up the Former Prophets?',
    [('Joshua, Judges, I & II Samuel and I & II Kings', ''),
     ('Joshua, Judges, Ruth and I & II Samuel', 'Ruth is not listed among the Former Prophets in the syllabus.'),
     ('Isaiah, Jeremiah, Ezekiel and the Twelve', 'These are the Latter Prophets — the Major Prophets and the Twelve.'),
     ('Deuteronomy, Joshua, Judges and I & II Kings', 'Deuteronomy belongs to the Law, though its view of history shapes the Former Prophets.')],
    0,
    'The Prophets are divided into the Former and the Latter, each containing four scrolls; the Former Prophets are Joshua, Judges, Samuel and Kings.',
    difficulty='easy', tags=['former-prophets', 'canon']))

Q.append(tf(126,
    'These books are anonymous, their authors are not known.',
    'The books of the Former Prophets are anonymous — their authors are not known.',
    True,
    'The syllabus contrasts this with the Latter or Writing Prophets, whose identities, names, places and times of prophecy are known.',
    difficulty='easy', tags=['former-prophets', 'authorship']))

Q.append(mc(126,
    'The former prophets cover the period from Israel’s entrance into the Promised Land until the destruction of the theocracy under Nebuchadnezzar.',
    'What period of Israel’s history do the Former Prophets cover?',
    [('From Israel’s entrance into the Promised Land until the destruction of the theocracy under Nebuchadnezzar', ''),
     ('From the call of Abraham until the death of Moses', 'That period belongs to the Law, not to the Former Prophets.'),
     ('From the reign of Saul until the return from exile', 'The narrative begins earlier, with the entrance into Canaan under Joshua.'),
     ('From the division of the kingdom until the fall of Samaria', 'This is only part of the period the Former Prophets cover.')],
    0,
    'The Former Prophets are interpretative history, and it is against that background that the work of the great writing prophets is to be understood.',
    difficulty='medium', tags=['former-prophets', 'chronology']))

Q.append(fb(128,
    'The Latter Prophets: These are also called the writing prophets.',
    'The Latter Prophets are also called the ______ prophets.',
    ['writing', 'writing prophets'],
    'Unlike the anonymous Former Prophets, the Latter Prophets left writings and their identities are known.',
    difficulty='easy', tags=['latter-prophets', 'canon']))

Q.append(mc(136,
    'The former prophets set forth the history of a particular period in the life of Israel and the latter or writing prophets interpreted particular phases of that history. The one is necessary for the proper understanding of the other.',
    'How do the Former and the Latter Prophets complement one another?',
    [('The Former set forth the history of a period, while the Latter interpreted particular phases of that history', ''),
     ('The Former interpreted the history which the Latter had recorded', 'This reverses the relation the syllabus describes.'),
     ('The Former recorded the Law, while the Latter recorded the history', 'The Law is a separate division of the Hebrew canon.'),
     ('The Former were written for their own day only, while the Latter were written for posterity alone', 'The writing prophets addressed both their own day and posterity, and the Former Prophets remain necessary for understanding them.')],
    0,
    'The syllabus insists that the two are mutually necessary: the one is needed for the proper understanding of the other.',
    difficulty='medium', tags=['former-prophets', 'latter-prophets']))

# --- 2.2 Deuteronomy and the Former Prophets ---
Q.append(mc(143,
    'It is this way of presenting the Old Testament history that is seen in the books collectively referred to as "former prophets". The style or interpretation of history is a reflection of what Moses said in the Book of Deuteronomy, hence what is referred to as "Deuteronomic" view of history.',
    'What is meant by the “Deuteronomic” view of history?',
    [('The presentation of Israel’s history along the lines of Moses’ teaching in Deuteronomy, that obedience brings blessing and disobedience brings punishment', ''),
     ('The view that all Israel’s history was written down by Moses himself', 'The syllabus says the Former Prophets are anonymous.'),
     ('The view that history is governed by the fertility of the land rather than by God', 'That belongs to Baalism, not to Deuteronomy.'),
     ('The view that the history of Israel may only be read alongside the Latter Prophets', 'The two are complementary, but this is not what “Deuteronomic” means.')],
    0,
    'God’s blessing would be seen in a strong nation that defeated its enemies; his punishment would be seen in a nation grown weak and invaded. That reading of events is the Deuteronomic view of history.',
    difficulty='medium', tags=['deuteronomic-history'],
    scripture=['Deuteronomy 28:1-35']))

Q.append(mc(143,
    'in the Book of Judges there is the record of the cycle of events: the people sin, God is angry and sells them into the hands of oppressors; during the oppression they cry to God for deliverance; God sends a judge - a warrior - and saves them and the land enjoys peace again.',
    'Which sequence correctly gives the cycle of events recorded in the book of Judges?',
    [('The people sin; God sells them into the hands of oppressors; they cry to God; God sends a judge and saves them; at the judge’s death they sin again', ''),
     ('The people cry to God; God sends a judge; the people sin; God sells them to oppressors; the land enjoys peace', 'The cycle begins with sin, not with the cry for deliverance.'),
     ('God sends a judge; the people obey; the enemy attacks; the people sin; God forgives', 'The judge is sent in answer to the cry raised under oppression.'),
     ('The people sin; the prophets warn them; they repent; God blesses them permanently', 'The syllabus stresses that the pattern repeats itself, not that repentance was permanent.')],
    0,
    'The cycle is the Deuteronomic view of history in narrative form, and it is repeated again in the books of Samuel and Kings.',
    difficulty='medium', tags=['judges', 'deuteronomic-history']))

# --- 2.3 Why the Prophetic Books are referred to as Former Prophets ---
Q.append(mr(146,
    'Firstly, the prophetic books (Joshua, Judges, Samuel and Kings) continue to teach the Deuteronomic philosophy of history. They emphasize Moses’ prophetic teaching that obedience brings blessing in national life, while disobedience to God brings disaster.',
    'Select the reasons the syllabus gives for the first ground on which Joshua, Judges, Samuel and Kings are called Former Prophets.',
    [('They continue to teach the Deuteronomic philosophy of history', True, ''),
     ('They emphasise Moses’ teaching that obedience brings blessing in national life', True, ''),
     ('They emphasise Moses’ teaching that disobedience to God brings disaster', True, ''),
     ('They were written by the prophets Samuel, Elijah and Elisha themselves', False, 'These books are anonymous; they describe the activities of the early prophets but are not ascribed to them.'),
     ('They contain the predictive oracles concerning the Messiah', False, 'It is the writing prophets whose messages the syllabus links with the coming of the Messiah.')],
    'The first reason is doctrinal: these books carry forward the Deuteronomic philosophy of history in which national obedience and disobedience have visible consequences.',
    difficulty='medium', tags=['former-prophets', 'deuteronomic-history']))

# --- 2.4 Brief Survey of the Former Prophets ---
Q.append(mc(154,
    'His one failure was at Ai. The reason for this defeat was because Achan coveted some of the spoils from Jericho and kept them for himself instead of letting it all be offered to God.',
    'Joshua’s one failure was at Ai. What does the syllabus give as the reason for that defeat?',
    [('Achan coveted some of the spoils from Jericho and kept them for himself instead of offering them all to God', ''),
     ('Joshua entered into a covenant with the people of Gibeon', 'That covenant was a separate mistake, made because Israel did not ask direction from the Lord.'),
     ('The Israelites had not circumcised their sons', 'The syllabus does not give this as the cause.'),
     ('Joshua attacked before the fall of Jericho', 'Jericho fell first; Ai followed.')],
    0,
    'The syllabus calls this a grim illustration of the prophetic interpretation of history, in which disobedience brings disaster.',
    difficulty='medium', tags=['joshua', 'deuteronomic-history']))

Q.append(mc(162,
    'Judges covers the period in Israel’s history between Joshua’s death and the rise of Samuel - roughly 1220 to 1050 B.C.',
    'What period does the book of Judges cover?',
    [('Between Joshua’s death and the rise of Samuel, roughly 1220 to 1050 B.C.', ''),
     ('Between the exodus and the entry into Canaan, roughly 1290 to 1220 B.C.', 'That period belongs to the Law and to the opening of Joshua.'),
     ('Between the rise of Samuel and the death of David, roughly 1075 to 975 B.C.', 'That is the period covered by the books of Samuel.'),
     ('Between the death of Solomon and the fall of Samaria, roughly 930 to 722 B.C.', 'That period is covered by the books of Kings.')],
    0,
    'Judges describes a time of transition in which the only thing holding the scattered tribes together was their common faith.',
    difficulty='medium', tags=['judges', 'chronology']))

Q.append(fb(173,
    'In Judges 17:6 and 21:25, the explanation given for this state of affairs is that, "There was no King in Israel and every man did what was right in his own eyes".',
    'Judges 17:6 and 21:25 explain the moral chaos of the period by saying: “There was no ______ in Israel and every man did what was right in his own eyes.”',
    ['King', 'king'],
    'The absence of a king is the book’s own explanation for the moral and religious decline recorded in its closing chapters.',
    difficulty='easy', tags=['judges'],
    scripture=['Judges 17:6']))

Q.append(mc(177,
    'I & II Samuel were originally one volume, or one book as contained in the Hebrew Old Testament. It was the Septuagint (LXX) that divided it into two.',
    'What does the syllabus say about the division of I and II Samuel into two books?',
    [('They were originally one volume in the Hebrew Old Testament and were divided into two by the Septuagint (LXX)', ''),
     ('They were always two separate scrolls in the Hebrew Old Testament', 'The syllabus states the opposite.'),
     ('They were divided into two by Samuel himself', 'Samuel is not the writer; he is the dominating figure after whom the books are named.'),
     ('They were divided by the compilers of the English Bible', 'The division goes back to the Septuagint, as with Kings.')],
    0,
    'The same is said of Kings: originally one volume, divided into two at the time of the Septuagint.',
    difficulty='medium', tags=['samuel', 'canon', 'septuagint']))

Q.append(tf(179,
    'The name Samuel is given to the books not because he is the writer, but because he is the dominating figure. He is seen in the book as the King maker - he anointed both Saul and David as Kings.',
    'The books of Samuel bear his name because he wrote them.',
    False,
    'The syllabus says the name is given because Samuel is the dominating figure and the king maker who anointed both Saul and David, not because he was the writer.',
    difficulty='easy', tags=['samuel', 'authorship']))

Q.append(mc(202,
    'The two books cover four centuries (400 years) of Israel’s history from the close of David’s reign (930 B.C) through the golden age of Solomon, and the rift between Israel and Judah, to the fall of Samaria in 722 BC and the destruction of Jerusalem in 587 BC',
    'The books of Kings cover four centuries of Israel’s history. In which years did Samaria fall and Jerusalem suffer destruction?',
    [('Samaria fell in 722 B.C. and Jerusalem was destroyed in 587 B.C.', ''),
     ('Samaria fell in 587 B.C. and Jerusalem was destroyed in 722 B.C.', 'The dates are the wrong way round.'),
     ('Samaria fell in 930 B.C. and Jerusalem was destroyed in 722 B.C.', '930 B.C. is the close of David’s reign, at which the books of Kings begin.'),
     ('Samaria fell in 746 B.C. and Jerusalem was destroyed in 561 B.C.', '746 B.C. is the end of Jeroboam II’s reign, and 561 B.C. is connected with the release of Jehoiachin.')],
    0,
    'Kings runs from the close of David’s reign through Solomon and the divided monarchy to the fall of both kingdoms, ending with the release of Jehoiachin.',
    difficulty='medium', tags=['kings', 'chronology']))

Q.append(mc(208,
    'The other great interest of Kings is the prophetic ministry of Elijah and Elisha. They represented the great northern "resistance" movement against the corrupting influence of King Ahab and the Baal religion of his wife Jezebel.',
    'Besides the reign of Solomon, what is the other great interest of the books of Kings?',
    [('The prophetic ministry of Elijah and Elisha, the northern “resistance” movement against Ahab and the Baal religion of Jezebel', ''),
     ('The priestly ordinances of the temple, as in Chronicles', 'The syllabus contrasts Kings with the priestly volumes of Chronicles.'),
     ('The ministry of Samuel as judge and king maker', 'That belongs to the books of Samuel.'),
     ('The conquest and division of the Promised Land', 'That is the subject of Joshua.')],
    0,
    'Their revolt was marked by power to work miracles, which had not been seen in Israel since the exodus.',
    difficulty='medium', tags=['kings', 'elijah', 'elisha']))

# ===================== CHAPTER III ===================================
Q.append(mc(219,
    'the Prophet Elijah, who came from Tishbe in Gilead prophesied during the reign of Ahab (c. 873 -851 B.C.), while Elisha’s ministry was from the period of Ahab through to the reign of Jehoahaz (c. 815 -800 B.c.).',
    'Where did the prophet Elijah come from, and in whose reign did he prophesy?',
    [('From Tishbe in Gilead, during the reign of Ahab (c. 873–851 B.C.)', ''),
     ('From Tekoa in Judah, during the reign of Jeroboam II', 'Tekoa was the home of Amos, who prophesied under Jeroboam II.'),
     ('From Bethel in Israel, during the reign of Jehoahaz', 'Jehoahaz belongs to the close of Elisha’s ministry, not the beginning of Elijah’s.'),
     ('From Samaria, during the reign of Jehoash', 'Samaria was the capital of the Northern Kingdom, not Elijah’s home town.')],
    0,
    'Elisha’s ministry then ran on from the days of Ahab to the reign of Jehoahaz, about 815–800 B.C.',
    difficulty='medium', tags=['elijah', 'chronology']))

Q.append(mc(223,
    'Yahwism, the Israelite religion, has a theological position of monolatry or henotheism, (i.e. worship was to be given exclusively to Yahweh). It abhors visual representation of any kind.',
    'What theological position does the syllabus assign to Yahwism, the Israelite religion?',
    [('Monolatry or henotheism — worship was to be given exclusively to Yahweh', ''),
     ('Polytheism — many gods were to be worshipped together', 'It is Baalism that the syllabus calls a polytheistic religion.'),
     ('Pantheism — the land itself was divine', 'Baalism was the religion tied to the land; Yahwism laid no stress on sacred places.'),
     ('Atheism — no god could be represented or named', 'Yahwism abhorred visual representation, but it was emphatically the worship of Yahweh.')],
    0,
    'Yahwism laid no stress on sanctuaries or sacred places, allowed no statues or pictures, and laid strong emphasis on morality and the keeping of the commandments given at Sinai.',
    difficulty='medium', tags=['yahwism', 'baalism']))

Q.append(mr(225,
    'Baalism, by contrast, was a religion tied to the land, a religion of times and seasons. It was purely an agricultural religion that laid great emphasis on local shrines, sanctuaries, and high places.',
    'Which of the following does the syllabus give as features of Baalism? Select all that apply.',
    [('It was a religion tied to the land, of times and seasons', True, ''),
     ('It was purely an agricultural religion', True, ''),
     ('It laid great emphasis on local shrines, sanctuaries and high places', True, ''),
     ('It abhorred visual representation of any kind', False, 'That is a mark of Yahwism, not of Baalism.'),
     ('It laid strong emphasis on morality and the keeping of the commandments', False, 'The syllabus says Baalism laid no stress at all on morality.')],
    'Baalism was intimately connected with the fertility of the land: to worship Baal was to celebrate rites and festivals designed to procure that fertility.',
    difficulty='medium', tags=['baalism', 'canaan']))

Q.append(mc(242,
    'Elisha’s traditions, however, do not show the same tension between Yahwism and Baalisrn, but that of the performance of Signs and Wonders both at personal and national levels',
    'How do the traditions of Elisha differ from those of Elijah?',
    [('They do not show the same tension between Yahwism and Baalism, but the performance of signs and wonders at personal and national levels', ''),
     ('They are concerned wholly with the royal court and the guidance of kings', 'Guiding the king was the special responsibility of the court prophets.'),
     ('They contain no miracles at all, only spoken oracles', 'Signs and wonders are precisely what marks the Elisha tradition.'),
     ('They are set entirely in the Southern Kingdom of Judah', 'Both Elijah and Elisha exercised their ministry in the North.')],
    0,
    'Elisha’s signs and wonders were meant to demonstrate the power of Yahweh and to call Israel to serve him alone.',
    difficulty='medium', tags=['elisha', 'signs-and-wonders'],
    scripture=['2 Kings 2:1-8']))

Q.append(tf(246,
    'Though Elijah had connections with the prophetic communities, he was pre-eminently solitary. He travelled alone and sometimes vanished mysteriously and then reappeared unheralded',
    'Although Elijah had connections with the prophetic communities, he was pre-eminently solitary, travelling alone and sometimes vanishing and reappearing unheralded.',
    True,
    'This is why the syllabus says the Elijah tradition, and especially the Mount Carmel contest, illustrates the variety of prophetism in the ninth century B.C.: there were individual prophets as well as prophetic groups.',
    difficulty='medium', tags=['elijah', 'prophetic-groups'],
    scripture=['1 Kings 18']))
