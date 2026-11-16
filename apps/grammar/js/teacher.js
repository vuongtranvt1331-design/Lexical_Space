/**
 * GrammarSpace — Teacher Dashboard Logic
 * File: js/teacher.js
 * Domain: Teacher Admin only
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'grammarSpace_shared_lesson';

  // DOM Elements
  const titleInput = document.getElementById('titleInput');
  const lessonHTMLInput = document.getElementById('lessonHTMLInput');
  const exercisesContainer = document.getElementById('exercisesContainer');
  const btnAddExercise = document.getElementById('btnAddExercise');
  const btnDeploy = document.getElementById('btnDeploy');
  const toastMessage = document.getElementById('toastMessage');
  const btnCloseToast = document.getElementById('btnCloseToast');

  let toastTimer = null;

  /**
   * Display a success or info toast notification
   */
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    if (message) {
      const toastText = document.getElementById('toastText');
      if (toastText) toastText.textContent = message;
    }
    toastMessage.classList.add('show');
    toastMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    toastTimer = setTimeout(() => {
      toastMessage.classList.remove('show');
    }, 5500);
  }

  if (btnCloseToast) {
    btnCloseToast.addEventListener('click', () => {
      if (toastTimer) clearTimeout(toastTimer);
      toastMessage.classList.remove('show');
    });
  }

  /**
   * Escape HTML utility for safe attribute/content insertion
   */
  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeText(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Recalculate and update the numbered exercise headers
   */
  function updateExerciseIndexes() {
    const blocks = exercisesContainer.querySelectorAll('.exercise-block');
    blocks.forEach((block, idx) => {
      const label = block.querySelector('.exercise-index-label');
      if (label) {
        label.textContent = `Exercise #${idx + 1}`;
      }
    });
  }

  /**
   * Factory function to generate an Exercise Form Block
   * Required fields: type (default to "gap-fill"), questionHTML, feedback, Delete button
   */
  function createExerciseBlock(data = {}) {
    const block = document.createElement('div');
    block.className = 'exercise-block';

    const selectedType = data.type || 'gap-fill';
    const questionHTML = data.questionHTML || '';
    const feedback = data.feedback || '';

    block.innerHTML = `
      <div class="exercise-block-top">
        <span class="exercise-index">
          <span>🔹</span>
          <span class="exercise-index-label">Exercise</span>
        </span>
        <button type="button" class="btn btn-delete btn-remove-exercise" title="Remove this exercise">
          ✕ Delete
        </button>
      </div>

      <div class="form-group">
        <label class="admin-label">Type</label>
        <select class="ex-type-input">
          <option value="gap-fill" ${selectedType === 'gap-fill' ? 'selected' : ''}>gap-fill</option>
          <option value="multiple-choice" ${selectedType === 'multiple-choice' ? 'selected' : ''}>multiple-choice</option>
          <option value="word-reorder" ${selectedType === 'word-reorder' ? 'selected' : ''}>word-reorder</option>
        </select>
      </div>

      <div class="form-group">
        <label class="admin-label">Question HTML</label>
        <textarea class="ex-question-input code-area" rows="3" placeholder="e.g. She <input type='text' id='q1' class='gap-input' data-answer='has visited'> Paris twice.">${escapeText(questionHTML)}</textarea>
        <div class="field-hint">Insert <code>&lt;input class="gap-input" data-answer="..."&gt;</code> for gap fills.</div>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="admin-label">Feedback / Explanatory Hint</label>
        <input type="text" class="ex-feedback-input" value="${escapeAttr(feedback)}" placeholder="e.g., Use the Present Perfect tense because the timeframe is indefinite.">
      </div>
    `;

    // Delete event listener
    const deleteBtn = block.querySelector('.btn-remove-exercise');
    deleteBtn.addEventListener('click', () => {
      block.remove();
      updateExerciseIndexes();
    });

    return block;
  }

  /**
   * Add Exercise handler
   */
  btnAddExercise.addEventListener('click', () => {
    const block = createExerciseBlock();
    exercisesContainer.appendChild(block);
    updateExerciseIndexes();
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /**
   * The Save Engine: Scrapes form inputs and saves to localStorage
   * Schema:
   * {
   *   title: string,
   *   lessonHTML: string,
   *   exercises: [
   *     { type: string, questionHTML: string, feedback: string }
   *   ]
   * }
   */
  function deployToStudentApp() {
    const titleVal = titleInput.value.trim();
    const lessonHTMLVal = lessonHTMLInput.value;

    const exercises = [];
    const exerciseBlocks = exercisesContainer.querySelectorAll('.exercise-block');

    exerciseBlocks.forEach((block, index) => {
      const typeElem = block.querySelector('.ex-type-input');
      const questionElem = block.querySelector('.ex-question-input');
      const feedbackElem = block.querySelector('.ex-feedback-input');

      exercises.push({
        id: `ex${index + 1}`,
        type: typeElem ? typeElem.value : 'gap-fill',
        questionHTML: questionElem ? questionElem.value : '',
        feedback: feedbackElem ? feedbackElem.value.trim() : ''
      });
    });

    const payload = {
      title: titleVal,
      lessonHTML: lessonHTMLVal,
      exercises: exercises
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      showToast('Lesson successfully deployed to localStorage! Open the Student App to preview.');
    } catch (err) {
      console.error('Failed to save lesson data:', err);
      alert('Error saving to local storage: ' + err.message);
    }
  }

  btnDeploy.addEventListener('click', deployToStudentApp);

  /**
   * Form population from existing localStorage or fallback default data
   */
  function populateForm(data) {
    if (!data) return;

    if (data.title) titleInput.value = data.title;
    if (data.lessonHTML) lessonHTMLInput.value = data.lessonHTML;

    exercisesContainer.innerHTML = '';
    if (Array.isArray(data.exercises) && data.exercises.length > 0) {
      data.exercises.forEach((ex) => {
        exercisesContainer.appendChild(createExerciseBlock(ex));
      });
    } else {
      // Create at least one default exercise block
      exercisesContainer.appendChild(createExerciseBlock());
    }
    updateExerciseIndexes();
  }

  // Initialization: load existing shared lesson or initial template
  window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        populateForm(parsed);
        return;
      } catch (err) {
        console.warn('Could not parse cached lesson data:', err);
      }
    }

    // Default starter data
    populateForm({
      title: "Task 1: Describing Upward Trends",
      lessonHTML: "<p>When describing upward trends in IELTS Task 1, you can use a <strong>verb + adverb</strong> structure.</p> <p>Example: <em>'Between 2010 and 2020, sales <span class=\"grammar-highlight\">increased significantly</span>.'</em></p> <p>Alternatively, you can use an <strong>adjective + noun</strong> structure.</p> <p>Example: <em>'Between 2010 and 2020, there was a <span class=\"grammar-highlight\">significant increase</span> in sales.'</em></p>",
      exercises: [
        {
          type: "gap-fill",
          questionHTML: "The chart shows that the population <input type='text' id='q1' class='gap-input' data-answer='grew rapidly'> over the ten-year period.",
          feedback: "Use the verb 'grew' and the adverb 'rapidly'."
        },
        {
          type: "gap-fill",
          questionHTML: "There was a <input type='text' id='q2' class='gap-input' data-answer='dramatic rise'> in the number of users in 2025.",
          feedback: "Use the adjective 'dramatic' and the noun 'rise'."
        }
      ]
    });
  });
})();
