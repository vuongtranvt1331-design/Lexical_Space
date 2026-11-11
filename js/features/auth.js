import { canSyncProfile, context, GUEST_PROFILE } from '../core/context.js';
import { flushMutationOutbox } from '../core/firebase-sync.js';
import { icon } from '../core/icons.js';

const $ = id => document.getElementById(id);
const TAB_PROFILE = 'ls_active_profile';
const LAST_PROFILE = 'vocab_user';
const INITIAL_BACKOFF = 2000;
const viewIcons = { 'view-review': 'cards', 'view-library': 'books', 'view-in-class-check': 'clipboard-check', 'view-entry': 'add' };
let syncRetry, syncBackoff = INITIAL_BACKOFF;
let startupStorage = 'opening', profileError = '', profileAttempt = 0, profileDialogCanCancel = false;

function rememberedProfile() {
  try {
    const selected = sessionStorage.getItem(TAB_PROFILE);
    if (selected !== null) return selected;
  } catch { /* Browser storage can be unavailable. */ }
  try { return localStorage.getItem(LAST_PROFILE) || ''; }
  catch { return ''; }
}

function rememberProfile(user, previousUser) {
  try { sessionStorage.setItem(TAB_PROFILE, user); } catch {}
  // This startup pointer contains only the profile name.
  try {
    if (user) localStorage.setItem(LAST_PROFILE, user);
    else if (localStorage.getItem(LAST_PROFILE) === previousUser) localStorage.removeItem(LAST_PROFILE);
  } catch {}
}

function signedOutInTab() {
  try { return sessionStorage.getItem(TAB_PROFILE) === ''; }
  catch { return false; }
}

function setProfileDropdown(open, { focusAction, restoreFocus = false } = {}) {
  const menu = $('profile-dropdown'), avatar = $('user-display');
  if (!menu || !avatar) return;
  menu.hidden = !open;
  avatar.setAttribute('aria-expanded', String(open));
  if (open && focusAction) {
    const buttons = [...menu.querySelectorAll('button:not([hidden]):not([disabled])')];
    (focusAction === 'last' ? buttons.at(-1) : buttons[0])?.focus();
  } else if (!open && restoreFocus && !avatar.closest('[inert]')) {
    avatar.focus();
  }
}

function renderProfileMenu(user) {
  const named = canSyncProfile(user);
  $('current-user-name').textContent = user || 'Signed out';
  $('header-user-avatar').textContent = [...user][0]?.toLocaleUpperCase() || '–';
  $('connection-dot').hidden = !named;
  $('btn-switch-user').hidden = !named;
  $('btn-logout').hidden = !named;
  $('btn-profile-sign-in').hidden = named;
}

export function updateProfileLock() {
  const modalOpen = $('modal-login') && !$('modal-login').hidden;
  const primaryDialogOpen = modalOpen || context.deckDialogOpen;
  const guide = $('modal-user-guide');
  if (primaryDialogOpen && guide?.hidden === false) {
    guide.hidden = true;
    $('btn-user-guide').setAttribute('aria-expanded', 'false');
  }
  const dialogOpen = primaryDialogOpen || guide?.hidden === false;
  const drawer = $('drawer'), drawerOpen = drawer && !drawer.classList.contains('-translate-x-full');
  const main = document.querySelector('main'), header = document.querySelector('body > header');
  main?.classList.toggle('hidden', !context.currentUser && !dialogOpen);
  if (dialogOpen || drawerOpen) setProfileDropdown(false);
  for (const [element, lock] of [
    [main, dialogOpen || context.profileLoading || drawerOpen || !context.currentUser],
    [header, dialogOpen || drawerOpen],
    [drawer, dialogOpen || !drawerOpen]
  ]) {
    if (!element) continue;
    element.inert = Boolean(lock);
    element.toggleAttribute('inert', Boolean(lock));
  }
}

export function focusNavigation() {
  const drawer = $('drawer');
  if (drawer && !drawer.inert) {
    const target = $('practice-panel').hidden ? drawer.querySelector('[aria-current="page"]') : $('practice-panel-heading');
    (target || $('btn-close-drawer'))?.focus();
  } else {
    const trigger = $('btn-open-drawer');
    if (trigger && !trigger.closest('[inert]')) trigger.focus();
  }
}

