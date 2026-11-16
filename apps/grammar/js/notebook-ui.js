import { createScoreRecord, ProgressManager, getProgressColor, getProgressColorClass, getApplyProgressColor, getApplyProgressColorClass, getPastelProgressColor, getPastelApplyProgressColor } from './storage-decay.js';

export function createNotebookUI({ byId, student, book, lessonProgress, reducedMotion, getActiveLesson, setActiveLesson, getLibrary, commitLesson, renderLibrary, showView }) {
    let pages = [], questions = [], practiceParts = [], currentPage = 0, turnState = null, turnTimer = 0;
    function measurePageHeight(page) {
      // Measure natural content without tying it to the book's existing height.
      // All visible sheets still occupy exactly 100% of the book after measuring.
      book.classList.add('is-measuring');
      const height = Math.ceil(page.face.offsetHeight);
      book.classList.remove('is-measuring');
      return height;
    }
    function syncBookHeight() {
      if (student.hidden || turnState || !pages[currentPage]) return;
      const height = measurePageHeight(pages[currentPage]);
      if (height && book.style.height !== height + 'px') book.style.height = height + 'px';
    }
    const pageObserver = new ResizeObserver(syncBookHeight);
    function cancelPageTurn() {
      clearTimeout(turnTimer); turnState = null; book.inert = false; book.classList.remove('is-turning'); book.removeAttribute('aria-busy');
    }
    function updatePageState(focus = false) {
      book.classList.add('is-resetting');
      pages.forEach((page, index) => {
        page.element.classList.toggle('flipped', index < currentPage);
        page.element.classList.toggle('is-visible', index === currentPage);
        page.element.classList.toggle('is-active', index === currentPage);
        page.element.inert = index !== currentPage;
        page.element.setAttribute('aria-hidden', String(index !== currentPage));
        page.previous.disabled = index === 0;
        if (page.forward) page.forward.disabled = false;
        const isTheory = page.kind === 'theory' || page.element.dataset.kind === 'theory';
        if (page.check) {
          if (isTheory) {
            page.check.classList.add('is-hidden');
            page.check.style.display = 'none';
            page.check.disabled = true;
            page.check.setAttribute('aria-hidden', 'true');
            page.check.tabIndex = -1;
          } else {
            page.check.classList.remove('is-hidden');
            page.check.style.display = '';
            page.check.disabled = !questions.length;
            page.check.removeAttribute('aria-hidden');
            page.check.tabIndex = 0;
          }
        }
      });
      if (pages[currentPage]) student.setAttribute('aria-labelledby', pages[currentPage].heading.id);
      void book.offsetWidth;
      book.classList.remove('is-resetting');
      syncBookHeight();
      if (focus && !student.hidden) pages[currentPage].heading.focus({ preventScroll: true });
    }
    function finishPageTurn() {
      if (!turnState) return;
      currentPage = turnState.to;
      cancelPageTurn(); updatePageState(true);
    }
    function turnPage(direction) {
      if (turnState || ![1, -1].includes(direction)) return;
      const target = direction > 0 ? currentPage + 1 : pages.map(page => page.element.classList.contains('flipped')).lastIndexOf(true);
      if (target < 0 || target >= pages.length) return;
      if (reducedMotion.matches) { currentPage = target; updatePageState(true); book.scrollIntoView({ block: 'start', behavior: 'auto' }); return; }
      const from = pages[currentPage].element, to = pages[target].element;
      const moving = direction > 0 ? from : to;
      turnState = { to: target, moving };
      const height = Math.max(measurePageHeight(pages[currentPage]), measurePageHeight(pages[target]));
      book.style.height = height + 'px';
      from.classList.add('is-visible'); to.classList.add('is-visible');
      pages.forEach(page => {
        page.previous.disabled = true;
        if (page.forward) page.forward.disabled = true;
        if (page.check) page.check.disabled = true;
      });
      book.classList.add('is-turning'); book.setAttribute('aria-busy', 'true'); book.inert = true;
      void moving.offsetWidth;
      if (direction > 0) moving.classList.add('flipped');
      else moving.classList.remove('flipped');
      book.scrollIntoView({ block: 'start', behavior: 'auto' });
      turnTimer = setTimeout(finishPageTurn, 950);
    }
    function goToFirstPage() {
      if (turnState || currentPage === 0 || !pages.length) return;
      if (reducedMotion.matches) {
        currentPage = 0;
        updatePageState(true);
        book.scrollIntoView({ block: 'start', behavior: 'auto' });
        return;
      }
      const from = pages[currentPage].element, to = pages[0].element;
      turnState = { to: 0, moving: from };
      const height = Math.max(measurePageHeight(pages[currentPage]), measurePageHeight(pages[0]));
      book.style.height = height + 'px';
      from.classList.add('is-visible');
      to.classList.add('is-visible');
      pages.forEach(page => {
        page.previous.disabled = true;
        if (page.forward) page.forward.disabled = true;
        if (page.check) page.check.disabled = true;
      });
      book.classList.add('is-turning');
      book.setAttribute('aria-busy', 'true');
      book.inert = true;
      void from.offsetWidth;
      pages.forEach(p => p.element.classList.remove('flipped'));
      book.scrollIntoView({ block: 'start', behavior: 'smooth' });
      turnTimer = setTimeout(finishPageTurn, 850);
    }
    window.addEventListener('keydown', event => {
      if (student.hidden || !pages.length) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentPage >= pages.length - 1) {
          goToFirstPage();
        } else {
          turnPage(1);
        }
      } else if (event.key === 'ArrowLeft') {
        if (currentPage > 0) {
          event.preventDefault();
          turnPage(-1);
        }
      }
    });
    book.addEventListener('transitionend', event => { if (turnState && event.target === turnState.moving && event.propertyName === 'transform') finishPageTurn(); });
    book.addEventListener('transitioncancel', event => { if (turnState && event.target === turnState.moving && event.propertyName === 'transform') finishPageTurn(); });
    window.addEventListener('resize', syncBookHeight);
    document.fonts.ready.then(syncBookHeight);

    function bindBackToLibrary() {
      const backBtns = [
        byId('back-to-library-btn'),
        byId('notebook-back-btn'),
        ...document.querySelectorAll('.back-lib-btn, .back-to-library-btn')
      ].filter(Boolean);
      backBtns.forEach(btn => {
        btn.onclick = () => {
          cancelPageTurn();
          if (typeof showView === 'function') {
            showView('library');
          }
        };
      });
    }
    bindBackToLibrary();

    function shuffle(items, avoidOriginal = false) {
      const output = [...items];
      for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
      if (avoidOriginal && output.length > 1 && output.every((item, index) => item === items[index])) output.push(output.shift());
      return output;
    }
    function updateLessonProgress() {
      const activeLesson = getActiveLesson();
      if (!activeLesson) return;
      let practicePercent = 0, applyPercent = 0, overallPercent = 0;
      if (!questions.length) {
        lessonProgress.textContent = 'This lesson contains theory only.';
      } else {
        const practiceQuestions = questions.filter(q => (q.data.tier || 'practice') === 'practice');
        const applyQuestions = questions.filter(q => q.data.tier === 'apply');
        const checked = questions.filter(question => question.checked).length;
        if (checked === questions.length) {
          const correct = questions.filter(question => question.isCorrect).length;
          const unanswered = questions.filter(question => question.isUnanswered).length;
          overallPercent = Math.round(correct / questions.length * 100);

          const practiceCorrect = practiceQuestions.filter(q => q.isCorrect).length;
          const practiceTotal = practiceQuestions.length;
          practicePercent = practiceTotal > 0 ? Math.round(practiceCorrect / practiceTotal * 100) : overallPercent;

          const applyCorrect = applyQuestions.filter(q => q.isCorrect).length;
          const applyTotal = applyQuestions.length;
          applyPercent = applyTotal > 0 ? Math.round(applyCorrect / applyTotal * 100) : 0;

          lessonProgress.textContent = `${unanswered ? 'Attempt checked' : 'Lesson complete'} · Practice: ${practicePercent}% · Apply: ${applyPercent}% · ${correct}/${questions.length} questions correct.${unanswered ? ` ${unanswered} unanswered.` : ''}`;
        } else {
          const status = ProgressManager.getLessonStatus(activeLesson.id);
          practicePercent = status && typeof status.practiceScore === 'number'
            ? Math.max(0, Math.min(100, Math.round(status.practiceScore)))
            : (status ? Math.max(0, Math.min(100, Math.round(status.displayedScore))) : 0);
          applyPercent = status && typeof status.applyScore === 'number'
            ? Math.max(0, Math.min(100, Math.round(status.applyScore)))
            : 0;
          overallPercent = status ? Math.max(0, Math.min(100, Math.round(status.displayedScore))) : 0;
          lessonProgress.textContent = status ? `Last attempt: Practice ${practicePercent}%, Apply ${applyPercent}%.` : `Total: ${questions.length} questions.`;
        }
      }

      // Sync Practice Bar
      const practiceColor = getProgressColor(practicePercent);
      const practiceColorClass = getProgressColorClass(practicePercent);
      const practicePastelColor = getPastelProgressColor(practicePercent);
      book.querySelectorAll('.completion-percent-number.practice-percent').forEach(el => {
        el.textContent = `${practicePercent}%`;
        el.style.color = practiceColor;
        el.className = `completion-percent-number practice-percent ${practiceColorClass}`;
      });
      book.querySelectorAll('.notebook-progress-track.practice-track').forEach(track => {
        track.setAttribute('aria-valuenow', practicePercent);
        track.setAttribute('aria-label', `Tiến độ Practice: ${practicePercent}%`);
      });
      book.querySelectorAll('.notebook-progress-fill.practice-fill').forEach(fill => {
        fill.style.width = `${practicePercent}%`;
        fill.style.backgroundColor = practicePastelColor;
        fill.className = `notebook-progress-fill practice-fill ${practiceColorClass}`;
      });

      // Sync Apply Bar
      const applyColor = getApplyProgressColor(applyPercent);
      const applyColorClass = getApplyProgressColorClass(applyPercent);
      const applyPastelColor = getPastelApplyProgressColor(applyPercent);
      book.querySelectorAll('.completion-percent-number.apply-percent').forEach(el => {
        el.textContent = `${applyPercent}%`;
        el.style.color = applyColor;
        el.className = `completion-percent-number apply-percent ${applyColorClass}`;
      });
      book.querySelectorAll('.notebook-progress-track.apply-track').forEach(track => {
        track.setAttribute('aria-valuenow', applyPercent);
        track.setAttribute('aria-label', `Tiến độ Apply: ${applyPercent}%`);
      });
      book.querySelectorAll('.notebook-progress-fill.apply-fill').forEach(fill => {
        fill.style.width = `${applyPercent}%`;
        fill.style.backgroundColor = applyPastelColor;
        fill.className = `notebook-progress-fill apply-fill ${applyColorClass}`;
      });
    }
    function clearQuestionFeedback(record) {
      record.card.classList.remove('is-correct', 'is-incorrect', 'is-unanswered');
      record.hints.hidden = true; record.success.hidden = true; record.unansweredMessage.hidden = true;
      record.hints.querySelectorAll('li').forEach(hint => { hint.hidden = true; });
      if (record.hint) record.hint.hidden = true;
      record.inputs.forEach(input => {
        input.classList.remove('correct', 'incorrect', 'unanswered');
        input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
      });
      record.control?.removeAttribute('aria-invalid'); record.control?.removeAttribute('aria-describedby');
      if (record.chips) {
        record.chips.forEach(chip => {
          chip.classList.remove('chip-correct', 'chip-incorrect');
        });
      }
      if (record.unscrambleNote) {
        record.unscrambleNote.hidden = true;
        record.unscrambleNote.textContent = '';
      }
      if (record.inlineFeedback) {
        record.inlineFeedback.hidden = true;
        record.inlineFeedback.textContent = '';
      }
    }
    function invalidateQuestion(record) {
      const wasChecked = record.checked;
      record.checked = false; record.isCorrect = null; record.isUnanswered = null;
      clearQuestionFeedback(record);
      if (wasChecked) { record.part.result.textContent = ''; updateLessonProgress(); }
    }
    function makeHint(record, text, id) {
      const hint = document.createElement('li'); hint.id = id; hint.hidden = true; hint.textContent = `💡 Gợi ý / Giải thích: ${text}`; record.hints.append(hint); return hint;
    }
    function renderQuestion(data, part, index) {
      const prefix = `p${part.index + 1}-q${index + 1}`;
      const questionNumber = questions.length + 1;
      const card = document.createElement('li'); card.className = `exercise exercise-${data.type}`;
      const number = document.createElement('span'); number.className = 'question-number'; number.textContent = String(questionNumber); number.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div'); body.className = 'question';
      const prompt = document.createElement('div'); prompt.id = prefix + '-prompt'; prompt.className = 'question-text'; prompt.innerHTML = data.questionHTML;
      const hints = document.createElement('ul'); hints.className = 'feedback-list'; hints.hidden = true; hints.lang = 'vi'; hints.setAttribute('aria-live', 'polite');
      const success = document.createElement('p'); success.className = 'success-message'; success.textContent = '✔ Chính xác!'; success.lang = 'vi'; success.hidden = true;
      const unansweredMessage = document.createElement('p'); unansweredMessage.id = prefix + '-unanswered'; unansweredMessage.className = 'unanswered-message'; unansweredMessage.lang = 'vi'; unansweredMessage.textContent = 'Vui lòng hoàn thành câu này'; unansweredMessage.hidden = true;
      const record = { data, part, card, hints, success, unansweredMessage, checked: false, isCorrect: null, isUnanswered: null, inputs: [] };
      card.dataset.tier = data.tier || 'practice';
      if (data.type !== 'unscramble') {
        body.append(prompt);
      }
      if (data.type === 'gap-fill' || data.type === 'paragraph-gap-fill') {
        record.inputs = [...prompt.querySelectorAll('.gap-input')];
        record.inputs.forEach((input, gapIndex) => {
          input.id = prefix + '-gap-' + (gapIndex + 1); input.autocomplete = 'off'; input.spellcheck = false; input.removeAttribute('placeholder'); input.placeholder = '';
          input.setAttribute('aria-label', `Part ${part.index + 1}, question ${questionNumber}, gap ${gapIndex + 1}`);
          const answers = (input.dataset.answer || '').split('|').map(a => a.trim()).filter(Boolean);
          const maxLen = answers.reduce((max, a) => Math.max(max, Array.from(a).length), 0);
          input.style.setProperty('--gap-width', `${Math.max(10, Math.min(maxLen + 4, 30))}ch`);
          const hint = makeHint(record, (record.inputs.length > 1 ? `Gap ${gapIndex + 1}: ` : '') + (data.feedback[gapIndex] || 'Review the lesson and try again.'), input.id + '-feedback');
          input.dataset.feedbackId = hint.id;
          input.addEventListener('input', () => { invalidateQuestion(record); });
        });
      } else if (data.type === 'multiple-choice') {
        const options = document.createElement('div');
        options.className = 'mc-options mcq-options-container';
        options.setAttribute('role', 'radiogroup');
        options.setAttribute('aria-labelledby', prompt.id);
        record.control = options;
        record.hint = makeHint(record, data.feedback, prefix + '-feedback');
        const name = `mc_${prefix}_${Math.random().toString(36).slice(2, 10)}`;

        // Content-aware layout classification: short words -> inline, phrases -> 2x2, sentences -> stacked
        const maxLen = Math.max(...data.options.map(text => (text || '').trim().length));
        if (maxLen > 35) {
          options.classList.add('layout-stacked');
        } else if (maxLen > 14) {
          options.classList.add('layout-2col');
        } else {
          options.classList.add('layout-inline');
        }

        shuffle(data.options).forEach((text, optionIndex) => {
          const label = document.createElement('label'); label.className = 'option-label mcq-label';
          const input = document.createElement('input'); input.type = 'radio'; input.name = name; input.className = 'radio-input mcq-radio'; input.value = text; input.id = prefix + '-option-' + optionIndex;
          const letterChar = (optionIndex < 26 ? String.fromCharCode(65 + optionIndex) : optionIndex + 1);
          const letter = document.createElement('span'); letter.className = 'option-letter mcq-letter color-' + (optionIndex % 4); letter.textContent = `${letterChar}.`; letter.setAttribute('aria-hidden', 'true');
          const caption = document.createElement('span'); caption.className = 'option-caption mcq-text'; caption.textContent = text;
          label.append(input, letter, caption); options.append(label); record.inputs.push(input);
          input.addEventListener('change', () => {
            record.inputs.forEach(radio => {
              radio.parentElement.classList.toggle('is-selected', radio.checked);
              radio.parentElement.classList.toggle('selected', radio.checked);
            });
            invalidateQuestion(record);
          });
        });
        body.append(options);
      } else {
        const headerRow = document.createElement('div');
        headerRow.className = 'unscramble-header-row';
        const questionTitle = document.createElement('span');
        questionTitle.className = 'question-title';
        questionTitle.textContent = 'Sắp xếp thành câu đúng:';
        const inlineFeedback = document.createElement('span');
        inlineFeedback.className = 'inline-feedback';
        inlineFeedback.setAttribute('role', 'status');
        inlineFeedback.setAttribute('aria-live', 'polite');
        inlineFeedback.hidden = true;
        headerRow.append(questionTitle, inlineFeedback);
        record.inlineFeedback = inlineFeedback;

        const zone = document.createElement('div'); zone.className = 'drop-zone'; zone.setAttribute('role', 'group'); zone.setAttribute('aria-label', `Your sentence for part ${part.index + 1}, question ${questionNumber}`);
        const bank = document.createElement('div'); bank.className = 'word-bank'; bank.setAttribute('role', 'group'); bank.setAttribute('aria-label', `Word bank for part ${part.index + 1}, question ${questionNumber}`);
        const announcement = document.createElement('span'); announcement.className = 'sr-only'; announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite');
        record.control = zone; record.zone = zone; record.bank = bank; record.announcement = announcement; record.chips = []; record.hint = makeHint(record, data.feedback, prefix + '-feedback');

        // Drag-and-drop support on zone
        zone.addEventListener('dragover', event => {
          event.preventDefault();
          zone.classList.add('drag-hover');
        });
        zone.addEventListener('dragleave', event => {
          if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
          zone.classList.remove('drag-hover');
        });
        zone.addEventListener('drop', event => {
          event.preventDefault();
          zone.classList.remove('drag-hover');
          const tokenId = event.dataTransfer.getData('text/plain');
          const dragged = record.chips.find(c => c.dataset.tokenId === tokenId);
          if (!dragged) return;
          zone.append(dragged);
          dragged.setAttribute('aria-pressed', 'true');
          dragged.setAttribute('aria-label', `${dragged.dataset.word}. Return to word bank`);
          invalidateQuestion(record);
          previewQuestion(record);
        });

        // Drag-and-drop support on bank
        bank.addEventListener('dragover', event => {
          event.preventDefault();
          bank.classList.add('drag-hover');
        });
        bank.addEventListener('dragleave', event => {
          if (event.relatedTarget && bank.contains(event.relatedTarget)) return;
          bank.classList.remove('drag-hover');
        });
        bank.addEventListener('drop', event => {
          event.preventDefault();
          bank.classList.remove('drag-hover');
          const tokenId = event.dataTransfer.getData('text/plain');
          const dragged = record.chips.find(c => c.dataset.tokenId === tokenId);
          if (!dragged) return;
          bank.append(dragged);
          dragged.setAttribute('aria-pressed', 'false');
          dragged.setAttribute('aria-label', `${dragged.dataset.word}. Add to sentence`);
          invalidateQuestion(record);
          previewQuestion(record);
        });

        shuffle(data.words.map((word, tokenIndex) => ({ word, tokenIndex })), true).forEach(token => {
          const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'unscramble-chip'; chip.textContent = token.word; chip.dataset.word = token.word; chip.dataset.tokenId = prefix + '-' + token.tokenIndex;
          chip.draggable = true;
          chip.setAttribute('aria-pressed', 'false'); chip.setAttribute('aria-label', `${token.word}. Add to sentence`);

          // Organic rotation for physical paper scrap look
          const scrapRotations = [-1.5, 1.3, -0.9, 1.7, -1.4, 0.8, -1.6, 1.5, -0.7, 1.2];
          const rot = scrapRotations[token.tokenIndex % scrapRotations.length];
          chip.style.setProperty('--chip-rot', `${rot}deg`);

          chip.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/plain', chip.dataset.tokenId);
            chip.classList.add('is-dragging');
          });
          chip.addEventListener('dragend', () => {
            chip.classList.remove('is-dragging');
            record.chips.forEach(c => c.classList.remove('drag-over-chip'));
            zone.classList.remove('drag-hover');
            bank.classList.remove('drag-hover');
          });
          chip.addEventListener('dragover', event => {
            event.preventDefault();
            event.stopPropagation();
            chip.classList.add('drag-over-chip');
          });
          chip.addEventListener('dragleave', () => {
            chip.classList.remove('drag-over-chip');
          });
          chip.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();
            chip.classList.remove('drag-over-chip');
            const tokenId = event.dataTransfer.getData('text/plain');
            const dragged = record.chips.find(c => c.dataset.tokenId === tokenId);
            if (!dragged || dragged === chip) return;

            const targetParent = chip.parentElement;
            if (targetParent) {
              targetParent.insertBefore(dragged, chip);
              const inZone = targetParent === zone;
              dragged.setAttribute('aria-pressed', String(inZone));
              dragged.setAttribute('aria-label', `${dragged.dataset.word}. ${inZone ? 'Return to word bank' : 'Add to sentence'}`);
              invalidateQuestion(record);
              previewQuestion(record);
            }
          });

          chip.addEventListener('click', () => {
            const add = chip.parentElement === bank; (add ? zone : bank).append(chip);
            chip.setAttribute('aria-pressed', String(add)); chip.setAttribute('aria-label', `${token.word}. ${add ? 'Return to word bank' : 'Add to sentence'}`);
            invalidateQuestion(record); announcement.textContent = `${token.word} ${add ? 'added to your sentence' : 'returned to the word bank'}.`; chip.focus({ preventScroll: true });
          });
          record.chips.push(chip); bank.append(chip);
        });
        body.append(headerRow, zone, bank, announcement);
      }
      card.append(number, body, hints, unansweredMessage, success); part.list.append(card); part.questions.push(record); questions.push(record);
    }
    const normalizeAnswer = value => value.normalize('NFC').trim().toLowerCase();
    function checkQuestion(record, preview = false) {
      // Clear the previous feedback before evaluating
      clearQuestionFeedback(record);

      const type = record.data.type;

      // 1. Determine if the question has been attempted
      let isAttempted = false;
      if (type === 'gap-fill' || type === 'paragraph-gap-fill') {
        isAttempted = record.inputs.some(input => input.value.trim() !== '');
      } else if (type === 'multiple-choice') {
        isAttempted = record.inputs.some(input => input.checked);
      } else if (type === 'unscramble') {
        const placedChips = record.zone ? record.zone.querySelectorAll('.unscramble-chip') : [];
        isAttempted = placedChips.length > 0;
      }

      // If NOT attempted: SKIP evaluation completely and enforce neutral state
      if (!isAttempted) {
        record.checked = !preview;
        record.isCorrect = false;
        record.isUnanswered = true;
        return;
      }

      // 2. Question was attempted: Evaluate according to question type
      record.checked = !preview;

      if (type === 'gap-fill' || type === 'paragraph-gap-fill') {
        let anyWrong = false;
        let anyEmpty = false;

        record.inputs.forEach(input => {
          const val = input.value.trim();
          const hint = byId(input.dataset.feedbackId);

          if (val === '') {
            // Unanswered gap within an attempted question:
            // Skip evaluation for this input, remove UI states, and hide hints
            input.classList.remove('correct', 'incorrect', 'unanswered');
            input.removeAttribute('aria-invalid');
            input.removeAttribute('aria-describedby');
            if (hint) hint.hidden = true;
            anyEmpty = true;
          } else {
            // Attempted gap: evaluate answer
            const validAnswers = (input.dataset.answer || '').split('|').map(a => normalizeAnswer(a)).filter(Boolean);
            const userVal = normalizeAnswer(val);
            const right = validAnswers.includes(userVal);

            input.classList.toggle('correct', right);
            input.classList.toggle('incorrect', !right);
            input.classList.remove('unanswered');
            input.setAttribute('aria-invalid', String(!right));

            if (hint) hint.hidden = right;
            if (right) {
              input.removeAttribute('aria-describedby');
            } else {
              anyWrong = true;
              if (hint) input.setAttribute('aria-describedby', hint.id);
            }
          }
        });

        const correct = !anyEmpty && !anyWrong;
        record.isCorrect = correct;
        record.isUnanswered = anyEmpty;

        record.card.classList.toggle('is-correct', correct);
        record.card.classList.toggle('is-incorrect', anyWrong);
        record.card.classList.remove('is-unanswered');

        if (correct) {
          record.success.hidden = false;
          record.hints.hidden = true;
        } else if (anyWrong) {
          record.success.hidden = true;
          record.hints.hidden = false;
        } else {
          // Gaps partially filled, none wrong so far
          record.success.hidden = true;
          record.hints.hidden = true;
        }

      } else if (type === 'multiple-choice') {
        const selectedInput = record.inputs.find(input => input.checked);
        const correct = Boolean(selectedInput && selectedInput.value === record.data.answer);
        record.isCorrect = correct;
        record.isUnanswered = false;

        record.card.classList.toggle('is-correct', correct);
        record.card.classList.toggle('is-incorrect', !correct);
        record.card.classList.remove('is-unanswered');

        record.hint.hidden = correct;
        record.hints.hidden = correct;
        record.success.hidden = !correct;

        record.control.setAttribute('aria-invalid', String(!correct));
        if (correct) {
          record.control.removeAttribute('aria-describedby');
        } else {
          record.control.setAttribute('aria-describedby', record.hint.id);
        }

      } else if (type === 'unscramble') {
        const placedChips = record.zone ? [...record.zone.querySelectorAll('.unscramble-chip')] : [];
        const correctWords = record.data.words;
        let misplacedCount = 0;

        if (!preview) {
          placedChips.forEach((chip, i) => {
            const isWordCorrect = chip.dataset.word === correctWords[i];
            if (isWordCorrect) {
              chip.classList.add('chip-correct');
              chip.classList.remove('chip-incorrect');
              chip.setAttribute('aria-label', `${chip.dataset.word}. Vị trí đúng (từ số ${i + 1})`);
            } else {
              chip.classList.add('chip-incorrect');
              chip.classList.remove('chip-correct');
              chip.setAttribute('aria-label', `${chip.dataset.word}. Vị trí chưa đúng (từ số ${i + 1})`);
              misplacedCount++;
            }
          });

          const allPlaced = placedChips.length === correctWords.length;

          if (record.unscrambleNote) {
            if (misplacedCount > 0) {
              record.unscrambleNote.textContent = `⚠️ Có ${misplacedCount} từ chưa đúng vị trí (${placedChips.length - misplacedCount}/${correctWords.length} từ đúng). Nhấp hoặc kéo từ màu đỏ để sắp xếp lại.`;
              record.unscrambleNote.hidden = false;
            } else if (!allPlaced) {
              record.unscrambleNote.textContent = `⚠️ Chưa xếp đủ từ (${placedChips.length}/${correctWords.length} từ).`;
              record.unscrambleNote.hidden = false;
            } else {
              record.unscrambleNote.hidden = true;
              record.unscrambleNote.textContent = '';
            }
          }

          const correct = allPlaced && misplacedCount === 0;

          if (record.inlineFeedback) {
            if (correct) {
              record.inlineFeedback.textContent = '✓ Chính xác!';
              record.inlineFeedback.className = 'inline-feedback feedback-correct';
              record.inlineFeedback.hidden = false;
            } else {
              record.inlineFeedback.textContent = '✗ Sai';
              record.inlineFeedback.className = 'inline-feedback feedback-incorrect';
              record.inlineFeedback.hidden = false;
            }
          }

          record.isCorrect = correct;
          record.isUnanswered = !allPlaced;

          record.card.classList.toggle('is-correct', correct);
          record.card.classList.toggle('is-incorrect', !correct);
          record.card.classList.remove('is-unanswered');

          record.hint.hidden = correct;
          record.hints.hidden = true;
          record.success.hidden = true;
          record.unansweredMessage.hidden = true;

          record.control.setAttribute('aria-invalid', String(!correct));
          if (correct) {
            record.control.removeAttribute('aria-describedby');
          } else {
            record.control.setAttribute('aria-describedby', record.hint.id);
          }
        }
      }
    }
    function previewQuestion(record) {
      // Real-time validation disabled: inputs remain neutral until Check button is clicked
      syncBookHeight();
    }
    function checkPart(part) {
      part.questions.forEach(record => checkQuestion(record));
      const correctCount = part.questions.filter(record => record.isCorrect).length;
      const unansweredCount = part.questions.filter(record => record.isUnanswered).length;
      part.result.textContent = `${correctCount} of ${part.questions.length} questions correct. ${unansweredCount ? `${unansweredCount} unanswered. Complete these questions and check again.` : correctCount === part.questions.length ? 'Beautiful work!' : 'Read the hints and try again.'}`;
    }
    function checkAllAnswers() {
      if (!questions.length || turnState) return;
      // Grade every practice page, including pages the student left unanswered.
      practiceParts.forEach(checkPart);
      const correct = questions.filter(question => question.isCorrect).length, total = questions.length;
      const activeLesson = getActiveLesson();

      // Separate scores for Practice vs Apply tiers
      const practiceQuestions = questions.filter(q => (q.data.tier || 'practice') === 'practice');
      const applyQuestions = questions.filter(q => q.data.tier === 'apply');

      const practiceCorrect = practiceQuestions.filter(q => q.isCorrect).length;
      const practiceTotal = practiceQuestions.length;
      const practiceScore = practiceTotal > 0 ? Math.round(practiceCorrect / practiceTotal * 100) : (total > 0 ? Math.round(correct / total * 100) : 0);

      const applyCorrect = applyQuestions.filter(q => q.isCorrect).length;
      const applyTotal = applyQuestions.length;
      const applyScore = applyTotal > 0 ? Math.round(applyCorrect / applyTotal * 100) : 0;

      const calculatedScore = total > 0 ? Math.round(correct / total * 100) : 0;
      if (activeLesson?.id) {
        ProgressManager.recordLessonCompletion(activeLesson.id, calculatedScore, {
          correctCount: correct,
          totalQuestions: total,
          practiceScore,
          applyScore,
          practiceCorrect,
          practiceTotal,
          applyCorrect,
          applyTotal
        });
        commitLesson(activeLesson.id, createScoreRecord(correct, total));
        renderLibrary();
      }
      updateLessonProgress(); syncBookHeight();
      lessonProgress.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    function clearPart(part) {
      part.form.reset();
      part.questions.forEach(record => {
        invalidateQuestion(record);
        record.inputs.forEach(input => { input.classList.remove('correct', 'incorrect'); input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); input.closest('.option-label, .mcq-label')?.classList.remove('is-selected', 'selected'); });
        record.hints.querySelectorAll('li').forEach(hint => { hint.hidden = true; });
        if (record.chips) { record.chips.forEach(chip => { record.bank.append(chip); chip.setAttribute('aria-pressed', 'false'); chip.setAttribute('aria-label', `${chip.dataset.word}. Add to sentence`); chip.classList.remove('chip-correct', 'chip-incorrect'); }); record.announcement.textContent = ''; }
        if (record.unscrambleNote) { record.unscrambleNote.hidden = true; record.unscrambleNote.textContent = ''; }
      });
      part.result.textContent = ''; updateLessonProgress(); syncBookHeight(); part.list.querySelector('input, button')?.focus();
    }

    function createPage(lesson, part, partIndex, kind) {
      const index = pages.length, element = document.createElement('article'); element.className = 'page book-page'; element.inert = true; element.setAttribute('aria-hidden', 'true'); element.dataset.part = String(partIndex); element.dataset.kind = kind;
      const face = document.createElement('div'); face.className = 'notebook page-face';
      const body = document.createElement('div'); body.className = 'page-body';
      const ribbon = document.createElement('div'); ribbon.className = 'page-ribbon ' + (kind === 'theory' ? 'lesson-ribbon' : 'practice-ribbon'); ribbon.lang = 'en'; ribbon.textContent = kind === 'theory' ? 'Lesson' : 'Practice';
      const heading = document.createElement(index === 0 ? 'h1' : 'h2'); heading.id = `page-${index + 1}-title`; heading.tabIndex = -1;
      if (index === 0) {
        // 1. Top row: Library return button + Dual Stacked Progress Bars (Practice & Apply)
        const topNav = document.createElement('div');
        topNav.className = 'notebook-page-top';
        const libBtn = document.createElement('button');
        libBtn.type = 'button';
        libBtn.className = 'notebook-lib-btn';
        libBtn.id = 'notebook-lib-btn';
        libBtn.textContent = '← Thư viện';
        libBtn.setAttribute('aria-label', 'Quay lại Thư viện');
        libBtn.addEventListener('click', (e) => {
          e.preventDefault();
          cancelPageTurn();
          if (typeof showView === 'function') {
            showView('library');
          }
        });

        const status = ProgressManager.getLessonStatus(lesson.id);
        const practicePercent = status && typeof status.practiceScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(status.practiceScore)))
          : (status ? Math.max(0, Math.min(100, Math.round(status.displayedScore))) : 0);
        const applyPercent = status && typeof status.applyScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(status.applyScore)))
          : 0;

        const practiceColor = getProgressColor(practicePercent);
        const practiceColorClass = getProgressColorClass(practicePercent);
        const practicePastelColor = getPastelProgressColor(practicePercent);
        const applyColor = getApplyProgressColor(applyPercent);
        const applyColorClass = getApplyProgressColorClass(applyPercent);
        const applyPastelColor = getPastelApplyProgressColor(applyPercent);

        const progressContainer = document.createElement('div');
        progressContainer.className = 'notebook-header-progress dual-progress';

        // Practice Row
        const practiceRow = document.createElement('div');
        practiceRow.className = 'notebook-tier-row practice-tier-row';
        practiceRow.innerHTML = `
          <div class="notebook-progress-info">
            <span class="notebook-progress-label">Practice:</span>
            <strong class="completion-percent-number practice-percent ${practiceColorClass}" style="color: ${practiceColor};">${practicePercent}%</strong>
          </div>
          <div class="notebook-progress-track practice-track" role="progressbar" aria-valuenow="${practicePercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ Practice: ${practicePercent}%">
            <div class="notebook-progress-fill practice-fill ${practiceColorClass}" style="width: ${practicePercent}%; background-color: ${practicePastelColor};"></div>
          </div>
        `;

        // Apply Row
        const applyRow = document.createElement('div');
        applyRow.className = 'notebook-tier-row apply-tier-row';
        applyRow.innerHTML = `
          <div class="notebook-progress-info">
            <span class="notebook-progress-label tier-apply-label">Apply:</span>
            <strong class="completion-percent-number apply-percent ${applyColorClass}" style="color: ${applyColor};">${applyPercent}%</strong>
          </div>
          <div class="notebook-progress-track apply-track" role="progressbar" aria-valuenow="${applyPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ Apply: ${applyPercent}%">
            <div class="notebook-progress-fill apply-fill ${applyColorClass}" style="width: ${applyPercent}%; background-color: ${applyPastelColor};"></div>
          </div>
        `;

        progressContainer.append(practiceRow, applyRow);
        topNav.append(libBtn, progressContainer);

        heading.className = 'notebook-title'; heading.textContent = lesson.title;
        const header = document.createElement('header'); header.className = 'page-header';
        const partTitle = document.createElement('p'); partTitle.className = 'page-part'; partTitle.textContent = `Part ${partIndex + 1} / ${lesson.parts.length} · ${part.title}`;
        header.append(topNav, heading, partTitle); body.append(header);
      } else {
        // Page > 1: Subsequent pages keep the top area clean and uncluttered with only the Library button
        element.classList.add('page-continued');
        const topNav = document.createElement('div');
        topNav.className = 'notebook-page-top compact';
        const libBtn = document.createElement('button');
        libBtn.type = 'button';
        libBtn.className = 'notebook-lib-btn compact';
        libBtn.textContent = '← Thư viện';
        libBtn.setAttribute('aria-label', 'Quay lại Thư viện');
        libBtn.addEventListener('click', (e) => {
          e.preventDefault();
          cancelPageTurn();
          if (typeof showView === 'function') {
            showView('library');
          }
        });

        topNav.append(libBtn);
        body.append(topNav);

        heading.className = 'sr-only page-focus';
        heading.textContent = `${kind === 'theory' ? 'Lesson' : 'Practice'}, part ${partIndex + 1}, page ${index + 1}`;
        body.append(heading);
      }
      face.append(ribbon, body); element.setAttribute('aria-labelledby', heading.id);
      if (kind === 'theory') {
        const content = document.createElement('div'); content.className = 'lesson-content'; content.innerHTML = part.lessonHTML; body.append(content);
      } else {
        const intro = document.createElement('p'); intro.className = 'practice-intro'; intro.textContent = 'Fill the gaps, choose an answer, and put the words in order.';
        const form = document.createElement('form'); form.noValidate = true; form.setAttribute('aria-label', `Practice for part ${partIndex + 1}`);
        const list = document.createElement('ol'); list.className = 'exercises';
        const result = document.createElement('p'); result.className = 'result sr-only'; result.setAttribute('role', 'status'); result.setAttribute('aria-live', 'polite'); result.setAttribute('aria-atomic', 'true');
        const record = { index: partIndex, form, list, result, questions: [] }; practiceParts.push(record);
        let lastTier = null;
        part.exercises.forEach((exercise, questionIndex) => {
          const tier = exercise.tier === 'apply' ? 'apply' : 'practice';
          if (tier !== lastTier) {
            const tierHeading = document.createElement('li');
            tierHeading.className = `exercise-tier-divider tier-${tier}`;
            tierHeading.setAttribute('aria-hidden', 'true');
            if (tier === 'practice') {
              tierHeading.innerHTML = `<span class="tier-badge badge-practice">Practice</span> <h3 class="tier-title"><span class="tier-highlight">Phần 1: Practice - Vận dụng</span></h3>`;
            } else {
              tierHeading.innerHTML = `<span class="tier-badge badge-apply">Apply</span> <h3 class="tier-title"><span class="tier-highlight">Phần 2: Apply - Nâng cao</span></h3>`;
            }
            list.append(tierHeading);
            lastTier = tier;
          }
          renderQuestion(exercise, record, questionIndex);
        });
        form.append(list, result); body.append(intro, form);
        form.addEventListener('submit', event => event.preventDefault());
      }
      const footer = document.createElement('footer');
      footer.className = 'page-footer';

      const numberIndicator = document.createElement('div');
      numberIndicator.className = 'page-number-indicator';
      const number = document.createElement('span');
      number.className = 'page-number';
      numberIndicator.append(number);

      const navBar = document.createElement('div');
      navBar.className = 'page-nav-bar';

      // 1. Quay lại (Prev Page)
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.className = 'page-button previous-page nav-btn prev';
      previous.innerHTML = '<span class="icon" aria-hidden="true">&lt;-</span> <span class="btn-text">Quay lại</span>';
      previous.setAttribute('aria-label', 'Quay lại');
      previous.addEventListener('click', () => turnPage(-1));

      // 2. Clear đáp án (Clear Answers)
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'page-button clear-page-button nav-btn clear';
      clearBtn.innerHTML = '<span class="icon" aria-hidden="true">✕</span> <span class="btn-text">Clear đáp án</span>';
      clearBtn.setAttribute('aria-label', 'Clear đáp án');
      if (kind === 'theory') {
        clearBtn.classList.add('is-hidden');
        clearBtn.style.display = 'none';
        clearBtn.disabled = true;
        clearBtn.setAttribute('aria-hidden', 'true');
        clearBtn.tabIndex = -1;
      } else {
        clearBtn.addEventListener('click', () => {
          const targetPart = practiceParts.find(p => p.index === partIndex);
          if (targetPart) clearPart(targetPart);
        });
      }

      // 3. Check đáp án (Check Answers)
      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'check-button final-check-button nav-btn check';
      check.innerHTML = '<span class="icon" aria-hidden="true">✓</span> <span class="btn-text">Check đáp án</span>';
      check.setAttribute('aria-label', 'Check đáp án');
      check.addEventListener('click', checkAllAnswers);
      if (kind === 'theory') {
        check.classList.add('is-hidden');
        check.style.display = 'none';
        check.disabled = true;
        check.setAttribute('aria-hidden', 'true');
        check.tabIndex = -1;
      }

      // 4. Trang tiếp (Next Page)
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'page-button next-page nav-btn next';
      next.innerHTML = '<span class="btn-text">Trang tiếp</span> <span class="icon" aria-hidden="true">-&gt;</span>';
      next.setAttribute('aria-label', 'Trang tiếp');
      next.addEventListener('click', () => turnPage(1));

      navBar.append(previous, clearBtn, check, next);
      footer.append(numberIndicator, navBar);
      face.append(footer);
      element.append(face);
      book.append(element);
      pages.push({ element, face, body, heading, previous, clear: clearBtn, check, forward: next, number, kind });
      // Content and footer can resize while the outer sheet stays at 100% height.
      pageObserver.observe(body);
      pageObserver.observe(footer);
    }
    function renderLesson(data) {
      bindBackToLibrary();
      setActiveLesson(data);
      cancelPageTurn(); pageObserver.disconnect(); book.replaceChildren(); pages = []; questions = []; practiceParts = []; currentPage = 0;
      data.parts.forEach((part, index) => { if (part.lessonHTML) createPage(data, part, index, 'theory'); if (part.exercises.length) createPage(data, part, index, 'practice'); });
      const topZIndex = Math.max(100, pages.length);
      pages.forEach((page, index) => {
        page.element.style.zIndex = String(topZIndex - index);
        page.number.textContent = `${index + 1} / ${pages.length}`;

        // Behavior on FIRST page: visually hide previous button while maintaining center alignment
        if (index === 0) {
          page.previous.classList.add('is-hidden');
          page.previous.disabled = true;
          page.previous.setAttribute('aria-hidden', 'true');
          page.previous.tabIndex = -1;
        } else {
          page.previous.classList.remove('is-hidden');
          page.previous.disabled = false;
          page.previous.removeAttribute('aria-hidden');
          page.previous.tabIndex = 0;
        }

        // Behavior on LAST page: change right-hand button into "Quay lại trang đầu ↺"
        if (index === pages.length - 1) {
          page.forward.innerHTML = '<span class="icon" aria-hidden="true">↺</span> <span class="btn-text">Quay lại trang đầu</span>';
          page.forward.className = 'page-button restart-page nav-btn restart';
          page.forward.setAttribute('aria-label', 'Quay lại trang đầu');
          page.forward.onclick = () => goToFirstPage();
        }

        // Clear & Check answers buttons: only display on Exercise pages, hide on Theory pages
        const isTheory = page.kind === 'theory' || page.element.dataset.kind === 'theory';
        if (isTheory) {
          page.clear.classList.add('is-hidden');
          page.clear.style.display = 'none';
          page.clear.disabled = true;
          page.clear.setAttribute('aria-hidden', 'true');
          page.clear.tabIndex = -1;
          page.check.classList.add('is-hidden');
          page.check.style.display = 'none';
          page.check.disabled = true;
          page.check.setAttribute('aria-hidden', 'true');
          page.check.tabIndex = -1;
        } else {
          page.clear.classList.remove('is-hidden');
          page.clear.style.display = '';
          page.clear.removeAttribute('aria-hidden');
          page.clear.tabIndex = 0;
          page.clear.disabled = false;
          page.check.classList.remove('is-hidden');
          page.check.style.display = '';
          page.check.removeAttribute('aria-hidden');
          page.check.tabIndex = 0;
          if (questions.length) {
            page.check.disabled = false;
            page.check.title = 'Kiểm tra toàn bộ đáp án của bài học';
          } else {
            page.check.disabled = true;
            page.check.title = 'Bài học chỉ có lý thuyết';
            page.check.style.opacity = '0.4';
          }
        }
      });
      showView('notebook', { focus: false, refresh: false });
      updatePageState(); updateLessonProgress(); renderLibrary(); pages[0].heading.focus({ preventScroll: true });
    }

    return { renderLesson, syncBookHeight, updateLessonProgress, finishPageTurn, currentHeading: () => pages[currentPage]?.heading };
}
