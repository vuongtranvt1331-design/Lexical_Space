import { openFirebaseServices } from '../core/firebase-config.js';
import { createVocabularySync } from '../core/firebase-sync.js';
import * as storage from '../core/idb-manager.js';
import { SoundManager } from '../core/sound-manager.js';
import { calendarDay, isDue, isNewWord } from '../core/srs.js';
import * as helpers from '../utils/helpers.js';
import { context } from '../core/context.js';
import * as activity from './activity.js';
import * as auth from './auth.js';
import * as library from './library.js';
import * as entry from './entry.js';
import * as flashcard from './flashcard.js';
import * as classCheck from './in-class-check.js';
import * as decks from './deck-sharing.js';
import * as vocabularyUpdate from './vocabulary-update.js';
Object.assign(context, storage, helpers, activity, auth, library, entry, flashcard, classCheck, decks, vocabularyUpdate, {
  db: null, firebasePersistenceReady: Promise.resolve(), SoundManager, DEFAULT_TOPIC: 'New Words', currentUser: '', wordsData: [], userTopics: [],
  reviewMode: 'learning', libraryTab: 'unknown', activeTopic: 'ALL', librarySelectedTopic: 'ALL', activeSpecialCollection: null,
  dbSyncError: null, activeSessionWords: [], sessionCurrentIndex: 0, sessionCompleted: false, userLoadGeneration: 0,
  accountGeneration: 0, profileLoading: false, deckDialogOpen: false,
  draftWord: { topic: 'New Words' }, STATUS: { KNOWN: 'mastered', NOT_KNOWN: 'not_remembered' },
  DEBUG_ACTIVITY_LOG: false, activityStateByStudent: Object.create(null), activityThrottleTimer: null, activityIdleTimer: null,
  activityRetryTimer: null, isActivitySyncInFlight: false, lastRecordedActivityAt: 0,
  ACTIVITY_SYNC_THROTTLE_MS: 45000, ACTIVITY_MIN_INTERVAL_MS: 30000, ACTIVITY_IDLE_FLUSH_MS: 15000,
  ACTIVITY_RETRY_BASE_MS: 10000, ACTIVITY_RETRY_MAX_MS: 300000
});
context.renderStats = async () => {
  const user = context.currentUser, ticket = context.accountGeneration, words = context.wordsData;
  const set = (name, count) => { document.getElementById('stats-' + name).textContent = count; };
  set('total', words.length);
  set('new', words.filter(isNewWord).length);
  set('due', words.filter(word => !isNewWord(word) && isDue(word)).length);
  set('mastered', words.filter(word => word.memoryStatus === 'mastered').length);
  if (!user) { set('attempts', 0); set('recalled', 0); return; }
  const key = `practice:v2:${encodeURIComponent(user)}:${calendarDay()}`;
  const ledger = await storage.idbGet('metadata', key).catch(() => null);
  if (ticket === context.accountGeneration) {
    set('attempts', ledger?.completedAttempts || 0);
    set('recalled', ledger?.successfulIds?.length || 0);
  }
};
context.refreshVocabulary = async username => {
  if (!username || username !== context.currentUser) return;
  const ticket = context.accountGeneration;
  const words = await storage.readUserWords(username);
  if (ticket !== context.accountGeneration || username !== context.currentUser) return;
  context.wordsData = words; library.updateTopicDropdowns(); library.updateBadges();
  if (!document.getElementById('view-library')?.classList.contains('hidden')) library.renderLibrary();
  classCheck.refreshInClassCheckPool();
  if (!document.getElementById('view-in-class-check')?.classList.contains('hidden')) void context.renderStats();
  await flashcard.reconcileSession();
};
const vocabularySync = db => createVocabularySync({ db, onStatus: auth.updateStatusBadge, onChange: context.refreshVocabulary });
context.vocabularySync = vocabularySync(null);
let cloudTask;
context.connectCloud = function connectCloud() {
  if (context.db) return Promise.resolve(true);
  if (cloudTask) return cloudTask;
  cloudTask = openFirebaseServices().then(({ db, persistenceReady }) => {
    context.vocabularySync.stop();
    context.db = db;
    context.firebasePersistenceReady = persistenceReady;
    context.vocabularySync = vocabularySync(db);
    if (context.currentUser && !context.profileLoading && !context.dbSyncError) {
      try {
        library.checkStudentVocabularyMetadata();
        void auth.syncPendingOperations();
        void activity.resumePendingActivitySyncForCurrentUser().catch(error => console.warn('Activity sync unavailable:', error));
      } catch (error) { console.warn('Cloud sync unavailable:', error); }
    }
    return true;
  }).catch(error => {
    console.warn('Cloud services unavailable:', error);
    return false;
  }).finally(() => { cloudTask = null; });
  return cloudTask;
};
// Compatibility for existing integrations; application state has one explicit owner.
Object.assign(window, { applyUser: auth.activateUser, switchView: auth.switchView, startNewSession: flashcard.startNewSession,
  playAudio: flashcard.playAudio, getCurrentUser: () => context.currentUser, getWordsData: () => context.wordsData,
  getActiveSessionWords: () => context.activeSessionWords, getSessionCurrentIndex: () => context.sessionCurrentIndex });
