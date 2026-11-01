import { context } from "../core/context.js";
export function renderEntryTopicCards(sortedTopics = context.getAlphabeticalTopics()) {
  const container = document.getElementById("entry-topic-cards-list");
  if (!container) return;
  const selectedTopic = context.draftWord.topic && sortedTopics.includes(context.draftWord.topic) ? context.draftWord.topic : context.DEFAULT_TOPIC;
  context.draftWord.topic = selectedTopic;
  const entrySelect = document.getElementById("select-entry-topic");
  if (entrySelect) entrySelect.value = selectedTopic;
  const topicBadge = document.getElementById("confirm-display-topic");
  if (topicBadge) topicBadge.textContent = selectedTopic;
  container.innerHTML = sortedTopics.map(t => {
    const isSelected = t === selectedTopic;
    return `
          <button type="button" onclick="selectEntryTopic('${context.escapeQuotes(t)}')"
            class="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between border ${isSelected ? 'bg-indigo-600 text-white border-[#D4AF37] shadow-md' : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'}">
            <span class="flex items-center gap-2 truncate pr-2">
              <i class="ph-fill ${isSelected ? 'ph-folder-open text-[#F3D060]' : 'ph-folder text-slate-400'} text-sm flex-shrink-0"></i>
              <span class="truncate">${context.escapeHtml(t)}</span>
            </span>
            ${isSelected ? '<span class="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#F3D060] flex-shrink-0"><i class="ph-bold ph-check-circle text-sm"></i> Selected</span>' : '<span class="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0"></span>'}
          </button>
        `;
  }).join("");
}
export function install_selectEntryTopic() {
  window.selectEntryTopic = topicName => {
    context.SoundManager.playSelect();
    context.draftWord.topic = topicName;
    const entrySelect = document.getElementById("select-entry-topic");
    if (entrySelect) entrySelect.value = topicName;
    const topicBadge = document.getElementById("confirm-display-topic");
    if (topicBadge) topicBadge.textContent = topicName;
    context.renderEntryTopicCards();
  };
}
export function setupEntryModule() {
  const btnOk = document.getElementById("btn-entry-ok");
  const btnAiTranslate = document.getElementById("btn-entry-ai-translate") || document.getElementById("btn-entry-quickfill");
  const btnConfirmBack = document.getElementById("btn-confirm-back");
  const btnConfirmSave = document.getElementById("btn-confirm-save");
  const btnQuickTopic = document.getElementById("btn-quick-create-topic");
  const inlineBox = document.getElementById("inline-create-topic-box");
  const btnSaveInline = document.getElementById("btn-save-inline-topic");
  const inputWord = document.getElementById("input-word");
  btnQuickTopic?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    inlineBox.classList.toggle("hidden");
    if (!inlineBox.classList.contains("hidden")) {
      document.getElementById("input-inline-topic-name").focus();
    }
  });
  btnSaveInline?.addEventListener("click", () => {
    const input = document.getElementById("input-inline-topic-name");
    const val = input.value.trim();
    if (!val) {
      context.SoundManager.playError();
      context.showToast("Please enter a topic name.", "error");
      return;
    }
    context.addUserTopic(val);
    context.draftWord.topic = val;
    input.value = "";
    inlineBox.classList.add("hidden");
    context.renderEntryTopicCards();
    context.SoundManager.playSuccess();
    context.showToast(`Topic "${val}" selected!`, "success");
  });
  btnOk?.addEventListener("click", () => {
    const word = inputWord.value.trim();
    if (!word) {
      context.SoundManager.playError();
      context.showToast("Please enter an English word or phrase.", "error");
      inputWord.focus();
      return;
    }
    context.SoundManager.playSelect();
    context.draftWord.word = word;
    context.draftWord.meaning = document.getElementById("confirm-input-meaning").value.trim();
    context.draftWord.synonym1 = document.getElementById("confirm-input-syn1").value.trim();
    context.draftWord.synonym2 = document.getElementById("confirm-input-syn2").value.trim();
    if (!context.draftWord.topic) context.draftWord.topic = context.DEFAULT_TOPIC;
    document.getElementById("entry-phase-1").classList.add("hidden");
    document.getElementById("entry-phase-2").classList.remove("hidden");
    document.getElementById("entry-step-indicator").textContent = "Step 2/2 · Select Topic & Save";
    document.getElementById("confirm-display-word").textContent = context.draftWord.word;
    document.getElementById("confirm-display-meaning").textContent = context.draftWord.meaning || "No meaning provided";
    context.renderEntryTopicCards();
  });
  let isAiTranslating = false;
  btnAiTranslate?.addEventListener("click", async () => {
    if (isAiTranslating) return;
    const word = inputWord.value.trim();
    if (!word) {
      context.SoundManager?.playError();
      context.showToast("Please enter an English word to translate.", "error");
      inputWord.focus();
      return;
    }
    const meaningInput = document.getElementById("confirm-input-meaning");
    const existingMeaning = meaningInput ? meaningInput.value.trim() : "";
    if (existingMeaning) {
      const proceed = window.confirm(`The Vietnamese meaning already contains text:\n\n"${existingMeaning}"\n\nDo you want to replace it with the AI translation?`);
      if (!proceed) {
        return;
      }
    }
    context.SoundManager?.playSelect();
    isAiTranslating = true;
    btnAiTranslate.disabled = true;
    btnAiTranslate.classList.remove("lightning-pulse", "animate-pulse");
    const iconEl = document.getElementById("icon-entry-ai-translate");
    if (iconEl) iconEl.className = "ph-bold ph-spinner animate-spin text-amber-300 text-sm";
    const statusLabel = document.getElementById("api-loading-status");
    if (statusLabel) {
      statusLabel.classList.remove("hidden");
      const span = statusLabel.querySelector("span");
      if (span) span.textContent = "Fetching AI translation...";
    }
    try {
      let translatedMeaning = "";
      let syn1 = "";
      let syn2 = "";

      // 1. First attempt: call secure local backend API
      try {
        const currentTopic = context.draftWord && context.draftWord.topic ? context.draftWord.topic : "";
        const apiResp = await fetch(`/api/translate?word=${encodeURIComponent(word)}&topic=${encodeURIComponent(currentTopic)}`);
        if (apiResp.ok) {
          const apiData = await apiResp.json();
          if (apiData && apiData.ok && apiData.meaning) {
            translatedMeaning = apiData.meaning;
            if (Array.isArray(apiData.synonyms)) {
              syn1 = apiData.synonyms[0] || "";
              syn2 = apiData.synonyms[1] || "";
            }
          }
        }
      } catch (backendErr) {
        console.warn("Backend /api/translate not reachable, trying client fallback...", backendErr);
      }

      // 2. Direct client-side Google Neural fallback (if standalone or backend not running)
      if (!translatedMeaning) {
        try {
          const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
          const gRes = await fetch(gUrl);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (Array.isArray(gData) && gData[0] && gData[0][0] && gData[0][0][0]) {
              let t = gData[0][0][0].trim();
              if (t.endsWith(".")) t = t.slice(0, -1);
              translatedMeaning = t;
            }
          }
        } catch (gErr) {
          console.warn("Google direct fallback failed:", gErr);
        }
      }

      // 3. Direct client-side MyMemory fallback (secondary fallback)
      if (!translatedMeaning) {
        try {
          const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`;
          const mRes = await fetch(mUrl);
          if (mRes.ok) {
            const mData = await mRes.json();
            if (mData?.responseData?.translatedText) {
              let m = mData.responseData.translatedText.trim();
              if (m.endsWith(".")) m = m.slice(0, -1);
              translatedMeaning = m;
            }
          }
        } catch (mErr) {
          console.warn("MyMemory fallback failed:", mErr);
        }
      }

      // Enrich synonyms from Datamuse if not populated yet
      if (!syn1 && !syn2) {
        try {
          const synRes = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word.toLowerCase())}`);
          if (synRes.ok) {
            const synData = await synRes.json();
            if (Array.isArray(synData) && synData.length > 0) {
              syn1 = synData[0]?.word || "";
              syn2 = synData[1]?.word || "";
            }
          }
        } catch (synErr) {}
      }
      if (!translatedMeaning) {
        throw new Error("Unable to obtain translation from available services.");
      }

      // Populate the Vietnamese Meaning field without saving automatically
      if (meaningInput) {
        meaningInput.value = translatedMeaning;
      }

      // Fill synonyms if currently empty
      const syn1Input = document.getElementById("confirm-input-syn1");
      const syn2Input = document.getElementById("confirm-input-syn2");
      if (syn1Input && !syn1Input.value.trim() && syn1) {
        syn1Input.value = syn1;
      }
      if (syn2Input && !syn2Input.value.trim() && syn2) {
        syn2Input.value = syn2;
      }
      context.SoundManager?.playSuccess();
      context.showToast("AI translation loaded! You can review and edit before saving.", "success");
    } catch (err) {
      console.error("AI translation error:", err);
      context.SoundManager?.playError();
      context.showToast("Translation service unavailable. Please enter meaning manually.", "error");
    } finally {
      isAiTranslating = false;
      btnAiTranslate.disabled = false;
      btnAiTranslate.classList.add("lightning-pulse", "animate-pulse");
      if (iconEl) iconEl.className = "ph-fill ph-lightning text-amber-300 text-sm";
      if (statusLabel) statusLabel.classList.add("hidden");
    }
  });
  btnConfirmBack?.addEventListener("click", () => {
    context.SoundManager.playSelect();
    document.getElementById("entry-phase-2").classList.add("hidden");
    document.getElementById("entry-phase-1").classList.remove("hidden");
    document.getElementById("entry-step-indicator").textContent = "Step 1/2 · Enter Vocabulary Info";
  });
  let isSavingWord = false;
  btnConfirmSave?.addEventListener("click", async () => {
    if (isSavingWord) return;
    const meaning = document.getElementById("confirm-input-meaning").value.trim();
    if (!meaning) {
      context.SoundManager.playError();
      context.showToast("Please enter Vietnamese meaning.", "error");
      return;
    }
    isSavingWord = true;
    btnConfirmSave.disabled = true;
    document.getElementById("btn-confirm-save-text").textContent = "Saving...";
    const recordId = `word_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record = {
      id: recordId,
      username: context.currentUser,
      word: context.draftWord.word,
      meaning: meaning,
      synonym1: document.getElementById("confirm-input-syn1").value.trim(),
      synonym2: document.getElementById("confirm-input-syn2").value.trim(),
      topic: context.draftWord.topic || context.DEFAULT_TOPIC,
      memoryStatus: context.STATUS.NOT_KNOWN,
      isFavorite: false
    };
    try {
      await context.idbPut("words", record);
      context.wordsData.push(record);
      context.addUserTopic(record.topic);
      context.updateBadges();
      context.recordLearningActivity("add_word");
      await context.updateStudentMetadataCount();
      if (context.db && navigator.onLine) {
        await context.db.collection("words").doc(recordId).set(record);
      } else {
        await context.idbPut("pendingOps", {
          id: `add_${recordId}`,
          type: "ADD",
          data: record
        });
      }
      context.SoundManager.playSuccess();
      context.showToast(`"${context.draftWord.word}" saved successfully!`, "success");
      inputWord.value = "";
      document.getElementById("confirm-input-meaning").value = "";
      document.getElementById("confirm-input-syn1").value = "";
      document.getElementById("confirm-input-syn2").value = "";
      context.draftWord = {
        word: "",
        topic: context.DEFAULT_TOPIC,
        meaning: "",
        synonym1: "",
        synonym2: ""
      };
      document.getElementById("entry-phase-2").classList.add("hidden");
      document.getElementById("entry-phase-1").classList.remove("hidden");
      document.getElementById("entry-step-indicator").textContent = "Step 1/2 · Enter Vocabulary Info";
    } catch (err) {
      context.SoundManager.playError();
      context.showToast("Failed to save word.", "error");
    } finally {
      isSavingWord = false;
      btnConfirmSave.disabled = false;
      document.getElementById("btn-confirm-save-text").textContent = "Save Word";
    }
  });
}
export function setupQuickImport() {
  const modal = document.getElementById("modal-quick-import");
  const toggleBtn = document.getElementById("btn-toggle-ai-library") || document.getElementById("btn-open-quick-import");
  const aiSec = document.getElementById("section-ai-library");
  const toggleText = document.getElementById("btn-toggle-ai-library-text");
  const toggleChevron = document.getElementById("btn-toggle-ai-library-chevron");
  let isAiLibraryExpanded = false;
  function updateAiLibraryVisibility(expanded) {
    isAiLibraryExpanded = !!expanded;
    if (aiSec) {
      if (isAiLibraryExpanded) {
        aiSec.classList.remove("hidden");
        if (toggleBtn) {
          toggleBtn.setAttribute("aria-expanded", "true");
          toggleBtn.title = "Hide AI Library";
        }
        if (toggleText) toggleText.textContent = "Hide AI Library";
        if (toggleChevron) {
          toggleChevron.classList.remove("ph-caret-down");
          toggleChevron.classList.add("ph-caret-up");
        }
      } else {
        aiSec.classList.add("hidden");
        if (toggleBtn) {
          toggleBtn.setAttribute("aria-expanded", "false");
          toggleBtn.title = "Open AI Library";
        }
        if (toggleText) toggleText.textContent = "AI Library";
        if (toggleChevron) {
          toggleChevron.classList.remove("ph-caret-up");
          toggleChevron.classList.add("ph-caret-down");
        }
      }
    }
  }

  // Initial state: Collapsed (zero layout footprint apart from button)
  updateAiLibraryVisibility(false);
  function handleToggleClick() {
    context.SoundManager?.playSelect();
    const phase1 = document.getElementById("entry-phase-1");
    const phase2 = document.getElementById("entry-phase-2");
    if (phase1?.classList.contains("hidden")) {
      phase1.classList.remove("hidden");
      phase2?.classList.add("hidden");
      document.getElementById("entry-step-indicator").textContent = "Step 1/2 · Enter Vocabulary Info";
    }
    updateAiLibraryVisibility(!isAiLibraryExpanded);
    if (isAiLibraryExpanded && aiSec) {
      aiSec.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
      document.getElementById("import-raw-input")?.focus();
    }
  }
  toggleBtn?.addEventListener("click", handleToggleClick);
  document.getElementById("btn-open-quick-import")?.addEventListener("click", handleToggleClick);
  window.toggleAiLibrarySection = updateAiLibraryVisibility;
  window.isAiLibraryExpanded = () => isAiLibraryExpanded;
  document.getElementById("btn-close-quick-import")?.addEventListener("click", () => modal?.classList.add("hidden"));
  document.getElementById("btn-cancel-import")?.addEventListener("click", () => {
    context.SoundManager?.playSelect();
    document.getElementById("import-preview-section")?.classList.add("hidden");
    document.getElementById("import-input-section")?.classList.remove("hidden");
    modal?.classList.add("hidden");
  });
  document.getElementById("btn-copy-template")?.addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("template-text").innerText).then(() => context.showToast("Copied template!", "success"));
  });
  document.getElementById("btn-back-to-input")?.addEventListener("click", () => {
    document.getElementById("import-input-section")?.classList.remove("hidden");
    document.getElementById("import-preview-section")?.classList.add("hidden");
  });
  document.getElementById("btn-preview-import")?.addEventListener("click", () => {
    const raw = document.getElementById("import-raw-input").value;
    context.parsedImportEntries = context.parseMultiTopicMessage(raw);
    if (context.parsedImportEntries.length === 0) {
      context.showToast("No valid entries found.", "error");
      return;
    }
    context.renderImportPreview();
    document.getElementById("import-input-section")?.classList.add("hidden");
    document.getElementById("import-preview-section")?.classList.remove("hidden");
  });
  document.getElementById("btn-execute-import")?.addEventListener("click", async () => {
    const valid = context.parsedImportEntries.filter(e => e.isValid);
    if (valid.length === 0) return;
    try {
      const newT = new Set();
      const batchRecs = [];
      valid.forEach(e => {
        const top = e.topic || context.DEFAULT_TOPIC;
        newT.add(top);
        const rec = {
          id: `word_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          username: context.currentUser,
          word: e.word,
          meaning: e.meaning,
          synonym1: e.synonym1,
          synonym2: e.synonym2,
          topic: top,
          memoryStatus: context.STATUS.NOT_KNOWN,
          isFavorite: false
        };
        context.wordsData.push(rec);
        batchRecs.push(rec);
      });
      newT.forEach(t => context.addUserTopic(t));
      for (const r of batchRecs) {
        await context.idbPut("words", r);
      }
      context.updateBadges();
      context.recordLearningActivity("quick_import");
      await context.updateStudentMetadataCount();
      context.renderLibrary();
      if (context.db && navigator.onLine) {
        const b = context.db.batch();
        batchRecs.forEach(r => {
          const ref = context.db.collection("words").doc(r.id);
          b.set(ref, r);
        });
        await b.commit();
      } else {
        for (const r of batchRecs) {
          await context.idbPut("pendingOps", {
            id: `add_${r.id}`,
            type: "ADD",
            data: r
          });
        }
      }
      context.showToast("Imported successfully!", "success");
      document.getElementById("import-raw-input").value = "";
      document.getElementById("import-preview-section")?.classList.add("hidden");
      document.getElementById("import-input-section")?.classList.remove("hidden");
      modal?.classList.add("hidden");
    } catch (e) {
      context.showToast("Import failed.", "error");
    }
  });
}
export function parseMultiTopicMessage(text) {
  const lines = text.split(/\r?\n/);
  let curT = "";
  const res = [];
  lines.forEach((l, idx) => {
    const line = l.trim();
    if (!line) return;
    const tm = line.match(/^Topic\s*:\s*(.+)$/i);
    if (tm) {
      curT = tm[1].trim();
      return;
    }
    const p = line.split("|").map(x => x.trim());
    if (!curT || p.length < 2 || !p[0] || !p[1]) return;
    const syns = (p[2] || "").split(",").map(s => s.trim()).filter(Boolean);
    res.push({
      id: `entry_${idx}`,
      word: p[0],
      meaning: p[1],
      synonym1: syns[0] || "",
      synonym2: syns[1] || "",
      topic: curT,
      isValid: true
    });
  });
  return res;
}
export function renderImportPreview() {
  const list = document.getElementById("import-preview-list");
  if (!list) return;
  list.innerHTML = context.parsedImportEntries.map(e => `
        <div class="p-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-200 flex items-center justify-between text-[11px]">
          <div><strong class="text-white">${context.escapeHtml(e.word)}</strong>: ${context.escapeHtml(e.meaning)} <span class="text-indigo-400">(${context.escapeHtml(e.topic)})</span></div>
          <button type="button" onclick="removeImportItem('${e.id}')" class="text-slate-500 hover:text-rose-400"><i class="ph-bold ph-trash text-xs"></i></button>
        </div>
      `).join('');
}
export function install_removeImportItem() {
  window.removeImportItem = id => {
    context.parsedImportEntries = context.parsedImportEntries.filter(e => e.id !== id);
    context.renderImportPreview();
  };
}
