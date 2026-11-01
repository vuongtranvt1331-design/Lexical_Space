import { db, firebasePersistenceReady } from '../core/firebase-config.js';
import { createVocabularySync } from '../core/firebase-sync.js';
import { openIndexedDB, idbGet, idbPut, idbDelete, idbGetAll } from '../core/idb-manager.js';
import { SoundManager } from '../core/sound-manager.js';
import { getStudentKey, showToast, escapeHtml, escapeQuotes } from '../utils/helpers.js';
import { context } from "../core/context.js";
import { maskStudentKey, logActivityDebug, getActivityMetaKey, clearActivityTimers, loadLocalActivityState, saveLocalActivityState, recordLearningActivity, scheduleActivitySync, scheduleActivityRetry, flushActivityLogSync, resumePendingActivitySyncForCurrentUser, setupActivityLifecycleListeners } from "./activity.js";
import { updateVisualViewportHeight, migrateLocalStorageToIndexedDB, checkAuth, applyUser, handleOnlineReconnection, syncPendingOperations, updateStatusBadge, setupNavigation, switchView } from "./auth.js";
import { loadUserTopics, saveUserTopics, addUserTopic, checkAndCleanupEmptyTopics, sortTopicsNumericFirst, getAlphabeticalTopics, updateStudentMetadataCount, cleanupAndMigrateVocabularyData, loadIndexedDBWordsData, checkStudentVocabularyMetadata, updateBadges, updateTopicDropdowns, renderLibraryTopicUpwardMenu, install_selectLibraryTopic, toggleWordFavorite, install_toggleWordQuickSave, install_toggleLibraryWordFavorite, updateWordMemory, updateLibraryTabsUI, setupLibraryModule, install_deleteTopicDirectly, setupMergeTopicsModal, renderVocabularyCardHtml, renderFavoritesCollection, renderLibrary, install_toggleWordStatus, install_deleteWordDirectly } from "./library.js";
import { renderEntryTopicCards, install_selectEntryTopic, setupEntryModule, setupQuickImport, parseMultiTopicMessage, renderImportPreview, install_removeImportItem } from "./entry.js";
import { isWordEligibleForReview, renderReviewTopicUpwardMenu, install_selectReviewTopic, resetSessionSwipeStats, hideEasterEggCard, showEasterEggCard, dismissEasterEgg, renderEasterEggCardContent, setupEasterEggInteractions, startNewSession, renderActiveCard, triggerSwipeToast, setupSwipeGesture, updateCardFavoriteVisual, updateCardQuickSaveVisual, updateQuickCollectionButtonsUI, setupSessionEndButtons, playAudio } from "./flashcard.js";
Object.defineProperties(context, {
  db: {
    get: () => db
  },
  firebasePersistenceReady: {
    get: () => firebasePersistenceReady
  },
  createVocabularySync: {
    get: () => createVocabularySync
  },
  openIndexedDB: {
    get: () => openIndexedDB
  },
  idbGet: {
    get: () => idbGet
  },
  idbPut: {
    get: () => idbPut
  },
  idbDelete: {
    get: () => idbDelete
  },
  idbGetAll: {
    get: () => idbGetAll
  },
  SoundManager: {
    get: () => SoundManager
  },
  getStudentKey: {
    get: () => getStudentKey
  },
  showToast: {
    get: () => showToast
  },
  escapeHtml: {
    get: () => escapeHtml
  },
  escapeQuotes: {
    get: () => escapeQuotes
  },
  DEFAULT_TOPIC: {
    get: () => DEFAULT_TOPIC
  },
  currentUser: {
    get: () => currentUser,
    set: value => currentUser = value
  },
  wordsData: {
    get: () => wordsData,
    set: value => wordsData = value
  },
  userTopics: {
    get: () => userTopics,
    set: value => userTopics = value
  },
  reviewMode: {
    get: () => reviewMode,
    set: value => reviewMode = value
  },
  libraryTab: {
    get: () => libraryTab,
    set: value => libraryTab = value
  },
  activeTopic: {
    get: () => activeTopic,
    set: value => activeTopic = value
  },
  librarySelectedTopic: {
    get: () => librarySelectedTopic,
    set: value => librarySelectedTopic = value
  },
  activeSpecialCollection: {
    get: () => activeSpecialCollection,
    set: value => activeSpecialCollection = value
  },
  dbSyncError: {
    get: () => dbSyncError,
    set: value => dbSyncError = value
  },
  activeSessionWords: {
    get: () => activeSessionWords,
    set: value => activeSessionWords = value
  },
  sessionCurrentIndex: {
    get: () => sessionCurrentIndex,
    set: value => sessionCurrentIndex = value
  },
  sessionCompleted: {
    get: () => sessionCompleted,
    set: value => sessionCompleted = value
  },
  isFlipped: {
    get: () => isFlipped,
    set: value => isFlipped = value
  },
  isCardFlipping: {
    get: () => isCardFlipping,
    set: value => isCardFlipping = value
  },
  isStatusUpdating: {
    get: () => isStatusUpdating,
    set: value => isStatusUpdating = value
  },
  sessionResponses: {
    get: () => sessionResponses,
    set: value => sessionResponses = value
  },
  sessionSwipeStats: {
    get: () => sessionSwipeStats,
    set: value => sessionSwipeStats = value
  },
  draftWord: {
    get: () => draftWord,
    set: value => draftWord = value
  },
  STATUS: {
    get: () => STATUS
  },
  vocabularySync: {
    get: () => vocabularySync
  },
  ACTIVITY_SYNC_THROTTLE_MS: {
    get: () => ACTIVITY_SYNC_THROTTLE_MS
  },
  ACTIVITY_MIN_INTERVAL_MS: {
    get: () => ACTIVITY_MIN_INTERVAL_MS
  },
  ACTIVITY_IDLE_FLUSH_MS: {
    get: () => ACTIVITY_IDLE_FLUSH_MS
  },
  ACTIVITY_RETRY_BASE_MS: {
    get: () => ACTIVITY_RETRY_BASE_MS
  },
  ACTIVITY_RETRY_MAX_MS: {
    get: () => ACTIVITY_RETRY_MAX_MS
  },
  DEBUG_ACTIVITY_LOG: {
    get: () => DEBUG_ACTIVITY_LOG,
    set: value => DEBUG_ACTIVITY_LOG = value
  },
  activityStateByStudent: {
    get: () => activityStateByStudent
  },
  activityThrottleTimer: {
    get: () => activityThrottleTimer,
    set: value => activityThrottleTimer = value
  },
  activityIdleTimer: {
    get: () => activityIdleTimer,
    set: value => activityIdleTimer = value
  },
  activityRetryTimer: {
    get: () => activityRetryTimer,
    set: value => activityRetryTimer = value
  },
  isActivitySyncInFlight: {
    get: () => isActivitySyncInFlight,
    set: value => isActivitySyncInFlight = value
  },
  lastRecordedActivityAt: {
    get: () => lastRecordedActivityAt,
    set: value => lastRecordedActivityAt = value
  },
  maskStudentKey: {
    get: () => maskStudentKey
  },
  logActivityDebug: {
    get: () => logActivityDebug
  },
  getActivityMetaKey: {
    get: () => getActivityMetaKey
  },
  clearActivityTimers: {
    get: () => clearActivityTimers
  },
  loadLocalActivityState: {
    get: () => loadLocalActivityState
  },
  saveLocalActivityState: {
    get: () => saveLocalActivityState
  },
  recordLearningActivity: {
    get: () => recordLearningActivity
  },
  scheduleActivitySync: {
    get: () => scheduleActivitySync
  },
  scheduleActivityRetry: {
    get: () => scheduleActivityRetry
  },
  flushActivityLogSync: {
    get: () => flushActivityLogSync
  },
  resumePendingActivitySyncForCurrentUser: {
    get: () => resumePendingActivitySyncForCurrentUser
  },
  setupActivityLifecycleListeners: {
    get: () => setupActivityLifecycleListeners
  },
  isWordEligibleForReview: {
    get: () => isWordEligibleForReview
  },
  updateVisualViewportHeight: {
    get: () => updateVisualViewportHeight
  },
  migrateLocalStorageToIndexedDB: {
    get: () => migrateLocalStorageToIndexedDB
  },
  checkAuth: {
    get: () => checkAuth
  },
  applyUser: {
    get: () => applyUser
  },
  loadUserTopics: {
    get: () => loadUserTopics
  },
  saveUserTopics: {
    get: () => saveUserTopics
  },
  addUserTopic: {
    get: () => addUserTopic
  },
  checkAndCleanupEmptyTopics: {
    get: () => checkAndCleanupEmptyTopics
  },
  sortTopicsNumericFirst: {
    get: () => sortTopicsNumericFirst
  },
  getAlphabeticalTopics: {
    get: () => getAlphabeticalTopics
  },
  updateStudentMetadataCount: {
    get: () => updateStudentMetadataCount
  },
  cleanupAndMigrateVocabularyData: {
    get: () => cleanupAndMigrateVocabularyData
  },
  loadIndexedDBWordsData: {
    get: () => loadIndexedDBWordsData
  },
  checkStudentVocabularyMetadata: {
    get: () => checkStudentVocabularyMetadata
  },
  handleOnlineReconnection: {
    get: () => handleOnlineReconnection
  },
  syncPendingOperations: {
    get: () => syncPendingOperations
  },
  updateStatusBadge: {
    get: () => updateStatusBadge
  },
  updateBadges: {
    get: () => updateBadges
  },
  updateTopicDropdowns: {
    get: () => updateTopicDropdowns
  },
  renderEntryTopicCards: {
    get: () => renderEntryTopicCards
  },
  renderReviewTopicUpwardMenu: {
    get: () => renderReviewTopicUpwardMenu
  },
  renderLibraryTopicUpwardMenu: {
    get: () => renderLibraryTopicUpwardMenu
  },
  currentSessionHadInitialCards: {
    get: () => currentSessionHadInitialCards,
    set: value => currentSessionHadInitialCards = value
  },
  resetSessionSwipeStats: {
    get: () => resetSessionSwipeStats
  },
  hideEasterEggCard: {
    get: () => hideEasterEggCard
  },
  isEasterEggFlipping: {
    get: () => isEasterEggFlipping,
    set: value => isEasterEggFlipping = value
  },
  isEasterEggFlipped: {
    get: () => isEasterEggFlipped,
    set: value => isEasterEggFlipped = value
  },
  showEasterEggCard: {
    get: () => showEasterEggCard
  },
  dismissEasterEgg: {
    get: () => dismissEasterEgg
  },
  renderEasterEggCardContent: {
    get: () => renderEasterEggCardContent
  },
  setupEasterEggInteractions: {
    get: () => setupEasterEggInteractions
  },
  startNewSession: {
    get: () => startNewSession
  },
  renderActiveCard: {
    get: () => renderActiveCard
  },
  swipeToastTimeout: {
    get: () => swipeToastTimeout,
    set: value => swipeToastTimeout = value
  },
  triggerSwipeToast: {
    get: () => triggerSwipeToast
  },
  setupSwipeGesture: {
    get: () => setupSwipeGesture
  },
  updateCardFavoriteVisual: {
    get: () => updateCardFavoriteVisual
  },
  updateCardQuickSaveVisual: {
    get: () => updateCardQuickSaveVisual
  },
  updateQuickCollectionButtonsUI: {
    get: () => updateQuickCollectionButtonsUI
  },
  isTogglingFavorite: {
    get: () => isTogglingFavorite,
    set: value => isTogglingFavorite = value
  },
  toggleWordFavorite: {
    get: () => toggleWordFavorite
  },
  updateWordMemory: {
    get: () => updateWordMemory
  },
  setupSessionEndButtons: {
    get: () => setupSessionEndButtons
  },
  setupEntryModule: {
    get: () => setupEntryModule
  },
  updateLibraryTabsUI: {
    get: () => updateLibraryTabsUI
  },
  setupLibraryModule: {
    get: () => setupLibraryModule
  },
  setupMergeTopicsModal: {
    get: () => setupMergeTopicsModal
  },
  renderVocabularyCardHtml: {
    get: () => renderVocabularyCardHtml
  },
  renderFavoritesCollection: {
    get: () => renderFavoritesCollection
  },
  renderLibrary: {
    get: () => renderLibrary
  },
  setupQuickImport: {
    get: () => setupQuickImport
  },
  parsedImportEntries: {
    get: () => parsedImportEntries,
    set: value => parsedImportEntries = value
  },
  parseMultiTopicMessage: {
    get: () => parseMultiTopicMessage
  },
  renderImportPreview: {
    get: () => renderImportPreview
  },
  playAudio: {
    get: () => playAudio
  },
  setupNavigation: {
    get: () => setupNavigation
  },
  switchView: {
    get: () => switchView
  }
});
const DEFAULT_TOPIC = "New Words";
let currentUser = localStorage.getItem("vocab_user") || "";
let wordsData = [];
let userTopics = [];
let reviewMode = "learning";
let libraryTab = "unknown";
let activeTopic = "ALL";
let librarySelectedTopic = "ALL";
let activeSpecialCollection = null; // null | 'FAVORITES'
let dbSyncError = null;
let activeSessionWords = [];
let sessionCurrentIndex = 0;
let sessionCompleted = false;
let isFlipped = false;
let isCardFlipping = false;
let isStatusUpdating = false;
let sessionResponses = new Map();

