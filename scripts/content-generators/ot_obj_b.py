"""Objective questions: Chapters IV (Amos) and V (Malachi)."""
from ot_common import mc, tf, fb, mr

Q = []

# ===================== CHAPTER IV — THE BOOK OF AMOS =================
# --- 4.1 The Prophet Amos ---
Q.append(mc(256,
    'The Name Amos: Amos means "burden-bearer." He is the only man in the Old Testament with this name.',
    'What does the name Amos mean?',
    [('Burden-bearer', ''),
     ('My messenger', 'That is the meaning of the name Malachi.'),
     ('Seer', 'Seer is the rendering of the Hebrew words rõ’eh and hõzeh, not of the name Amos.'),
     ('Sheep owner', 'Nõqĕd, the term used of Amos in 1:1, refers to a sheep owner, but it is not the meaning of his name.')],
    0,
    'The syllabus notes that Amos is the only man in the Old Testament to bear this name, which means “burden-bearer”.',
    difficulty='easy', tags=['amos', 'names']))

Q.append(tf(256,
    'The name should not be confused with Amoz who was the father of the prophet Isaiah.',
    'The name Amos should not be confused with Amoz, who was the father of the prophet Isaiah.',
    True,
    'The syllabus warns against confusing the two names: Amoz was Isaiah’s father, not the prophet of Tekoa.',
    difficulty='easy', tags=['amos', 'names']))

Q.append(mc(258,
    'Amos was from a town called Tekoa, a small mountain-top town in Judah, (Amos 1: 1; 7: 12). Tekoa was about twelve (12) miles from Jerusalem, the capital of the Southern Kingdom and about six (6) miles south east of Bethlehem.',
    'Where was Tekoa, the home town of the prophet Amos?',
    [('A small mountain-top town in Judah, about twelve miles from Jerusalem and about six miles south east of Bethlehem', ''),
     ('A village in the Northern Kingdom, about twelve miles from Samaria', 'Amos came from the Southern Kingdom of Judah, though he was sent to preach in the North.'),
     ('A settlement by the Dead Sea where the sycamore fig trees grew', 'Sycamore fig trees do not grow at Tekoa but by the Dead Sea; his migrant work took him there.'),
     ('A priestly city attached to the sanctuary at Bethel', 'Bethel was the Northern sanctuary at which Amos preached, not his home.')],
    0,
    'Tekoa was believed to be the centre of a large sheep-farming district, and Amos was taking care of his flock when he was called.',
    difficulty='medium', tags=['amos', 'tekoa'],
    scripture=['Amos 1:1']))

Q.append(fb(260,
    'Two terms are used to describe Amos (in Amos 7:14) a Shepherd and a dresser of sycamore fig-trees.',
    'Two terms are used in Amos 7:14 to describe Amos: a shepherd, and a ______.',
    ['dresser of sycamore fig-trees', 'dresser of sycamore fig trees', 'dresser of sycamore figs',
     'a dresser of sycamore fig-trees'],
    'Gathering sycamore fruit was a seasonal occupation and among the lowest in Palestine, which gives an idea of Amos’s economic condition.',
    difficulty='easy', tags=['amos', 'occupation'],
    scripture=['Amos 7:14']))

# --- 4.2 The Historical Background to Amos' Ministry ---
Q.append(mc(265,
    'Amos delivered his message during the reign of Jeroboam II, who ruled Israel from 786 to 746 BC.',
    'During whose reign did Amos deliver his message, and what were the years of that reign?',
    [('Jeroboam II, who ruled Israel from 786 to 746 B.C.', ''),
     ('Jehoash, who reigned in Israel from 801 to 786 B.C.', 'Jehoash was the father of Jeroboam II and prepared the ground for his prosperity.'),
     ('Uzziah, king of Judah', 'Uzziah was Jeroboam’s contemporary in Judah, but Amos preached in the Northern Kingdom.'),
     ('Ahab, who reigned from about 873 to 851 B.C.', 'Ahab belongs to the ninth century and to the ministry of Elijah.')],
    0,
    'This was the period when the fortunes of the Northern Kingdom stood at their highest point of prosperity and peace.',
    difficulty='easy', tags=['amos', 'jeroboam-ii', 'chronology']))

Q.append(tf(269,
    'Jeroboam II himself continued the military success of his father, took advantage of the internal weakness of Syria at that time to extend his frontiers to almost those of the old Davidic kingdom',
    'Jeroboam II continued his father’s military success and took advantage of Syria’s internal weakness to extend his frontiers to almost those of the old Davidic kingdom.',
    True,
    'He also pursued an expansionist policy into Trans-Jordan, so that Israel’s lost lands had been recovered by the time Amos preached.',
    difficulty='medium', tags=['amos', 'jeroboam-ii'],
    scripture=['2 Kings 14:23']))

