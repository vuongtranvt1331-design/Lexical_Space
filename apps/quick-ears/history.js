/**
 * Quick Ears - Local Attempt History
 * Per-student practice run persistence and profile progress tracking.
 */
(function() {
  'use strict';

  const STORAGE_PREFIX = 'qe_run_';

  function resolveProfile() {
    try {
      const active = sessionStorage.getItem('ls_active_profile');
      if (active && active.trim()) return active.trim();
    } catch {}

    try {
      const params = new URLSearchParams(window.location.search);
      const user = params.get('user');
      if (user && user.trim()) return user.trim();
    } catch {}

    try {
      const vocab = localStorage.getItem('vocab_user');
      if (vocab && vocab.trim()) return vocab.trim();
    } catch {}

    return 'Guest';
  }

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function getRawRuns() {
    const list = [];
    try {
      const total = localStorage.length;
      for (let i = 0; i < total; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = safeStorageGet(key);
          if (raw) {
            try {
              const obj = JSON.parse(raw);
              if (obj && typeof obj === 'object' &&
        typeof obj.title === 'string' &&
        typeof obj.profile === 'string' &&
        typeof obj.slug === 'string' &&
        Number.isInteger(obj.total) && obj.total > 0 &&
        Number.isSafeInteger(obj.first) && obj.first >= 0 &&
        Number.isSafeInteger(obj.replayed) && obj.replayed >= 0 &&
        Number.isSafeInteger(obj.skipped) && obj.skipped >= 0 &&
        (obj.first + obj.replayed + obj.skipped) <= obj.total) {
                obj._key = key;
                list.push(obj);
              }
            } catch {}
          }
        }
      }
    } catch {}
    return list;
  }

  function getAllProfiles() {
    const current = resolveProfile();
    const set = new Set([current]);
    const runs = getRawRuns();
    for (const r of runs) {
      if (typeof r.profile === 'string' && r.profile.trim()) {
        set.add(r.profile.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function cleanLessonTitle(raw) {
    if (!raw) return '';
    return raw.replace(/^(?:✓ |🟡 ⏸ |✕ )/, '');
  }

  class RunTracker {
    constructor() {
      this.currentRun = null;
    }

    startNewRun(topic, slug, title, total) {
      this.currentRun = {
        key: STORAGE_PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        profile: resolveProfile(),
        topic: topic || '',
        slug: slug || '',
        title: cleanLessonTitle(title || slug || ''),
        start: new Date().toISOString(),
        updated: new Date().toISOString(),
        total: Math.max(0, Number(total) || 0),
        first: 0,
        replayed: 0,
        skipped: 0,
        completed: false,
        persisted: false
      };
    }

    onInteraction(records, forcePersist = false) {
      if (!this.currentRun) return;

      const hasAudio = records.some(r => r.heard);
      const hasAttempt = records.some(r => (r.attempts > 0 || r.skipped || r.correct));
      const shouldSave = forcePersist || hasAudio || hasAttempt;
      if (!shouldSave) return;

      let first = 0, replayed = 0, skipped = 0;
      for (const r of records) {
        if (r.correct) {
          if (r.first) first++;
          else replayed++;
        } else if (r.skipped) {
          skipped++;
        }
      }

      this.currentRun.first = first;
      this.currentRun.replayed = replayed;
      this.currentRun.skipped = skipped;
      this.currentRun.updated = new Date().toISOString();

      const answered = first + replayed + skipped;
      this.currentRun.completed = this.currentRun.total > 0 && answered >= this.currentRun.total;

      const payload = {
        profile: this.currentRun.profile,
        topic: this.currentRun.topic,
        slug: this.currentRun.slug,
        title: this.currentRun.title,
        start: this.currentRun.start,
        updated: this.currentRun.updated,
        total: this.currentRun.total,
        first: this.currentRun.first,
        replayed: this.currentRun.replayed,
        skipped: this.currentRun.skipped,
        completed: this.currentRun.completed
      };

      if (safeStorageSet(this.currentRun.key, JSON.stringify(payload))) {
        this.currentRun.persisted = true;
      }
    }
  }

  const tracker = new RunTracker();

  function getProfileLessonStatusMap(profile) {
    const target = profile || resolveProfile();
    const map = new Map();
    const runs = getRawRuns();
    for (const r of runs) {
      if (r.profile !== target || !r.slug) continue;
      const prev = map.get(r.slug);
      const answered = (r.first || 0) + (r.replayed || 0) + (r.skipped || 0);
      const isCompleted = r.completed === true || (r.total > 0 && answered >= r.total);
      if (isCompleted) {
        map.set(r.slug, 'completed');
      } else {
        if (prev !== 'completed') {
          map.set(r.slug, 'in_progress');
        }
      }
    }
    return map;
  }

  function formatStatusPrefix(status) {
    if (status === 'completed') return '✓ ';
    if (status === 'in_progress') return '🟡 ⏸ ';
    return '✕ ';
  }

  function getStatusLabel(status) {
    if (status === 'completed') return '✓ Completed';
    if (status === 'in_progress') return '⏸️ In progress';
    return '✕ Not started';
  }

  function renderHistoryView(selectedProfile) {
    const active = resolveProfile();
    const profileToFilter = selectedProfile || active;
    const profileSelect = document.getElementById('history-profile');
    if (profileSelect) {
      const allProfiles = getAllProfiles();
      profileSelect.replaceChildren(...allProfiles.map(p => {
        const text = p === active ? `${p} (current)` : p;
        return new Option(text, p, false, p === profileToFilter);
      }));
    }

    const runs = getRawRuns()
      .filter(r => r.profile === profileToFilter)
      .sort((a, b) => new Date(b.updated || b.start || 0) - new Date(a.updated || a.start || 0));

    const listContainer = document.getElementById('history-list');
    const emptyMsg = document.getElementById('history-empty');
    if (!listContainer) return;

    listContainer.replaceChildren();
    if (!runs.length) {
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }
    if (emptyMsg) emptyMsg.hidden = true;

    for (const run of runs) {
      const card = document.createElement('div');
      card.className = 'history-item';

      const header = document.createElement('div');
      header.className = 'history-item-header';

      const titleEl = document.createElement('strong');
      titleEl.className = 'history-item-title';
      titleEl.textContent = cleanLessonTitle(run.title || run.slug);

      const statusTag = document.createElement('span');
      const answered = (run.first || 0) + (run.replayed || 0) + (run.skipped || 0);
      const total = run.total || 0;
      const isCompleted = run.completed || (total > 0 && answered >= total);
      statusTag.className = 'history-tag ' + (isCompleted ? 'tag-completed' : 'tag-progress');
      statusTag.textContent = isCompleted ? 'Completed' : 'In progress';

      header.append(titleEl, statusTag);

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';

      const d = run.updated || run.start ? new Date(run.updated || run.start) : null;
      const dateStr = d && !isNaN(d) ? d.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }) : 'Recent';

      const firstCount = run.first || 0;
      const repCount = run.replayed || 0;
      const skipCount = run.skipped || 0;
      const firstPct = total > 0 ? Math.round((firstCount / total) * 100) : 0;
      const repPct = total > 0 ? Math.round((repCount / total) * 100) : 0;
      const skipPct = total > 0 ? Math.round((skipCount / total) * 100) : 0;
      const remPct = Math.max(0, 100 - firstPct - repPct - skipPct);

      const progressText = `Progress: ${answered}/${total} sentences · First-try: ${firstCount}/${total} (${firstPct}%)`;
      const dateSpan = document.createElement('span');
      dateSpan.textContent = dateStr;
      const countsSpan = document.createElement('span');
      countsSpan.textContent = progressText;

      meta.append(dateSpan, countsSpan);

      const bar = document.createElement('div');
      bar.className = 'history-bar';
      const accessibleSummary = `First try: ${firstCount}, Replayed: ${repCount}, Skipped: ${skipCount}, Remaining: ${Math.max(0, total - answered)}`;
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `${cleanLessonTitle(run.title)}: ${accessibleSummary}`);

      const segGreen = document.createElement('div');
      segGreen.className = 'bar-seg seg-first';
      segGreen.style.width = firstPct + '%';
      segGreen.title = `First try: ${firstCount}`;

      const segYellow = document.createElement('div');
      segYellow.className = 'bar-seg seg-replayed';
      segYellow.style.width = repPct + '%';
      segYellow.title = `Corrected/Replayed: ${repCount}`;

      const segRed = document.createElement('div');
      segRed.className = 'bar-seg seg-skipped';
      segRed.style.width = skipPct + '%';
      segRed.title = `Skipped: ${skipCount}`;

      const segGray = document.createElement('div');
      segGray.className = 'bar-seg seg-remaining';
      segGray.style.width = remPct + '%';
      segGray.title = `Remaining: ${Math.max(0, total - answered)}`;

      bar.append(segGreen, segYellow, segRed, segGray);

      const breakdown = document.createElement('div');
      breakdown.className = 'history-breakdown';
      breakdown.textContent = `🟢 First try: ${firstCount} · 🟡 Replayed or corrected: ${repCount} · 🔴 Skipped: ${skipCount} · Remaining: ${total - answered}`;

      card.append(header, meta, bar, breakdown);
      listContainer.append(card);
    }
  }

  window.QuickEarsHistory = {
    tracker,
    resolveProfile,
    cleanLessonTitle,
    getProfileLessonStatusMap,
    formatStatusPrefix,
    getStatusLabel,
    renderHistoryView
  };
})();
