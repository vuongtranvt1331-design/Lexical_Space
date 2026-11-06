import { memoryStatusFor, normalizeRemoteVocabulary, timestamp, wordTopics } from './vocabulary.js';
export const DAY_MS = 86400000;
export function calendarDay(value = Date.now()) {
  const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addCalendarDays(now, days) { const d = new Date(now); d.setDate(d.getDate() + days); return d.toISOString(); }
export const isNewWord = word => !(Number(word.reviewCount) > 0 || timestamp(word.lastReviewedAt) > 0);
export const isDue = (word, now = Date.now()) => !word.deleted && timestamp(word.dueDate ?? word.due) <= now;
// SM-2-inspired intervals advance after scheduled successes on distinct calendar days.
export function scheduleReview(record, grade, now = Date.now()) {
  if (![0, 1, 2, 3].includes(grade)) throw new Error('Invalid recall grade.');
  const word = normalizeRemoteVocabulary(record), today = calendarDay(now);
  const canGraduate = !word.successfulDays.includes(today) && (isNewWord(word) || calendarDay(timestamp(word.dueDate)) <= today);
  const quality = [0, 3, 4, 5][grade];
  const easeFactor = Math.max(1.3, word.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let repetition = word.repetition, interval = word.interval, successfulDays = [...word.successfulDays], dueDate;
  if (grade === 0) { repetition = 0; interval = 0; dueDate = new Date(now + 10 * 60000).toISOString(); }
  else {
    if (canGraduate) {
      repetition++; successfulDays.push(today);
      interval = repetition === 1 ? 1 : repetition === 2 ? (grade === 1 ? 3 : 6) : Math.max(1, Math.round(Math.max(1, interval) * (grade === 1 ? 1.2 : easeFactor) * (grade === 3 ? 1.3 : 1)));
    } else interval = Math.max(1, interval);
    dueDate = addCalendarDays(now, interval);
  }
  const goodReviewCount = grade === 0 ? 0 : word.goodReviewCount + Number(grade === 2);
  const promoted = grade === 3 || (grade === 2 && goodReviewCount >= 3);
  const autoMastered = grade !== 0 && (word.autoMastered || promoted);
  const masteryOverride = grade === 0 || promoted ? null : word.masteryOverride;
  return { ...word, repetition, interval, easeFactor, successfulDays, dueDate, lastReviewedAt: now, lastGrade: grade,
    reviewCount: word.reviewCount + 1, lapses: word.lapses + (grade === 0 ? 1 : 0),
    goodReviewCount, autoMastered, masteryOverride, memoryStatus: memoryStatusFor({ masteryOverride, autoMastered }) };
}
function withinDailyLimit(words, limit, used, counted, preferred) {
  if (limit == null) return words;
  let remaining = Math.max(0, limit - used.size);
  const byId = new Map(words.map(word => [word.id, word]));
  const ordered = [...preferred].map(id => byId.get(id)).filter(Boolean).concat(words.filter(word => !preferred.has(word.id)));
  const selected = new Set();
  for (const { id } of ordered) {
    if (counted.has(id)) selected.add(id);
    else if (remaining > 0) { selected.add(id); remaining--; }
  }
  return words.filter(word => selected.has(word.id));
}

export function selectPracticeWords(words, { mode = 'learning', topic = 'ALL', favorites = false, now = Date.now(),
  ledger, settings = {}, preferredIds = [], retryIds = [] } = {}) {
  const retries = new Set(retryIds);
  const eligible = words.filter(w => !w.deleted && !retries.has(w.id) && (topic === 'ALL' || wordTopics(w).includes(topic)) && (!favorites || w.isFavorite));
  const due = eligible.filter(w => !isNewWord(w) && isDue(w, now)).sort((a, b) => timestamp(a.dueDate) - timestamp(b.dueDate) || a.id.localeCompare(b.id));
  const fresh = mode === 'review' ? [] : eligible.filter(isNewWord).sort((a, b) => a.id.localeCompare(b.id));
  const reviewed = new Set(Array.isArray(ledger?.dailyReviewIds) ? ledger.dailyReviewIds : []);
  const learned = new Set(Array.isArray(ledger?.dailyNewIds) ? ledger.dailyNewIds : []);
  const counted = new Set([...reviewed, ...learned]), preferred = new Set(preferredIds);
  const selectedReview = withinDailyLimit(due, settings.dailyReviewLimit, reviewed, counted, preferred);
  const selectedNew = withinDailyLimit(fresh, settings.dailyNewLimit, learned, counted, preferred);
  return { review: selectedReview, fresh: selectedNew, limited: selectedReview.length < due.length || selectedNew.length < fresh.length };
}