# --- 4.3 Socio-Economic Situation ---
Q.append(mc(280,
    'One important feature of the period was that the rich became richer while the poor became poorer.',
    'What does the syllabus identify as one important feature of the period in which Amos prophesied?',
    [('The rich became richer while the poor became poorer', ''),
     ('Wealth was evenly spread through the growth of international trade', 'International trade made many people very rich, but the syllabus stresses the widening gap.'),
     ('Both rich and poor grew poorer as trade collapsed', 'This was a time of prosperity and splendour, not of collapse.'),
     ('The rich supported the poor out of the revenue from the caravan tolls', 'The tolls brought revenue to the treasury; the syllabus says nothing of relief for the poor.')],
    0,
    'Amos repeatedly attacked this division, and especially the luxury of the rich set against the misery of the poor.',
    difficulty='easy', tags=['amos', 'social-justice']))

Q.append(tf(282,
    'Justice was perverted by the judges who took bribes',
    'In the days of Amos justice was perverted by judges who took bribes.',
    True,
    'The legal process had been totally corrupted and was used as an instrument of oppression, so that the courts became little more than a market where the poor man was enslaved.',
    difficulty='medium', tags=['amos', 'social-justice', 'courts']))

Q.append(fb(280,
    'Amos stated that these merchants hated the day in which they could not do any business (8:5).',
    'Amos stated that the rich merchants of his day hated the day in which they could not do any ______.',
    ['business', 'any business'],
    'Their one aim was to increase their profit, no matter the means; even the Sabbath was an interruption to be resented.',
    difficulty='medium', tags=['amos', 'social-justice']))

# --- 4.4 Religious Situation ---
Q.append(tf(285,
    'The worship of Yahweh even though appeared to continue, had become inextricably bound up with practices associated with Canaanite worship.',
    'In the days of Amos the worship of Yahweh appeared to continue, but it had become inextricably bound up with practices associated with Canaanite worship.',
    True,
    'Religion flourished in the nation, but it was a religion completely divorced from reality, with elaborate ritual and no evidence of true spiritual value.',
    difficulty='easy', tags=['amos', 'religion', 'canaan']))

Q.append(mc(285,
    'bacchanalian orgies (noisy, drunkenness, dancing and other merrymaking associated with the worship of the god Bacchus (the god of wine) which were part of the fertility cults of the surrounding nations',
    'Amos attacked worship accompanied by “bacchanalian orgies”. How does the syllabus explain that expression?',
    [('Noisy drunkenness, dancing and other merrymaking associated with the worship of the god Bacchus, the god of wine', ''),
     ('The ritual slaughter of animals at the high places', 'Sacrifice was part of the elaborate ritual, but it is not what the word bacchanalian describes.'),
     ('The chanting of psalms by hired temple singers', 'Amos does say the people thought more of worldly music than of their Messiah, but that is a separate charge.'),
     ('The sacred processions held at the great festivals', 'Many thronged to the shrines at the great festivals, but the term refers to drunken revelry.')],
    0,
    'These practices, together with sanctuary prostitution, belonged to the fertility cults of the surrounding nations and had invaded Israel’s worship.',
    difficulty='medium', tags=['amos', 'religion', 'fertility-cults']))

# --- 4.5 The Ministry of Amos ---
Q.append(mc(293,
    'These statements show that Amos had no training as a prophet. He was not a professional prophet ("I was no prophet"), nor a member of the schools of prophets ("neither was I a prophet\'s son").',
    'What did Amos mean when he told Amaziah, “I was no prophet, neither was I a prophet’s son”?',
    [('That he was not a professional prophet, nor a member of the schools of prophets', ''),
     ('That he had never received a call from God', 'It was precisely the Lord who took him from tending the flock and told him to prophesy to Israel.'),
     ('That his father’s name was not known', 'The point concerns training and office, not parentage.'),
     ('That he refused to prophesy any longer at Bethel', 'Amos was answering Amaziah’s challenge by explaining how he became a prophet.')],
    0,
    'Heritage and education might be good, but the syllabus insists that it is God’s calling that makes the prophet.',
    difficulty='medium', tags=['amos', 'call'],
    scripture=['Amos 7:10-17']))

Q.append(mc(298,
    'It was there that Jacob had his famous dream (Gen. 28: 10-22) which motivated him to give the name "Bethel" (meaning "House of God") to the place, which was formerly known as Luz (Gen 28: 19).',
    'What does the name Bethel mean, and by what name was the place formerly known?',
    [('It means “House of God”; the place was formerly known as Luz', ''),
     ('It means “House of the King”; the place was formerly known as Tekoa', 'Tekoa was the home town of Amos in Judah.'),
     ('It means “House of bread”; the place was formerly known as Ephrath', 'The syllabus gives neither of these for Bethel.'),
     ('It means “Gate of heaven”; the place was formerly known as Shechem', 'Shechem is where Joshua renewed the covenant with Israel.')],
    0,
    'Jacob named the place after his famous dream; by Amos’s day the house of God had become the house of iniquity.',
    difficulty='easy', tags=['amos', 'bethel'],
    scripture=['Genesis 28:10-22', 'Genesis 28:19']))