/* ================= 15-SWIPE EASTER EGG SESSION TRACKER ================= */
let sessionSwipeStats = {
  rightSwipes: 0,
  leftSwipes: 0,
  trophyTriggered: false,
  trophyDismissed: false,
  flagTriggered: false,
  flagDismissed: false,
  activeEasterEgg: null
};
window.sessionSwipeStats = sessionSwipeStats;
let draftWord = {
  word: "",
  topic: DEFAULT_TOPIC,
  meaning: "",
  synonym1: "",
  synonym2: ""
};
const STATUS = {
  NOT_KNOWN: "not_remembered",
  KNOWN: "mastered"
};
window.STATUS = STATUS;
window.getCurrentUser = () => currentUser;
window.setCurrentUser = u => {
  currentUser = u;
};
window.getWordsData = () => wordsData;
window.setWordsData = w => {
  wordsData = w;
};
window.getReviewMode = () => reviewMode;
window.setReviewMode = m => {
  reviewMode = m;
};
window.getLibraryTab = () => libraryTab;
window.setLibraryTab = t => {
  libraryTab = t;
};
window.getActiveSessionWords = () => activeSessionWords;
window.getSessionCurrentIndex = () => sessionCurrentIndex;
window.applyUser = applyUser;
window.switchView = switchView;
window.startNewSession = startNewSession;
window.renderLibrary = renderLibrary;
window.renderActiveCard = renderActiveCard;
window.idbPut = idbPut;
window.idbGetAll = idbGetAll;
window.idbDelete = idbDelete;

