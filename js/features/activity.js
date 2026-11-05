import { canSyncProfile, context } from '../core/context.js';
import { readStudentStats } from '../core/firebase-sync.js';
import { timestamp } from '../core/vocabulary.js';
import { getLegacyStudentKey } from '../utils/helpers.js';
const activityFlights = new Set();
export function maskStudentKey(key) {
  if (!key) return "unknown";
  const s = String(key);
  if (s.length <= 2) return s[0] + "*";
  return s.slice(0, 2) + "***" + s.slice(-1);
}
export function logActivityDebug(msg, extra = {}) {
  if (!context.DEBUG_ACTIVITY_LOG) return;
  console.log(`[LexicalActivity] ${msg}`, extra);
}
export function getActivityMetaKey(studentKey) {
  return `studentActivity:v3:${studentKey}`;
}
export function clearActivityTimers() {
  if (context.activityThrottleTimer) {
    clearTimeout(context.activityThrottleTimer);
    context.activityThrottleTimer = null;
  }
  if (context.activityIdleTimer) {
    clearTimeout(context.activityIdleTimer);
    context.activityIdleTimer = null;
  }
  if (context.activityRetryTimer) {
    clearTimeout(context.activityRetryTimer);
    context.activityRetryTimer = null;
  }
}
export function resetActivityForUser() {
  clearActivityTimers();
  context.activityStateByStudent = Object.create(null);
  context.lastRecordedActivityAt = 0;
}
export async function loadLocalActivityState(username) {
  const cleanUser = (username || "").trim();
  const studentKey = context.getStudentKey(cleanUser);
  if (!studentKey) return null;
  const cache = context.activityStateByStudent;
  if (cache[studentKey]) return cache[studentKey];
  try {
    const stored = await context.idbGet("metadata", getActivityMetaKey(studentKey))
      || await context.idbGet("metadata", `studentActivity_${getLegacyStudentKey(cleanUser)}`);
    if (cache[studentKey]) return cache[studentKey];
    if (stored?.username === cleanUser && typeof stored.activityLogTimestamp === "number") {
      cache[studentKey] = {
        username: cleanUser,
        studentKey: studentKey,
        activityLogTimestamp: stored.activityLogTimestamp,
        pendingSync: Boolean(stored.pendingSync),
        lastSyncedTimestamp: stored.lastSyncedTimestamp || 0,
        lastWriteAttemptAt: 0,
        retryCount: 0
      };
      return cache[studentKey];
    }
  } catch (err) {
    context.logActivityDebug("IndexedDB read activity state warning", {
      error: String(err)
    });
  }
  return null;
}
export async function saveLocalActivityState(state) {
  if (!state?.username || state.studentKey !== context.getStudentKey(state.username) || typeof state.activityLogTimestamp !== "number") return;
  try {
    const key = getActivityMetaKey(state.studentKey);
    const snapshot = {
      key,
      username: state.username,
      studentKey: state.studentKey,
      activityLogTimestamp: state.activityLogTimestamp,
      pendingSync: Boolean(state.pendingSync),
      lastSyncedTimestamp: state.lastSyncedTimestamp || 0
    };
    await context.updateMetadata([key], records => {
      const previous = records[key];
      const activityLogTimestamp = Math.max(previous?.activityLogTimestamp || 0, snapshot.activityLogTimestamp);
      const lastSyncedTimestamp = Math.max(previous?.lastSyncedTimestamp || 0, snapshot.lastSyncedTimestamp);
      const pendingSync = (previous?.pendingSync || snapshot.pendingSync) && activityLogTimestamp > lastSyncedTimestamp;
      return { records: [{ ...snapshot, activityLogTimestamp, lastSyncedTimestamp, pendingSync }] };
    });
  } catch (err) {
    context.logActivityDebug("IndexedDB write activity state warning", {
      error: String(err)
    });
  }
}

/**
 * Ghi nhận hoạt động học tập thực tế của học sinh hiện tại.
 * - Cập nhật ngay lập tức vào bộ nhớ & IndexedDB (Unix milliseconds từ Date.now()).
 * - Đánh dấu pendingSync = true.
 * - Lên lịch đồng bộ Firestore theo cơ chế throttle 45s và idle 15s.
 */