Q.append(mc(300,
    'when the United Kingdom was divided in 931BC (1 Kings 12) Bethel became one of the two major religious sites of the Northern Kingdom (2 Kings 12: 25-31). At Bethel, the idolatrous worship of the golden calf was instituted and continued to the end of the Northern Kingdom.',
    'What had Bethel become by the time Amos was sent to prophesy there?',
    [('One of the two major religious sites of the Northern Kingdom, where the idolatrous worship of the golden calf was instituted', ''),
     ('The capital city of the Northern Kingdom', 'Samaria was the capital, developed by Jeroboam II into a strong commercial centre.'),
     ('A deserted ruin abandoned after the division of the kingdom', 'Worship continued there to the very end of the Northern Kingdom.'),
     ('A royal sanctuary of the Southern Kingdom of Judah', 'Bethel belonged to the North; Amos came from Judah to preach there.')],
    0,
    'Thus Bethel, the house of God, became the house of iniquity — and it was about this place that Amos prophesied.',
    difficulty='medium', tags=['amos', 'bethel', 'idolatry'],
    scripture=['1 Kings 12']))

Q.append(fb(303,
    'Amos\' message is dominated by the idea of God\'s righteousness. The essence of the teaching of Amos is found in Amos 5:24.',
    'The essence of the teaching of Amos is found in the verse ______.',
    ['Amos 5:24', '5:24', 'Amos 5.24'],
    'Amos’s message is dominated by the idea of God’s righteousness, and the syllabus points to this single verse as its essence.',
    difficulty='easy', tags=['amos', 'righteousness'],
    scripture=['Amos 5:24']))

Q.append(tf(307,
    'In the Old Testament righteousness is not a legal concept. It is a moral and spiritual concept.',
    'In the Old Testament righteousness is essentially a legal concept.',
    False,
    'The syllabus says plainly that righteousness in the Old Testament is not a legal but a moral and spiritual concept: a righteous man is a good, pleasant, kind and charitable man.',
    difficulty='medium', tags=['amos', 'righteousness']))

# --- 4.6 Brief Analysis of the Book of Amos ---
Q.append(mc(323,
    'The dating is specific, two years before the earthquake (see Zech.14:5). It was a catastrophic event which is mentioned only in these two passages.',
    'How does the title in Amos 1:1 date the prophet’s oracles?',
    [('Two years before the earthquake', ''),
     ('In the year that King Uzziah died', 'The syllabus gives only the earthquake as the specific dating in Amos 1:1.'),
     ('In the thirtieth year of Jeroboam II', 'No such dating is given.'),
     ('Two years after the fall of Samaria', 'Samaria fell in 722 B.C., long after Amos prophesied.')],
    0,
    'Verse 1 is the title placed at the head of the collection: it says who spoke the words, to whom, and when. Verse 2 gives the content — the judgment to come.',
    difficulty='medium', tags=['amos', 'dating'],
    scripture=['Amos 1:1']))

Q.append(fb(328,
    'Each of the offences also begins with the words for three sins ... and for four I will not turn back my wrath.',
    'Each of the offences in the oracles against the nations begins with the words, “For three sins … and for four I will not turn back my ______.”',
    ['wrath', 'my wrath'],
    'Amos uses this refrain to indicate the certainty of the judgment coming upon the nations he names.',
    difficulty='medium', tags=['amos', 'oracles-against-nations']))

Q.append(mc(331,
    'The significance of the prophecy against the nations is to indicate the concept of Yahweh\'s sovereignty beyond His covenant people. God is portrayed as the King of His world who judges sin and unrighteousness irrespective of where it may occur.',
    'What is the significance of Amos’s oracles against the surrounding nations?',
    [('They indicate Yahweh’s sovereignty beyond his covenant people: he is King of his world and judges sin wherever it occurs', ''),
     ('They show that the surrounding nations were more wicked than Israel', 'Israel itself is the climax of the series and receives the fullest indictment.'),
     ('They prove that Amos had travelled widely among the nations', 'The syllabus says nothing of such travels; his migrant work took him only into the North.'),
     ('They show that Israel alone stood under God’s authority', 'The syllabus says all nations and all people stand under his authority.')],
    0,
    'Each oracle follows the same structure — messenger formula, offence, punishment, concluding messenger formula — and together they display God as ruler of all nations.',
    difficulty='medium', tags=['amos', 'oracles-against-nations', 'sovereignty']))

Q.append(mc(338,
    'Cause many Syrians to die and others to be carried back into Kir, the land of their former slavery, (2 Kings 16:9). Kir was located in Mesopotamia',
    'In the oracle against Syria, where were many Syrians to be carried?',
    [('To Kir, the land of their former slavery, located in Mesopotamia', ''),
     ('To Damascus, the capital city', 'Damascus was Syria’s own capital, whose palace God would burn down.'),
     ('To Edom, to be sold as slaves', 'It was Philistia and Tyre that sold Israelites into slavery to Edom.'),
     ('To Kirioth, the capital of Moab', 'Kirioth was Moab’s capital, not a place of Syrian exile.')],
    0,
    'Syria’s offence was that it had often harassed Israel, especially under Ben-Hadad and King Hazael; its punishment included burning of the palace, breaking of strongholds and deportation to Kir.',
    difficulty='medium', tags=['amos', 'oracles-against-nations', 'syria'],
    scripture=['2 Kings 16:9']))