/* ================= ACTIVITY LOG TRACKER & THROTTLED SYNC MANAGER ================= */
const vocabularySync = createVocabularySync({
  db,
  readWords: () => idbGetAll('words'),
  readPending: () => idbGetAll('pendingOps'),
  readServerIds: async username => (await idbGet('metadata', 'ls_server_ids_' + username.toLowerCase()))?.ids || [],
  saveServerIds: (username, ids) => idbPut('metadata', {
    key: 'ls_server_ids_' + username.toLowerCase(),
    ids
  }),
  putWord: record => idbPut('words', record),
  deleteWord: id => idbDelete('words', id),
  onStatus: (ok, text) => updateStatusBadge(ok, text),
  onChange: async username => {
    if (currentUser !== username) return;
    const allWords = await idbGetAll('words');
    if (currentUser !== username) return;
    wordsData = allWords.filter(word => !word.username || word.username.toLowerCase() === username.toLowerCase());
    for (const word of wordsData) {
      if (word.topic && !userTopics.some(topic => topic.toLowerCase() === word.topic.toLowerCase())) userTopics.push(word.topic);
    }
    checkAndCleanupEmptyTopics();
    saveUserTopics();
    updateTopicDropdowns();
    updateBadges();
    if (activeSessionWords.length === 0 || reviewMode === 'learning') startNewSession();
    renderLibrary();
  }
});
const ACTIVITY_SYNC_THROTTLE_MS = 45000; // 45s periodic throttle window (within 30-60s spec)
const ACTIVITY_MIN_INTERVAL_MS = 30000; // Minimum 30s between regular Firestore writes
const ACTIVITY_IDLE_FLUSH_MS = 15000; // Flush after 15s of inactivity if min interval passed
const ACTIVITY_RETRY_BASE_MS = 10000; // 10s initial backoff on error
const ACTIVITY_RETRY_MAX_MS = 300000; // Max 5m backoff

