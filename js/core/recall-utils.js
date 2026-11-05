// Pure helpers shared by the recall UI, library and interaction tests.
export function normalizeAnswer(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en')
    .replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');
}
export const matchesTarget = (answer, target) => !!normalizeAnswer(answer) && normalizeAnswer(answer) === normalizeAnswer(target);
export function matchesRecallAnswer(answer, { word, synonyms = [] }) {
  const normalized = answer.trim().toLowerCase();
  return normalized !== '' && [word, ...synonyms].some(value => typeof value === 'string' && value.trim().toLowerCase() === normalized);
}
const IRREGULAR = { be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], give: ['gave', 'given'], go: ['went', 'gone', 'goes'], do: ['did', 'done', 'does'],
  have: ['had', 'has'], take: ['took', 'taken'], make: ['made'], see: ['saw', 'seen'], get: ['got', 'gotten'], run: ['ran'], come: ['came'], find: ['found'],
  think: ['thought'], bring: ['brought'], buy: ['bought'], teach: ['taught'], write: ['wrote', 'written'], speak: ['spoke', 'spoken'], leave: ['left'],
  begin: ['began', 'begun'], keep: ['kept'], know: ['knew', 'known'], feel: ['felt'], hold: ['held'], child: ['children'], person: ['people'], mouse: ['mice'] };
function targetForms(word) {
  const [first, ...tail] = normalizeAnswer(word).split(' '), forms = new Set([first]);
  if (!/^[a-z]{2,}$/.test(first)) return [word];
  const y = /[^aeiou]y$/.test(first), silentE = /[^e]e$/.test(first), stem = silentE ? first.slice(0, -1) : first;
  const ending = /(?:s|x|z|ch|sh|o)$/.test(first) ? 'es' : 's';
  forms.add(y ? first.slice(0, -1) + 'ies' : first + ending);
  forms.add(y ? first.slice(0, -1) + 'ied' : first + (silentE ? 'd' : 'ed'));
  forms.add(stem + 'ing');
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(first)) { forms.add(first + first.at(-1) + 'ed'); forms.add(first + first.at(-1) + 'ing'); }
  for (const irregular of Object.hasOwn(IRREGULAR, first) ? IRREGULAR[first] : []) forms.add(irregular);
  return [...new Set([word, ...[...forms].map(form => [form, ...tail].join(' '))])];
}
export function targetSegments(sentence, word, { inflections = false } = {}) {
  const source = String(sentence || ''), target = String(word || '');
  if (!target) return [{ text: source, target: false }];
  const escaped = (inflections ? targetForms(target) : [target]).sort((a, b) => b.length - a.length).map(form => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(?:${escaped})`, 'giu');
  const letter = value => /[\p{L}\p{N}_]/u.test(value || '');
  const result = []; let offset = 0;
  for (const match of source.matchAll(pattern)) {
    if ((letter(target[0]) && letter(source[match.index - 1])) || (letter(target.at(-1)) && letter(source[match.index + match[0].length]))) continue;
    if (match.index > offset) result.push({ text: source.slice(offset, match.index), target: false });
    result.push({ text: match[0], target: true }); offset = match.index + match[0].length;
  }
  if (offset < source.length || !result.length) result.push({ text: source.slice(offset), target: false });
  return result;
}
export const clozeText = (sentence, word, options) => targetSegments(sentence, word, options).map(part => part.target ? '[ _____ ]' : part.text).join('');