export function recordLearningActivity(reason = "study_action") {
  if (!canSyncProfile(context.currentUser)) return;
  const cleanUser = context.currentUser.trim();
  const studentKey = context.getStudentKey(cleanUser);
  if (!studentKey) return;
  const now = Date.now();
  // Ngăn một thao tác UI đơn lẻ kích hoạt trùng lặp nhiều lần trong cùng vài chục ms
  if (now - context.lastRecordedActivityAt < 50 && context.activityStateByStudent[studentKey]?.activityLogTimestamp) {
    return;
  }
  context.lastRecordedActivityAt = now;
  const existing = context.activityStateByStudent[studentKey] || {
    username: cleanUser,
    studentKey: studentKey,
    activityLogTimestamp: now,
    pendingSync: true,
    lastSyncedTimestamp: 0,
    lastWriteAttemptAt: 0,
    retryCount: 0
  };
  existing.username = cleanUser;
  existing.studentKey = studentKey;
  existing.activityLogTimestamp = Math.max(now, existing.activityLogTimestamp || 0);
  existing.pendingSync = true;
  context.activityStateByStudent[studentKey] = existing;
  context.logActivityDebug("Recorded learning activity locally", {
    reason,
    student: context.maskStudentKey(studentKey),
    activityLogTimestamp: existing.activityLogTimestamp
  });

  // 1. Lưu ngay xuống IndexedDB (không chặn luồng học tập)
  context.saveLocalActivityState(existing);

  // 2. Đặt lịch đồng bộ định kỳ (Throttle) & khi ngừng tương tác (Idle)
  context.scheduleActivitySync(studentKey);
}
export function scheduleActivitySync(studentKey) {
  if (!studentKey || context.getStudentKey(context.currentUser) !== studentKey) return;
  const state = context.activityStateByStudent[studentKey];
  if (!state || !state.pendingSync) return;

  // Reset bộ đếm ngừng tương tác (Idle timer): nếu học sinh dừng 15s thì kiểm tra đẩy đồng bộ
  if (context.activityIdleTimer) clearTimeout(context.activityIdleTimer);
  context.activityIdleTimer = setTimeout(() => {
    context.activityIdleTimer = null;
    if (context.getStudentKey(context.currentUser) === studentKey) {
      context.flushActivityLogSync({
        reason: "idle_timeout",
        targetStudentKey: studentKey
      });
    }
  }, context.ACTIVITY_IDLE_FLUSH_MS);

  // Keep the periodic throttle timer active during consecutive grades.
  if (!context.activityThrottleTimer) {
    const elapsedSinceLastWrite = Date.now() - (state.lastWriteAttemptAt || 0);
    const delay = elapsedSinceLastWrite >= context.ACTIVITY_SYNC_THROTTLE_MS ? context.ACTIVITY_MIN_INTERVAL_MS : Math.max(context.ACTIVITY_MIN_INTERVAL_MS, context.ACTIVITY_SYNC_THROTTLE_MS - elapsedSinceLastWrite);
    context.activityThrottleTimer = setTimeout(() => {
      context.activityThrottleTimer = null;
      if (context.getStudentKey(context.currentUser) === studentKey) {
        context.flushActivityLogSync({
          reason: "periodic_throttle",
          targetStudentKey: studentKey,
          force: true
        });
      }
    }, delay);
  }
}
export function scheduleActivityRetry(studentKey) {
  if (context.activityRetryTimer) return;
  const state = context.activityStateByStudent[studentKey];
  if (!state || !state.pendingSync) return;
  const retryAttempt = state.retryCount || 1;
  const backoffMs = Math.min(context.ACTIVITY_RETRY_MAX_MS, context.ACTIVITY_RETRY_BASE_MS * Math.pow(2, retryAttempt - 1));
  context.logActivityDebug("Scheduled retry backoff", {
    student: context.maskStudentKey(studentKey),
    retryAttempt,
    backoffMs
  });
  context.activityRetryTimer = setTimeout(() => {
    context.activityRetryTimer = null;
    if (context.getStudentKey(context.currentUser) === studentKey) {
      context.flushActivityLogSync({
        reason: "retry_backoff",
        targetStudentKey: studentKey,
        force: true
      });
    }
  }, backoffMs);
}
export async function flushActivityLogSync(options = {}) {
  const {
    force = false,
    reason = "scheduled",
    targetStudentKey = null,
    targetUsername = null
  } = options;
  const resolvedUsername = (targetUsername || context.currentUser || "").trim();
  if (!canSyncProfile(resolvedUsername)) return false;
  const studentKey = context.getStudentKey(resolvedUsername);
  if (!studentKey || (targetStudentKey && targetStudentKey !== studentKey)) return false;
  const cache = context.activityStateByStudent;
  let state = cache[studentKey];
  if (!state) {
    state = await context.loadLocalActivityState(resolvedUsername);
  }
  if (!state || !state.pendingSync || typeof state.activityLogTimestamp !== "number") {
    return false;
  }

  // Không ghi nếu giá trị này đã được đồng bộ trước đó
  if (state.lastSyncedTimestamp && state.activityLogTimestamp <= state.lastSyncedTimestamp) {
    state.pendingSync = false;
    await context.saveLocalActivityState(state);
    return false;
  }
  if (!context.db || !navigator.onLine) {
    context.logActivityDebug("Offline or DB unavailable; keeping pendingSync in IndexedDB", {
      reason,
      student: context.maskStudentKey(studentKey),
      activityLogTimestamp: state.activityLogTimestamp
    });
    return false;
  }
  const now = Date.now();
  const elapsed = now - (state.lastWriteAttemptAt || 0);
  if (!force && elapsed < context.ACTIVITY_MIN_INTERVAL_MS) {
    // Chưa đủ khoảng cách tối thiểu, để throttle timer xử lý
    context.scheduleActivitySync(studentKey);
    return false;
  }
  if (activityFlights.has(studentKey)) return false;
  activityFlights.add(studentKey);
  const snapshotTimestamp = state.activityLogTimestamp;
  const snapshotUsername = state.username || resolvedUsername;
  state.lastWriteAttemptAt = now;
  try {
    const db = context.db;
    await db.runTransaction(async tx => {
      const { ref, data } = await readStudentStats(db, snapshotUsername, doc => tx.get(doc));
      const update = { username: snapshotUsername, activityLogTimestamp: Math.max(snapshotTimestamp, timestamp(data.activityLogTimestamp)) };
      if (data.wordCount != null) update.wordCount = data.wordCount;
      tx.set(ref, update, { merge: true });
    });
    const latestState = cache[studentKey] || state;
    latestState.lastSyncedTimestamp = Math.max(latestState.lastSyncedTimestamp || 0, snapshotTimestamp);
    latestState.retryCount = 0;

    // Chỉ xóa trạng thái chờ nếu không có timestamp mới hơn phát sinh trong lúc đang ghi
    if (latestState.activityLogTimestamp <= snapshotTimestamp) {
      latestState.pendingSync = false;
    } else {
      latestState.pendingSync = true;
    }
    await context.saveLocalActivityState(latestState);
    context.logActivityDebug("Synced activityLogTimestamp to Firestore", {
      reason,
      student: context.maskStudentKey(studentKey),
      syncedTimestamp: snapshotTimestamp,
      hasNewerPending: latestState.pendingSync
    });
    if (latestState.pendingSync && context.getStudentKey(context.currentUser) === studentKey) {
      context.scheduleActivitySync(studentKey);
    }
    return true;
  } catch (err) {
    const latestState = cache[studentKey] || state;
    latestState.pendingSync = true;
    latestState.retryCount = (latestState.retryCount || 0) + 1;
    await context.saveLocalActivityState(latestState);
    context.logActivityDebug("Firestore activityLogTimestamp sync failed; keeping pending state", {
      reason,
      student: context.maskStudentKey(studentKey),
      retryCount: latestState.retryCount,
      error: String(err)
    });
    if (context.getStudentKey(context.currentUser) === studentKey && navigator.onLine) {
      context.scheduleActivityRetry(studentKey);
    }
    return false;
  } finally {
    activityFlights.delete(studentKey);
  }
}
export async function resumePendingActivitySyncForCurrentUser() {
  const username = context.currentUser, cache = context.activityStateByStudent;
  if (!canSyncProfile(username)) return;
  const state = await context.loadLocalActivityState(username);
  if (username !== context.currentUser || cache !== context.activityStateByStudent) return;
  if (state && state.pendingSync && typeof state.activityLogTimestamp === "number") {
    context.logActivityDebug("Found pending activityLogTimestamp for current user on load/login", {
      student: context.maskStudentKey(state.studentKey),
      activityLogTimestamp: state.activityLogTimestamp
    });
    if (context.db && navigator.onLine) {
      await context.flushActivityLogSync({
        force: true,
        reason: "resume_pending",
        targetStudentKey: state.studentKey,
        targetUsername: state.username
      });
    }
  }
}
export function setupActivityLifecycleListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && context.currentUser) {
      context.flushActivityLogSync({
        force: true,
        reason: "visibility_hidden"
      });
    }
  });
  window.addEventListener("pagehide", () => {
    if (context.currentUser) {
      context.flushActivityLogSync({
        force: true,
        reason: "pagehide"
      });
    }
  });
  window.addEventListener("beforeunload", () => {
    if (context.currentUser) {
      context.flushActivityLogSync({
        force: true,
        reason: "beforeunload"
      });
    }
  });
}