let DEBUG_ACTIVITY_LOG = localStorage.getItem("vocab_debug_activity") === "true";
window.setLexicalActivityDebug = enabled => {
  DEBUG_ACTIVITY_LOG = Boolean(enabled);
  localStorage.setItem("vocab_debug_activity", String(DEBUG_ACTIVITY_LOG));
};

// Per-student in-memory cache: { [studentKey]: { username, studentKey, activityLogTimestamp, pendingSync, lastSyncedTimestamp, lastWriteAttemptAt, retryCount } }
const activityStateByStudent = {};
let activityThrottleTimer = null;
let activityIdleTimer = null;
let activityRetryTimer = null;
let isActivitySyncInFlight = false;
let lastRecordedActivityAt = 0;

/**
 * Ghi nhận hoạt động học tập thực tế của học sinh hiện tại.
 * - Cập nhật ngay lập tức vào bộ nhớ & IndexedDB (Unix milliseconds từ Date.now()).
 * - Đánh dấu pendingSync = true.
 * - Lên lịch đồng bộ Firestore theo cơ chế throttle 45s và idle 15s.
 */

/**
 * Đồng bộ activityLogTimestamp mới nhất lên Firestore metadata/userWordStats_${studentKey}.
 * - Chỉ cập nhật trường cần thiết bằng set(..., { merge: true }), không đọc hay ghi đè wordCount.
 * - Bảo đảm an toàn khi chuyển tài khoản và khi có timestamp mới hơn phát sinh trong lúc đang ghi.
 */

