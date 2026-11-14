import { context } from '../core/context.js';
import { readUserWords, readUserWord } from '../core/idb-manager.js';
import { lookupMissingVocabulary, missingVocabularyFields } from '../core/quick-fill.js';
import { normalizeTerm, validateVocabulary } from '../core/vocabulary.js';
import { clozeText } from '../core/recall-utils.js';

const $ = id => document.getElementById(id);
let active = null;

function controls(busy) {
  $('btn-update-old-vocabulary').disabled = busy;
  $('btn-update-old-vocabulary').setAttribute('aria-busy', String(busy));
  $('btn-cancel-vocabulary-update').hidden = !busy;
}

export function cancelVocabularyUpdate() {
  active?.abort();
  active = null;
  if (!$('btn-update-old-vocabulary')) return;
  controls(false);
  $('vocabulary-update-status').textContent = '';
}

function blankFieldPatch(original, live, suggestions) {
  if (normalizeTerm(original.word) !== normalizeTerm(live.word) ||
      original.pos !== live.pos || original.meaning !== live.meaning || original.sense !== live.sense) return {};
  const missing = new Set(missingVocabularyFields(live));
  const patch = Object.fromEntries(Object.entries(suggestions).filter(([field]) => missing.has(field)));
  if (live.exampleSentence !== original.exampleSentence) {
    delete patch.clozeSentence;
    const cloze = clozeText(live.exampleSentence, live.word, { inflections: true });
    if (missing.has('clozeSentence') && cloze.includes('[ _____ ]')) patch.clozeSentence = cloze;
  }
  if (patch.exampleSentence && suggestions.exampleSourceId) patch.exampleSourceId = suggestions.exampleSourceId;
  return patch;
}

export async function updateOldVocabulary() {
  if (active || !context.currentUser || context.profileLoading) return;
  if (navigator.onLine === false) {
    $('vocabulary-update-status').textContent = 'Cần kết nối mạng để tra cứu bộ từ cũ.';
    return;
  }
  const user = context.currentUser, generation = context.accountGeneration;
  const controller = new AbortController();
  active = controller; controls(true);
  const current = () => active === controller && generation === context.accountGeneration && user === context.currentUser;
  const cache = new Map();
  let processed = 0, updated = 0, unchanged = 0, failed = 0;
  const status = message => { if (current()) $('vocabulary-update-status').textContent = message; };
  try {
    status('Đang kiểm tra các trường còn thiếu…');
    const words = (await readUserWords(user)).filter(word => word.word && missingVocabularyFields(word).length);
    if (!current()) return;
    for (let offset = 0; offset < words.length && !controller.signal.aborted; offset += 2) {
      await Promise.all(words.slice(offset, offset + 2).map(async original => {
        try {
          const key = JSON.stringify([original.word, original.pos, original.sense, original.exampleSentence,
            original.clozeSentence, missingVocabularyFields(original)]);
          if (!cache.has(key)) cache.set(key, lookupMissingVocabulary(original, { signal: controller.signal }));
          const suggestions = await cache.get(key);
          for (let attempt = 0; attempt < 2; attempt++) {
            if (!current() || controller.signal.aborted) return;
            const live = await readUserWord(user, original.id);
            if (!live || live.deleted) { unchanged++; return; }
            const patch = blankFieldPatch(original, live, suggestions);
            if (!Object.keys(patch).length) { unchanged++; return; }
            const validation = validateVocabulary({ ...live, ...patch });
            if (!validation.valid) { failed++; return; }
            try {
              if (!current() || controller.signal.aborted) return;
              await context.commitVocabularyChanges([{ id: live.id, patch, expectedVersion: live }], [], user,
                { render: $('modal-settings').hidden });
              updated++;
              return;
            } catch (error) {
              if (attempt) throw error;
              // Re-read after a concurrent edit and fill only fields that are still blank.
            }
          }
        } catch {
          if (!controller.signal.aborted) failed++;
        } finally {
          processed++;
          status(`Đã kiểm tra ${processed}/${words.length} từ · Đã bổ sung ${updated} từ.`);
        }
      }));
    }
    status(`${controller.signal.aborted ? 'Đã dừng' : 'Hoàn tất'} · Đã bổ sung ${updated} từ · ${unchanged} từ giữ nguyên · ${failed} từ cần thử lại. Những ô chưa có dữ liệu vẫn để trống.`);
  } catch {
    status('Chưa thể cập nhật bộ từ. Bạn có thể thử lại.');
  } finally {
    if (current()) {
      controls(false); active = null;
      try { await context.refreshVocabulary(user); }
      catch { /* Each completed word is already saved in its local transaction. */ }
    }
  }
}

export function setupVocabularyUpdate() {
  $('btn-update-old-vocabulary').addEventListener('click', () => void updateOldVocabulary());
  $('btn-cancel-vocabulary-update').addEventListener('click', () => active?.abort());
  window.addEventListener('pagehide', cancelVocabularyUpdate);
}
