import { parseFolderLesson } from './parser.js';
import { STORAGE_KEY, loadLibrary as loadStoredLibrary, saveLibrary, ProgressManager, getProgressColor, getProgressColorClass, getApplyProgressColor, getApplyProgressColorClass } from './storage-decay.js';
import { createNotebookUI } from './notebook-ui.js?v=hide_filename1';

'use strict';

const byId = id => document.getElementById(id);
const libraryView = byId('library-view');
const student = byId('notebook-view');
const appHeader = byId('app-header');
const book = byId('notebook-book');
const lessonProgress = byId('lesson-progress');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let storageWritable = true;
let activeLesson = null;
let library = [];
let currentView = 'library';
let generalCatalog = [];
let generalRequest = null;
let lessonLoadState = null;
let lessonLoadSequence = 0;

window.addEventListener('beforeunload', function (event) {
  if (currentView !== 'notebook' || !activeLesson || student?.hidden) return;
  event.preventDefault();
  event.returnValue = 'Bạn có chắc chắn muốn rời đi? Dữ liệu bài làm sẽ bị mất.';
});

function notice(message) {
  const el = byId('app-notice');
  if (el) {
    el.textContent = message;
    el.hidden = !message;
  }
}

function questionTotal(lesson) {
  return lesson.parts.reduce((sum, part) => sum + part.exercises.length, 0);
}

function loadLibrary() {
  const result = loadStoredLibrary(notice);
  storageWritable = result.writable;
  return result.lessons;
}

function syncActiveLessonMeta() {
  const latest = library.find(lesson => lesson.id === activeLesson?.id);
  if (!latest) return;
  activeLesson.title = latest.title;
  activeLesson.score = latest.score;
  activeLesson.lastCompletedDate = latest.lastCompletedDate;
  const heading = book.querySelector('.notebook-title');
  if (heading) heading.textContent = latest.title;
  if (currentView === 'notebook' && !lessonLoadState) {
    document.title = latest.title + ' | GrammarSpace';
  }
}

function refreshLibrary() {
  const stored = loadLibrary();
  if (stored !== null) library = stored;
  syncActiveLessonMeta();
}

function persistLibrary() {
  if (!storageWritable) return false;
  try {
    saveLibrary(library);
    return true;
  } catch {
    return false;
  }
}

function commitLesson(id, changes, fallback = null) {
  const source = fallback || library.find(lesson => lesson.id === id) || (activeLesson?.id === id ? activeLesson : null);
  if (!source) return null;
  refreshLibrary();
  const index = library.findIndex(lesson => lesson.id === id);
  if (index < 0) {
    library.push({ ...source, ...changes });
  } else {
    library[index] = { ...library[index], ...changes };
  }
  const saved = persistLibrary();
  syncActiveLessonMeta();
  return { lesson: library.find(lesson => lesson.id === id), saved };
}

function folderError(message, code = '') {
  return Object.assign(new Error(message), { code });
}

function validateLessonFilename(value) {
  if (typeof value !== 'string' || !value.trim() || /[\\:%?#\u0000-\u001f]/.test(value)) {
    throw folderError('Tên tệp bài học không hợp lệ.');
  }
  const segments = value.trim().split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..') || !/\.json$/i.test(segments.at(-1))) {
    throw folderError('Bài học phải là tệp JSON trong thư mục lessons.');
  }
  return segments.join('/');
}

function lessonAssetPath(filename) {
  return './lessons/' + validateLessonFilename(filename).split('/').map(encodeURIComponent).join('/');
}