window.addEventListener('resize', updateVisualViewportHeight);
window.addEventListener("DOMContentLoaded", async () => {
  updateVisualViewportHeight();
  document.addEventListener("pointerdown", () => SoundManager.ensureContext(), {
    once: true
  });
  const soundIcon = document.getElementById("global-sound-icon");
  if (soundIcon) {
    soundIcon.className = SoundManager.enabled ? "ph-bold ph-speaker-high text-base text-[#D4AF37]" : "ph-bold ph-speaker-slash text-base text-rose-400";
  }
  document.getElementById("btn-global-sound")?.addEventListener("click", () => SoundManager.toggle());
  setupNavigation();
  setupSwipeGesture();
  setupEntryModule();
  setupLibraryModule();
  setupSessionEndButtons();
  setupQuickImport();
  setupMergeTopicsModal();
  setupActivityLifecycleListeners();
  await migrateLocalStorageToIndexedDB();
  checkAuth();
  window.addEventListener("online", handleOnlineReconnection);
});

/* Hàm dọn dẹp topic trống tự động */

/* Tạo studentKey ổn định từ username */

/* Cập nhật lại metadata wordCount lên Firebase và IndexedDB */

window.cleanupAndMigrateVocabularyData = cleanupAndMigrateVocabularyData;
install_selectEntryTopic();
install_selectReviewTopic();
install_selectLibraryTopic();
let currentSessionHadInitialCards = false;
window.resetSessionSwipeStats = resetSessionSwipeStats;
window.hideEasterEggCard = hideEasterEggCard;
let isEasterEggFlipping = false;
let isEasterEggFlipped = false;
window.showEasterEggCard = showEasterEggCard;
window.dismissEasterEgg = dismissEasterEgg;
let swipeToastTimeout = null;
let isTogglingFavorite = false;
window.toggleWordFavorite = toggleWordFavorite;
install_toggleWordQuickSave();
install_toggleLibraryWordFavorite();
window.updateLibraryTabsUI = updateLibraryTabsUI;
/* ========================================================
   TÍNH NĂNG XÓA TOPIC (ĐÃ SỬA TRIỆT ĐỂ)
   ======================================================== */
