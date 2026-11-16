'use strict';

// Keep this binding available to the existing shared page's startup code.
// The student app only reads lesson storage; it never replaces saved lessons.
let currentLesson = { title: '', lessonHTML: '', exercises: [] };

(() => {
  const root = document.getElementById('student-app');
  if (!root) return;

  const get = id => root.querySelector('#' + id);
  const title = get('student-lesson-title');
  const content = get('student-lesson-content');
  const lessonView = get('student-lesson-view');
  const status = get('student-status');
  const exercises = get('student-exercises');
  const form = get('student-practice-form');
  const result = get('student-result');
  const checkButton = get('student-check');
  const resetButton = get('student-reset');
  let renderedExercises = [];

  function readStudentLesson() {
    const stored = localStorage.getItem('grammarSpace_shared_lesson');
    if (stored === null) return null;
    const lesson = JSON.parse(stored);
    if (!lesson || typeof lesson.title !== 'string' ||
        typeof lesson.lessonHTML !== 'string' || !Array.isArray(lesson.exercises) ||
        !lesson.exercises.every(exercise => exercise &&
          typeof exercise.type === 'string' &&
          typeof exercise.questionHTML === 'string' &&
          typeof exercise.feedback === 'string')) {
      throw new Error('The saved lesson does not match the expected format.');
    }
    return lesson;
  }

  // Preserve rich text and answer attributes without importing scripts, styles,
  // event handlers, or IDs that could affect the rest of the shared page.
  function lessonFragment(html, allowInputs = false) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SPAN',
      'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
      'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'CODE',
      'PRE', 'SMALL', 'SUP', 'SUB', 'HR', 'MARK']);
    const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG',
      'MATH', 'LINK', 'META', 'BASE', 'TEMPLATE']);

    function copyNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return document.createDocumentFragment();
      if (node.tagName === 'INPUT') {
        if (!allowInputs) return document.createDocumentFragment();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'gap-input';
        if (node.hasAttribute('data-answer')) input.dataset.answer = node.getAttribute('data-answer');
        return input;
      }
      const element = allowed.has(node.tagName)
        ? document.createElement(node.tagName.toLowerCase())
        : document.createDocumentFragment();
      if (element.nodeType === Node.ELEMENT_NODE) {
        if (node.classList.contains('grammar-highlight')) element.className = 'grammar-highlight';
        ['colspan', 'rowspan'].forEach(attribute => {
          const value = node.getAttribute(attribute);
          if (['TD', 'TH'].includes(node.tagName) && /^[1-9]\d?$/.test(value || '')) element.setAttribute(attribute, value);
        });
      }
      node.childNodes.forEach(child => element.append(copyNode(child)));
      return element;
    }
    const fragment = document.createDocumentFragment();
    template.content.childNodes.forEach(node => fragment.append(copyNode(node)));
    return fragment;
  }

  function updateProgress() {
    const inputs = renderedExercises.flatMap(exercise => exercise.inputs);
    const correct = inputs.filter(input => input.classList.contains('is-correct')).length;
    get('student-progress').max = inputs.length || 1;
    get('student-progress').value = correct;
    get('student-progress-text').textContent = `${correct} of ${inputs.length} answers correct`;
    checkButton.disabled = inputs.length === 0;
    resetButton.disabled = inputs.length === 0;
    return { correct, total: inputs.length };
  }

  function showState(heading, message, isError = false) {
    title.textContent = heading;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.hidden = false;
    lessonView.hidden = true;
  }

  function renderStudentLesson() {
    // Discard stale content when storage is cleared or contains invalid JSON.
    renderedExercises = [];
    content.replaceChildren();
    exercises.replaceChildren();
    result.textContent = 'Ready when you are.';
    currentLesson = { title: '', lessonHTML: '', exercises: [] };

    let lesson;
    try {
      lesson = readStudentLesson();
    } catch (error) {
      const message = error.name === 'SecurityError'
        ? 'This browser is blocking lesson storage. Allow local storage for this page, then reload.'
        : 'The saved lesson could not be loaded. Ask your teacher to save it again.';
      showState('We couldn’t load your lesson.', message, true);
      updateProgress();
      return;
    }
    if (!lesson) {
      showState('Your next lesson starts here.', 'No lesson has been saved yet. Your lesson and practice will appear here after your teacher saves them.');
      updateProgress();
      return;
    }

    currentLesson = lesson;
    title.textContent = lesson.title.trim() || 'Untitled lesson';
    content.append(lessonFragment(lesson.lessonHTML));
    if (!content.hasChildNodes()) content.textContent = 'No lesson notes have been added yet.';
    status.hidden = true;
    lessonView.hidden = false;
    get('student-no-exercises').hidden = lesson.exercises.length !== 0;

    lesson.exercises.forEach((exercise, index) => {
      const card = document.createElement('div');
      card.className = 'sg-exercise';
      const label = document.createElement('h4');
      label.className = 'sg-question-label';
      label.textContent = `Question ${String(index + 1).padStart(2, '0')}`;
      const question = document.createElement('div');
      question.className = 'sg-question';
      question.id = `student-question-${index + 1}`;
      const feedback = document.createElement('p');
      feedback.className = 'sg-feedback';
      feedback.id = `student-feedback-${index + 1}`;
      feedback.hidden = true;

      const supported = exercise.type === 'gap-fill';
      question.append(lessonFragment(exercise.questionHTML, supported));
      const fields = [...question.querySelectorAll('input')];
      const ready = supported && fields.length > 0 &&
        fields.every(input => input.hasAttribute('data-answer') && input.dataset.answer.trim() !== '');
      const record = { card, feedback, hint: exercise.feedback, inputs: ready ? fields : [] };
      fields.forEach((input, inputIndex) => {
        input.id = `student-answer-${index + 1}-${inputIndex + 1}`;
        input.setAttribute('aria-label', `Question ${index + 1}, answer ${inputIndex + 1}`);
        input.setAttribute('aria-describedby', `${question.id} ${feedback.id}`);
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Type your answer';
        input.disabled = !ready;
        input.addEventListener('input', () => {
          input.classList.remove('is-correct', 'is-incorrect');
          input.removeAttribute('aria-invalid');
          feedback.hidden = true;
          feedback.textContent = '';
          result.textContent = 'Ready to check your answers.';
          updateProgress();
        });
      });

      if (!ready) {
        feedback.className = 'sg-feedback is-unavailable';
        feedback.textContent = supported
          ? 'This question needs an answer field and answer key before it can be checked.'
          : 'This exercise type is not available in Student V1 yet.';
        feedback.hidden = false;
      }
      card.append(label, question, feedback);
      exercises.append(card);
      renderedExercises.push(record);
    });

    const { total } = updateProgress();
    if (total === 0) result.textContent = 'No answers to check yet.';
  }

  function checkAnswers(event) {
    event.preventDefault();
    const normalize = value => value.trim().toLowerCase();
    renderedExercises.forEach(exercise => {
      if (exercise.inputs.length === 0) return;
      const isAttempted = exercise.inputs.some(input => input.value.trim() !== '');
      if (!isAttempted) {
        exercise.inputs.forEach(input => {
          input.classList.remove('is-correct', 'is-incorrect');
          input.removeAttribute('aria-invalid');
        });
        exercise.feedback.hidden = true;
        exercise.feedback.textContent = '';
        return;
      }
      let allCorrect = true;
      let anyEmpty = false;
      exercise.inputs.forEach(input => {
        const val = input.value.trim();
        if (val === '') {
          input.classList.remove('is-correct', 'is-incorrect');
          input.removeAttribute('aria-invalid');
          anyEmpty = true;
        } else {
          const correct = normalize(val) === normalize(input.dataset.answer);
          input.classList.toggle('is-correct', correct);
          input.classList.toggle('is-incorrect', !correct);
          input.setAttribute('aria-invalid', String(!correct));
          if (!correct) allCorrect = false;
        }
      });
      if (anyEmpty && allCorrect) {
        exercise.feedback.hidden = true;
        exercise.feedback.textContent = '';
        return;
      }
      // A question with multiple blanks keeps its hint if any answer is wrong.
      exercise.feedback.className = 'sg-feedback ' + (allCorrect ? 'is-correct' : 'is-incorrect');
      exercise.feedback.textContent = allCorrect
        ? '✓ Correct. Nicely done!'
        : exercise.hint || 'Not quite yet. Review the lesson and try again.';
      exercise.feedback.hidden = false;
    });
    const { correct, total } = updateProgress();
    result.textContent = total === 0 ? 'No answers to check yet.'
      : correct === total ? `${correct} of ${total} correct. Nicely done!`
      : `${correct} of ${total} correct. Read the feedback and try again.`;
  }

  form.addEventListener('submit', checkAnswers);
  resetButton.addEventListener('click', () => {
    form.reset();
    renderedExercises.forEach(exercise => {
      if (exercise.inputs.length === 0) return;
      exercise.inputs.forEach(input => {
        input.classList.remove('is-correct', 'is-incorrect');
        input.removeAttribute('aria-invalid');
      });
      exercise.feedback.hidden = true;
      exercise.feedback.textContent = '';
    });
    updateProgress();
    result.textContent = 'A fresh start. You’ve got this.';
    renderedExercises.flatMap(exercise => exercise.inputs)[0]?.focus();
  });

  // The existing mode toggle calls this when returning to the student view.
  window.renderStudentLesson = renderStudentLesson;
  window.addEventListener('storage', event => {
    if (event.key === 'grammarSpace_shared_lesson' || event.key === null) renderStudentLesson();
  });
  renderStudentLesson();
})();
