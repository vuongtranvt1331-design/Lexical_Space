import { context } from "../core/context.js";
export function updateVisualViewportHeight() {
  if (window.visualViewport) {
    const height = window.visualViewport.height;
    document.documentElement.style.setProperty('--viewport-avail-height', `${height}px`);
  }
}
export async function migrateLocalStorageToIndexedDB() {
  try {
    const oldUser = localStorage.getItem("vocab_user");
    if (!oldUser) return;
    const lsWordsKey = `vocab_words_${oldUser}`;
    const rawWords = localStorage.getItem(lsWordsKey);
    if (rawWords) {
      const parsedWords = JSON.parse(rawWords);
      if (Array.isArray(parsedWords)) {
        for (const w of parsedWords) {
          const existing = await context.idbGet("words", w.id);
          if (!existing) {
            await context.idbPut("words", {
              ...w,
              username: oldUser
            });
          }
        }
      }
      localStorage.removeItem(lsWordsKey);
    }
  } catch (err) {
    console.warn("Migration warning:", err);
  }
}
export function checkAuth() {
  const modal = document.getElementById("modal-login");
  if (!context.currentUser) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  } else {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    context.applyUser(context.currentUser);
    context.loadUserTopics();
    context.loadIndexedDBWordsData();
  }
}
export function applyUser(name) {
  if (context.currentUser !== name.trim()) context.vocabularySync.stop();
  context.currentUser = name.trim();
  localStorage.setItem("vocab_user", context.currentUser);
  document.getElementById("current-user-name").textContent = context.currentUser;
  document.getElementById("drawer-user-name").textContent = context.currentUser;
  const initial = context.currentUser.charAt(0).toUpperCase();
  document.getElementById("drawer-user-avatar").textContent = initial;
  document.getElementById("header-user-avatar").textContent = initial;
  const dotEl = document.getElementById("connection-dot");
  const drawerDotEl = document.getElementById("drawer-connection-dot");
  if (context.db && navigator.onLine) {
    if (dotEl) dotEl.className = "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900 transition-colors";
    if (drawerDotEl) drawerDotEl.className = "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 transition-colors";
  } else {
    if (dotEl) dotEl.className = "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-slate-900 transition-colors";
    if (drawerDotEl) drawerDotEl.className = "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-slate-950 transition-colors";
  }
}
export async function handleOnlineReconnection() {
  context.updateStatusBadge(true, "Connected");
  if (context.db && context.currentUser) {
    await context.syncPendingOperations();
    await context.checkStudentVocabularyMetadata();
    await context.flushActivityLogSync({
      force: true,
      reason: "online_reconnected"
    });
  }
}
export async function syncPendingOperations() {
  if (!context.db || !navigator.onLine) return;
  try {
    const pending = await context.idbGetAll("pendingOps");
    for (const op of pending) {
      if (op.type === "ADD") {
        // Preserve the original ID so old offline records keep the same identity after upload.
        const docRef = context.db.collection("words").doc(op.data.id);
        const cleanData = {
          ...op.data
        };
        delete cleanData.hasBeenStudied;
        delete cleanData.studiedAt;
        delete cleanData.lastReviewedAt;
        delete cleanData.createdAt;
        delete cleanData.studyCount;
        delete cleanData.reviewCount;
        if (cleanData.isFavorite === undefined) cleanData.isFavorite = false;
        await docRef.set(cleanData);
        await context.idbDelete("pendingOps", op.id);
      } else if (op.type === "UPDATE") {
        const cleanUpdates = {
          ...op.data.updates
        };
        delete cleanUpdates.hasBeenStudied;
        delete cleanUpdates.studiedAt;
        delete cleanUpdates.lastReviewedAt;
        delete cleanUpdates.createdAt;
        delete cleanUpdates.studyCount;
        delete cleanUpdates.reviewCount;
        await context.db.collection("words").doc(op.data.id).update(cleanUpdates);
        await context.idbDelete("pendingOps", op.id);
      } else if (op.type === "DELETE") {
        await context.db.collection("words").doc(op.data.id).delete();
        await context.idbDelete("pendingOps", op.id);
      }
    }
  } catch (err) {
    console.warn("Pending sync error:", err);
  }
}
export function updateStatusBadge(isOk, text) {
  const dotEl = document.getElementById("connection-dot");
  const drawerDotEl = document.getElementById("drawer-connection-dot");
  if (isOk) {
    if (dotEl) dotEl.className = "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900 transition-colors";
    if (drawerDotEl) drawerDotEl.className = "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 transition-colors";
  } else {
    if (dotEl) dotEl.className = "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-slate-900 transition-colors";
    if (drawerDotEl) drawerDotEl.className = "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-slate-950 transition-colors";
  }
}
export function setupNavigation() {
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const openDrawer = () => {
    context.SoundManager.playSelect();
    drawer?.classList.remove("-translate-x-full");
    backdrop?.classList.remove("opacity-0", "pointer-events-none");
  };
  const closeDrawer = () => {
    drawer?.classList.add("-translate-x-full");
    backdrop?.classList.add("opacity-0", "pointer-events-none");
  };
  document.getElementById("btn-open-drawer")?.addEventListener("click", openDrawer);
  document.getElementById("btn-close-drawer")?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      context.SoundManager.playSelect();
      context.switchView(btn.dataset.target);
      closeDrawer();
    });
  });

  // Dynamic link handling for Arcade Space / GameHub (supports GitHub Pages & local dev)
  const btnArcade = document.getElementById("btn-drawer-arcadespace");
  if (btnArcade) {
    const updateArcadeHref = () => {
      const isGitHubPages = window.location.hostname.endsWith("github.io");
      const prodArcadeUrl = "https://vuongtranvt1331-design.github.io/Arcadehub/";
      const targetBase = isGitHubPages ? prodArcadeUrl : "arcade.html";
      const currentUrl = window.location.href;
      const params = new URLSearchParams();
      params.set("returnUrl", currentUrl);
      const activeUser = typeof context.currentUser === "string" && context.currentUser.trim() ? context.currentUser.trim() : localStorage.getItem("vocab_user") || "";
      if (activeUser && activeUser !== "Guest") {
        params.set("user", activeUser);
      }
      btnArcade.href = `${targetBase}?${params.toString()}`;
    };
    updateArcadeHref();
    btnArcade.addEventListener("click", () => {
      updateArcadeHref();
      if (window.SoundManager) context.SoundManager.playSelect();
    });
  }
  const submitLogin = async () => {
    const val = document.getElementById("input-username")?.value.trim();
    if (!val) {
      context.SoundManager.playError();
      context.showToast("Please enter your name.", "error");
      return;
    }
    context.SoundManager.playSuccess();
    const previousUser = context.currentUser;
    const previousKey = context.getStudentKey(previousUser);
    const nextKey = context.getStudentKey(val);

    // Nếu chuyển sang tài khoản khác, hủy timer của tài khoản cũ và đồng bộ nốt dữ liệu chờ của tài khoản cũ
    if (previousUser && previousKey && previousKey !== nextKey) {
      context.clearActivityTimers();
      await context.flushActivityLogSync({
        force: true,
        reason: "account_switch",
        targetStudentKey: previousKey,
        targetUsername: previousUser
      });
    }
    context.activeSessionWords = [];
    context.applyUser(val);
    document.getElementById("modal-login")?.classList.add("hidden");
    document.getElementById("modal-login")?.classList.remove("flex");
    context.loadUserTopics();
    context.loadIndexedDBWordsData();
    context.showToast(`Welcome, ${val}!`, "success");
  };
  document.getElementById("btn-login-submit")?.addEventListener("click", submitLogin);
  document.getElementById("input-username")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitLogin();
    }
  });
  document.getElementById("btn-switch-user")?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    // Đồng bộ ngay timestamp đang chờ của tài khoản hiện tại trước khi mở hộp thoại đổi tài khoản
    if (context.currentUser) {
      const oldUser = context.currentUser;
      const oldKey = context.getStudentKey(oldUser);
      context.clearActivityTimers();
      context.flushActivityLogSync({
        force: true,
        reason: "switch_user_click",
        targetStudentKey: oldKey,
        targetUsername: oldUser
      });
    }
    closeDrawer();
    const inputUser = document.getElementById("input-username");
    if (inputUser) inputUser.value = context.currentUser;
    const modal = document.getElementById("modal-login");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.remove("flex");
      modal.classList.add("flex");
    }
  });
  document.getElementById("user-display")?.addEventListener("click", () => {
    document.getElementById("btn-switch-user")?.click();
  });
}
export function switchView(viewId) {
  document.querySelectorAll(".view-panel").forEach(p => p.classList.add("hidden"));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(btn => {
    if (btn.dataset.target === viewId) {
      btn.classList.add("bg-indigo-600", "text-white");
      btn.classList.remove("text-slate-300");
    } else {
      btn.classList.remove("bg-indigo-600", "text-white");
      btn.classList.add("text-slate-300");
    }
  });
  if (viewId === "view-review") {
    context.reviewMode = "learning";
    if (typeof updateBottomNavModeVisual === "function") {
      updateBottomNavModeVisual(context.reviewMode);
    }
    context.startNewSession();
  } else {
    if (viewId === "view-library") {
      context.libraryTab = "unknown";
      if (typeof context.updateLibraryTabsUI === "function") {
        context.updateLibraryTabsUI();
      }
      context.renderLibrary();
    } else if (viewId === "view-entry") {
      context.updateVisualViewportHeight();
      context.renderEntryTopicCards();
      if (typeof window.toggleAiLibrarySection === "function") {
        window.toggleAiLibrarySection(false);
      }
    }
  }
}