async function fetchFolderJSON(path, signal) {
  if (location.protocol === 'file:') {
    throw folderError('Hãy mở GrammarSpace qua địa chỉ http://localhost hoặc website để tải thư mục bài học. Mở trực tiếp tệp HTML không hỗ trợ tính năng này.', 'local-file');
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);

  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) {
      throw folderError(response.status === 404 ? 'Không tìm thấy tệp bài học.' : 'Chưa tải được dữ liệu bài học.', 'http-' + response.status);
    }
    return await response.json();
  } catch (error) {
    if (timedOut) throw folderError('Tải bài quá lâu. Kiểm tra kết nối rồi thử lại.', 'timeout');
    if (signal?.aborted) throw error;
    if (error instanceof TypeError) throw folderError('Không kết nối được với thư mục bài học.', 'network');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

function parseGeneralManifest(data) {
  if (!Array.isArray(data)) throw folderError('Danh mục bài học phải là một mảng JSON.');
  const seen = new Set();
  const entries = [];
  data.forEach(item => {
    try {
      if (!item || !['id', 'group', 'title', 'filename'].every(key => typeof item[key] === 'string' && item[key].trim())) {
        return;
      }
      const manifestId = item.id.trim();
      if (seen.has(manifestId)) return;
      const filename = validateLessonFilename(item.filename);
      seen.add(manifestId);
      entries.push({
        id: 'general:' + encodeURIComponent(manifestId),
        manifestId,
        group: item.group.trim(),
        title: item.title.trim(),
        filename,
        origin: 'general',
        sourceName: 'GrammarSpace'
      });
    } catch {}
  });
  return entries;
}

function loadGeneralCatalog() {
  if (generalRequest) return generalRequest;
  generalRequest = (async () => {
    try {
      const data = await fetchFolderJSON('./lessons/index.json');
      generalCatalog = parseGeneralManifest(data);
    } catch (error) {
      console.warn('Không tải được danh mục bài học:', error);
      const statusEl = byId('library-status');
      if (statusEl) statusEl.textContent = error.message || 'Không tải được danh mục bài học.';
    } finally {
      generalRequest = null;
      renderLibrary();
    }
  })();
  return generalRequest;
}

function manifestLessonWithProgress(entry) {
  const saved = library.find(item => item.id === entry.id);
  return {
    ...entry,
    ...(saved ? {
      parts: saved.parts,
      customTitle: saved.customTitle,
      title: saved.customTitle || entry.title,
      score: saved.score,
      lastCompletedDate: saved.lastCompletedDate,
      addedAt: saved.addedAt
    } : { score: null, lastCompletedDate: null })
  };
}

function cancelLessonLoad() {
  lessonLoadSequence++;
  lessonLoadState?.controller.abort();
  lessonLoadState = null;
  const loader = byId('notebook-loader');
  if (loader) loader.hidden = true;
  book.hidden = false;
  lessonProgress.hidden = false;
  student.removeAttribute('aria-busy');
}

async function openGeneralLesson(id) {
  const entry = generalCatalog.find(item => item.id === id);
  if (!entry) {
    notice('Bài này không còn trong danh mục.');
    return;
  }
  cancelLessonLoad();
  const request = { id, token: lessonLoadSequence, controller: new AbortController() };
  lessonLoadState = request;

  const loader = byId('notebook-loader');
  book.hidden = true;
  lessonProgress.hidden = true;
  if (loader) loader.hidden = false;
  byId('lesson-load-title').textContent = entry.title;
  byId('lesson-load-message').textContent = 'Đang tải bài học...';
  byId('retry-lesson').hidden = true;
  student.setAttribute('aria-busy', 'true');

  showView('notebook', { focus: false });
  byId('lesson-load-title').focus();

  try {
    const raw = await fetchFolderJSON(lessonAssetPath(entry.filename), request.controller.signal);
    if (request.token !== lessonLoadSequence) return;
    if (!raw || raw.id !== entry.manifestId) {
      throw folderError('Mã bài trong tệp không khớp với danh mục.');
    }
    const data = parseFolderLesson(raw, entry.title);
    if (request.token !== lessonLoadSequence) return;

    refreshLibrary();
    let lesson = withLocalProgress({
      id: entry.id,
      ...data,
      origin: 'general',
      sourceName: '',
      addedAt: new Date().toISOString(),
      score: null,
      lastCompletedDate: null,
      group: entry.group
    });
    commitLesson(lesson.id, lesson, lesson);
    cancelLessonLoad();
    renderLesson(lesson);
  } catch (error) {
    if (request.token !== lessonLoadSequence) return;
    student.setAttribute('aria-busy', 'false');
    byId('lesson-load-message').textContent = error.message || 'Không tải được bài học. Vui lòng thử lại.';
    byId('retry-lesson').hidden = false;
  }
}

function withLocalProgress(lesson) {
  const saved = library.find(item => item.id === lesson.id);
  const hasProgress = saved && typeof saved.score === 'number' && questionTotal(saved) === questionTotal(lesson);
  return {
    ...lesson,
    title: saved?.customTitle || lesson.title,
    customTitle: saved?.customTitle || '',
    addedAt: saved?.addedAt || '',
    score: hasProgress ? saved.score : null,
    lastCompletedDate: hasProgress ? saved.lastCompletedDate : null,
    group: lesson.group || saved?.group || ''
  };
}

function openLesson(id) {
  if (generalCatalog.some(item => item.id === id)) return openGeneralLesson(id);
  cancelLessonLoad();
  refreshLibrary();
  let lesson = library.find(item => item.id === id);
  if (!lesson) {
    notice('Bài này không còn trong thư viện.');
    renderLibrary();
    return;
  }
  renderLesson(lesson);
}

function getGroupBadgeInfo(group) {
  if (!group || typeof group !== 'string') return null;
  const raw = group.trim();
  if (!raw) return null;

  let label = raw;
  const match = raw.match(/^Group\s*\d+\s*:\s*(.+)$/i);
  if (match && match[1].trim()) {
    label = match[1].trim();
  }
  const text = label.startsWith('#') ? label : `#${label}`;
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Group 1: Thoi gian / Tu loai (Pastel Blue)
  if (/\bgroup\s*1\b/.test(norm) || /thoi\s*gian/.test(norm) || /tu\s*loai/.test(norm)) {
    return { text, className: 'group-badge-g1' };
  }
  // Group 2: Quan he / Mao tu & Gioi tu (Pastel Purple)
  if (/\bgroup\s*2\b/.test(norm) || /quan\s*he/.test(norm) || /mao\s*tu/.test(norm) || /gioi\s*tu/.test(norm)) {
    return { text, className: 'group-badge-g2' };
  }
  // Group 3: Menh de / Cac thi (Pastel Green)
  if (/\bgroup\s*3\b/.test(norm) || /menh\s*de/.test(norm) || /cac\s*thi/.test(norm) || /\bthi\b/.test(norm)) {
    return { text, className: 'group-badge-g3' };
  }
  // Group 4: The & Bi dong / Dong tu khuyet thieu (Pastel Orange/Peach)
  if (/\bgroup\s*4\b/.test(norm) || /bi\s*dong/.test(norm) || /\bthe\b/.test(norm) || /khuyet\s*thieu/.test(norm)) {
    return { text, className: 'group-badge-g4' };
  }

  // Dynamic group: hash-based pastel color
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const otherClasses = ['group-badge-yellow', 'group-badge-teal', 'group-badge-pink'];
  const fallbackClass = otherClasses[absHash % otherClasses.length];
  const hue = absHash % 360;

  return {
    text,
    className: fallbackClass,
    dynamicStyle: {
      backgroundColor: `hsl(${hue}, 85%, 94%)`,
      color: `hsl(${hue}, 70%, 30%)`
    }
  };
}

let selectedTopic = null;

function getNormalizedTopic(group) {
  return (group || 'Khác').replace(/^Group\s*\d+\s*:\s*/i, '').trim() || 'Khác';
}

function createTopicOverviewCard(entries, now = Date.now()) {
  if (!entries || !entries.length) return null;

  // Extract topics in curriculum progression order
  const topicMap = new Map();
  entries.forEach(lesson => {
    const rawGroup = lesson.group || 'Khác';
    const cleanGroup = getNormalizedTopic(rawGroup);
    if (!topicMap.has(cleanGroup)) {
      topicMap.set(cleanGroup, {
        name: cleanGroup,
        rawGroup: rawGroup,
        lessons: []
      });
    }
    topicMap.get(cleanGroup).lessons.push(lesson);
  });

  let totalLessonsCount = 0;
  let totalScoreSum = 0;

  const topicStats = Array.from(topicMap.values()).map(topic => {
    let topicScoreSum = 0;
    topic.lessons.forEach(l => {
      const status = ProgressManager.getLessonStatus(l.id, now);
      const score = status ? Math.max(0, Math.min(100, Math.round(status.displayedScore))) : 0;
      topicScoreSum += score;
    });
    const topicPercent = topic.lessons.length > 0 ? Math.round(topicScoreSum / topic.lessons.length) : 0;
    totalLessonsCount += topic.lessons.length;
    totalScoreSum += topicScoreSum;

    return {
      name: topic.name,
      count: topic.lessons.length,
      percent: topicPercent,
      color: getProgressColor(topicPercent),
      colorClass: getProgressColorClass(topicPercent)
    };
  });

  const overallPercent = totalLessonsCount > 0 ? Math.round(totalScoreSum / totalLessonsCount) : 0;
  const overallColor = getProgressColor(overallPercent);
  const overallColorClass = getProgressColorClass(overallPercent);

  const card = document.createElement('li');
  card.className = 'lesson-card topic-overview-card';
  card.setAttribute('aria-label', `Tổng quan tiến độ ${topicStats.length} chủ đề: ${overallPercent}% hoàn thành`);

  // Top row: Badge + Total percentage
  const top = document.createElement('div');
  top.className = 'lesson-card-top';

  const badge = document.createElement('span');
  badge.className = 'lesson-group-badge overview-badge';
  badge.textContent = '📊 Tiến độ chủ đề';

  const overallIndicator = document.createElement('div');
  overallIndicator.className = 'overview-total-badge';
  overallIndicator.innerHTML = `<span class="overview-total-label">Tổng:</span> <strong class="overview-total-num ${overallColorClass}" style="color: ${overallColor};">${overallPercent}%</strong>`;

  top.append(badge, overallIndicator);

  // Title row
  const titleRow = document.createElement('div');
  titleRow.className = 'lesson-title-row';
  const heading = document.createElement('h2');
  heading.className = 'lesson-title overview-title';
  heading.textContent = 'Tỉ lệ hoàn thành Chủ đề';
  const sub = document.createElement('span');
  sub.className = 'overview-subtitle';
  sub.textContent = `${topicStats.length} chủ đề · ${totalLessonsCount} bài học`;
  titleRow.append(heading, sub);

  // Topics Grid
  const topicsGrid = document.createElement('div');
  topicsGrid.className = 'overview-topics-grid';

  topicStats.forEach(t => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('aria-controls', 'topic-lessons');
    item.className = 'topic-stat-item' + (selectedTopic === t.name ? ' is-active' : '');
    item.setAttribute('aria-expanded', String(selectedTopic === t.name));
    item.setAttribute('title', `${t.name}: ${t.percent}% (${t.count} bài) · Nhấp để xem bài học`);
    item.setAttribute('aria-label', `${t.name}: ${t.percent}%`);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTopic = (selectedTopic === t.name) ? null : t.name;
      const buttons = topicsGrid.querySelectorAll('.topic-stat-item');
      buttons.forEach(btn => {
        const isActive = (btn === item) && (selectedTopic === t.name);
        btn.setAttribute('aria-expanded', String(isActive));
        btn.classList.toggle('is-active', isActive);
      });
      appendLessonCards(byId('topic-lessons'), entries, now);

    });

    const header = document.createElement('div');
    header.className = 'topic-stat-header';

    const name = document.createElement('span');
    name.className = 'topic-stat-name';
    name.textContent = t.name;

    const percent = document.createElement('span');
    percent.className = `topic-stat-percent ${t.colorClass}`;
    percent.style.color = t.color;
    percent.textContent = `${t.percent}%`;

    header.append(name, percent);

    const track = document.createElement('div');
    track.className = 'topic-stat-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuenow', t.percent);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');

    const fill = document.createElement('div');
    fill.className = `topic-stat-fill ${t.colorClass}`;
    fill.style.width = `${t.percent}%`;
    fill.style.backgroundColor = t.color;

    track.append(fill);
    item.append(header, track);
    topicsGrid.append(item);
  });

  card.append(top, titleRow, topicsGrid);
  return card;
}

