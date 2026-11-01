import { context } from "../core/context.js";
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
  return `studentActivity_${studentKey}`;
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
export async function loadLocalActivityState(username) {
  const cleanUser = (username || "").trim();
  const studentKey = context.getStudentKey(cleanUser);
  if (!studentKey) return null;
  if (context.activityStateByStudent[studentKey]) {
    return context.activityStateByStudent[studentKey];
  }
  try {
    const stored = await context.idbGet("metadata", context.getActivityMetaKey(studentKey));
    if (stored && typeof stored.activityLogTimestamp === "number") {
      context.activityStateByStudent[studentKey] = {
        username: stored.username || cleanUser,
        studentKey: studentKey,
        activityLogTimestamp: stored.activityLogTimestamp,
        pendingSync: Boolean(stored.pendingSync),
        lastSyncedTimestamp: stored.lastSyncedTimestamp || 0,
        lastWriteAttemptAt: 0,
        retryCount: 0
      };
      return context.activityStateByStudent[studentKey];
    }
  } catch (err) {
    context.logActivityDebug("IndexedDB read activity state warning", {
      error: String(err)
    });
  }
  return null;
}
export async function saveLocalActivityState(state) {
  if (!state || !state.studentKey || typeof state.activityLogTimestamp !== "number") return;
  try {
    await context.idbPut("metadata", {
      key: context.getActivityMetaKey(state.studentKey),
      username: state.username,
      studentKey: state.studentKey,
      activityLogTimestamp: state.activityLogTimestamp,
      pendingSync: Boolean(state.pendingSync),
      lastSyncedTimestamp: state.lastSyncedTimestamp || 0
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
export
/**
 * Đồng bộ activityLogTimestamp mới nhất lên Firestore metadata/userWordStats_${studentKey}.
 * - Chỉ cập nhật trường cần thiết bằng set(..., { merge: true }), không đọc hay ghi đè wordCount.
 * - Bảo đảm an toàn khi chuyển tài khoản và khi có timestamp mới hơn phát sinh trong lúc đang ghi.
 */
function recordLearningActivity(reason = "study_action") {
  if (!context.currentUser) return;
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

  // Bộ đếm Throttle định kỳ (45s): KHÔNG reset khi học sinh vuốt liên tiếp để bảo đảm luôn đồng bộ định kỳ
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
  const studentKey = targetStudentKey || context.getStudentKey(resolvedUsername);
  if (!studentKey) return false;
  let state = context.activityStateByStudent[studentKey];
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
  if (context.isActivitySyncInFlight) {
    return false;
  }
  context.isActivitySyncInFlight = true;
  const snapshotTimestamp = state.activityLogTimestamp;
  const snapshotUsername = state.username || resolvedUsername;
  state.lastWriteAttemptAt = now;
  try {
    await context.db.collection("metadata").doc(`userWordStats_${studentKey}`).set({
      username: snapshotUsername,
      activityLogTimestamp: snapshotTimestamp
    }, {
      merge: true
    });
    const latestState = context.activityStateByStudent[studentKey] || state;
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
    const latestState = context.activityStateByStudent[studentKey] || state;
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
    context.isActivitySyncInFlight = false;
  }
}
export async function resumePendingActivitySyncForCurrentUser() {
  if (!context.currentUser) return;
  const state = await context.loadLocalActivityState(context.currentUser);
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