let startupTask, localReady = false, deckStartupTask;
function connectCloudForPage() {
  if (!localReady || deckStartupTask) return;
  deckStartupTask = context.connectCloud().then(() => decks.loadDeckFromLocation())
    .finally(() => { deckStartupTask = null; });
}
function announceStartup(storageReady) {
  window.__lexicalSpaceReady = true;
  document.dispatchEvent(new window.CustomEvent('lexicalspace:ready', { detail: { storageReady } }));
}
function reportStartupFailure(error) {
  console.error('LexicalSpace could not start:', error);
  auth.setStartupStorageState('reload');
  announceStartup(false);
}
function openStartupStorage() {
  if (startupTask) return startupTask;
  startupTask = (async () => {
    auth.setStartupStorageState('opening');
    try {
      await storage.openIndexedDB({ onBlocked: () => {
        auth.setStartupStorageState('blocked');
        announceStartup(false);
      } });
      await storage.migrateLegacyOutbox();
    } catch (error) {
      console.warn('Could not open local storage:', error);
      auth.setStartupStorageState(error?.name === 'VersionError' ? 'newer' : 'unavailable');
      announceStartup(false);
      return;
    }
    auth.setStartupStorageState('ready');
    await auth.checkAuth();
    localReady = true;
    announceStartup(true);
    connectCloudForPage();
  })().catch(reportStartupFailure).finally(() => { startupTask = null; });
  return startupTask;
}
async function initialize() {
  try {
    auth.updateVisualViewportHeight(); auth.setupNavigation({ retryStartup: openStartupStorage });
    flashcard.setupPracticeControls(); flashcard.setupSessionEndButtons();
    classCheck.setupInClassCheck();
    entry.setupEntryModule(); entry.setupQuickImport(); library.setupLibraryModule(); library.setupMergeTopicsModal();
    decks.setupDeckSharing();
    vocabularyUpdate.setupVocabularyUpdate();
    library.install_deleteWordDirectly(); library.install_deleteTopicDirectly(); activity.setupActivityLifecycleListeners();
    window.addEventListener('online', () => {
      if (context.db) void auth.handleOnlineReconnection();
      connectCloudForPage();
    });
    window.addEventListener('offline', () => auth.updateStatusBadge(false, 'Offline · saved locally'));
    window.addEventListener('resize', auth.updateVisualViewportHeight);
    window.visualViewport?.addEventListener('resize', auth.updateVisualViewportHeight);
    // Other tabs can commit to this origin; reload records before resuming interaction.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && context.currentUser && !context.profileLoading) {
        void context.refreshVocabulary(context.currentUser).catch(error => console.warn('Could not refresh the local library:', error));
      }
    });
    await openStartupStorage();
  } catch (error) {
    reportStartupFailure(error);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else void initialize();
