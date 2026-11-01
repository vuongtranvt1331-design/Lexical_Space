import { context } from "../core/context.js";
export function loadUserTopics() {
  const key = `vocab_topics_${context.currentUser}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      context.userTopics = JSON.parse(saved);
    } catch (e) {
      context.userTopics = [];
    }
  } else {
    context.userTopics = [];
  }
  if (!context.userTopics.includes(context.DEFAULT_TOPIC)) {
    context.userTopics.unshift(context.DEFAULT_TOPIC);
  }
  context.saveUserTopics();
}
export function saveUserTopics() {
  const key = `vocab_topics_${context.currentUser}`;
  localStorage.setItem(key, JSON.stringify(context.userTopics));
}
export function addUserTopic(topicName) {
  const trimmed = topicName.trim();
  if (!trimmed) return false;
  if (!context.userTopics.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
    context.userTopics.push(trimmed);
    context.saveUserTopics();
    context.updateTopicDropdowns();
  }
  return true;
}

/* Hàm dọn dẹp topic trống tự động */
export
/* Tạo studentKey ổn định từ username */
/* Cập nhật lại metadata wordCount lên Firebase và IndexedDB */
function checkAndCleanupEmptyTopics() {
  const existingTopics = [...context.userTopics];
  context.userTopics = existingTopics.filter(topic => {
    if (topic === context.DEFAULT_TOPIC) return true;
    const hasWords = context.wordsData.some(w => (w.topic || context.DEFAULT_TOPIC).toLowerCase() === topic.toLowerCase());
    return hasWords;
  });
  if (context.activeTopic !== 'ALL' && !context.userTopics.some(t => t.toLowerCase() === context.activeTopic.toLowerCase())) {
    context.activeTopic = 'ALL';
  }
  if (context.librarySelectedTopic !== 'ALL' && !context.userTopics.some(t => t.toLowerCase() === context.librarySelectedTopic.toLowerCase())) {
    context.librarySelectedTopic = 'ALL';
  }
  context.saveUserTopics();
}
export function sortTopicsNumericFirst(topics) {
  return [...topics].sort((a, b) => {
    const parseTopic = t => {
      const match = String(t || "").trim().match(/^(\d+)(?:\.|\s|-|_)?(.*)$/);
      if (match) {
        return {
          hasNumber: true,
          num: parseInt(match[1], 10),
          rest: match[2].trim()
        };
      }
      return {
        hasNumber: false,
        num: Infinity,
        rest: String(t || "").trim()
      };
    };
    const parsedA = parseTopic(a);
    const parsedB = parseTopic(b);
    if (parsedA.hasNumber && parsedB.hasNumber) {
      if (parsedA.num !== parsedB.num) return parsedA.num - parsedB.num;
      return parsedA.rest.localeCompare(parsedB.rest, 'vi', {
        sensitivity: 'base',
        numeric: true
      });
    }
    if (parsedA.hasNumber && !parsedB.hasNumber) return -1;
    if (!parsedA.hasNumber && parsedB.hasNumber) return 1;
    return parsedA.rest.localeCompare(parsedB.rest, 'vi', {
      sensitivity: 'base',
      numeric: true
    });
  });
}
export function getAlphabeticalTopics() {
  context.checkAndCleanupEmptyTopics();
  return context.sortTopicsNumericFirst(context.userTopics);
}
export async function updateStudentMetadataCount() {
  if (!context.currentUser) return;
  const studentKey = context.getStudentKey(context.currentUser);
  const currentCount = context.wordsData.length;
  const localMetaKey = `studentWordCount_${studentKey}`;

  // Lưu local metadata
  await context.idbPut("metadata", {
    key: localMetaKey,
    count: currentCount
  });

  // Lưu Firebase metadata nếu có mạng
  if (context.db && navigator.onLine) {
    try {
      await context.db.collection("metadata").doc(`userWordStats_${studentKey}`).set({
        username: context.currentUser,
        wordCount: currentCount
      }, {
        merge: true
      });
    } catch (err) {
      console.warn("Failed to update remote metadata count:", err);
    }
  }
}
export async function cleanupAndMigrateVocabularyData() {
  // 1. Local IndexedDB migration for vocabulary words
  try {
    const allWords = await context.idbGetAll("words");
    let localChanged = false;
    for (const w of allWords) {
      let modified = false;
      // Strip obsolete fields
      if ("hasBeenStudied" in w) {
        delete w.hasBeenStudied;
        modified = true;
      }
      if ("studiedAt" in w) {
        delete w.studiedAt;
        modified = true;
      }
      if ("lastReviewedAt" in w) {
        delete w.lastReviewedAt;
        modified = true;
      }
      if ("createdAt" in w) {
        delete w.createdAt;
        modified = true;
      }
      if ("studyCount" in w) {
        delete w.studyCount;
        modified = true;
      }
      if ("reviewCount" in w) {
        delete w.reviewCount;
        modified = true;
      }
      if ("lastStudied" in w) {
        delete w.lastStudied;
        modified = true;
      }
      if ("reviewedAt" in w) {
        delete w.reviewedAt;
        modified = true;
      }

      // Normalize isFavorite to boolean (false if missing/falsy)
      if (w.isFavorite === undefined || typeof w.isFavorite !== "boolean") {
        w.isFavorite = Boolean(w.isFavorite);
        modified = true;
      }

      // Normalize memoryStatus to exactly STATUS.KNOWN ("mastered") or STATUS.NOT_KNOWN ("not_remembered")
      if (w.memoryStatus === "known" || w.memoryStatus === "mastered" || w.memoryStatus === context.STATUS.KNOWN) {
        if (w.memoryStatus !== context.STATUS.KNOWN) {
          w.memoryStatus = context.STATUS.KNOWN;
          modified = true;
        }
      } else {
        if (w.memoryStatus !== context.STATUS.NOT_KNOWN) {
          w.memoryStatus = context.STATUS.NOT_KNOWN;
          modified = true;
        }
      }
      if (modified) {
        await context.idbPut("words", w);
        localChanged = true;
      }
    }

    // Clean pendingOps to ensure no obsolete fields are queued
    const pending = await context.idbGetAll("pendingOps");
    for (const op of pending) {
      let opModified = false;
      if (op.data) {
        ["hasBeenStudied", "studiedAt", "lastReviewedAt", "createdAt", "studyCount", "reviewCount", "lastStudied", "reviewedAt"].forEach(f => {
          if (f in op.data) {
            delete op.data[f];
            opModified = true;
          }
          if (op.data.updates && f in op.data.updates) {
            delete op.data.updates[f];
            opModified = true;
          }
        });
        if (op.type === "ADD" && (op.data.isFavorite === undefined || typeof op.data.isFavorite !== "boolean")) {
          op.data.isFavorite = Boolean(op.data.isFavorite);
          opModified = true;
        }
      }
      if (opModified) {
        await context.idbPut("pendingOps", op);
      }
    }
    if (localChanged) {
      const refreshed = await context.idbGetAll("words");
      context.wordsData = refreshed.filter(w => !w.username || w.username.toLowerCase() === context.currentUser.toLowerCase());
      context.updateBadges();
      context.renderLibrary();
      if (context.reviewMode === "favorites") context.startNewSession();
    }
  } catch (err) {
    console.warn("Local vocabulary cleanup error:", err);
  }

  // Remote changes are handled by the incremental vocabulary listener.
}
export async function loadIndexedDBWordsData() {
  try {
    await context.cleanupAndMigrateVocabularyData();
    const allWords = await context.idbGetAll("words");
    context.wordsData = allWords.filter(w => !w.username || w.username.toLowerCase() === context.currentUser.toLowerCase());
    context.wordsData.forEach(w => {
      if (w.topic && !context.userTopics.some(t => t.toLowerCase() === w.topic.toLowerCase())) {
        context.userTopics.push(w.topic);
      }
    });
    if (!context.userTopics.includes(context.DEFAULT_TOPIC)) {
      context.userTopics.unshift(context.DEFAULT_TOPIC);
    }
    context.checkAndCleanupEmptyTopics();
    context.saveUserTopics();
    context.updateTopicDropdowns();
    context.updateBadges();
    if (context.activeSessionWords.length === 0) context.startNewSession();
    context.renderLibrary();

    // Nạp trạng thái chờ đồng bộ activityLogTimestamp (nếu có từ phiên offline trước) mà không tạo timestamp giả
    await context.resumePendingActivitySyncForCurrentUser();

    // Thực hiện Quy trình đồng bộ theo học sinh
    if (context.db && navigator.onLine) {
      await context.syncPendingOperations();
      await context.checkStudentVocabularyMetadata();
    }
  } catch (err) {
    console.warn("IndexedDB load error:", err);
  }
}
export async function checkStudentVocabularyMetadata() {
  if (!context.db || !context.currentUser) return;
  await context.firebasePersistenceReady;
  context.vocabularySync.start(context.currentUser);
}
export function updateBadges() {
  const libCountEl = document.getElementById("badge-library-count");
  const revCountEl = document.getElementById("badge-review-count");
  if (libCountEl) libCountEl.textContent = context.wordsData.length;
  const eligibleReviewCount = context.wordsData.filter(w => context.isWordEligibleForReview(w)).length;
  const learningCount = context.wordsData.filter(w => w.memoryStatus !== context.STATUS.KNOWN).length;
  const favoritesCount = context.wordsData.filter(w => w.isFavorite).length;
  if (revCountEl) {
    if (context.reviewMode === "favorites") revCountEl.textContent = favoritesCount;else if (context.reviewMode === "review") revCountEl.textContent = eligibleReviewCount;else revCountEl.textContent = learningCount;
  }
}
export function updateTopicDropdowns() {
  context.checkAndCleanupEmptyTopics();
  const sortedTopics = context.getAlphabeticalTopics();
  context.renderReviewTopicUpwardMenu(sortedTopics);
  const entrySelect = document.getElementById("select-entry-topic");
  if (entrySelect) {
    const curEntry = context.draftWord.topic || entrySelect.value || context.DEFAULT_TOPIC;
    entrySelect.innerHTML = "";
    sortedTopics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      if (t === curEntry) opt.selected = true;
      entrySelect.appendChild(opt);
    });
    entrySelect.value = curEntry;
    context.draftWord.topic = curEntry;
  }
  context.renderEntryTopicCards(sortedTopics);
  context.renderLibraryTopicUpwardMenu(sortedTopics);
}
export function renderLibraryTopicUpwardMenu(sortedTopics) {
  const listEl = document.getElementById("lib-topic-options-list");
  if (!listEl) return;
  const libMenuCountEl = document.getElementById("lib-topic-menu-count");
  if (libMenuCountEl) libMenuCountEl.textContent = `${sortedTopics.length + 1} Topics`;
  let html = `
        <div onclick="selectLibraryTopic('ALL')" class="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${context.librarySelectedTopic === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">
          <span>All Topics</span>
          ${context.librarySelectedTopic === 'ALL' ? '<i class="ph-bold ph-check text-sm"></i>' : ''}
        </div>
        <div onclick="selectLibraryTopic('FAVORITES')" class="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${context.librarySelectedTopic === 'FAVORITES' ? 'bg-red-950/80 text-red-200 border border-red-500/80' : 'text-red-400 hover:bg-slate-800'}">
          <span class="flex items-center gap-1.5"><i class="ph-fill ph-heart text-red-500"></i> Favorites ❤️</span>
          ${context.librarySelectedTopic === 'FAVORITES' ? '<i class="ph-bold ph-check text-sm"></i>' : ''}
        </div>
      `;
  sortedTopics.forEach(t => {
    const isSelected = context.librarySelectedTopic === t;
    const isDefault = t === context.DEFAULT_TOPIC;
    html += `
          <div onclick="selectLibraryTopic('${context.escapeQuotes(t)}')" class="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">
            <span class="truncate pr-2">${context.escapeHtml(t)}</span>
            <div class="flex items-center gap-1.5 flex-shrink-0" onclick="event.stopPropagation()">
              <button type="button" onclick="openMergeModalForTopic('${context.escapeQuotes(t)}')" class="w-6 h-6 rounded-lg bg-slate-950/70 hover:bg-indigo-700 text-indigo-300 hover:text-white border border-indigo-800/60 flex items-center justify-center active:scale-95 transition-all" title="Merge topics"><i class="ph-bold ph-plus text-xs"></i></button>
              ${isDefault ? `<span class="w-6 h-6 rounded-lg bg-slate-950/40 text-slate-600 border border-slate-800 flex items-center justify-center cursor-not-allowed"><i class="ph-bold ph-lock text-xs"></i></span>` : `<button type="button" onclick="deleteTopicDirectly('${context.escapeQuotes(t)}')" class="w-6 h-6 rounded-lg bg-rose-950/70 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-800/60 flex items-center justify-center active:scale-95 transition-all" title="Delete topic"><i class="ph-bold ph-trash text-xs"></i></button>`}
            </div>
          </div>
        `;
  });
  listEl.innerHTML = html;
  const libLabelEl = document.getElementById("lib-selected-topic-label");
  if (libLabelEl) {
    if (context.librarySelectedTopic === 'FAVORITES') {
      libLabelEl.textContent = 'Collection: Favorites ❤️';
    } else {
      libLabelEl.textContent = `Topic: ${context.librarySelectedTopic === 'ALL' ? 'All Topics' : context.librarySelectedTopic}`;
    }
  }
}
export function install_selectLibraryTopic() {
  window.selectLibraryTopic = topic => {
    context.SoundManager.playSelect();
    context.librarySelectedTopic = topic;
    document.getElementById("lib-topic-upward-menu").classList.add("hidden");
    document.getElementById("lib-topic-chevron").classList.remove("rotate-180");
    context.updateTopicDropdowns();
    context.renderLibrary();
  };
}
export async function toggleWordFavorite(docId, animate = false) {
  if (context.isTogglingFavorite) return;
  const target = context.wordsData.find(w => w.id === docId);
  if (!target) return;
  context.isTogglingFavorite = true;
  try {
    const newFav = !target.isFavorite;
    target.isFavorite = newFav;
    if (context.activeSessionWords[context.sessionCurrentIndex]?.id === docId) {
      context.updateCardFavoriteVisual(newFav, animate);
    }
    await context.idbPut("words", target);
    context.renderLibrary();
    if (context.reviewMode === "favorites" && !newFav) {
      context.activeSessionWords = context.activeSessionWords.filter(w => w.id !== docId);
      if (context.sessionCurrentIndex >= context.activeSessionWords.length) {
        context.sessionCurrentIndex = Math.max(0, context.activeSessionWords.length - 1);
      }
      context.renderActiveCard();
    }
    const updatePayload = {
      isFavorite: newFav
    };
    if (context.db && navigator.onLine) {
      try {
        await context.db.collection("words").doc(docId).update(updatePayload);
      } catch (e) {
        await context.idbPut("pendingOps", {
          id: `fav_${docId}_${Date.now()}`,
          type: "UPDATE",
          data: {
            id: docId,
            updates: updatePayload
          }
        });
      }
    } else {
      await context.idbPut("pendingOps", {
        id: `fav_${docId}_${Date.now()}`,
        type: "UPDATE",
        data: {
          id: docId,
          updates: updatePayload
        }
      });
    }
  } finally {
    context.isTogglingFavorite = false;
  }
}
export function install_toggleWordQuickSave() {
  window.toggleWordQuickSave = () => {};
}
export function install_toggleLibraryWordFavorite() {
  window.toggleLibraryWordFavorite = async function (docId) {
    const target = context.wordsData.find(w => w.id === docId);
    if (!target) return;
    const newFav = !target.isFavorite;
    target.isFavorite = newFav;
    if (context.activeSessionWords[context.sessionCurrentIndex]?.id === docId) {
      context.updateCardFavoriteVisual(newFav, false);
    }
    await context.idbPut("words", target);
    context.updateBadges();
    if (context.libraryTab === "favorites") {
      context.renderLibrary();
    } else {
      const icon = document.getElementById(`lib-fav-icon-${docId}`);
      const btn = document.getElementById(`lib-fav-${docId}`);
      if (icon) {
        icon.className = `${newFav ? 'ph-fill ph-heart text-red-500' : 'ph ph-bold ph-heart text-white'} text-base`;
        icon.classList.remove("animate-heart-pop", "animate-heart-unpop");
        void icon.offsetWidth;
        icon.classList.add(newFav ? "animate-heart-pop" : "animate-heart-unpop");
      }
      if (btn) {
        btn.title = newFav ? "Remove from favorites" : "Add to favorites";
        btn.setAttribute("aria-label", newFav ? "Remove from favorites" : "Add to favorites");
      }
    }
    if (context.reviewMode === "favorites" && !newFav) {
      context.activeSessionWords = context.activeSessionWords.filter(w => w.id !== docId);
      if (context.sessionCurrentIndex >= context.activeSessionWords.length) {
        context.sessionCurrentIndex = Math.max(0, context.activeSessionWords.length - 1);
      }
      context.renderActiveCard();
    }
    const updatePayload = {
      isFavorite: newFav
    };
    if (context.db && navigator.onLine) {
      try {
        await context.db.collection("words").doc(docId).update(updatePayload);
      } catch (e) {
        await context.idbPut("pendingOps", {
          id: `fav_${docId}_${Date.now()}`,
          type: "UPDATE",
          data: {
            id: docId,
            updates: updatePayload
          }
        });
      }
    } else {
      await context.idbPut("pendingOps", {
        id: `fav_${docId}_${Date.now()}`,
        type: "UPDATE",
        data: {
          id: docId,
          updates: updatePayload
        }
      });
    }
  };
}
export async function updateWordMemory(docId, newStatus, fromStudySession = false) {
  const target = context.wordsData.find(w => w.id === docId);
  if (target) {
    if (target.memoryStatus === newStatus && !fromStudySession) return;
    target.memoryStatus = newStatus;
    delete target.hasBeenStudied;
    delete target.studiedAt;
    delete target.lastReviewedAt;
    delete target.createdAt;
    delete target.studyCount;
    delete target.reviewCount;
    if (target.isFavorite === undefined) target.isFavorite = false;
    await context.idbPut("words", target);
  }

  // Ghi nhận thời điểm hoạt động học tập gần nhất (cập nhật IndexedDB ngay, gộp ghi Firestore)
  context.recordLearningActivity(fromStudySession ? "study_swipe" : "library_status_toggle");
  context.updateBadges();
  context.renderLibrary();
  const updatePayload = {
    memoryStatus: newStatus
  };
  if (context.db && navigator.onLine) {
    try {
      await context.db.collection("words").doc(docId).update(updatePayload);
    } catch (e) {
      await context.idbPut("pendingOps", {
        id: `upd_${docId}_${Date.now()}`,
        type: "UPDATE",
        data: {
          id: docId,
          updates: updatePayload
        }
      });
    }
  } else {
    await context.idbPut("pendingOps", {
      id: `upd_${docId}_${Date.now()}`,
      type: "UPDATE",
      data: {
        id: docId,
        updates: updatePayload
      }
    });
  }
}
export function updateLibraryTabsUI() {
  const btnKnown = document.getElementById("btn-lib-tab-known");
  const btnFavs = document.getElementById("btn-lib-tab-favorites");
  const btnUnknown = document.getElementById("btn-lib-tab-unknown");
  const iconFavs = document.getElementById("lib-bottom-fav-icon");
  const activeRectClass = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-indigo-600 text-white border-indigo-500 shadow-sm active:scale-95 truncate";
  const inactiveRectClass = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95 truncate";
  if (btnKnown) btnKnown.className = context.libraryTab === "known" ? activeRectClass : inactiveRectClass;
  if (btnUnknown) btnUnknown.className = context.libraryTab === "unknown" ? activeRectClass : inactiveRectClass;
  if (btnFavs) {
    if (context.libraryTab === "favorites") {
      btnFavs.className = "w-[46px] h-[46px] min-w-[46px] min-h-[46px] aspect-square rounded-full flex-shrink-0 flex items-center justify-center shadow-lg transition-all active:scale-90 border bg-red-950/80 border-red-500/80 text-white relative shadow-[0_0_14px_rgba(239,68,68,0.35)]";
      btnFavs.title = "Favorites Collection (Active)";
      btnFavs.setAttribute("aria-label", "Favorites Collection (Active)");
      if (iconFavs) iconFavs.className = "ph-fill ph-heart text-xl text-red-500";
    } else {
      btnFavs.className = "w-[46px] h-[46px] min-w-[46px] min-h-[46px] aspect-square rounded-full flex-shrink-0 flex items-center justify-center shadow-md transition-all active:scale-90 border bg-slate-900 hover:bg-slate-800 border-slate-800 text-white relative";
      btnFavs.title = "Favorites Collection";
      btnFavs.setAttribute("aria-label", "Favorites Collection");
      if (iconFavs) iconFavs.className = "ph-bold ph-heart text-xl text-white";
    }
  }
}
export function setupLibraryModule() {
  const btnKnown = document.getElementById("btn-lib-tab-known");
  const btnFavs = document.getElementById("btn-lib-tab-favorites");
  const btnUnknown = document.getElementById("btn-lib-tab-unknown");
  const btnAddTopic = document.getElementById("btn-lib-create-topic");
  const box = document.getElementById("lib-topic-create-box");
  const search = document.getElementById("lib-search-input");
  const clearSearch = document.getElementById("btn-lib-clear-search");
  const triggerTopic = document.getElementById("btn-lib-topic-selector");
  const upwardMenu = document.getElementById("lib-topic-upward-menu");
  const chevron = document.getElementById("lib-topic-chevron");
  triggerTopic?.addEventListener("click", e => {
    e.stopPropagation();
    context.SoundManager.playSelect();
    upwardMenu?.classList.toggle("hidden");
    chevron?.classList.toggle("rotate-180");
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#lib-topic-popover-container")) {
      upwardMenu?.classList.add("hidden");
      chevron?.classList.remove("rotate-180");
    }
  });
  btnKnown?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.libraryTab = "known";
    context.updateLibraryTabsUI();
    context.renderLibrary();
  });
  btnFavs?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.libraryTab = "favorites";
    context.updateLibraryTabsUI();
    context.renderLibrary();
  });
  btnUnknown?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.libraryTab = "unknown";
    context.updateLibraryTabsUI();
    context.renderLibrary();
  });
  btnAddTopic?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    box?.classList.toggle("hidden");
    if (!box?.classList.contains("hidden")) document.getElementById("input-lib-topic-name").focus();
  });
  document.getElementById("btn-close-lib-topic-box")?.addEventListener("click", () => box?.classList.add("hidden"));
  document.getElementById("btn-save-lib-topic")?.addEventListener("click", () => {
    const val = document.getElementById("input-lib-topic-name").value.trim();
    if (!val) {
      context.SoundManager.playError();
      context.showToast("Enter topic name.", "error");
      return;
    }
    context.addUserTopic(val);
    document.getElementById("input-lib-topic-name").value = "";
    box?.classList.add("hidden");
    context.SoundManager.playSuccess();
    context.showToast("Topic created!", "success");
    context.renderLibrary();
  });
  search?.addEventListener("input", () => {
    clearSearch?.classList.toggle("hidden", !search.value);
    context.renderLibrary();
  });
  clearSearch?.addEventListener("click", () => {
    search.value = "";
    clearSearch.classList.add("hidden");
    context.renderLibrary();
  });
}

/* ========================================================
   TÍNH NĂNG XÓA TOPIC (ĐÃ SỬA TRIỆT ĐỂ)
   ======================================================== */
export function install_deleteTopicDirectly() {
  window.deleteTopicDirectly = async topicName => {
    if (!topicName || topicName.toLowerCase() === context.DEFAULT_TOPIC.toLowerCase()) {
      context.showToast("Cannot delete default topic.", "error");
      return;
    }
    if (!confirm(`Are you sure you want to delete topic "${topicName}" and ALL words inside it?`)) {
      return;
    }
    context.SoundManager.playSelect();
    try {
      // 1. Xác định chính xác các từ vựng thuộc topic này của học sinh hiện tại
      const wordsToDelete = context.wordsData.filter(w => (w.topic || context.DEFAULT_TOPIC).toLowerCase() === topicName.toLowerCase());
      const wordIdsToDelete = wordsToDelete.map(w => w.id);
      // A queued offline add or edit must not resurrect a deleted word later.
      const queued = await context.idbGetAll('pendingOps');
      for (const op of queued) if (wordIdsToDelete.includes(op?.data?.id)) await context.idbDelete('pendingOps', op.id);

      // 2. Xóa tất cả từ vựng khỏi IndexedDB
      for (const id of wordIdsToDelete) {
        await context.idbDelete("words", id);
      }

      // 3. Xóa tất cả từ vựng khỏi Firebase Firestore (Xử lý batch tối đa 500 từ mỗi batch)
      if (context.db && navigator.onLine) {
        const batchSize = 400;
        for (let i = 0; i < wordIdsToDelete.length; i += batchSize) {
          const chunk = wordIdsToDelete.slice(i, i + batchSize);
          const batch = context.db.batch();
          chunk.forEach(id => {
            const ref = context.db.collection("words").doc(id);
            batch.delete(ref);
          });
          await batch.commit();
        }
      } else {
        // Nếu offline, ghi queue pendingOps để xóa remote sau
        for (const id of wordIdsToDelete) {
          await context.idbPut("pendingOps", {
            id: `del_${id}`,
            type: "DELETE",
            data: {
              id
            }
          });
        }
      }

      // 4. Loại bỏ từ khỏi mảng wordsData local và xóa topic khỏi userTopics
      context.wordsData = context.wordsData.filter(w => (w.topic || context.DEFAULT_TOPIC).toLowerCase() !== topicName.toLowerCase());
      context.userTopics = context.userTopics.filter(t => t.toLowerCase() !== topicName.toLowerCase());
      if (!context.userTopics.includes(context.DEFAULT_TOPIC)) context.userTopics.unshift(context.DEFAULT_TOPIC);
      context.saveUserTopics();

      // 5. Cập nhật lại metadata wordCount & ghi nhận hoạt động
      context.recordLearningActivity("delete_topic");
      await context.updateStudentMetadataCount();

      // 6. Cập nhật lại giao diện
      if (context.librarySelectedTopic.toLowerCase() === topicName.toLowerCase()) {
        context.librarySelectedTopic = 'ALL';
      }
      if (context.activeTopic.toLowerCase() === topicName.toLowerCase()) {
        context.activeTopic = 'ALL';
      }
      context.updateTopicDropdowns();
      context.updateBadges();
      context.renderLibrary();
      context.startNewSession();
      context.SoundManager.playSuccess();
      context.showToast(`Topic "${topicName}" and its words deleted successfully!`, "success");
    } catch (err) {
      console.error("Error deleting topic:", err);
      context.SoundManager.playError();
      context.showToast("Failed to delete topic completely. Please check network.", "error");
    }
  };
}
export
/* ========================================================
   TÍNH NĂNG GOM TOPIC (MERGE TOPICS) - ĐÃ SỬA TRIỆT ĐỂ
   ======================================================== */
function setupMergeTopicsModal() {
  const modal = document.getElementById("modal-merge-topics");
  const checkboxesContainer = document.getElementById("merge-topic-checkboxes");
  const inputNewName = document.getElementById("input-merge-new-name");
  const btnConfirm = document.getElementById("btn-confirm-merge");
  const btnCancel = document.getElementById("btn-cancel-merge");
  const btnClose = document.getElementById("btn-close-merge-modal");
  window.openMergeModalForTopic = (preselectedTopic = null) => {
    context.SoundManager.playSelect();
    const sortedTopics = context.getAlphabeticalTopics().filter(t => t.toLowerCase() !== context.DEFAULT_TOPIC.toLowerCase());
    if (sortedTopics.length === 0) {
      context.showToast("No custom topics available to merge.", "error");
      return;
    }
    checkboxesContainer.innerHTML = sortedTopics.map(t => `
          <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 cursor-pointer">
            <input type="checkbox" value="${context.escapeHtml(t)}" ${preselectedTopic && t.toLowerCase() === preselectedTopic.toLowerCase() ? 'checked' : ''} class="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0">
            <span class="text-slate-200 font-semibold truncate">${context.escapeHtml(t)}</span>
          </label>
        `).join("");
    inputNewName.value = preselectedTopic ? `${preselectedTopic} (Merged)` : "";
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  };
  const closeModal = () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  };
  btnCancel?.addEventListener("click", closeModal);
  btnClose?.addEventListener("click", closeModal);
  btnConfirm?.addEventListener("click", async () => {
    const checkedBoxes = checkboxesContainer.querySelectorAll("input[type='checkbox']:checked");
    const sourceTopics = Array.from(checkedBoxes).map(cb => cb.value);
    const newName = inputNewName.value.trim();
    if (sourceTopics.length < 1) {
      context.SoundManager.playError();
      context.showToast("Please select at least one source topic.", "error");
      return;
    }
    if (!newName) {
      context.SoundManager.playError();
      context.showToast("Please enter a new topic name.", "error");
      return;
    }
    context.SoundManager.playSelect();
    try {
      // 1. Lấy toàn bộ từ vựng thuộc các topic nguồn
      const wordsToUpdate = context.wordsData.filter(w => sourceTopics.some(st => st.toLowerCase() === (w.topic || context.DEFAULT_TOPIC).toLowerCase()));
      if (wordsToUpdate.length === 0) {
        context.showToast("No words found in selected source topics.", "error");
        closeModal();
        return;
      }

      // 2. Cập nhật topic của các từ sang topic đích trong IndexedDB
      const conn = await context.openIndexedDB();
      await new Promise((resolve, reject) => {
        const tx = conn.transaction("words", "readwrite");
        const store = tx.objectStore("words");
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(e.target.error);
        wordsToUpdate.forEach(w => {
          w.topic = newName;
          store.put(w);
        });
      });

      // 3. Cập nhật trên Firebase Firestore (Batch update)
      if (context.db && navigator.onLine) {
        const batchSize = 400;
        for (let i = 0; i < wordsToUpdate.length; i += batchSize) {
          const chunk = wordsToUpdate.slice(i, i + batchSize);
          const batch = context.db.batch();
          chunk.forEach(w => {
            const ref = context.db.collection("words").doc(w.id);
            batch.update(ref, {
              topic: newName
            });
          });
          await batch.commit();
        }
      } else {
        for (const w of wordsToUpdate) {
          await context.idbPut("pendingOps", {
            id: `upd_${w.id}`,
            type: "UPDATE",
            data: {
              id: w.id,
              updates: {
                topic: newName
              }
            }
          });
        }
      }

      // 4. Thêm topic mới vào danh sách userTopics và loại bỏ topic nguồn cũ nếu đã trống hoàn toàn
      context.addUserTopic(newName);

      // Cập nhật lại mảng local wordsData
      context.wordsData.forEach(w => {
        if (sourceTopics.some(st => st.toLowerCase() === (w.topic || context.DEFAULT_TOPIC).toLowerCase())) {
          w.topic = newName;
        }
      });
      context.recordLearningActivity("merge_topics");
      context.checkAndCleanupEmptyTopics();
      context.saveUserTopics();
      context.updateTopicDropdowns();
      context.updateBadges();
      context.renderLibrary();
      context.startNewSession();
      closeModal();
      context.SoundManager.playSuccess();
      context.showToast(`Successfully merged topics into "${newName}"!`, "success");
    } catch (err) {
      console.error("Error merging topics:", err);
      context.SoundManager.playError();
      context.showToast("Failed to merge topics. Please try again.", "error");
    }
  });
}
export function renderVocabularyCardHtml(w) {
  const isWordKnown = w.memoryStatus === context.STATUS.KNOWN;
  const cardBorderClass = isWordKnown ? "border-2 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.12)]" : "border-2 border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.12)]";
  const individualSynonyms = [w.synonym1, w.synonym2].map(s => (s || "").trim()).filter(Boolean).map((synText, idx) => `
        <div class="flex items-center justify-between gap-2 bg-slate-950/75 px-2.5 py-1.5 rounded-xl border border-slate-800/90">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[9px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/50 flex-shrink-0">Syn ${idx + 1}</span>
            <span class="text-xs sm:text-sm font-bold text-slate-200 break-words leading-snug">${context.escapeHtml(synText)}</span>
          </div>
          <button type="button" onclick="playAudio('${context.escapeQuotes(synText)}')" class="min-w-[28px] min-h-[28px] rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-300 text-white flex items-center justify-center flex-shrink-0 active:scale-90 transition-all" title="Listen">
            <i class="ph-fill ph-speaker-high text-xs"></i>
          </button>
        </div>
      `).join("");
  return `
        <div class="bg-slate-900/95 rounded-xl p-3 shadow-md flex flex-col gap-2.5 transition-all ${cardBorderClass}">
          <!-- Main 3-Row Two-Column Grid: Left (Info) vs Right (Actions) -->
          <div class="grid grid-cols-[1fr_88px] gap-x-3 gap-y-2 items-center" style="grid-template-columns: 1fr 88px; column-gap: 12px; row-gap: 8px;">
            <!-- Row 1 Left: English Vocabulary Word (Largest Row) -->
            <div class="min-w-0 text-left">
              <h3 class="inline-block max-w-full text-base sm:text-lg font-black text-white break-words leading-tight text-left">${context.escapeHtml(w.word)}</h3>
            </div>
            <!-- Row 1 Right: Circular Favourite and Speaker buttons -->
            <div class="w-[88px] min-w-[88px] flex items-center justify-end gap-2 flex-shrink-0">
              <button type="button" onclick="toggleLibraryWordFavorite('${w.id}')" id="lib-fav-${w.id}" class="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-90 text-white flex items-center justify-center shadow-md border border-indigo-400/30 transition-all flex-shrink-0 relative" title="${w.isFavorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${w.isFavorite ? 'Remove from favorites' : 'Add to favorites'}" data-action="favorite">
                <i id="lib-fav-icon-${w.id}" class="${w.isFavorite ? 'ph-fill ph-heart text-red-500' : 'ph ph-bold ph-heart text-white'} text-base"></i>
              </button>
              <button type="button" onclick="playAudio('${context.escapeQuotes(w.word)}')" id="lib-sound-${w.id}" class="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-90 text-white flex items-center justify-center shadow-md border border-indigo-400/30 transition-all flex-shrink-0" title="Listen" aria-label="Listen" data-action="audio">
                <i class="ph-fill ph-speaker-high text-base text-white"></i>
              </button>
            </div>

            <!-- Row 2 Left: Vietnamese Meaning -->
            <div class="min-w-0 text-left">
              <p class="inline-block max-w-full text-xs sm:text-[13px] font-semibold text-slate-300 break-words leading-snug text-left">${context.escapeHtml(w.meaning)}</p>
            </div>
            <!-- Row 2 Right: Knowledge Status Change Button (Unknown -> Know, Known -> Unknown) -->
            <div class="w-[88px] min-w-[88px] flex items-center justify-end flex-shrink-0">
              <button type="button" onclick="toggleWordStatus('${w.id}', '${isWordKnown ? context.STATUS.NOT_KNOWN : context.STATUS.KNOWN}')" id="lib-status-${w.id}" style="width: 88px; min-width: 88px; height: 28px;" class="w-[88px] min-w-[88px] h-[28px] ${isWordKnown ? 'bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border-slate-800 hover:border-rose-800/80' : 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-500/80 shadow-sm'} border rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all flex-shrink-0" title="${isWordKnown ? 'Mark as Unknown' : 'Mark as Known'}" aria-label="${isWordKnown ? 'Mark as Unknown' : 'Mark as Known'}" data-action="status" data-status-action="${isWordKnown ? 'unknown' : 'know'}">
                ${isWordKnown ? '<i class="ph-bold ph-warning-circle text-xs text-rose-400"></i>' : '<i class="ph-bold ph-check text-xs"></i>'}
                <span>${isWordKnown ? 'Unknown' : 'Know'}</span>
              </button>
            </div>

            <!-- Row 3 Left: Topic Badge -->
            <div class="min-w-0 flex items-center text-left">
              <span class="inline-block font-bold text-[10px] uppercase tracking-wider text-[#F3D060] bg-slate-950 border border-[#D4AF37]/35 px-2.5 py-1 rounded max-w-[170px] sm:max-w-[220px] truncate self-start text-left" title="${context.escapeHtml(w.topic || context.DEFAULT_TOPIC)}">
                ${context.escapeHtml(w.topic || context.DEFAULT_TOPIC)}
              </span>
            </div>
            <!-- Row 3 Right: Compact Delete Button -->
            <div class="w-[88px] min-w-[88px] flex items-center justify-end flex-shrink-0">
              <button type="button" onclick="deleteWordDirectly('${w.id}')" id="lib-del-${w.id}" style="width: 88px; min-width: 88px; height: 28px;" class="w-[88px] min-w-[88px] h-[28px] rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 font-extrabold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all flex-shrink-0" title="Delete word" aria-label="Delete word" data-action="delete">
                <i class="ph-bold ph-trash text-xs text-rose-400/80"></i>
                <span>Delete</span>
              </button>
            </div>
          </div>

          <!-- Supplementary Synonyms (if any) positioned below main 3-row section -->
          ${individualSynonyms ? `<div class="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">${individualSynonyms}</div>` : ''}
        </div>
      `;
}
export function renderFavoritesCollection() {
  const container = document.getElementById("review-favorites-container");
  if (!container) return;
  const favWords = context.wordsData.filter(w => w.isFavorite);
  favWords.sort((a, b) => (a.word || "").localeCompare(b.word || ""));
  if (favWords.length === 0) {
    container.innerHTML = `
          <div class="text-center py-8 px-4 bg-slate-900/90 rounded-2xl border border-slate-800 my-auto">
            <div class="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center text-2xl mx-auto mb-2">
              <i class="ph-bold ph-heart"></i>
            </div>
            <h3 class="text-sm font-black text-white">No Favorites Yet</h3>
            <p class="text-xs font-semibold text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              No vocabulary items marked as favorites yet. Tap the heart ♡ on any card to add it to your collection!
            </p>
          </div>
        `;
    return;
  }
  const headerHtml = `
        <div class="flex-shrink-0 flex items-center justify-between px-1 py-1 text-xs">
          <span class="font-black text-red-400 uppercase text-[10px] tracking-wide flex items-center gap-1.5">
            <i class="ph-fill ph-heart text-red-500"></i> Favorites Collection
          </span>
          <span class="text-slate-400 font-extrabold text-[11px]">
            Showing: ${favWords.length} ${favWords.length === 1 ? 'word' : 'words'}
          </span>
        </div>
      `;
  container.innerHTML = headerHtml + favWords.map(w => context.renderVocabularyCardHtml(w)).join("");
}
export function renderLibrary() {
  context.checkAndCleanupEmptyTopics();
  if (typeof context.updateLibraryTabsUI === "function") {
    context.updateLibraryTabsUI();
  }
  const container = document.getElementById("library-list-container");
  if (!container) return;
  const search = document.getElementById("lib-search-input")?.value.toLowerCase().trim() || "";
  let filtered = context.wordsData.filter(w => {
    // 1. Tab collection filter (Known vs Favorites vs Unknown)
    if (context.libraryTab === "favorites") {
      if (!w.isFavorite) return false;
    } else if (context.libraryTab === "known") {
      if (w.memoryStatus !== context.STATUS.KNOWN) return false;
    } else if (context.libraryTab === "unknown") {
      if (w.memoryStatus !== context.STATUS.NOT_KNOWN) return false;
    }

    // 2. Topic filter
    if (context.librarySelectedTopic !== "ALL" && context.librarySelectedTopic !== "FAVORITES") {
      if ((w.topic || "").toLowerCase() !== context.librarySelectedTopic.toLowerCase()) return false;
    }

    // 3. Search query
    if (!search) return true;
    return w.word && w.word.toLowerCase().includes(search) || w.meaning && w.meaning.toLowerCase().includes(search);
  });
  filtered.sort((a, b) => (a.word || "").localeCompare(b.word || ""));
  const countStatus = document.getElementById("lib-count-status");
  if (countStatus) countStatus.textContent = `Showing: ${filtered.length} ${filtered.length === 1 ? 'word' : 'words'}`;
  if (filtered.length === 0) {
    let emptyMsg = "No words found";
    let emptySub = "";
    let emptyIcon = "ph-notebook";
    if (context.libraryTab === "favorites") {
      emptyMsg = "No Favorites Yet";
      emptySub = "No vocabulary items marked as favorites yet. Tap the heart ♡ on any card to add it to Favorites!";
      emptyIcon = "ph-heart text-red-400";
    } else if (context.libraryTab === "known") {
      emptyMsg = "No Known Words";
      emptySub = "No words marked as Known yet. Study words to mark them as Known!";
      emptyIcon = "ph-check-circle text-emerald-400";
    } else if (context.libraryTab === "unknown") {
      emptyMsg = "No Unknown Words";
      emptySub = "All words in this collection are marked as Known!";
      emptyIcon = "ph-warning-circle text-amber-400";
    }
    container.innerHTML = `
          <div class="text-center py-8 px-4 bg-slate-900/90 rounded-2xl border border-slate-800 my-auto">
            <i class="ph-bold ${emptyIcon} text-3xl text-slate-500 mb-1"></i>
            <p class="text-sm font-extrabold text-slate-300">${emptyMsg}</p>
            ${emptySub ? `<p class="text-xs font-semibold text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">${emptySub}</p>` : ''}
          </div>
        `;
    return;
  }
  container.innerHTML = filtered.map(w => context.renderVocabularyCardHtml(w)).join("");
}
export function install_toggleWordStatus() {
  window.toggleWordStatus = async (id, targetStatus) => {
    if (context.isStatusUpdating) return;
    const target = context.wordsData.find(w => w.id === id);
    if (!targetStatus && target) {
      targetStatus = target.memoryStatus === context.STATUS.KNOWN ? context.STATUS.NOT_KNOWN : context.STATUS.KNOWN;
    }
    if (target && target.memoryStatus === targetStatus) return;
    context.isStatusUpdating = true;
    try {
      if (targetStatus === context.STATUS.KNOWN) context.SoundManager.playSuccess();else context.SoundManager.playSelect();
      await context.updateWordMemory(id, targetStatus, false);
      context.showToast("Status updated!", "success");
    } catch (e) {} finally {
      context.isStatusUpdating = false;
    }
  };
}
export function install_deleteWordDirectly() {
  window.deleteWordDirectly = async id => {
    context.SoundManager.playSelect();
    const queued = await context.idbGetAll('pendingOps');
    for (const op of queued) if (op?.data?.id === id) await context.idbDelete('pendingOps', op.id);
    context.wordsData = context.wordsData.filter(w => w.id !== id);
    context.checkAndCleanupEmptyTopics();
    context.saveUserTopics();
    await context.idbDelete("words", id);
    context.updateBadges();
    context.recordLearningActivity("delete_word");
    await context.updateStudentMetadataCount();
    context.renderLibrary();
    context.startNewSession();
    if (context.db && navigator.onLine) {
      try {
        await context.db.collection("words").doc(id).delete();
      } catch (e) {
        await context.idbPut("pendingOps", {
          id: `del_${id}`,
          type: "DELETE",
          data: {
            id
          }
        });
      }
    } else {
      await context.idbPut("pendingOps", {
        id: `del_${id}`,
        type: "DELETE",
        data: {
          id
        }
      });
    }
    context.showToast("Word deleted.", "success");
  };
}
