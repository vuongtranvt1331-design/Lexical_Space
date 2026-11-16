import { normalizeDocument } from './parser.js';

export const PROGRESS_STORAGE_KEY = 'grammarspace_student_progress_v1';
export const STORAGE_KEY = 'grammarSpace_lessons_v1';
export const IDB_NAME = 'grammarspace_db';
export const IDB_STORE_NAME = 'student_progress';
export const IDB_VERSION = 1;

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const DAILY_SCORE_DECAY = 2;

/**
 * Unified Progress Color Rules:
 * < 20%: Red (#e74c3c)
 * 20% - 79%: Yellow/Amber (#f39c12)
 * >= 80%: Green (#2ecc71)
 */
export function getProgressColor(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return '#e74c3c';
  if (p < 80) return '#f39c12';
  return '#2ecc71';
}

export function getProgressColorClass(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return 'progress-red';
  if (p < 80) return 'progress-yellow';
  return 'progress-green';
}

/**
 * Color Logic for Apply (Nâng cao) Bar:
 * < 20%: Red (#e74c3c)
 * 20% - 79%: Yellow/Amber (#f39c12)
 * >= 80%: Blue / Xanh biển (#3498db)
 */
export function getApplyProgressColor(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return '#e74c3c';
  if (p < 80) return '#f39c12';
  return '#3498db';
}

export function getApplyProgressColorClass(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return 'progress-red';
  if (p < 80) return 'progress-yellow';
  return 'progress-blue';
}

/**
 * Soft pastel marker colors for hand-drawn highlighter aesthetic:
 * Practice: Pastel Red (#f28b82), Pastel Yellow (#f7dc6f), Pastel Green (#82e0aa)
 * Apply:    Pastel Red (#f28b82), Pastel Yellow (#f7dc6f), Pastel Blue (#85c1e9)
 */
export function getPastelProgressColor(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return '#f28b82';
  if (p < 80) return '#f7dc6f';
  return '#82e0aa';
}

export function getPastelApplyProgressColor(percent) {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  if (p < 20) return '#f28b82';
  if (p < 80) return '#f7dc6f';
  return '#85c1e9';
}

/**
 * IndexedDB helper for robust persistent storage
 */
export function openIDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'lessonId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[ProgressManager] IndexedDB open failed:', request.error);
      resolve(null);
    };
  });
}

export async function saveToIndexedDB(lessonId, record) {
  try {
    const db = await openIDB();
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const entry = { lessonId, ...record, updatedAt: Date.now() };
      store.put(entry);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[ProgressManager] IndexedDB save failed:', err);
    return false;
  }
}