Q.append(tf(361,
    'The Ammonites, who were descendants of Lot\'s youngest daughter (Gen. 19: 36-38) had committed serious crimes against Israel. They ripped open pregnant Israelite women with swords during their wars of expansion in Gilead.',
    'The offence charged against Ammon was that its people ripped open pregnant Israelite women with swords during their wars of expansion in Gilead.',
    True,
    'The Ammonites were descendants of Lot’s youngest daughter; their punishment was that their cities would be destroyed and the inhabitants enslaved.',
    difficulty='medium', tags=['amos', 'oracles-against-nations', 'ammon'],
    scripture=['Genesis 19:36-38']))

Q.append(mr(373,
    'They had perverted justice by accepting bribes, sold the poor into slavery, trading them for a pair of shoes, both fathers and sons were guilty of immorality with the same harlot, and lounging in stolen clothing from their debtors at religious feasts.',
    'In the oracle against Israel (Amos 2:6–16), which of the following are named among the offences? Select all that apply.',
    [('They perverted justice by accepting bribes', True, ''),
     ('They sold the poor into slavery, trading them for a pair of shoes', True, ''),
     ('Both fathers and sons were guilty of immorality with the same harlot', True, ''),
     ('They desecrated the tombs of the kings of Edom', False, 'That was the offence charged against Moab.'),
     ('They broke a covenant of brotherhood made with Israel', False, 'That was the offence charged against Phoenicia, whose capital was Tyre.')],
    'Israel, with its capital Samaria, is the eighth and climactic oracle: the nation that had received most from God is charged with the fullest catalogue of sin.',
    difficulty='hard', tags=['amos', 'oracles-against-nations', 'israel'],
    scripture=['Amos 2:6']))

Q.append(mc(404,
    'Jeroboam II was succeeded by his son Zechariah, who was assassinated by a rebel named Shall urn after a reign of only six months (2 Kings 15:10-12).',
    'In the vision of the plumb line God said he would destroy the dynasty of Jeroboam II by the sword. How does the syllabus say this came about?',
    [('Jeroboam II was succeeded by his son Zechariah, who was assassinated after a reign of only six months', ''),
     ('Jeroboam II himself was killed in battle at Ramoth-Gilead', 'It was Ahab who died in the battle at Ramoth-Gilead.'),
     ('Samaria fell to the Assyrians within a year of the vision', 'Samaria fell in 722 B.C., some years after Jeroboam’s dynasty ended.'),
     ('His household was carried captive to Kir', 'Kir was the place of exile named in the oracle against Syria.')],
    0,
    'God told Amos he would continue to test Israel with the plumb line of heavenly justice, and would no longer turn away from punishing them; the same plumb line was later used on Judah under Manasseh.',
    difficulty='hard', tags=['amos', 'visions', 'plumb-line'],
    scripture=['2 Kings 15:10-12']))

Q.append(mc(406,
    'The Lord showed Amos a basket filled with ripe fruit. He then explained to Amos that it symbolized Israel which was now ripe for judgment.',
    'What did the basket of ripe summer fruit symbolise in the fourth of Amos’s visions?',
    [('Israel, which was now ripe for judgment', ''),
     ('The restoration of agriculture in the last days', 'The restoration of agriculture is promised at Amos 9:13, not in this vision.'),
     ('The abundance of the reign of Jeroboam II', 'The prosperity of the reign is background to the book, not the meaning of the vision.'),
     ('The offerings the merchants brought to the shrine at Bethel', 'The vision concerns judgment on the merchants, not their offerings.')],
    0,
    'The vision goes on to charge the merchants with robbing the poor, longing for the Sabbath to end, and making slaves of the poor for a piece of silver or a pair of shoes.',
    difficulty='easy', tags=['amos', 'visions']))

Q.append(mc(397,
    'God revealed to Amos in a vision that the crops were to be destroyed by an invasion of locusts. Amos interceded for Israel and the destruction did not take place.',
    'What was the outcome of the first vision, the plague of locusts?',
    [('Amos interceded for Israel and the destruction did not take place', ''),
     ('The locusts destroyed the crops as the vision had shown', 'The syllabus says the destruction did not take place because Amos interceded.'),
     ('Amos was forbidden to intercede for the people', 'Intercession is named in the syllabus as one of the roles of the prophets, and Amos exercised it here.'),
     ('The vision was withheld from Israel and told only to Amaziah', 'Amaziah appears in the account of Amos’s call, not here.')],
    0,
    'The same happened with the second vision, the destructive fire: the prophet pleaded for mercy and God set the deserved punishment aside.',
    difficulty='medium', tags=['amos', 'visions', 'intercession']))

