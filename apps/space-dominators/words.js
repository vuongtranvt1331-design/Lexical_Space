(function () {
  'use strict';

  // Dedicated C2 English vocabulary deck (60 high-register accurate synonymous pairs
  // with distinct distractors and Vietnamese meanings).
  // Format per row: clue|first synonym|second synonym|decoy1|decoy2|decoy3|decoy4|decoy5
  const fallbackRaw = `
làm sáng tỏ, giải thích rõ|elucidate|expound|obfuscate|confound|distort|truncate|prevaricate
xoa dịu, làm nguôi giận|mollify|propitiate|aggravate|exasperate|precipitate|enervate|disparage
phù du, chóng tàn|ephemeral|evanescent|perpetual|perennial|inveterate|immutable|obstinate
phong phú, dồi dào|copious|profuse|exiguous|deficient|penurious|meager|sparse
bí ẩn, khó hiểu|arcane|esoteric|manifest|patent|ubiquitous|intelligible|pellucid
làm suy yếu, kiệt sức|enervate|debilitate|invigorate|fortify|galvanize|resuscitate|reinforce
tính ba hoa, nói nhiều|loquacious|garrulous|taciturn|laconic|reticent|diffident|succinct
thâm độc, xảo quyệt|insidious|perfidious|ingenuous|candid|guileless|scrupulous|upright
khen ngợi nồng nhiệt|laud|extol|castigate|censure|vituperate|disparage|reprimand
ghét cay ghét đắng|abominate|execrate|revere|venerate|relish|cherish|admire
độc ác, hiểm độc|malevolent|virulent|benevolent|benign|altruistic|magnanimous|munificent
do dự, lưỡng lự|vacillate|oscillate|persevere|endure|resolve|decide|persist
bướng bỉnh, khó bảo|recalcitrant|intractable|compliant|docile|tractable|pliant|submissive
làm giảm nhẹ nỗi đau|mitigate|alleviate|exacerbate|aggravate|intensify|augment|escalate
bẩm sinh, vốn có|innate|inherent|acquired|extrinsic|adventitious|peripheral|transient
hời hợt, qua loa|perfunctory|desultory|meticulous|exhaustive|profound|rigorous|punctilious
hống hách, độc đoán|imperious|peremptory|deferential|servile|meek|acquiescent|obsequious
rõ ràng, minh bạch|lucid|pellucid|opaque|turbid|enigmatic|recondite|abstruse
thô lỗ, cộc cằn|surly|churlish|affable|genial|courteous|urbane|cordial
dối trá, không thật|mendacious|disingenuous|veracious|candid|forthright|authentic|trustworthy
ngây thơ, thật thà|ingenuous|guileless|calculating|devious|artful|cynical|shrewd
bủn xỉn, keo kiệt|parsimonious|penurious|lavish|prodigal|munificent|generous|profligate
thèm muốn, tham lam|covetous|cupidinous|altruistic|generous|ascetic|detached|content
hiếu chiến, hung hăng|bellicose|pugnacious|pacifist|irenic|dovish|conciliatory|serene
bình thản, điềm tĩnh|phlegmatic|imperturbable|frantic|mercurial|hysterical|volatile|excitable
chua cay, châm chọc|mordant|caustic|soothing|balmy|flattering|palliative|cordial
kiêu ngạo, trịch thượng|supercilious|disdainful|modest|diffident|humble|unassuming|respectful
xấc xược, láo xược|insolent|impudent|deferential|reverent|courteous|meek|obedient
có tính giáo huấn|didactic|moralizing|frivolous|recreational|vacuous|hedonistic|trivial
vô tình, lơ đãng|inadvertent|heedless|deliberate|intentional|calculated|vigilant|wary
sắc sảo, nhạy bén|perspicacious|astute|obtuse|dense|vacuous|fatuous|unperceptive
sinh sôi nhiều, mắn đẻ|prolific|fecund|barren|sterile|infertile|unproductive|desolate
căm ghét tột cùng|abhor|detest|adore|treasure|cherish|embrace|esteem
nịnh hót, bợ đỡ|sycophantic|obsequious|rebellious|defiant|aloof|assertive|arrogant
khắc khổ, giản dị|austere|ascetic|opulent|hedonistic|sybaritic|indulgent|lavish
rỗng tuếch, vô vị|vacuous|inane|profound|erudite|sagacious|insightful|weighty
thay đổi thất thường|mercurial|capricious|steadfast|invariable|immutable|resolute|constant
điềm đạm, trầm tĩnh|equanimous|placid|agitated|turbulent|volatile|frenetic|exasperated
chớp nhoáng, thoáng qua|fleeting|transient|permanent|ceaseless|immutable|lasting|indelible
giả mạo, nguỵ tạo|spurious|apocryphal|genuine|authentic|verifiable|legitimate|bona fide
tự phụ, ngạo mạn|haughty|overweening|servile|submissive|humble|self-effacing|modest
làm dịu bớt đau đớn|assuage|palliate|exacerbate|aggravate|inflame|intensify|escalate
lười biếng, uể oải|indolent|torpid|diligent|assiduous|industrious|dynamic|fervent
sôi nổi, nhiệt thành|zealous|fervent|apathetic|indifferent|lukewarm|nonchalant|listless
độc hại, nguy hiểm|deleterious|pernicious|salubrious|salutary|beneficial|wholesome|innocuous
ngây thơ, mộc mạc|artless|naive|cunning|crafty|devious|worldly|manipulative
chê bai, gièm pha|disparage|deprecate|extol|applaud|venerate|laud|commend
xua tan, giải tán|dispel|dissipate|aggregate|amass|congregate|gather|foster
quanh co, lảng tránh|equivocate|prevaricate|clarify|confront|assert|articulate|validate
sự suy đồi, sa đọa|decadence|degeneracy|virtue|integrity|nobility|rectitude|probity
khôn ngoan, sáng suốt|sagacious|sapient|foolish|fatuous|injudicious|gullible|senseless
nhút nhát, e dè|diffident|timorous|audacious|intrepid|brassy|presumptuous|brazen
dũng cảm, quả cảm|intrepid|dauntless|cowardly|craven|pusillanimous|timid|recreant
ngắn gọn, súc tích|laconic|compendious|verbose|redundant|pleonastic|rambling|prolix
ương ngạnh, hay gây gổ|fractious|contentious|harmonious|amicable|genial|peaceable|cooperative
dỗ ngọt, dụ dỗ|cajole|inveigle|dissuade|bully|coerce|intimidate|compel
thận trọng, cảnh giác|chary|circumspect|heedless|rash|incautious|headlong|reckless
hoang vắng, ảm đạm|desolate|bleak|bustling|flourishing|teeming|cheerful|lush
sự nhân nhượng, xoa dịu|appeasement|conciliation|instigation|defiance|confrontation|provocation|rebellion
tính liêm chính, ngay thẳng|probity|rectitude|duplicity|perfidy|corruption|baseness|depravity
`.trim().split('\n').map(line => line.trim().split('|'));

  const c2Entries = fallbackRaw.filter(row => row.length >= 8);
  const fallbackTypingWords = [...new Set(c2Entries.flatMap(row => row.slice(1)))];

  function random() {
    if (typeof window !== 'undefined' && typeof window.SpaceFlightRandom === 'function') {
      return window.SpaceFlightRandom();
    }
    return Math.random();
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  let activeEntries = c2Entries.slice();
  let typingWords = fallbackTypingWords.slice();
  let sourceLabel = 'C2 Mastery deck · ' + c2Entries.length + ' advanced synonym pairs';

  async function prepareMatch(options = {}) {
    const reader = typeof window !== 'undefined' ? window.lexicalVocabulary : null;
    const paramUser = typeof options === 'string' ? options : (options?.profile || options?.user);
    const profile = paramUser || (reader?.activeProfile ? reader.activeProfile() : '');
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    const topic = options?.topic || (params.get('mode') === 'topic' ? (params.get('topic') || '').trim().toLowerCase() : '');

    if (typeof document !== 'undefined') {
      for (const link of document.querySelectorAll('[data-carry-deck]')) {
        try {
          const dest = new URL(link.href, location.href);
          for (const k of ['user', 'mode', 'topic']) {
            if (params.has(k)) dest.searchParams.set(k, params.get(k));
          }
          link.href = dest.href;
        } catch {}
      }
    }

    const norm = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

    let records = [];
    if (profile && reader?.readWords) {
      try {
        records = await reader.readWords(profile);
      } catch {
        records = [];
      }
    }

    const validEntries = new Set();
    const groups = new Map();
    const pool = new Set();

    for (const row of records || []) {
      if (!row || row.deleted) continue;
      if (topic && reader?.topicsOf && !reader.topicsOf(row).some(t => norm(t) === topic)) continue;
      const word = norm(row.word);
      if (!word) continue;
      validEntries.add(word);
      pool.add(word);

      const clue = typeof row.meaning === 'string' && row.meaning.trim()
        ? row.meaning.trim()
        : (typeof row.translation === 'string' ? row.translation.trim() : '');
      if (!clue) continue;
      const key = norm(clue);
      if (!groups.has(key)) groups.set(key, { clue, answers: new Set() });
      const answers = groups.get(key).answers;
      answers.add(word);

      for (const raw of [row.synonym1, row.synonym2, row.synonym, ...[row.synonyms].flat()]) {
        if (typeof raw !== 'string') continue;
        for (const item of raw.split(/[,;|]/).map(norm).filter(Boolean)) {
          answers.add(item);
          pool.add(item);
        }
      }
    }

    const count = validEntries.size;
    const reserve = fallbackTypingWords;

    const playable = [];
    if (count >= 50) {
      const vocabTypingWords = [...pool];
      for (const { clue, answers } of groups.values()) {
        if (answers.size < 2) continue;
        const choices = shuffle([...answers]);
        const decoys = shuffle(vocabTypingWords.filter(w => !answers.has(w)));
        if (decoys.length < 5) {
          const known = new Set([...answers, ...decoys]);
          decoys.push(...shuffle(reserve.filter(w => !known.has(w))).slice(0, 5 - decoys.length));
        }
        playable.push([clue, ...choices.slice(0, 2), ...decoys.slice(0, 5)]);
      }
    }

    const useFallback = count < 50 || playable.length === 0;

    if (!useFallback && playable.length) {
      activeEntries = playable;
      typingWords = [...pool];
      sourceLabel = (topic || 'Your vocabulary') + ' · ' + playable.length + ' playable clues';
    } else {
      activeEntries = c2Entries.slice();
      typingWords = fallbackTypingWords.slice();
      sourceLabel = count < 50
        ? 'C2 Mastery deck · ' + c2Entries.length + ' advanced synonym pairs'
        : (topic || 'Your vocabulary') + ' · C2 fallback (no synonym pairs found)';
    }

    bag = [];
    lastEntry = null;

    return { count, useFallback };
  }

  let bag = [];
  let lastEntry = null;

  function next() {
    if (bag.length === 0) {
      bag = shuffle(activeEntries.slice());
      if (bag.length > 1 && bag[bag.length - 1] === lastEntry) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    lastEntry = bag.pop();
    const [clue, first, second, ...decoys] = lastEntry;
    const distractorCount = random() < 0.5 ? 4 : 5;
    return {
      clue,
      pair: [first, second],
      words: shuffle([first, second, ...shuffle(decoys.slice()).slice(0, distractorCount)])
    };
  }

  const initialReady = prepareMatch();

  window.SpaceWords = Object.freeze({
    next,
    prepareMatch,
    loadDeck: prepareMatch,
    ready: initialReady,
    source: () => sourceLabel,
    get typingWords() { return typingWords; }
  });
})();