export async function getFromIndexedDB(lessonId) {
  try {
    const db = await openIDB();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(lessonId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Extensible adapter function for future Firestore / Firebase linking.
 */
export async function triggerFutureFirebaseSync(lessonId, progressRecord) {
  try {
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore) {
      // Future Firebase Firestore sync implementation:
      // const db = window.firebase.firestore();
      // await db.collection('student_progress').doc(lessonId).set(progressRecord, { merge: true });
    }
  } catch (error) {
    console.warn('[ProgressManager] Firebase sync pending/offline:', error);
  }
  return { synced: false, adapterReady: true, lessonId, progressRecord };
}

/**
 * ProgressManager: handles local persistence and spaced memory decay
 */
export const ProgressManager = {
  getStorageKey() {
    return PROGRESS_STORAGE_KEY;
  },

  getAllProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  getRawRecord(lessonId) {
    if (!lessonId) return null;
    const all = this.getAllProgress();
    if (all[lessonId]) return all[lessonId];

    // Fallback: migrate from legacy lesson storage if present
    try {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw) {
        const list = JSON.parse(legacyRaw);
        if (Array.isArray(list)) {
          const found = list.find(item => item && item.id === lessonId);
          if (found && typeof found.score === 'number') {
            const lastCompletedAt = typeof found.lastCompletedDate === 'number'
              ? new Date(found.lastCompletedDate).toISOString()
              : new Date().toISOString();
            const record = {
              score: found.score,
              originalScore: found.score,
              lastCompletedAt,
              totalAttempts: 1
            };
            all[lessonId] = record;
            try {
              localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(all));
            } catch {}
            return record;
          }
        }
      }
    } catch {}

    return null;
  },

  recordLessonCompletion(lessonId, score, metadata = {}) {
    if (!lessonId) return null;
    const numScore = typeof score === 'number' && Number.isFinite(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : 0;
    const all = this.getAllProgress();
    const existing = all[lessonId] || {};
    const totalAttempts = (typeof existing.totalAttempts === 'number' ? existing.totalAttempts : 0) + 1;
    const lastCompletedAt = new Date().toISOString();

    const practiceScore = typeof metadata.practiceScore === 'number' && Number.isFinite(metadata.practiceScore)
      ? Math.max(0, Math.min(100, Math.round(metadata.practiceScore)))
      : (typeof existing.practiceScore === 'number' ? existing.practiceScore : numScore);

    const applyScore = typeof metadata.applyScore === 'number' && Number.isFinite(metadata.applyScore)
      ? Math.max(0, Math.min(100, Math.round(metadata.applyScore)))
      : (typeof existing.applyScore === 'number' ? existing.applyScore : 0);

    // Absolute overwrite of the latest session with dual tier progress
    const record = {
      score: numScore,
      originalScore: numScore,
      practiceScore,
      applyScore,
      lastCompletedAt,
      totalAttempts,
      updatedAt: Date.now(),
      ...metadata,
      practiceScore,
      applyScore
    };

    all[lessonId] = record;
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[ProgressManager] Could not save progress to localStorage', e);
    }

    // Overwrite in IndexedDB
    saveToIndexedDB(lessonId, record);

    // Extensible hook for Firestore syncing
    triggerFutureFirebaseSync(lessonId, record);

    return record;
  },

  saveToIndexedDB,
  getFromIndexedDB,

  getLessonStatus(lessonId, now = Date.now()) {
    if (!lessonId) return null;
    const record = this.getRawRecord(lessonId);
    if (!record) return null;
    const originalScore = Number.isFinite(record.originalScore) ? record.originalScore : record.score;
    if (!Number.isFinite(originalScore)) return null;

    // Support both current ISO timestamps and older numeric completion dates.
    const completedAt = record.lastCompletedAt ?? record.lastCompletedDate;
    const completedTimestamp = typeof completedAt === 'number' ? completedAt : Date.parse(completedAt);
    const validTimestamp = Number.isFinite(completedTimestamp) ? completedTimestamp : now;
    const daysPassed = Math.max(0, Math.floor((now - validTimestamp) / DAY_IN_MS));
    const decayLost = daysPassed * DAILY_SCORE_DECAY;
    const currentScore = Math.max(0, originalScore - decayLost);

    // Visual metadata:
    // Green: fresh/high (0-2 days)
    // Orange: 3-6 days
    // Red: >=7 days
    let badgeColor = 'green';
    let badgeColorHex = '#48bb78';
    if (daysPassed >= 7) {
      badgeColor = 'red';
      badgeColorHex = '#e53e3e';
    } else if (daysPassed >= 3) {
      badgeColor = 'orange';
      badgeColorHex = '#ed8936';
    }

    const statusText = daysPassed === 0
      ? 'Vừa hoàn thành · Giảm 2 điểm phần trăm sau mỗi 24 giờ'
      : `Đã giảm ${decayLost} điểm phần trăm sau ${daysPassed} ngày · Ôn tập để cập nhật điểm`;

    // Keep saved scores unchanged; calculate decayed values for each displayed tier.
    const practiceScore = Number.isFinite(record.practiceScore)
      ? Math.max(0, record.practiceScore - decayLost)
      : currentScore;
    const applyScore = Number.isFinite(record.applyScore)
      ? Math.max(0, record.applyScore - decayLost)
      : 0;

    return {
      score: currentScore,
      currentScore,
      displayedScore: Math.round(currentScore),
      originalScore,
      practiceScore,
      applyScore,
      practiceTotal: record.practiceTotal || 0,
      applyTotal: record.applyTotal || 0,
      lastCompletedAt: record.lastCompletedAt,
      totalAttempts: record.totalAttempts || 1,
      daysPassed,
      decayLost,
      statusText,
      badgeColor,
      badgeColorHex
    };
  }
};

// Also attach globally for flexibility
if (typeof window !== 'undefined') {
  window.ProgressManager = ProgressManager;
  window.triggerFutureFirebaseSync = triggerFutureFirebaseSync;
  window.saveToIndexedDB = saveToIndexedDB;
  window.getFromIndexedDB = getFromIndexedDB;
}