# --- 4.7 Conclusion ---
Q.append(mc(433,
    'He states finally that this Restoration would be permanent (9: 15), "I will plant Israel in their own land, never again to be uprooted from the land I have given them" says the Lord your God.',
    'How does Amos describe the restoration with which his prophecy closes?',
    [('As permanent — Israel would be planted in their own land, never again to be uprooted', ''),
     ('As temporary, lasting only until the exile', 'The syllabus stresses that the restoration would be permanent.'),
     ('As conditional upon the repentance of Jeroboam II', 'The oracles offered no hope for the future to Jeroboam’s Israel; the restoration lies beyond judgment.'),
     ('As limited to the tribe of Judah', 'The promise is of the restoration of the people of Israel scattered throughout the world.')],
    0,
    'Amos began with judgment and doom to show that God is just, and ends with a permanent restoration, showing how God delights to bless his people and to welcome the repentant sinner.',
    difficulty='easy', tags=['amos', 'restoration']))

# ===================== CHAPTER V — THE BOOK OF MALACHI ===============
# --- 5.0 INTRODUCTION ---
Q.append(mc(441,
    'The Book of Malachi is one of the post exilic prophetic books which concludes the prophetic books of the Hebrew canon of the Old Testament. It is one of the shortest books which make up "The Twelve" or the Minor Prophets.',
    'What place does the Book of Malachi occupy in the Hebrew canon of the Old Testament?',
    [('It is a post-exilic prophetic book which concludes the prophetic books of the Hebrew canon', ''),
     ('It opens the collection known as “The Twelve” or the Minor Prophets', 'Malachi is one of the Twelve, but it closes rather than opens the prophetic books.'),
     ('It is the last of the Former Prophets', 'The Former Prophets are Joshua, Judges, Samuel and Kings.'),
     ('It stands among the Writings, the third division of the Hebrew canon', 'Malachi belongs to the Prophets, not to the Writings.')],
    0,
    'The book speaks of the love of God and of the obedience by which our love for him is shown, and it concludes the prophetic books of the Hebrew canon.',
    difficulty='easy', tags=['malachi', 'canon']))

Q.append(tf(443,
    'The Book of Malachi is closely linked with the prophets Haggai and Zechariah and from them we get to understand better, the post exilic period of the Jewish History.',
    'The Book of Malachi is closely linked with the prophets Haggai and Zechariah, and from them the post-exilic period of Jewish history is better understood.',
    True,
    'The three post-exilic prophets belong together, and Malachi’s setting can only be fixed by reference to the ministries of Haggai and Zechariah.',
    difficulty='easy', tags=['malachi', 'post-exilic']))

# --- 5.1 The Prophet Malachi ---
Q.append(mc(446,
    'His Name: The name MALACHI means "My Messenger".',
    'What does the name Malachi mean?',
    [('“My Messenger”', ''),
     ('“Burden-bearer”', 'That is the meaning of the name Amos.'),
     ('“Oracle”', 'Massa, the Hebrew word for oracle, means a burden laid upon the messenger.'),
     ('“My Servant”', 'The syllabus gives “My Messenger” as the meaning of the name.')],
    0,
    'Whether the word is his personal name or a title of his office, Malachi was a communicator of God’s word whose message was full of rebuke, but intended to turn the people back to God.',
    difficulty='easy', tags=['malachi', 'names']))

Q.append(tf(448,
    'There is nothing in the book of Malachi or the Historical books of Ezra and Nehemiah about his personal history. The names of his parents and his home are not known.',
    'Nothing is known of Malachi’s personal history: neither the names of his parents nor his home are given in his book or in Ezra and Nehemiah.',
    True,
    'The book tells us nothing of the man himself, which is one reason some scholars have argued that “Malachi” is a title rather than a personal name.',
    difficulty='easy', tags=['malachi', 'biography']))

# --- 5.2 The Ministry of Malachi ---
Q.append(mc(451,
    'First, the Prophet must have prophesied after the exile because he mentions a "governor" as being over the land (1:8). This was a political condition which existed when the Jews returned from Babylon. Before the exile, the political leader of the nation was a "Kinq".',
    'What is the first indication given that Malachi prophesied after the return from the Babylonian exile?',
    [('He mentions a “governor” as being over the land (1:8), whereas before the exile the political leader was a king', ''),
     ('He refers to the rebuilding of the temple as still in progress', 'There is no reference to the rebuilding of the temple; that silence is itself part of the argument.'),
     ('He names Nehemiah as the governor of Judah', 'Malachi does not name the governor; the link with Nehemiah rests on the agreement between Nehemiah 13 and the book.'),
     ('He speaks of the four hundred years of silence to follow', 'The four hundred years of silence is a later reckoning, not a statement of the book.')],
    0,
    'A governor over the land was the political condition that existed when the Jews returned from Babylon; Haggai used the same word of Zerubbabel.',
    difficulty='medium', tags=['malachi', 'dating']))