install_deleteTopicDirectly();
/* ========================================================
   TÍNH NĂNG GOM TOPIC (MERGE TOPICS) - ĐÃ SỬA TRIỆT ĐỂ
   ======================================================== */
window.renderVocabularyCardHtml = renderVocabularyCardHtml;
window.renderFavoritesCollection = renderFavoritesCollection;
install_toggleWordStatus();
install_deleteWordDirectly();
let parsedImportEntries = [];
install_removeImportItem();
window.playAudio = playAudio;

// Preserve the original classic script’s callable global functions.
Object.assign(window, {
  openIndexedDB,
  idbGet,
  idbPut,
  idbDelete,
  idbGetAll,
  maskStudentKey,
  logActivityDebug,
  getActivityMetaKey,
  clearActivityTimers,
  loadLocalActivityState,
  saveLocalActivityState,
  recordLearningActivity,
  scheduleActivitySync,
  scheduleActivityRetry,
  flushActivityLogSync,
  resumePendingActivitySyncForCurrentUser,
  setupActivityLifecycleListeners,
  isWordEligibleForReview,
  updateVisualViewportHeight,
  migrateLocalStorageToIndexedDB,
  checkAuth,
  applyUser,
  loadUserTopics,
  saveUserTopics,
  addUserTopic,
  checkAndCleanupEmptyTopics,
  sortTopicsNumericFirst,
  getAlphabeticalTopics,
  getStudentKey,
  updateStudentMetadataCount,
  cleanupAndMigrateVocabularyData,
  loadIndexedDBWordsData,
  checkStudentVocabularyMetadata,
  handleOnlineReconnection,
  syncPendingOperations,
  updateStatusBadge,
  updateBadges,
  updateTopicDropdowns,
  renderEntryTopicCards,
  renderReviewTopicUpwardMenu,
  renderLibraryTopicUpwardMenu,
  resetSessionSwipeStats,
  hideEasterEggCard,
  showEasterEggCard,
  dismissEasterEgg,
  renderEasterEggCardContent,
  setupEasterEggInteractions,
  startNewSession,
  renderActiveCard,
  triggerSwipeToast,
  setupSwipeGesture,
  updateCardFavoriteVisual,
  updateCardQuickSaveVisual,
  updateQuickCollectionButtonsUI,
  toggleWordFavorite,
  updateWordMemory,
  setupSessionEndButtons,
  setupEntryModule,
  updateLibraryTabsUI,
  setupLibraryModule,
  setupMergeTopicsModal,
  renderVocabularyCardHtml,
  renderFavoritesCollection,
  renderLibrary,
  setupQuickImport,
  parseMultiTopicMessage,
  renderImportPreview,
  playAudio,
  setupNavigation,
  switchView,
  showToast,
  escapeHtml,
  escapeQuotes
});