function renderLessonCards(listId, entries, now = Date.now()) {
  const list = typeof listId === 'string' ? byId(listId) : listId;
  if (!list) return;
  list.replaceChildren();

  // 1. Topic Overview Card as the VERY FIRST card
  if (entries.length > 0) {
    const overviewCard = createTopicOverviewCard(entries, now);
    if (overviewCard) {
      list.append(overviewCard);
    }
  }

  appendLessonCards(byId('topic-lessons'), entries, now);
  }

  function appendLessonCards(list, entries, now = Date.now()) {
    if (!list) return;
    list.replaceChildren();
    list.hidden = !selectedTopic;
    list.scrollTop = 0;
    if (!selectedTopic) return;

  const targetEntries = selectedTopic
    ? entries.filter(l => getNormalizedTopic(l.group) === selectedTopic)
    : [];

  // Strict numerical and alphabetical sorting by lesson title / lesson number (01, 02, 03 ... 40)
  const sorted = [...targetEntries].sort((a, b) => {
    return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  sorted.forEach(lesson => {
    const item = document.createElement('li');
    item.className = 'lesson-card card-item';
    item.dataset.lessonId = lesson.id;
    const cleanTopic = getNormalizedTopic(lesson.group);
    if (cleanTopic) item.dataset.topic = cleanTopic;

    // Card-level click interaction: binds to the entire card container
    item.addEventListener('click', () => {
      openLesson(lesson.id);
    });

    const top = document.createElement('div');
    top.className = 'lesson-card-top';

    // 1. Group Hashtag badge
    const badgeInfo = getGroupBadgeInfo(lesson.group);
    if (badgeInfo) {
      const badge = document.createElement('span');
      badge.className = 'lesson-group-badge ' + badgeInfo.className;
      badge.textContent = badgeInfo.text;
      if (badgeInfo.dynamicStyle) {
        badge.style.backgroundColor = badgeInfo.dynamicStyle.backgroundColor;
        badge.style.color = badgeInfo.dynamicStyle.color;
      }
      top.append(badge);
    }

    // Progress status calculation (used exclusively by the bottom progress bar)
    const status = ProgressManager.getLessonStatus(lesson.id, now);

    // 3. Lesson Title
    const titleRow = document.createElement('div');
    titleRow.className = 'lesson-title-row';
    const heading = document.createElement('h2');
    heading.className = 'lesson-title';
    heading.textContent = lesson.title;
    titleRow.append(heading);

    // 4. Dual Lesson Progress Bars (Practice & Apply)
    const practicePercent = status && typeof status.practiceScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(status.practiceScore)))
      : (status ? Math.max(0, Math.min(100, Math.round(status.displayedScore))) : 0);
    const applyPercent = status && typeof status.applyScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(status.applyScore)))
      : 0;

    const practiceColor = getProgressColor(practicePercent);
    const practiceColorClass = getProgressColorClass(practicePercent);
    const applyColor = getApplyProgressColor(applyPercent);
    const applyColorClass = getApplyProgressColorClass(applyPercent);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'card-progress-container dual-progress';
    if (status) progressContainer.title = status.statusText;
    progressContainer.setAttribute('aria-label', `Tiến độ Practice: ${practicePercent}%, Apply: ${applyPercent}%`);

    // Practice Row
    const practiceRow = document.createElement('div');
    practiceRow.className = 'tier-progress-row';
    const practiceInfo = document.createElement('div');
    practiceInfo.className = 'tier-progress-info';
    practiceInfo.innerHTML = `<span class="tier-progress-label">Practice:</span> <span class="tier-progress-percent ${practiceColorClass}" style="color: ${practiceColor};">${practicePercent}%</span>`;
    const practiceTrack = document.createElement('div');
    practiceTrack.className = 'card-progress-track practice-track';
    practiceTrack.setAttribute('role', 'progressbar');
    practiceTrack.setAttribute('aria-valuenow', practicePercent);
    practiceTrack.setAttribute('aria-valuemin', '0');
    practiceTrack.setAttribute('aria-valuemax', '100');
    const practiceFill = document.createElement('div');
    practiceFill.className = `card-progress-fill practice-fill ${practiceColorClass}`;
    practiceFill.style.width = `${practicePercent}%`;
    practiceFill.style.backgroundColor = practiceColor;
    practiceTrack.append(practiceFill);
    practiceRow.append(practiceInfo, practiceTrack);

    // Apply Row
    const applyRow = document.createElement('div');
    applyRow.className = 'tier-progress-row';
    const applyInfo = document.createElement('div');
    applyInfo.className = 'tier-progress-info';
    applyInfo.innerHTML = `<span class="tier-progress-label tier-apply-label">Apply (Nâng cao):</span> <span class="tier-progress-percent ${applyColorClass}" style="color: ${applyColor};">${applyPercent}%</span>`;
    const applyTrack = document.createElement('div');
    applyTrack.className = 'card-progress-track apply-track';
    applyTrack.setAttribute('role', 'progressbar');
    applyTrack.setAttribute('aria-valuenow', applyPercent);
    applyTrack.setAttribute('aria-valuemin', '0');
    applyTrack.setAttribute('aria-valuemax', '100');
    const applyFill = document.createElement('div');
    applyFill.className = `card-progress-fill apply-fill ${applyColorClass}`;
    applyFill.style.width = `${applyPercent}%`;
    applyFill.style.backgroundColor = applyColor;
    applyTrack.append(applyFill);
    applyRow.append(applyInfo, applyTrack);

    progressContainer.append(practiceRow, applyRow);

    if (top.hasChildNodes()) {
      item.append(top);
    }
    item.append(titleRow, progressContainer);
    list.append(item);
  });
}