function renderLoginControls() {
  const messages = {
    opening: 'Opening your library…',
    blocked: 'Close any other LexicalSpace tabs on this site. Your library will open automatically when the update can continue.',
    unavailable: 'Browser storage is unavailable. Check that this site can use storage, then try again.',
    newer: 'This library was opened by a newer version of LexicalSpace. Open that version to continue.',
    reload: 'LexicalSpace could not start. Reload the page or open the app using its local launcher.',
  };
  const busy = Boolean(context.profileLoading);
  const message = messages[startupStorage] || (busy ? 'Opening your profile…' : profileError);
  const status = $('login-status'), retry = $('btn-startup-retry'), reload = $('link-startup-reload');
  if (status) { status.textContent = message; status.hidden = !message; }
  for (const id of ['btn-login-submit', 'btn-continue-guest']) {
    if ($(id)) $(id).disabled = startupStorage !== 'ready' || busy;
  }
  if (retry) retry.hidden = startupStorage !== 'unavailable';
  if (reload) reload.hidden = !['reload', 'newer'].includes(startupStorage);
  $('btn-login-cancel')?.classList.toggle('hidden', (!context.currentUser && !profileDialogCanCancel) || busy || Boolean(message));
}

function showProfileDialog(open, { focus = true } = {}) {
  const dialog = $('modal-login');
  if (!dialog) return;
  if (!open) profileDialogCanCancel = false;
  dialog.hidden = !open;
  dialog.classList.toggle('hidden', !open);
  renderLoginControls();
  updateProfileLock();
  if (open && focus) $('input-username')?.focus();
}

export function setStartupStorageState(state) {
  startupStorage = state;
  if (state !== 'ready') {
    const input = $('input-username');
    if (input && !input.value) input.value = context.currentUser || rememberedProfile();
    showProfileDialog(true, { focus: false });
  } else renderLoginControls();
}

export function updateVisualViewportHeight() {
  if (window.visualViewport) {
    document.documentElement.style.setProperty('--viewport-avail-height', `${window.visualViewport.height}px`);
  }
}