// Backward compatibility functions
const questionTotal = lesson => lesson.parts.reduce((sum, part) => sum + part.exercises.length, 0);

export function normalizeStoredProgress(item, total, now) {
  let score = null, completedAt = null;
  if (total > 0 && typeof item.score === 'number' && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100) {
    score = item.score;
  } else if (item.score && typeof item.score === 'object') {
    const legacy = item.score;
    if (total > 0 && Number.isInteger(legacy.correct) && legacy.correct >= 0 && legacy.correct <= total && legacy.total === total) {
      score = Math.round(legacy.correct / total * 100);
      completedAt = typeof legacy.completedAt === 'string' ? Date.parse(legacy.completedAt) : null;
    }
  }
  if (score === null) return { score: null, lastCompletedDate: null };
  const isTimestamp = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8640000000000000;
  if (isTimestamp(item.lastCompletedDate)) completedAt = item.lastCompletedDate;
  if (!isTimestamp(completedAt)) completedAt = now;
  return { score, lastCompletedDate: completedAt };
}

export function getLessonProgress(lesson, now = Date.now()) {
  const status = ProgressManager.getLessonStatus(lesson?.id, now);
  if (status) {
    return {
      originalScore: status.originalScore,
      currentScore: status.currentScore,
      displayedScore: status.displayedScore,
      daysPassed: status.daysPassed,
      decayLost: status.decayLost,
      statusText: status.statusText,
      badgeColor: status.badgeColor,
      badgeColorHex: status.badgeColorHex,
      level: status.badgeColor === 'green' ? 'high' : status.badgeColor === 'orange' ? 'medium' : 'low'
    };
  }
  if (typeof lesson.score !== 'number' || !Number.isFinite(lesson.score) || lesson.score < 0 || lesson.score > 100 || typeof lesson.lastCompletedDate !== 'number' || !Number.isFinite(lesson.lastCompletedDate)) return null;
  const daysPassed = Math.max(0, Math.floor((now - lesson.lastCompletedDate) / DAY_IN_MS));
  const decayLost = daysPassed * DAILY_SCORE_DECAY;
  const currentScore = Math.max(0, lesson.score - decayLost);
  return {
    originalScore: lesson.score,
    currentScore,
    displayedScore: Math.round(currentScore),
    daysPassed,
    decayLost,
    level: daysPassed >= 7 ? 'low' : daysPassed >= 3 ? 'medium' : 'high',
    badgeColor: daysPassed >= 7 ? 'red' : daysPassed >= 3 ? 'orange' : 'green'
  };
}

export function loadLibrary(notice) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Invalid history');
    const seen = new Set(), now = Date.now();
    let needsMigration = false;
    const loaded = saved.map(item => {
      if (!item || typeof item.id !== 'string' || seen.has(item.id)) throw new Error('Invalid lesson');
      seen.add(item.id);
      const data = normalizeDocument(item.title, item.parts);
      const progress = normalizeStoredProgress(item, questionTotal(data), now);
      if (item.score !== progress.score || item.lastCompletedDate !== progress.lastCompletedDate) needsMigration = true;
      return { id: item.id, ...data, origin: ['general', 'firebase'].includes(item.origin) ? item.origin : 'upload', customTitle: typeof item.customTitle === 'string' ? item.customTitle.trim() : '', sourceName: typeof item.sourceName === 'string' ? item.sourceName : '', addedAt: typeof item.addedAt === 'string' ? item.addedAt : '', ...progress };
    });
    
    if (needsMigration) {
      try {
        const migrated = saved.map((item, index) => ({ ...item, score: loaded[index].score, lastCompletedDate: loaded[index].lastCompletedDate }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch { notice('Your previous scores are available in this tab, but the updated history could not be saved.'); }
    }
    return { lessons: loaded, writable: true };
  } catch {
    notice('Saved lessons could not be loaded. You can still use this tab; existing stored data will be preserved.');
    return { lessons: null, writable: false };
  }
}

export function saveLibrary(lessons) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
}

export function createScoreRecord(correct, total, now = Date.now()) {
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(correct) || correct < 0 || correct > total || !Number.isFinite(now) || now < 0) {
    throw new RangeError('Invalid score or completion date.');
  }
  return { score: Math.round(correct / total * 100), lastCompletedDate: now };
}