function renderLibrary() {
  refreshLibrary();
  const now = Date.now();
  const entries = generalCatalog.map(manifestLessonWithProgress);
  renderLessonCards('library-lessons', entries, now);

  const emptyEl = byId('library-empty');
  if (emptyEl) {
    emptyEl.hidden = generalCatalog.length > 0;
  }
}

function showView(name, { focus = true } = {}) {
  if (name !== 'notebook') cancelLessonLoad();
  finishPageTurn();
  currentView = name;

  if (name === 'library') {
    activeLesson = null;
    if (student) student.hidden = true;
    if (libraryView) libraryView.hidden = false;
    if (appHeader) appHeader.hidden = false;
    document.title = 'GrammarSpace';
    window.scrollTo({ top: 0, behavior: 'auto' });
    renderLibrary();
    if (focus) byId('library-lessons')?.focus?.({ preventScroll: true });
  } else if (name === 'notebook') {
    if (libraryView) libraryView.hidden = true;
    if (student) student.hidden = false;
    if (appHeader) appHeader.hidden = true;
    document.title = (lessonLoadState ? byId('lesson-load-title').textContent : activeLesson?.title || 'Notebook') + ' | GrammarSpace';
    window.scrollTo({ top: 0, behavior: 'auto' });
    syncBookHeight();
    if (focus) notebook.currentHeading()?.focus?.({ preventScroll: true });
  }
}