async function migrateLocalStorageToIndexedDB(user) {
  const key = `vocab_words_${user}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const words = JSON.parse(raw);
    if (!Array.isArray(words)) return;
    let migratedAll = true;
    for (const word of words) {
      if (!word?.id || (word.username && word.username !== user)) {
        migratedAll = false;
        continue;
      }
      if (!(await context.readUserWord(user, word.id))) {
        await context.mutateWords([{ id: word.id, username: user, patch: word, type: word.deleted ? 'DELETE' : 'UPSERT' }]);
      }
    }
    if (migratedAll) localStorage.removeItem(key);
  } catch (error) { console.warn('Legacy library migration retained for retry:', error); }
}

export async function checkAuth() {
  const user = context.currentUser || rememberedProfile();
  if (user.trim()) await activateUser(user);
  else showProfileDialog(!signedOutInTab());
}

export function applyUser(name, { forceReset = false } = {}) {
  const user = name.trim(), previousUser = context.currentUser;
  if (previousUser !== user || forceReset) {
    if (canSyncProfile(previousUser) && previousUser !== user) void context.flushActivityLogSync({ force: true, reason: 'account_switch', targetUsername: previousUser });
    context.accountGeneration++;
    context.cancelVocabularyUpdate?.();
    context.vocabularySync.stop();
    context.resetActivityForUser();
    context.resetForUser();
    context.resetInClassCheck();
    clearTimeout(syncRetry);
    syncBackoff = INITIAL_BACKOFF;

    context.currentUser = user;
    context.wordsData = [];
    context.userTopics = [];
    context.activeSessionWords = [];
    context.sessionCurrentIndex = 0;
    context.sessionCompleted = false;
    context.activeTopic = 'ALL';
    context.activeSpecialCollection = null;
    context.reviewMode = 'learning';
    context.dbSyncError = null;

    context.resetLibraryForUser();
    context.resetEntryForUser();
    context.resetDeckPreview();
    $('review-topic-upward-menu').classList.add('hidden');
    context.renderReviewTopicUpwardMenu([context.DEFAULT_TOPIC]);
    $('stats-attempts').textContent = '0';
    $('stats-recalled').textContent = '0';
    context.updateBadges();
    context.renderActiveCard();
    void context.renderStats();
  }
  context.SoundManager.loadForUser(user);
  context.renderSettings();
  renderProfileMenu(user);
  updateStatusBadge(false, user ? 'Opening local library…' : 'Signed out');
}

export async function activateUser(name) {
  const user = name.trim();
  if (!user || startupStorage !== 'ready' || (context.profileLoading && context.currentUser === user)) return false;
  const previousUser = context.currentUser, attempt = ++profileAttempt;
  const isCurrent = () => attempt === profileAttempt;
  const forceReset = Boolean(profileError);
  let opened = false;
  profileError = '';
  context.profileLoading = true;
  try {
    $('input-username').value = user;
    showProfileDialog(true, { focus: false });
    applyUser(user, { forceReset });
    switchView('view-review', { render: false });
    await migrateLocalStorageToIndexedDB(user);
    if (!isCurrent()) return false;
    context.loadUserTopics();
    await context.loadIndexedDBWordsData();
    if (!isCurrent()) return false;
    if (context.dbSyncError) throw context.dbSyncError;
    rememberProfile(user, previousUser);
    opened = true;
    return true;
  } catch (error) {
    if (isCurrent()) {
      console.warn('Profile could not open:', error);
      profileError = 'Could not open this profile. Check browser storage and try again.';
      updateStatusBadge(false, 'Could not open profile');
    }
    return false;
  } finally {
    if (isCurrent()) {
      context.profileLoading = false;
      showProfileDialog(!opened);
      if (opened) {
        if (user === GUEST_PROFILE) updateStatusBadge(false, 'Guest library · saved on this device');
        else if (!context.db) updateStatusBadge(false, navigator.onLine ? 'Local library ready' : 'Offline · saved locally');
        context.renderActiveCard();
        void context.showPendingDeck();
      }
    }
  }
}

export function logoutUser() {
  const previousUser = rememberedProfile() || context.currentUser;
  profileAttempt++;
  profileError = '';
  context.profileLoading = false;
  applyUser('');
  rememberProfile('', previousUser);
  $('input-username').value = '';
  switchView('view-review', { render: false });
  showProfileDialog(false);
  setProfileDropdown(false, { restoreFocus: true });
}

export async function handleOnlineReconnection() {
  const ticket = context.accountGeneration;
  if (!context.db || !canSyncProfile(context.currentUser)) return;
  await syncPendingOperations();
  if (ticket !== context.accountGeneration) return;
  context.checkStudentVocabularyMetadata();
  await context.flushActivityLogSync({ force: true, reason: 'online_reconnected' });
}

export async function syncPendingOperations() {
  const username = context.currentUser, ticket = context.accountGeneration;
  const current = () => ticket === context.accountGeneration && username === context.currentUser;
  if (!context.db || !navigator.onLine || !canSyncProfile(username)) return false;
  clearTimeout(syncRetry);
  try {
    await context.firebasePersistenceReady;
    if (!current()) return false;
    await flushMutationOutbox({
      db: context.db,
      username,
      onStatus: (ok, message) => { if (current()) updateStatusBadge(ok, message); },
      onChange: user => current() ? context.refreshVocabulary(user) : undefined
    });
    if (current()) syncBackoff = INITIAL_BACKOFF;
    return true;
  } catch (error) {
    console.warn('Outbox retained for retry:', error);
    if (current() && navigator.onLine) {
      syncRetry = setTimeout(() => { void syncPendingOperations(); }, syncBackoff);
      syncBackoff = Math.min(60000, syncBackoff * 2);
    }
    return false;
  }
}

export function updateStatusBadge(ok, text) {
  const dot = $('connection-dot'), status = $('sync-status');
  if (status) { status.textContent = text; status.dataset.ok = String(ok); }
  if (dot) dot.dataset.ok = String(ok);
}

function setupUserGuide() {
  const trigger = $('btn-user-guide'), guide = $('modal-user-guide'), close = $('btn-close-user-guide');
  const dismiss = () => {
    guide.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    updateProfileLock();
    if (trigger.closest('[inert]')) return;
    if (context.currentUser && !$('view-review').classList.contains('hidden')) context.renderActiveCard();
    if (context.currentUser && !$('view-library').classList.contains('hidden')) context.renderLibrary();
    trigger.focus();
  };
  trigger.addEventListener('click', () => {
    if (trigger.closest('[inert]')) return;
    context.pausePracticeAudio();
    guide.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    updateProfileLock();
    close.focus();
  });
  close.addEventListener('click', dismiss);
  guide.addEventListener('click', event => { if (event.target === guide) dismiss(); });
  guide.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...guide.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')]
      .filter(control => !control.closest('[hidden]'));
    const target = event.shiftKey ? controls.at(-1) : controls[0];
    if ((event.shiftKey && document.activeElement === controls[0]) ||
        (!event.shiftKey && document.activeElement === controls.at(-1))) {
      event.preventDefault(); target?.focus();
    }
  });
}

export function setupNavigation({ retryStartup } = {}) {
  setupUserGuide();
  const drawer = $('drawer'), backdrop = $('drawer-backdrop'), trigger = $('btn-open-drawer');
  const navigation = $('drawer-navigation'), practicePanel = $('practice-panel'), heading = $('practice-panel-heading');
  const openPractice = $('btn-practice-panel'), backToMenu = $('btn-practice-panel-back');
  function setPracticePanel(open) {
    navigation.hidden = open;
    practicePanel.hidden = !open;
    drawer.classList.toggle('drawer-practice-open', open);
    if (open) drawer.setAttribute('aria-labelledby', heading.id);
    else drawer.removeAttribute('aria-labelledby');
  }
  function setDrawer(open, { restoreFocus = true } = {}) {
    if (!open) setPracticePanel(false);
    drawer.classList.toggle('-translate-x-full', !open);
    backdrop.classList.toggle('opacity-0', !open);
    backdrop.classList.toggle('pointer-events-none', !open);
    trigger.setAttribute('aria-expanded', String(open));
    updateProfileLock();
    if (open) focusNavigation();
    else if (restoreFocus) {
      if (context.currentUser && !$('view-review').classList.contains('hidden')) context.renderActiveCard();
      focusNavigation();
    }
  }
  setDrawer(false, { restoreFocus: false });
  trigger.addEventListener('click', () => {
    if (trigger.closest('[inert]')) return;
    context.SoundManager.playSelect();
    setDrawer(true);
  });
  const closeDrawer = () => setDrawer(false);
  $('btn-close-drawer').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  function openPracticeSettings(focusTarget = heading) {
    if (!context.currentUser || context.profileLoading) return;
    context.SoundManager.playSelect();
    context.pausePracticeAudio();
    setPracticePanel(true);
    if (drawer.inert) setDrawer(true);
    practicePanel.scrollTop = 0;
    context.renderSettings();
    void context.renderStats();
    focusTarget.focus();
  }
  openPractice.addEventListener('click', () => {
    if (!drawer.inert) openPracticeSettings();
  });
  $('btn-adjust-daily-limits')?.addEventListener('click', event => {
    if (!event.currentTarget.closest('[hidden], [inert]')) openPracticeSettings($('practice-daily-limits'));
  });
  backToMenu.addEventListener('click', () => {
    setPracticePanel(false);
    openPractice.focus();
  });
  drawer.addEventListener('keydown', event => {
    if (drawer.inert) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...drawer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')]
      .filter(control => !control.closest('[hidden], .hidden, [inert]'));
    const first = controls[0], last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  });
  navigation.querySelectorAll('button[data-target]').forEach(button => {
    button.addEventListener('click', () => {
      if (drawer.inert || !context.currentUser || context.profileLoading) return;
      context.SoundManager.playSelect();
      setDrawer(false, { restoreFocus: false });
      focusNavigation();
      switchView(button.dataset.target);
    });
  });
  navigation.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', event => {
      if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) closeDrawer();
    });
  });

  const avatar = $('user-display'), profileMenu = $('profile-dropdown');
  avatar.addEventListener('click', () => {
    if (avatar.closest('[inert]')) return;
    context.SoundManager.playSelect();
    if (profileMenu.hidden) setProfileDropdown(true, { focusAction: 'first' });
    else setProfileDropdown(false, { restoreFocus: true });
  });
  avatar.addEventListener('keydown', event => {
    if (avatar.closest('[inert]') || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setProfileDropdown(true, { focusAction: event.key === 'ArrowUp' ? 'last' : 'first' });
  });
  function dismissProfileMenuOutside(event) {
    if (!profileMenu.hidden && !profileMenu.contains(event.target) && !avatar.contains(event.target)) setProfileDropdown(false);
  }
  document.addEventListener('click', dismissProfileMenuOutside);
  document.addEventListener('focusin', dismissProfileMenuOutside);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !profileMenu.hidden) {
      event.preventDefault();
      setProfileDropdown(false, { restoreFocus: true });
    } else if (event.key === 'Escape' && !$('modal-login').hidden && !$('btn-login-cancel').classList.contains('hidden')) {
      event.preventDefault();
      $('btn-login-cancel').click();
    }
  });

  async function submitLogin() {
    if ($('btn-login-submit').disabled) return;
    const user = $('input-username').value.trim();
    if (!user) {
      context.SoundManager.playError();
      context.showToast('Please enter your name.', 'error');
      return;
    }
    if (await activateUser(user)) {
      context.SoundManager.playSuccess();
      context.showToast(`Welcome, ${user}!`, 'success');
    }
  }
  $('btn-startup-retry')?.addEventListener('click', retryStartup);
  $('btn-login-submit').addEventListener('click', submitLogin);
  $('btn-continue-guest')?.addEventListener('click', async event => {
    if (event.currentTarget.disabled) return;
    if (await activateUser(GUEST_PROFILE)) context.SoundManager.playSuccess();
  });
  $('input-username').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void submitLogin(); }
  });
  const chooseProfile = () => {
    setProfileDropdown(false);
    setDrawer(false, { restoreFocus: false });
    profileDialogCanCancel = true;
    $('input-username').value = canSyncProfile(context.currentUser) ? context.currentUser : '';
    context.pausePracticeAudio();
    showProfileDialog(true);
    $('input-username').select();
  };
  $('btn-switch-user').addEventListener('click', chooseProfile);
  $('btn-profile-sign-in').addEventListener('click', chooseProfile);
  $('btn-login-cancel').addEventListener('click', () => {
    showProfileDialog(false);
    $('user-display').focus();
  });
  $('btn-logout').addEventListener('click', logoutUser);
  document.addEventListener('lexicalspace:interactive', () => {
    updateProfileLock();
    if (!$('modal-login').classList.contains('hidden')) $('input-username').focus();
  });
}

export function switchView(viewId, { render = true } = {}) {
  const target = $(viewId);
  if (!target?.classList.contains('view-panel')) return;
  if (target.classList.contains('hidden')) context.navigationGeneration = (context.navigationGeneration || 0) + 1;
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.toggle('hidden', panel !== target));
  $('btn-open-drawer').innerHTML = icon(viewIcons[viewId] || 'cards');
  document.querySelectorAll('#drawer-navigation button[data-target]').forEach(button => {
    const active = button.dataset.target === viewId;
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (viewId !== 'view-entry') context.cancelQuickFill();
  if (viewId !== 'view-review') context.pausePracticeAudio();
  if (!render || !context.currentUser) return;

  switch (viewId) {
    case 'view-review': void context.startNewSession(); break;
    case 'view-library': context.updateLibraryTabsUI(); context.renderLibrary(); break;
    case 'view-in-class-check': context.renderInClassCheck(); break;
    case 'view-entry':
      updateVisualViewportHeight();
      context.renderEntryTopicCards();
      window.toggleAiLibrarySection(false);
      break;
  }
}