Q.append(mc(453,
    'he must have prophesied after the ministry of Haggai and Zechariah who prophesied during the time of the building of the temple (520 - 516 B.C.).',
    'During which years does the syllabus say Haggai and Zechariah prophesied?',
    [('During the building of the temple, 520–516 B.C.', ''),
     ('During the governorship of Nehemiah, 445–433 B.C.', 'Those are the dates of Nehemiah’s governorship, to which Malachi himself is linked.'),
     ('During the reign of Jeroboam II, 786–746 B.C.', 'That is the setting of the ministry of Amos.'),
     ('During the exile itself, 587–539 B.C.', 'Haggai and Zechariah prophesied after the return, at the rebuilding of the temple.')],
    0,
    'Malachi must be later still, since the temple services had been resumed long enough for the priests to grow weary of them and for irregularities to creep in.',
    difficulty='medium', tags=['malachi', 'dating', 'haggai-zechariah']))

Q.append(mc(457,
    'Nehemiah came to Jerusalem to be governor in 445 Be. He served in that capacity for some years and then returned temporarily to Persia in 433 B.C. (Nehemiah 5:14).',
    'When did Nehemiah come to Jerusalem as governor, and when did he return temporarily to Persia?',
    [('He came in 445 B.C. and returned to Persia in 433 B.C.', ''),
     ('He came in 433 B.C. and returned to Persia in 420 B.C.', '433 B.C. is the year of his temporary return to Persia, not of his arrival.'),
     ('He came in 520 B.C. and returned to Persia in 516 B.C.', 'Those are the years of the building of the temple under Haggai and Zechariah.'),
     ('He came in 516 B.C. and returned to Persia in 500 B.C.', 'The syllabus gives 445 B.C. and 433 B.C.')],
    0,
    'On his return to Jerusalem Nehemiah found gross sin and violation of the Law, and the close agreement between Nehemiah 13 and Malachi suggests the prophet worked a few years after 433 B.C.',
    difficulty='medium', tags=['malachi', 'dating', 'nehemiah'],
    scripture=['Nehemiah 5:14', 'Nehemiah 13']))

Q.append(fb(459,
    'There is then the four hundred years of silence after which the Prophet John the Baptist appeared on the scene to "prepare the way" for the Messiah the Lord Jesus Christ.',
    'Malachi is the last prophet of the Old Testament; his book is followed by ______ years of silence, after which John the Baptist appeared to prepare the way for the Messiah.',
    ['four hundred', '400', 'four hundred (400)'],
    'The book ends the Old Testament revelation, and the syllabus reckons four hundred silent years between Malachi and John the Baptist.',
    difficulty='easy', tags=['malachi', 'chronology', 'john-the-baptist']))

# --- 5.3 The nature of His Message ---
Q.append(mc(467,
    'Charges or accusations are made against Israel, which is usually an opening statement (e.g.: "I have loved you" says the Lord 1:2). These are then followed by objections on the part of the accused (in the form of a question) put into the mouth of the hearers',
    'What recurring literary method is a common feature of the Book of Malachi?',
    [('A charge against Israel, followed by an objection in the form of a question put into the mouth of the hearers, which is then answered', ''),
     ('A vision described and then interpreted by an angel', 'Visions of that kind belong to other prophets; Malachi works by charge and reply.'),
     ('An oracle against a foreign nation followed by one against Israel', 'That is the pattern of Amos 1:3–2:16.'),
     ('A parable followed by a prayer of confession', 'The syllabus describes no such pattern in Malachi.')],
    0,
    'The words placed in the mouth of the Lord’s opponents represent the attitudes and actions of the people as the prophet understood them, and are meant to show the Israelites their true selves.',
    difficulty='medium', tags=['malachi', 'structure']))

Q.append(fb(474,
    'The theme of the Book of Malachi is "God\'s Rebuke of Israel\'s Outrageous Sins".',
    'Complete the theme of the Book of Malachi: “God’s Rebuke of Israel’s ______ Sins”.',
    ['Outrageous', 'outrageous'],
    'The theme is developed into six charges against the nation, from doubting God’s love to discrediting God’s service.',
    difficulty='easy', tags=['malachi', 'theme']))

# --- 5.5 Outline of the Book of Malachi ---
Q.append(mc(484,
    'The word "Oracle" as used in Malachi means a "burden" imposed by a master or a ruler or a deity on his subjects.',
    'What does the Hebrew word for oracle, Massa, mean as it is used in Malachi?',
    [('A “burden” imposed by a master, a ruler or a deity on his subjects', ''),
     ('A vision granted to a seer', 'Vision belongs to the words rõ’eh and hõzeh, not to Massa.'),
     ('A tenth part set aside for God', 'A tenth is the meaning of ma’aser, the Hebrew word for tithe.'),
     ('A covenant of brotherhood between two nations', 'That phrase belongs to the oracle against Tyre in Amos.')],
    0,
    'The messenger would not have chosen to say such a thing: the burden has been laid on his heart by the Lord and he is obliged to discharge it.',
    difficulty='medium', tags=['malachi', 'hebrew-terms', 'oracle']))