// Navigation event listeners: Return to Library
const returnToLibrary = () => showView('library');
byId('notebook-lib-btn')?.addEventListener('click', returnToLibrary);
byId('back-to-library-btn')?.addEventListener('click', returnToLibrary);
byId('notebook-back-btn')?.addEventListener('click', returnToLibrary);
byId('cancel-lesson-load')?.addEventListener('click', returnToLibrary);
document.querySelectorAll('.notebook-lib-btn, .back-lib-btn, .back-to-library-btn').forEach(btn => {
  btn.addEventListener('click', returnToLibrary);
});
byId('retry-lesson')?.addEventListener('click', () => {
  if (lessonLoadState) openGeneralLesson(lessonLoadState.id);
});

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === ProgressManager.getStorageKey() || event.key === null) {
    refreshLibrary();
    renderLibrary();
    updateLessonProgress();
  }
});

// Refresh progress when returning to the app or when a 24-hour decay boundary passes.
let lastDecaySignature = '';
function refreshDecayedProgress() {
  if (document.hidden) return;
  const entries = currentView === 'library' ? generalCatalog : (activeLesson ? [activeLesson] : []);
  const now = Date.now();
  const signature = entries.map(entry => {
    const status = ProgressManager.getLessonStatus(entry.id, now);
    return status ? `${entry.id}:${status.daysPassed}` : `${entry.id}:-`;
  }).join('|');
  if (signature === lastDecaySignature) return;
  lastDecaySignature = signature;
  if (currentView === 'library') renderLibrary();
  else if (currentView === 'notebook') updateLessonProgress();
}
document.addEventListener('visibilitychange', refreshDecayedProgress);
window.setInterval(refreshDecayedProgress, 60_000);

// Initialize 3D notebook UI
const notebook = createNotebookUI({
  byId,
  student,
  book,
  lessonProgress,
  reducedMotion,
  getActiveLesson: () => activeLesson,
  setActiveLesson: value => { activeLesson = value; },
  getLibrary: () => library,
  commitLesson,
  renderLibrary,
  showView
});

const { renderLesson, syncBookHeight, updateLessonProgress, finishPageTurn } = notebook;

// Start app with Library View as the direct landing page
refreshLibrary();
const startupCatalog = loadGeneralCatalog();
showView('library', { focus: false });

// The common loader waits for the lesson list, including the existing error view.
startupCatalog.then(() => window.SpaceSuite?.ready(), () => window.SpaceSuite?.ready());
