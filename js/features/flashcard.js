import { context } from "../core/context.js";
export function isWordEligibleForReview(wordObj) {
  if (!wordObj) return false;
  return wordObj.memoryStatus === context.STATUS.NOT_KNOWN;
}
export function renderReviewTopicUpwardMenu(sortedTopics) {
  const listEl = document.getElementById("review-topic-options-list");
  if (!listEl) return;
  const menuCountEl = document.getElementById("review-topic-menu-count");
  if (menuCountEl) menuCountEl.textContent = `${sortedTopics.length + 1} Topics`;
  const isFavoritesSelected = context.activeSpecialCollection === 'FAVORITES';
  const isAllSelected = context.activeTopic === 'ALL' && !isFavoritesSelected;
  let html = `
        <div onclick="selectReviewTopic('ALL')" class="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${isAllSelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">
          <span>All Topics</span>
          ${isAllSelected ? '<i class="ph-bold ph-check text-sm"></i>' : ''}
        </div>
        <div onclick="selectReviewTopic('FAVORITES')" class="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${isFavoritesSelected ? 'bg-red-950/80 text-red-200 border border-red-500/80' : 'text-red-400 hover:bg-slate-800'}">
          <span class="flex items-center gap-1.5"><i class="ph-fill ph-heart text-red-500"></i> Favorites ❤️</span>
          ${isFavoritesSelected ? '<i class="ph-bold ph-check text-sm"></i>' : ''}
        </div>
      `;
  sortedTopics.forEach(t => {
    const isSelected = context.activeTopic === t && !isFavoritesSelected;
    html += `
          <div onclick="selectReviewTopic('${context.escapeQuotes(t)}')" class="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">
            <span class="truncate pr-2">${context.escapeHtml(t)}</span>
            ${isSelected ? '<i class="ph-bold ph-check text-sm flex-shrink-0"></i>' : ''}
          </div>
        `;
  });
  listEl.innerHTML = html;
  const labelEl = document.getElementById("review-selected-topic-label");
  if (labelEl) {
    if (isFavoritesSelected) {
      labelEl.textContent = 'Collection: Favorites ❤️';
    } else {
      labelEl.textContent = `Topic: ${context.activeTopic === 'ALL' ? 'All Topics' : context.activeTopic}`;
    }
  }
}
export function install_selectReviewTopic() {
  window.selectReviewTopic = topic => {
    context.SoundManager.playSelect();
    if (topic === "FAVORITES") {
      context.activeSpecialCollection = "FAVORITES";
    } else {
      context.activeSpecialCollection = null;
      context.activeTopic = topic;
    }
    document.getElementById("review-topic-upward-menu")?.classList.add("hidden");
    document.getElementById("review-topic-chevron")?.classList.remove("rotate-180");
    context.updateTopicDropdowns();
    context.startNewSession();
  };
}
export function resetSessionSwipeStats() {
  context.sessionSwipeStats.rightSwipes = 0;
  context.sessionSwipeStats.leftSwipes = 0;
  context.sessionSwipeStats.trophyTriggered = false;
  context.sessionSwipeStats.trophyDismissed = false;
  context.sessionSwipeStats.flagTriggered = false;
  context.sessionSwipeStats.flagDismissed = false;
  context.sessionSwipeStats.activeEasterEgg = null;
  context.hideEasterEggCard();
}
export function hideEasterEggCard() {
  const container = document.getElementById("easter-egg-card-container");
  const swipeCard = document.getElementById("swipe-card");
  if (container) container.classList.add("hidden");
  if (swipeCard && !context.sessionCompleted) {
    swipeCard.classList.remove("hidden");
    swipeCard.style.opacity = "1";
    swipeCard.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
  }
}
export function showEasterEggCard(type) {
  context.sessionSwipeStats.activeEasterEgg = type;
  const container = document.getElementById("easter-egg-card-container");
  const inner = document.getElementById("ee-card-inner");
  const swipeCard = document.getElementById("swipe-card");
  if (!container || !inner) return;
  context.isEasterEggFlipped = false;
  context.isEasterEggFlipping = false;
  inner.classList.remove("is-flipped");
  if (swipeCard) swipeCard.classList.add("hidden");
  container.classList.remove("hidden");
  context.renderEasterEggCardContent(type);
  if (type === "trophy") {
    context.SoundManager.playLevelUp();
  } else if (type === "flag") {
    context.SoundManager.playEncouragement();
  }
}
export function dismissEasterEgg() {
  context.SoundManager.playSelect();
  if (context.sessionSwipeStats.activeEasterEgg === "trophy") {
    context.sessionSwipeStats.trophyDismissed = true;
  } else if (context.sessionSwipeStats.activeEasterEgg === "flag") {
    context.sessionSwipeStats.flagDismissed = true;
  }
  context.sessionSwipeStats.activeEasterEgg = null;
  context.hideEasterEggCard();
  context.renderActiveCard();
}
export function renderEasterEggCardContent(type) {
  const frontEl = document.getElementById("ee-card-face-front");
  const backEl = document.getElementById("ee-card-face-back");
  if (!frontEl || !backEl) return;
  const isTrophy = type === "trophy";
  if (isTrophy) {
    // 1. GOLD TROPHY ACHIEVEMENT CARD (English, 8-bit retro theme)
    frontEl.className = "card-face rounded-2xl overflow-hidden shadow-2xl retro-pixel-border-gold retro-pixel-stars";
    frontEl.innerHTML = `
          <div class="h-full w-full flex flex-col justify-between p-3.5 sm:p-4 text-center relative select-none">
            <div class="flex items-center justify-between w-full">
              <span class="inline-flex items-center gap-1 font-mono font-black text-[9px] uppercase tracking-widest text-[#F3D060] bg-[#1a1405] border border-[#D4AF37]/60 px-2 py-0.5 rounded shadow-sm">
                <span>★ 15-SWIPE COLLECTIBLE ★</span>
              </span>
              <span class="text-[9px] font-mono font-bold text-amber-300/80">#EASTER-EGG</span>
            </div>

            <div class="my-auto py-1 space-y-2 pointer-events-none">
              <svg viewBox="0 0 24 24" class="w-14 h-14 sm:w-16 sm:h-16 mx-auto pixel-art filter drop-shadow-[0_0_12px_rgba(243,208,96,0.65)]" shape-rendering="crispEdges">
                <rect x="5" y="3" width="14" height="2" fill="#F3D060"/>
                <rect x="6" y="2" width="12" height="1" fill="#FFEAA7"/>
                <rect x="5" y="5" width="14" height="4" fill="#D4AF37"/>
                <rect x="6" y="5" width="3" height="4" fill="#FFF275"/>
                <rect x="7" y="9" width="10" height="2" fill="#D4AF37"/>
                <rect x="8" y="11" width="8" height="2" fill="#B8860B"/>
                <rect x="9" y="13" width="6" height="2" fill="#996515"/>
                <rect x="3" y="5" width="2" height="4" fill="#F3D060"/>
                <rect x="2" y="6" width="1" height="4" fill="#D4AF37"/>
                <rect x="3" y="9" width="2" height="2" fill="#996515"/>
                <rect x="19" y="5" width="2" height="4" fill="#F3D060"/>
                <rect x="21" y="6" width="1" height="4" fill="#D4AF37"/>
                <rect x="19" y="9" width="2" height="2" fill="#996515"/>
                <rect x="11" y="15" width="2" height="3" fill="#D4AF37"/>
                <rect x="10" y="15" width="1" height="3" fill="#FFEAA7"/>
                <rect x="8" y="18" width="8" height="2" fill="#F3D060"/>
                <rect x="7" y="20" width="10" height="2" fill="#996515"/>
                <rect x="6" y="21" width="12" height="1" fill="#5C3D0E"/>
                <rect x="11" y="7" width="2" height="2" fill="#FFF"/>
                <rect x="10" y="7" width="1" height="1" fill="#FFF275"/>
                <rect x="13" y="7" width="1" height="1" fill="#FFF275"/>
                <rect x="11" y="6" width="2" height="1" fill="#FFF275"/>
                <rect x="11" y="9" width="2" height="1" fill="#FFF275"/>
              </svg>

              <h2 class="text-base sm:text-lg font-black tracking-wider uppercase text-[#F3D060] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-mono">
                ACHIEVEMENT UNLOCKED!
              </h2>

              <p class="text-[11px] sm:text-xs font-semibold text-slate-200 leading-snug max-w-[280px] sm:max-w-[320px] mx-auto">
                You've conquered 15 words! Every word you learn today brings you one step closer to your IELTS goal. Keep it up!
              </p>
            </div>

            <div class="flex items-center justify-between w-full pt-1.5 border-t border-[#D4AF37]/30">
              <span class="text-[10px] font-bold text-amber-300/80 flex items-center gap-1">
                <i class="ph-bold ph-arrows-clockwise text-xs"></i>
                <span>Tap card to flip</span>
              </span>
              <button type="button" class="btn-ee-dismiss min-h-[30px] px-3.5 py-1 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-lg shadow-md border border-amber-300 transition-all flex items-center gap-1 cursor-pointer">
                <span>Continue</span>
                <i class="ph-bold ph-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        `;
  } else {
    // 2. BLUE FLAG ENCOURAGEMENT CARD (Vietnamese text only, NO English interface labels)
    frontEl.className = "card-face rounded-2xl overflow-hidden shadow-2xl retro-pixel-border-blue retro-pixel-stars";
    frontEl.innerHTML = `
          <div class="h-full w-full flex flex-col justify-between p-3.5 sm:p-4 text-center relative select-none">
            <div class="flex items-center justify-between w-full">
              <span class="inline-flex items-center gap-1 font-mono font-black text-[9px] uppercase tracking-widest text-sky-300 bg-[#062033] border border-sky-400/60 px-2 py-0.5 rounded shadow-sm">
                <span>★ CỘT MỐC ĐẶC BIỆT ★</span>
              </span>
              <span class="text-[9px] font-mono font-bold text-sky-400/80">#THẺ-HIẾM</span>
            </div>

            <div class="my-auto py-1 space-y-2 pointer-events-none">
              <svg viewBox="0 0 24 24" class="w-14 h-14 sm:w-16 sm:h-16 mx-auto pixel-art filter drop-shadow-[0_0_12px_rgba(56,189,248,0.65)]" shape-rendering="crispEdges">
                <rect x="4" y="2" width="2" height="2" fill="#F3D060"/>
                <rect x="4" y="4" width="2" height="18" fill="#94A3B8"/>
                <rect x="4" y="4" width="1" height="18" fill="#E2E8F0"/>
                <rect x="2" y="21" width="6" height="2" fill="#475569"/>
                <rect x="6" y="4" width="14" height="2" fill="#38BDF8"/>
                <rect x="6" y="6" width="16" height="3" fill="#0284C7"/>
                <rect x="6" y="9" width="15" height="3" fill="#0369A1"/>
                <rect x="6" y="12" width="12" height="2" fill="#075985"/>
                <rect x="8" y="5" width="2" height="8" fill="#7DD3FC"/>
                <rect x="14" y="5" width="2" height="7" fill="#7DD3FC"/>
                <rect x="10" y="7" width="2" height="2" fill="#FFFFFF"/>
                <rect x="9" y="7" width="1" height="1" fill="#BAE6FD"/>
                <rect x="12" y="7" width="1" height="1" fill="#BAE6FD"/>
                <rect x="10" y="6" width="2" height="1" fill="#BAE6FD"/>
                <rect x="10" y="9" width="2" height="1" fill="#BAE6FD"/>
              </svg>

              <h2 class="text-base sm:text-lg font-black tracking-wider uppercase text-sky-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-mono">
                BẠN SẮP VỀ ĐÍCH RỒI!
              </h2>

              <p class="text-[11px] sm:text-xs font-semibold text-slate-200 leading-snug max-w-[280px] sm:max-w-[320px] mx-auto">
                Bạn đã học được nhiều từ mới hơn phần lớn học viên AMES rồi đấy! Cố lên một chút nữa thôi — bạn đang tiến bộ hơn mình nghĩ rất nhiều!
              </p>
            </div>

            <div class="flex items-center justify-between w-full pt-1.5 border-t border-sky-400/30">
              <span class="text-[10px] font-bold text-sky-300/80 flex items-center gap-1">
                <i class="ph-bold ph-arrows-clockwise text-xs"></i>
                <span>Chạm thẻ để lật</span>
              </span>
              <button type="button" class="btn-ee-dismiss min-h-[30px] px-3.5 py-1 bg-gradient-to-r from-sky-500 to-sky-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-lg shadow-md border border-sky-300 transition-all flex items-center gap-1 cursor-pointer">
                <span>Tiếp tục</span>
                <i class="ph-bold ph-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        `;
  }

  // Back Face for Both Cards
  backEl.className = `card-face card-face-back rounded-2xl overflow-hidden shadow-2xl ${isTrophy ? 'retro-pixel-border-gold' : 'retro-pixel-border-blue'} retro-pixel-stars`;
  backEl.innerHTML = `
        <div class="h-full w-full flex flex-col justify-between p-3.5 sm:p-4 text-center relative select-none">
          <div class="flex items-center justify-between w-full">
            <span class="inline-flex items-center gap-1 font-mono font-black text-[9px] uppercase tracking-widest ${isTrophy ? 'text-[#F3D060] bg-[#1a1405] border border-[#D4AF37]/60' : 'text-sky-300 bg-[#062033] border border-sky-400/60'} px-2 py-0.5 rounded shadow-sm">
              <span>★ ${isTrophy ? 'TEACHER REWARD' : 'PHẦN THƯỞNG'} ★</span>
            </span>
            <span class="text-[9px] font-mono font-bold ${isTrophy ? 'text-amber-300/80' : 'text-sky-400/80'}">${isTrophy ? 'SECRET BACK' : 'MẶT SAU'}</span>
          </div>

          <div class="my-auto py-2 space-y-2 pointer-events-none">
            <svg viewBox="0 0 24 24" class="w-12 h-12 sm:w-14 sm:h-14 mx-auto pixel-art filter drop-shadow-[0_0_10px_rgba(244,63,94,0.45)]" shape-rendering="crispEdges">
              <rect x="8" y="4" width="8" height="2" fill="#FB7185"/>
              <rect x="6" y="6" width="12" height="4" fill="#F43F5E"/>
              <rect x="5" y="8" width="14" height="6" fill="#E11D48"/>
              <rect x="6" y="14" width="12" height="3" fill="#BE123C"/>
              <rect x="8" y="17" width="8" height="4" fill="#9F1239"/>
              <rect x="8" y="5" width="4" height="1" fill="#FECDD3"/>
              <rect x="6" y="7" width="2" height="2" fill="#FECDD3"/>
            </svg>

            <p class="text-base sm:text-lg font-black text-amber-200 leading-snug px-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] max-w-[290px] mx-auto">
              Để teacher V thưởng bạn một quả đấm nhé
            </p>
          </div>

          <div class="flex items-center justify-between w-full pt-1.5 border-t ${isTrophy ? 'border-[#D4AF37]/30' : 'border-sky-400/30'}">
            <span class="text-[10px] font-bold ${isTrophy ? 'text-amber-300/80' : 'text-sky-300/80'} flex items-center gap-1">
              <i class="ph-bold ph-arrows-clockwise text-xs"></i>
              <span>${isTrophy ? 'Tap to flip back' : 'Chạm để lật lại'}</span>
            </span>
            <button type="button" class="btn-ee-dismiss min-h-[30px] px-3.5 py-1 ${isTrophy ? 'bg-gradient-to-r from-amber-500 to-[#D4AF37] border-amber-300' : 'bg-gradient-to-r from-sky-500 to-sky-400 border-sky-300'} hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-lg shadow-md border transition-all flex items-center gap-1 cursor-pointer">
              <span>${isTrophy ? 'Continue' : 'Tiếp tục'}</span>
              <i class="ph-bold ph-arrow-right text-xs"></i>
            </button>
          </div>
        </div>
      `;
  frontEl.querySelectorAll(".btn-ee-dismiss").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      context.dismissEasterEgg();
    });
  });
  backEl.querySelectorAll(".btn-ee-dismiss").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      context.dismissEasterEgg();
    });
  });
}
export function setupEasterEggInteractions() {
  const container = document.getElementById("easter-egg-card-container");
  const inner = document.getElementById("ee-card-inner");
  if (!container || !inner) return;
  container.addEventListener("click", e => {
    if (e.target.closest(".btn-ee-dismiss")) return;
    if (context.isEasterEggFlipping) return;
    context.isEasterEggFlipping = true;
    context.SoundManager.playFlip();
    context.isEasterEggFlipped = !context.isEasterEggFlipped;
    if (context.isEasterEggFlipped) {
      inner.classList.add("is-flipped");
    } else {
      inner.classList.remove("is-flipped");
    }
    setTimeout(() => {
      context.isEasterEggFlipping = false;
    }, 900);
  });
}
export function startNewSession(explicitWords = null) {
  if (explicitWords) {
    context.activeSessionWords = [...explicitWords];
  } else if (context.reviewMode === "favorites") {
    context.activeSessionWords = context.wordsData.filter(w => w.isFavorite);
  } else if (context.activeSpecialCollection === "FAVORITES") {
    context.activeSessionWords = context.wordsData.filter(w => w.isFavorite);
    if (context.reviewMode === "learning") {
      const unlearned = context.activeSessionWords.filter(w => w.memoryStatus === context.STATUS.NOT_KNOWN);
      if (unlearned.length > 0) context.activeSessionWords = unlearned;
    }
  } else if (context.reviewMode === "learning") {
    context.activeSessionWords = context.wordsData.filter(w => {
      if (context.activeTopic !== "ALL" && (w.topic || "").toLowerCase() !== context.activeTopic.toLowerCase()) return false;
      return w.memoryStatus === context.STATUS.NOT_KNOWN;
    });
  } else if (context.reviewMode === "review") {
    context.activeSessionWords = context.wordsData.filter(w => {
      if (context.activeTopic !== "ALL" && (w.topic || "").toLowerCase() !== context.activeTopic.toLowerCase()) return false;
      return w.memoryStatus === context.STATUS.KNOWN;
    });
  } else {
    context.activeSessionWords = context.wordsData.filter(w => {
      if (!context.isWordEligibleForReview(w)) return false;
      if (context.activeTopic !== "ALL" && (w.topic || "").toLowerCase() !== context.activeTopic.toLowerCase()) return false;
      return true;
    });
  }
  if ((context.activeTopic === "ALL" || context.reviewMode === "favorites" || context.activeSpecialCollection) && context.activeSessionWords.length > 1) {
    for (let i = context.activeSessionWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [context.activeSessionWords[i], context.activeSessionWords[j]] = [context.activeSessionWords[j], context.activeSessionWords[i]];
    }
  }
  context.currentSessionHadInitialCards = context.activeSessionWords.length > 0;
  context.sessionCurrentIndex = 0;
  context.sessionCompleted = false;
  context.sessionResponses.clear();
  context.resetSessionSwipeStats();
  context.updateBadges();
  context.updateQuickCollectionButtonsUI();
  const labelEl = document.getElementById("review-selected-topic-label");
  if (labelEl) {
    if (context.reviewMode === "favorites") {
      labelEl.textContent = "Favorites Learning Mode ❤️";
    } else if (context.activeSpecialCollection === "FAVORITES") {
      labelEl.textContent = "Collection: Favorites ❤️";
    } else {
      labelEl.textContent = `Topic: ${context.activeTopic === "ALL" ? "All Topics" : context.activeTopic}`;
    }
  }
  context.renderActiveCard();
}
export function renderActiveCard() {
  const cardContainer = document.getElementById("swipe-card");
  const cardInner = document.getElementById("card-inner");
  const emptyState = document.getElementById("card-empty-state");
  const statsBox = document.getElementById("session-stats-box");
  const subtitleEl = document.getElementById("empty-state-subtitle");
  const titleEl = document.getElementById("empty-state-title");
  const iconEl = document.getElementById("empty-state-icon");
  context.isFlipped = false;
  context.isCardFlipping = false;
  cardInner.classList.remove("is-flipped");
  cardContainer.style.transition = "none";
  cardContainer.style.transform = "translate3d(0,0,0) rotate(0deg)";
  if (context.activeSessionWords.length === 0 || context.sessionCurrentIndex >= context.activeSessionWords.length) {
    context.sessionCompleted = true;
    cardContainer.classList.add("hidden");
    emptyState.classList.remove("hidden");
    const totalFavorites = context.wordsData.filter(w => w.isFavorite).length;
    if (context.reviewMode === "favorites" && totalFavorites === 0) {
      statsBox.classList.add("hidden");
      subtitleEl.classList.remove("hidden");
      iconEl.className = "ph-bold ph-heart text-red-400";
      titleEl.textContent = "No Favorites Yet";
      subtitleEl.textContent = "No favorite words yet. Add words to Favorites using the heart button in the Library.";
    } else if (!context.currentSessionHadInitialCards && context.sessionResponses.size === 0) {
      statsBox.classList.add("hidden");
      subtitleEl.classList.remove("hidden");
      if (context.reviewMode === "favorites" || context.activeSpecialCollection === "FAVORITES") {
        iconEl.className = "ph-bold ph-heart text-red-400";
        titleEl.textContent = "No Favorites Yet";
        subtitleEl.textContent = "No favorite words yet. Add words to Favorites using the heart button in the Library.";
      } else if (context.dbSyncError && context.wordsData.length === 0) {
        iconEl.className = "ph-bold ph-warning-circle";
        titleEl.textContent = "Database Error";
        subtitleEl.textContent = "Unable to load your saved vocabulary from the database.";
      } else if (context.reviewMode === "review") {
        iconEl.className = "ph-bold ph-books";
        titleEl.textContent = "No Words for Review";
        subtitleEl.textContent = "No unknown words available for review yet. All words in this topic are marked Known.";
      } else {
        iconEl.className = "ph-bold ph-check-circle";
        titleEl.textContent = "No Words in Queue";
        subtitleEl.textContent = "All words in this topic are marked Known.";
      }
    } else {
      iconEl.className = "ph-bold ph-sparkle";
      titleEl.textContent = "Session Complete";
      subtitleEl.classList.add("hidden");
      statsBox.classList.remove("hidden");
      let knownCount = 0;
      let unknownCount = 0;
      context.sessionResponses.forEach(status => {
        if (status === context.STATUS.KNOWN) knownCount++;else if (status === context.STATUS.NOT_KNOWN) unknownCount++;
      });
      const knownCountEl = document.getElementById("stat-known-count");
      const unknownCountEl = document.getElementById("stat-unknown-count");
      if (knownCountEl) knownCountEl.textContent = knownCount;
      if (unknownCountEl) unknownCountEl.textContent = unknownCount;
    }
    return;
  }
  cardContainer.classList.remove("hidden");
  emptyState.classList.add("hidden");
  const item = context.activeSessionWords[context.sessionCurrentIndex];
  context.updateCardFavoriteVisual(!!item.isFavorite);
  const isItemKnown = item && item.memoryStatus === context.STATUS.KNOWN;
  document.querySelectorAll(".btn-fc-known-action").forEach(btn => {
    btn.className = `btn-fc-known-action ${isItemKnown ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-sm' : 'bg-slate-900 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-300 border-slate-800 hover:border-emerald-800/80'} border rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all`;
    btn.style.width = "68px";
    btn.style.minWidth = "68px";
    btn.style.height = "28px";
    btn.title = isItemKnown ? "Word is known" : "Mark Known";
    btn.setAttribute("aria-label", isItemKnown ? "Word is known" : "Mark Known");
    btn.innerHTML = `${isItemKnown ? '<i class="ph-bold ph-check text-xs"></i>' : ''}<span>Known</span>`;
  });
  document.querySelectorAll(".btn-fc-unknown-action").forEach(btn => {
    btn.className = `btn-fc-unknown-action px-3 py-1 ${!isItemKnown ? 'bg-rose-950/60 text-rose-300 border-rose-800/80' : 'bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border-slate-800 hover:border-rose-800/80'} border rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all flex-shrink-0`;
    btn.style.minWidth = "68px";
    btn.style.height = "28px";
    btn.title = !isItemKnown ? "Word is unknown" : "Mark Unknown";
    btn.setAttribute("aria-label", !isItemKnown ? "Word is unknown" : "Mark Unknown");
    btn.innerHTML = `${!isItemKnown ? '<i class="ph-bold ph-warning-circle text-xs"></i>' : ''}<span>Unknown</span>`;
  });
  const wordTopic = item.topic || context.DEFAULT_TOPIC;
  const totalCards = context.activeSessionWords.length;
  const displayCardNum = `${String(context.sessionCurrentIndex + 1).padStart(2, '0')} / ${String(totalCards).padStart(2, '0')}`;
  const frontTopicBadge = document.getElementById("fc-front-topic-badge");
  const backTopicBadge = document.getElementById("fc-back-topic-badge");
  if (frontTopicBadge) frontTopicBadge.textContent = wordTopic;
  if (backTopicBadge) backTopicBadge.textContent = wordTopic;
  const numFront = document.getElementById("card-num-front");
  const numBack = document.getElementById("card-num-back");
  if (numFront) numFront.textContent = displayCardNum;
  if (numBack) numBack.textContent = displayCardNum;
  const frontWord = document.getElementById("fc-front-word");
  const backWordTitle = document.getElementById("fc-back-word-title");
  const backMeaning = document.getElementById("fc-back-meaning");
  if (frontWord) frontWord.textContent = item.word;
  if (backWordTitle) backWordTitle.textContent = item.word;
  if (backMeaning) backMeaning.textContent = item.meaning;
  const synList = document.getElementById("fc-back-synonyms-list");
  if (synList) {
    synList.innerHTML = "";
    const synEntries = [item.synonym1, item.synonym2].map(s => (s || "").trim()).filter(Boolean);
    if (synEntries.length > 0) {
      document.getElementById("fc-synonyms-block")?.classList.remove("hidden");
      synEntries.forEach((synWord, idx) => {
        const row = document.createElement("div");
        row.className = "flex items-center justify-between w-full px-3 py-1.5 bg-slate-900/95 rounded-xl border border-slate-700/80";
        row.innerHTML = `
              <div class="min-w-0 pr-2">
                <span class="block text-[9px] font-black uppercase tracking-widest text-indigo-400">Synonym ${idx + 1}</span>
                <div class="text-sm font-bold text-indigo-100 break-words leading-tight">${context.escapeHtml(synWord)}</div>
              </div>
              <button type="button" class="btn-syn-speaker min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-300 text-white active:scale-90 flex-shrink-0 transition-all" title="Listen">
                <i class="ph-fill ph-speaker-high text-sm"></i>
              </button>
            `;
        row.querySelector(".btn-syn-speaker").addEventListener("click", e => {
          e.stopPropagation();
          e.preventDefault();
          context.playAudio(synWord);
        });
        synList.appendChild(row);
      });
    } else {
      document.getElementById("fc-synonyms-block")?.classList.add("hidden");
    }
  }
}
export function triggerSwipeToast(isKnown, customText = null) {
  const pill = document.getElementById("swipe-toast-pill");
  const icon = document.getElementById("swipe-toast-icon");
  const text = document.getElementById("swipe-toast-text");
  if (!pill) return;
  clearTimeout(context.swipeToastTimeout);
  if (customText) {
    pill.className = "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-lg backdrop-blur-md bg-slate-900 text-amber-300 border-amber-500/80 show";
    if (icon) icon.className = "ph-bold ph-arrow-u-up-left text-xs text-amber-400";
    if (text) text.textContent = customText;
  } else if (isKnown) {
    pill.className = "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-lg backdrop-blur-md bg-emerald-950/90 text-emerald-300 border-emerald-500/80 show";
    if (icon) icon.className = "ph-bold ph-check text-xs text-emerald-400";
    if (text) text.textContent = "Known";
  } else {
    pill.className = "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-lg backdrop-blur-md bg-rose-950/90 text-rose-300 border-rose-500/80 show";
    if (icon) icon.className = "ph-bold ph-x text-xs text-rose-400";
    if (text) text.textContent = "Not Known";
  }
  context.swipeToastTimeout = setTimeout(() => {
    pill.classList.remove("show");
  }, 750);
}
export function setupSwipeGesture() {
  const cardContainer = document.getElementById("swipe-card");
  const cardInner = document.getElementById("card-inner");
  if (!cardContainer || !cardInner) return;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  let isSwiping = false;
  cardContainer.addEventListener("click", e => {
    if (isSwiping || isDragging || context.isCardFlipping) return;
    if (e.target.closest("#btn-fc-sound") || e.target.closest("#btn-fc-fav") || e.target.closest("#btn-fc-back-sound") || e.target.closest(".btn-syn-speaker") || e.target.closest(".btn-fc-known-action") || e.target.closest(".btn-fc-unknown-action") || e.target.closest(".btn-fc-prev-action")) return;
    context.isCardFlipping = true;
    context.SoundManager.playFlip();
    context.isFlipped = !context.isFlipped;
    if (context.isFlipped) cardInner.classList.add("is-flipped");else cardInner.classList.remove("is-flipped");
    context.recordLearningActivity("card_flip");
    setTimeout(() => {
      context.isCardFlipping = false;
    }, 900);
  });
  document.querySelectorAll(".btn-fc-known-action").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      if (context.sessionCompleted || isSwiping || context.activeSessionWords.length === 0) return;
      triggerSwipeOut("right", false);
    });
  });
  document.querySelectorAll(".btn-fc-unknown-action").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      if (context.sessionCompleted || isSwiping || context.activeSessionWords.length === 0) return;
      triggerSwipeOut("left", false);
    });
  });
  document.querySelectorAll(".btn-fc-prev-action").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      if (context.sessionCompleted || isSwiping) return;
      triggerSwipeUpPrevious();
    });
  });
  document.getElementById("btn-fc-fav")?.addEventListener("click", async e => {
    e.stopPropagation();
    e.preventDefault();
    context.SoundManager.playSelect();
    if (context.activeSessionWords.length > 0 && context.sessionCurrentIndex < context.activeSessionWords.length) {
      await context.toggleWordFavorite(context.activeSessionWords[context.sessionCurrentIndex].id, true);
    }
  });
  document.getElementById("btn-fc-sound")?.addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    if (context.activeSessionWords.length > 0 && context.sessionCurrentIndex < context.activeSessionWords.length) {
      context.playAudio(context.activeSessionWords[context.sessionCurrentIndex].word);
    }
  });
  document.getElementById("btn-fc-back-sound")?.addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    if (context.activeSessionWords.length > 0 && context.sessionCurrentIndex < context.activeSessionWords.length) {
      context.playAudio(context.activeSessionWords[context.sessionCurrentIndex].word);
    }
  });
  const onStart = (clientX, clientY) => {
    if (isSwiping || context.sessionCompleted) return;
    isDragging = true;
    startX = clientX;
    startY = clientY;
    currentX = clientX;
    currentY = clientY;
    cardContainer.style.transition = "none";
  };
  const onMove = (clientX, clientY) => {
    if (!isDragging || isSwiping || context.sessionCompleted) return;
    currentX = clientX;
    currentY = clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && deltaY < -20) {
      cardContainer.style.transform = `translate3d(0, ${Math.max(deltaY * 0.5, -70)}px, 0) scale(0.97)`;
    } else if (Math.abs(deltaX) >= Math.abs(deltaY) * 0.8) {
      cardContainer.style.transform = `translate3d(${deltaX}px, 0, 0) rotate(${deltaX * 0.08}deg)`;
    }
  };
  const onEnd = () => {
    if (!isDragging || isSwiping || context.sessionCompleted) return;
    isDragging = false;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const threshold = 70;
    if (deltaY < -threshold && Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      triggerSwipeUpPrevious();
    } else if (deltaX < -threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      triggerSwipeOut("left", true);
    } else if (deltaX > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      triggerSwipeOut("right", true);
    } else {
      cardContainer.style.transition = "transform 0.3s ease-out";
      cardContainer.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
    }
  };
  cardContainer.addEventListener("mousedown", e => {
    if (e.target.closest(".btn-fc-known-action") || e.target.closest(".btn-fc-unknown-action") || e.target.closest(".btn-fc-prev-action") || e.target.closest("#btn-fc-sound") || e.target.closest("#btn-fc-fav") || e.target.closest("#btn-fc-back-sound") || e.target.closest(".btn-syn-speaker")) return;
    onStart(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onEnd);
  cardContainer.addEventListener("touchstart", e => {
    if (e.target.closest(".btn-fc-known-action") || e.target.closest(".btn-fc-unknown-action") || e.target.closest(".btn-fc-prev-action") || e.target.closest("#btn-fc-sound") || e.target.closest("#btn-fc-fav") || e.target.closest("#btn-fc-back-sound") || e.target.closest(".btn-syn-speaker")) return;
    if (e.touches && e.touches[0]) onStart(e.touches[0].clientX, e.touches[0].clientY);
  }, {
    passive: true
  });
  window.addEventListener("touchmove", e => {
    if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, {
    passive: true
  });
  window.addEventListener("touchend", onEnd);
  function triggerSwipeUpPrevious() {
    if (context.sessionCurrentIndex <= 0) {
      context.SoundManager.playSelect();
      context.triggerSwipeToast(false, "You're on the first card.");
      cardContainer.style.transition = "transform 0.28s ease-out";
      cardContainer.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
      return;
    }
    isSwiping = true;
    context.SoundManager.playSelect();
    context.triggerSwipeToast(false, "Previous Card");
    cardContainer.style.transition = "transform 0.24s ease-out, opacity 0.24s ease-out";
    cardContainer.style.transform = "translate3d(0, -110px, 0) scale(0.94)";
    cardContainer.style.opacity = "0";
    setTimeout(() => {
      context.sessionCurrentIndex = Math.max(0, context.sessionCurrentIndex - 1);
      context.renderActiveCard();
      cardContainer.style.transition = "none";
      cardContainer.style.transform = "translate3d(0, 45px, 0) scale(0.97)";
      cardContainer.style.opacity = "0";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardContainer.style.transition = "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.26s ease-out";
          cardContainer.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
          cardContainer.style.opacity = "1";
          setTimeout(() => {
            isSwiping = false;
          }, 260);
        });
      });
    }, 230);
  }
  function triggerSwipeOut(direction, isGesture = false) {
    isSwiping = true;
    const isKnown = direction === "right";
    if (isKnown) context.SoundManager.playSuccess();else context.SoundManager.playError();
    context.triggerSwipeToast(isKnown);
    const moveOut = direction === "left" ? -window.innerWidth * 1.15 : window.innerWidth * 1.15;
    cardContainer.style.transition = "transform 0.32s ease-in, opacity 0.32s ease-in";
    cardContainer.style.transform = `translate3d(${moveOut}px, 0, 0) rotate(${direction === "left" ? -25 : 25}deg)`;
    cardContainer.style.opacity = "0";
    const currentWord = context.activeSessionWords[context.sessionCurrentIndex];
    if (currentWord) {
      const newStatus = isKnown ? context.STATUS.KNOWN : context.STATUS.NOT_KNOWN;
      context.sessionResponses.set(currentWord.id, newStatus);
      context.updateWordMemory(currentWord.id, newStatus, true);
    }

    // Check 15-swipe thresholds for completed gesture swipes only
    let triggeredEasterEgg = null;
    if (isGesture) {
      if (direction === "right") {
        context.sessionSwipeStats.rightSwipes++;
        if (context.sessionSwipeStats.rightSwipes === 15 && !context.sessionSwipeStats.trophyTriggered) {
          context.sessionSwipeStats.trophyTriggered = true;
          triggeredEasterEgg = "trophy";
        }
      } else if (direction === "left") {
        context.sessionSwipeStats.leftSwipes++;
        if (context.sessionSwipeStats.leftSwipes === 15 && !context.sessionSwipeStats.flagTriggered) {
          context.sessionSwipeStats.flagTriggered = true;
          triggeredEasterEgg = "flag";
        }
      }
    }
    setTimeout(() => {
      context.sessionCurrentIndex++;
      cardContainer.style.opacity = "1";
      isSwiping = false;
      if (triggeredEasterEgg) {
        context.showEasterEggCard(triggeredEasterEgg);
      } else {
        context.renderActiveCard();
      }
    }, 300);
  }
  window.recordCompletedSwipe = direction => triggerSwipeOut(direction, true);
  context.setupEasterEggInteractions();
  const btnLearning = document.getElementById("btn-mode-learning");
  const btnReview = document.getElementById("btn-mode-review");
  const btnBottomFav = document.getElementById("btn-bottom-fav");
  function updateBottomNavModeVisual(mode) {
    const stage = document.getElementById("review-flashcard-stage");
    const topicMenu = document.getElementById("review-topic-popover-container");
    const favContainer = document.getElementById("review-favorites-container");
    const btmBtn = document.getElementById("btn-bottom-fav");
    const btmIcon = document.getElementById("bottom-fav-icon");
    if (stage) stage.classList.remove("hidden");
    if (topicMenu) topicMenu.classList.remove("hidden");
    if (favContainer) favContainer.classList.add("hidden");
    if (mode === "favorites") {
      if (btnLearning) {
        btnLearning.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95 truncate";
        btnLearning.title = "Unknown Vocabulary";
        btnLearning.setAttribute("aria-label", "Unknown Vocabulary");
      }
      if (btnReview) {
        btnReview.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95 truncate";
        btnReview.title = "Known Vocabulary";
        btnReview.setAttribute("aria-label", "Known Vocabulary");
      }
      if (btmBtn) {
        btmBtn.className = "w-[46px] h-[46px] min-w-[46px] min-h-[46px] aspect-square rounded-full flex-shrink-0 flex items-center justify-center shadow-lg transition-all active:scale-90 border bg-red-950/80 border-red-500/80 text-white relative shadow-[0_0_14px_rgba(239,68,68,0.35)]";
        btmBtn.title = "Favorites Mode (Active)";
        btmBtn.setAttribute("aria-label", "Favorites Mode (Active)");
      }
      if (btmIcon) {
        btmIcon.className = "ph-fill ph-heart text-xl text-red-500";
      }
    } else {
      if (mode === "learning") {
        if (btnLearning) {
          btnLearning.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-indigo-600 text-white border-indigo-500 shadow-sm active:scale-95 truncate";
          btnLearning.title = "Unknown Vocabulary (Active)";
          btnLearning.setAttribute("aria-label", "Unknown Vocabulary (Active)");
        }
        if (btnReview) {
          btnReview.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95 truncate";
          btnReview.title = "Known Vocabulary";
          btnReview.setAttribute("aria-label", "Known Vocabulary");
        }
      } else {
        if (btnReview) {
          btnReview.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-indigo-600 text-white border-indigo-500 shadow-sm active:scale-95 truncate";
          btnReview.title = "Known Vocabulary (Active)";
          btnReview.setAttribute("aria-label", "Known Vocabulary (Active)");
        }
        if (btnLearning) {
          btnLearning.className = "flex-1 min-h-[46px] py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95 truncate";
          btnLearning.title = "Unknown Vocabulary";
          btnLearning.setAttribute("aria-label", "Unknown Vocabulary");
        }
      }
      if (btmBtn) {
        btmBtn.className = "w-[46px] h-[46px] min-w-[46px] min-h-[46px] aspect-square rounded-full flex-shrink-0 flex items-center justify-center shadow-md transition-all active:scale-90 border bg-slate-900 hover:bg-slate-800 border-slate-800 text-white relative";
        btmBtn.title = "Favorites Mode";
        btmBtn.setAttribute("aria-label", "Favorites Mode");
      }
      if (btmIcon) {
        btmIcon.className = "ph-bold ph-heart text-xl text-white";
      }
    }
  }
  window.updateBottomNavModeVisual = updateBottomNavModeVisual;
  btnLearning?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.reviewMode = "learning";
    updateBottomNavModeVisual("learning");
    context.startNewSession();
  });
  btnReview?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.reviewMode = "review";
    updateBottomNavModeVisual("review");
    context.startNewSession();
  });
  btnBottomFav?.addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    context.SoundManager.playSelect();
    context.reviewMode = "favorites";
    updateBottomNavModeVisual("favorites");
    context.startNewSession();
  });
  window.openFavoritesCollection = () => {
    context.reviewMode = "favorites";
    updateBottomNavModeVisual("favorites");
    context.startNewSession();
  };
  const triggerReviewTopic = document.getElementById("btn-review-topic-selector");
  const reviewUpwardMenu = document.getElementById("review-topic-upward-menu");
  const reviewChevron = document.getElementById("review-topic-chevron");
  if (triggerReviewTopic && reviewUpwardMenu) {
    triggerReviewTopic.addEventListener("click", e => {
      e.stopPropagation();
      context.SoundManager.playSelect();
      const isClosed = reviewUpwardMenu.classList.contains("hidden");
      if (isClosed) {
        reviewUpwardMenu.classList.remove("hidden");
        reviewChevron?.classList.add("rotate-180");
      } else {
        reviewUpwardMenu.classList.add("hidden");
        reviewChevron?.classList.remove("rotate-180");
      }
    });
    document.addEventListener("click", e => {
      if (!e.target.closest("#review-topic-popover-container")) {
        reviewUpwardMenu.classList.add("hidden");
        reviewChevron?.classList.remove("rotate-180");
      }
    });
  }
}
export function updateCardFavoriteVisual(isFav, animate = false) {
  const topBtn = document.getElementById("btn-fc-fav");
  const topIcon = document.getElementById("fc-fav-icon");

  // 1. Top favorite button beside speaker on current flashcard
  if (topBtn && topIcon) {
    topBtn.className = "w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-90 text-white flex items-center justify-center shadow-md border border-indigo-400/30 transition-all relative";
    if (isFav) {
      topIcon.className = "ph-fill ph-heart text-base text-red-500";
      topBtn.title = "Favorited ❤️ (Click to remove)";
      topBtn.setAttribute("aria-label", "Favorited word");
    } else {
      topIcon.className = "ph-bold ph-heart text-base text-white";
      topBtn.title = "Favorite Word ♡";
      topBtn.setAttribute("aria-label", "Favorite word");
    }
    if (animate) {
      topIcon.classList.remove("animate-heart-pop", "animate-heart-unpop");
      void topIcon.offsetWidth; // Force CSS reflow to retrigger animation
      topIcon.classList.add(isFav ? "animate-heart-pop" : "animate-heart-unpop");
    }
  }
}
export function updateCardQuickSaveVisual(isStar) {
  // Obsolete, replaced by unified Favorite
}
export function updateQuickCollectionButtonsUI() {
  // Kept as safe no-op for backward compatibility
}
export function setupSessionEndButtons() {
  document.getElementById("btn-session-add-words")?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.switchView("view-entry");
  });
  document.getElementById("btn-session-restart")?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    context.startNewSession();
  });
}
export async function playAudio(text) {
  if (!text) return;
  context.recordLearningActivity("audio_pronounce");
  const clean = text.trim().toLowerCase();
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      let audioUrl = null;
      if (Array.isArray(data) && data[0]?.phonetics) {
        for (const item of data[0].phonetics) {
          if (item.audio && item.audio.length > 0) {
            if (item.audio.includes("-uk")) {
              audioUrl = item.audio;
              break;
            }
            if (!audioUrl) audioUrl = item.audio;
          }
        }
      }
      if (audioUrl) {
        const a = new Audio(audioUrl);
        await a.play();
        return;
      }
    }
  } catch (e) {}
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-GB';
    window.speechSynthesis.speak(u);
  }
}