Q.append(mc(489,
    'The terms LOVED and HATED could be explained as preference, not animosity.',
    'How does the syllabus explain the words “Yet I have loved Jacob but Esau I have hated”?',
    [('The terms loved and hated are to be explained as preference, not animosity', ''),
     ('They are a prediction of the future conversion of Edom', 'The syllabus points instead to Edom’s destruction as a nation.'),
     ('They show God rejecting the covenant he made with the fathers', 'The covenant with the fathers stands; Israel’s very existence is offered as proof of God’s love.'),
     ('They describe the personal characters of the two brothers', 'The contrast is between two nations, Israel and Edom, not two temperaments.')],
    0,
    'God answers the complaint “How have you loved us?” by pointing Israel to its own history: its continued existence as a nation, set against Edom which was a nation no longer.',
    difficulty='medium', tags=['malachi', 'love-of-god', 'edom'],
    scripture=['Genesis 25:19-23']))

Q.append(mc(498,
    'How have the priests despised God\'s name? By placing defiled (ritually unclean) food upon His altar.',
    'How, according to Malachi, had the priests despised God’s name?',
    [('By placing defiled, ritually unclean food upon his altar, offering blind, crippled or diseased animals', ''),
     ('By refusing to serve at the altar at all', 'The problem was careless service, not the abandonment of service.'),
     ('By marrying the daughters of a strange god', 'That was the charge that Israel had defied God’s law on marriage.'),
     ('By keeping back the tithes and offerings', 'That was the separate charge that Israel had disregarded God’s tithes.')],
    0,
    'The Law of Moses required that only the best animals be brought to God’s altar; by bringing the sick, the blind and the lame they were saying in effect, “You are unworthy of our best.”',
    difficulty='medium', tags=['malachi', 'priests', 'sacrifice'],
    scripture=['Malachi 1:7-8']))

Q.append(tf(509,
    'This is an issue of religion. It is marrying people of other Faith which is being condemned and not because of ethnicity.',
    'Malachi’s condemnation of mixed marriages rests on religious rather than racial or ethnic grounds.',
    True,
    'The men of Israel had married the daughters of a strange god — heathen women who were idolaters — and God had prohibited such marriages because they would lead Israel into idolatry.',
    difficulty='medium', tags=['malachi', 'marriage'],
    scripture=['Deuteronomy 7:1-5', 'Exodus 34:16']))

Q.append(mc(519,
    'Divorcing one\'s wife was an act of cruelty because it was not merely the putting away of a woman, but the putting away of a woman who is "HIS COMPANION. . ."',
    'Why does Malachi treat the divorcing of a wife as an act of cruelty?',
    [('Because it is not merely the putting away of a woman, but of a woman who is “his companion”, who has shared her life and life’s experiences with him', ''),
     ('Because the divorced wife had no legal means of support', 'The syllabus rests the charge on the relationship betrayed, not on economics.'),
     ('Because it left the children of the marriage without a name', 'The children appear under a different head — divorce frustrates God’s design for a godly seed.'),
     ('Because it profaned the covenant God made with the fathers', 'That is God’s evaluation of intermarriage with idolaters in 2:10-11.')],
    0,
    'The syllabus sets out four things about divorce: it is an act of cruelty, an act of disloyalty, an act which frustrates God’s design for a godly seed, and an act which God hates.',
    difficulty='medium', tags=['malachi', 'marriage', 'divorce']))

Q.append(fb(516,
    'Here, God states clearly "I HATE DIVORCE" (v16).',
    'In Malachi 2:16 God states clearly, “I ______ divorce.”',
    ['hate', 'HATE'],
    'It was bad enough that the men of Israel entered mixed marriages; worse still that they were divorcing their Jewish wives in order to do so.',
    difficulty='easy', tags=['malachi', 'divorce']))

Q.append(mc(532,
    'the Jews of Malachi\'s day continued to struggle with the problem of why the wicked apparently prosper while the righteous suffer.',
    'With what problem did the Jews of Malachi’s day struggle, so that they disdained God’s justice?',
    [('Why the wicked apparently prosper while the righteous suffer', ''),
     ('Why the temple had not yet been rebuilt', 'The temple had already been rebuilt; the silence about it is one argument for a late date.'),
     ('Why the exile had lasted seventy years', 'The book addresses the community after the return, not the length of the exile.'),
     ('Why God had chosen Jacob rather than Esau', 'That question belongs to the first charge, that Israel had doubted God’s love.')],
    0,
    'Their complaint was, “Everyone who does evil is good in the sight of the Lord … or where is the God of justice?” — a view that leaves out God’s long-suffering and his own timetable for judgment.',
    difficulty='medium', tags=['malachi', 'justice']))

Q.append(mc(544,
    'The Hebrew word for Tithe is, ma\'aser, and it means a \'Tenth\'.',
    'What is the Hebrew word for tithe, and what does it mean?',
    [('Ma’aser, meaning a “tenth”', ''),
     ('Massa, meaning a “burden”', 'Massa is the Hebrew word for oracle.'),
     ('Hevel, meaning a “band”', 'Hevel is the word used of the bands of prophets.'),
     ('Nõqĕd, meaning a “sheep owner”', 'Nõqĕd is the term used of Amos in Amos 1:1.')],
    0,
    'The practice is very old: it was known in Babylon, Persia, Egypt and China, and Abraham knew of it when he migrated from Ur.',
    difficulty='easy', tags=['malachi', 'tithe', 'hebrew-terms']))

Q.append(tf(548,
    'A penalty of twenty percent of the tithe was exacted from anyone who sold his tithes and refused to use the money to pay for a substitute',
    'Under the Levitical system a penalty of twenty percent of the tithe was exacted from anyone who sold his tithes and refused to use the money to pay for a substitute.',
    True,
    'Leviticus 27:30 makes it clear that a tithe of everything belonged to the Lord and was holy to him; when the Levites received the tithe they in turn gave a tenth for the priests.',
    difficulty='medium', tags=['malachi', 'tithe', 'levites']))

Q.append(mc(555,
    'They must repent and "bring the whole tithe into the store house," If they are willing to do this, God will open the windows of heaven, and pour out a blessing on them.',
    'What does Malachi tell the people to do about their disregard of the tithes, and what does God promise in return?',
    [('They must repent and bring the whole tithe into the storehouse, and God will open the windows of heaven and pour out a blessing', ''),
     ('They must sell their tithes and bring the money to the priests instead', 'That permission belonged to Hebrews living far from the temple, and it led to gross abuses.'),
     ('They must pay a further twenty percent as a penalty', 'The twenty per cent penalty belonged to the earlier Levitical provision, not to Malachi’s call.'),
     ('They must ask the Levites to pay the tithe on their behalf', 'The Levites received the tithe; they did not pay it for the people.')],
    0,
    'By withholding the tithes the people were robbing God, and were already experiencing his chastisement; repentance would bring the removal of that chastisement from their agriculture.',
    difficulty='medium', tags=['malachi', 'tithe', 'repentance'],
    scripture=['Malachi 3:10-12']))

Q.append(mr(564,
    'Three things are said about the godly: (1) They feared (or reverenced) the Lord and served Him faithfully; (2) they spoke to one another - defending God\'s actions, and exhorting one another not to lose heart in spite of their hard conditions of life; and (3) they esteemed his name',
    'Three things are said about the godly remnant in Malachi 3:16. Select the three.',
    [('They feared or reverenced the Lord and served him faithfully', True, ''),
     ('They spoke to one another, defending God’s actions and exhorting one another not to lose heart', True, ''),
     ('They esteemed his name', True, ''),
     ('They brought only the best animals to the altar', False, 'The Law required the best animals, but this is not among the three things said of the remnant.'),
     ('They complained that it was vain to serve God', False, 'That was the complaint of the majority, who by it discredited God’s service.')],
    'The remnant stands in contrast to the rest of the nation, who by their lifestyle showed that they despised God’s name; of the godly a book of remembrance was written before the Lord.',
    difficulty='medium', tags=['malachi', 'remnant']))

# --- 5.6 Conclusion ---
Q.append(mc(572,
    'The Admonition (4:4): The people of Israel are told to "Remember the law of Moses my servant, the decrees and the laws that I commanded him at Horeb for all Israel."',
    'What is the admonition with which the Book of Malachi closes (4:4)?',
    [('That Israel should remember the law of Moses, the decrees and laws commanded him at Horeb for all Israel', ''),
     ('That Israel should bring the whole tithe into the storehouse', 'That call belongs to the charge concerning the tithes in 3:7-12.'),
     ('That Israel should put away the daughters of a strange god', 'The charge concerning mixed marriage stands at 2:10-16.'),
     ('That Israel should rebuild the temple without delay', 'The temple had long been rebuilt by Malachi’s day.')],
    0,
    'The admonition is a warning to the majority of the nation who had defied and neglected the Law and were therefore going to face the consequences.',
    difficulty='easy', tags=['malachi', 'law-of-moses']))

Q.append(mc(574,
    'The Promise (4:5-6): The promise looked forward to the coming of the Prophet Elijah – who will restore the hearts of the Fathers to their children, and the heart of their children to their fathers',
    'What is the promise with which the Book of Malachi closes (4:5-6)?',
    [('The coming of the prophet Elijah, who will restore the hearts of the fathers to their children and the hearts of the children to their fathers', ''),
     ('The rebuilding of the temple in Jerusalem', 'The temple had already been rebuilt under Haggai and Zechariah.'),
     ('The return of the exiles scattered throughout the world', 'That promise of restoration belongs to the close of Amos.'),
     ('The coming of a new king from the line of David', 'The syllabus names the coming of Elijah, not of a Davidic king, as the promise here.')],
    0,
    'The concluding verses of Malachi are both an admonition and a promise; three views have been advanced about the identity of the promised Elijah.',
    difficulty='medium', tags=['malachi', 'elijah', 'promise'],
    scripture=['Matthew 11:14', 'Luke 1:17']))

# --- 5.7 Summary and Conclusion ---
Q.append(tf(587,
    'The Book of Malachi is seen by many as forming a bridge between the Old Testament and the New Testament.',
    'The Book of Malachi is seen by many as forming a bridge between the Old Testament and the New Testament.',
    True,
    'It closes the Old Testament revelation and points forward, through the promise of Elijah, to the ministry that would prepare the way for the Messiah.',
    difficulty='easy', tags=['malachi', 'canon']))
