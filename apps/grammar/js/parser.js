    function escapeHTML(value) {
      return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }
    function safeColor(value, allowComputed = false) {
      const simple = /^(?:[a-z]+|#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i.test(value);
      const computed = allowComputed && /^(?:rgba?|hsla?)\([\d\s.,%/+\-]+\)$/i.test(value);
      return (simple || computed) && CSS.supports('color', value);
    }
    function formatText(value) {
      return escapeHTML(value)
        .replace(/\[color:([^\]\n]+)\]([\s\S]*?)\[\/color\]/g, (whole, color, content) => safeColor(color.trim()) ? `<span style="color: ${color.trim()};">${content}</span>` : whole)
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__([\s\S]+?)__/g, '<span style="text-decoration: underline;">$1</span>')
        .replace(/==([\s\S]+?)==/g, '<span class="highlight">$1</span>')
        .replace(/\n/g, '<br>');
    }

    // Rebuild imported HTML from inert nodes. No uploaded scripts, handlers,
    // arbitrary styles, IDs, URLs, or foreign controls can enter the page.
    function cleanHTML(html, allowGaps = false, exerciseNumber = 0) {
      const template = document.createElement('template');
      template.innerHTML = html;
      const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'CODE', 'PRE', 'SMALL', 'SUP', 'SUB', 'HR', 'MARK']);
      const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'LINK', 'META', 'BASE', 'TEMPLATE']);
      const holder = document.createElement('div');
      let gapCount = 0;
      function copy(node) {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
        if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return document.createDocumentFragment();
        if (node.tagName === 'INPUT') {
          if (!allowGaps) return document.createDocumentFragment();
          const answer = node.getAttribute('data-answer');
          const type = (node.getAttribute('type') || 'text').toLowerCase();
          if (type !== 'text' || answer === null || !answer.trim()) throw new Error(`Exercise ${exerciseNumber}: each gap must be a text input with a nonempty data-answer.`);
          const input = document.createElement('input');
          input.type = 'text'; input.className = 'gap-input'; input.dataset.answer = answer;
          const hint = node.getAttribute('data-feedback');
          if (hint && hint.trim()) input.dataset.feedback = hint.trim();
          gapCount++;
          return input;
        }
        const element = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment();
        if (element.nodeType === Node.ELEMENT_NODE) {
          const colorMatch = (node.getAttribute('style') || '').match(/(?:^|;)\s*color\s*:\s*([^;]+)(?:;|$)/i);
          if (colorMatch && safeColor(colorMatch[1].trim(), true)) element.style.color = colorMatch[1].trim();
          if (node.style.textDecoration.includes('underline') || node.style.textDecorationLine.includes('underline')) element.style.textDecoration = 'underline';
          if (node.classList.contains('highlight') || node.classList.contains('grammar-highlight')) element.className = 'highlight';
          if (['TD', 'TH'].includes(node.tagName)) ['colspan', 'rowspan'].forEach(name => {
            const value = node.getAttribute(name);
            if (/^[1-9]\d?$/.test(value || '')) element.setAttribute(name, value);
          });
          const language = node.getAttribute('lang');
          if (language && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)) element.lang = language;
        }
        node.childNodes.forEach(child => element.append(copy(child)));
        return element;
      }
      template.content.childNodes.forEach(node => holder.append(copy(node)));
      return { html: holder.innerHTML, gapCount, text: holder.textContent.trim() };
    }

    const DEFAULT_UNSCRAMBLE_FEEDBACK = 'Use every word and check the sentence order. Click a placed word to move it back.';

    // Uploaded and stored questions share the same normalized model.
    function normalizeExercises(exercises) {
      if (!Array.isArray(exercises)) throw new Error('Exercises must be an array.');
      return exercises.map((exercise, index) => {
        if (!exercise || typeof exercise.questionHTML !== 'string' || (exercise.feedback !== undefined && !Array.isArray(exercise.feedback) && typeof exercise.feedback !== 'string')) throw new Error(`Exercise ${index + 1}: provide questionHTML and feedback.`);
        const type = exercise.type || 'gap-fill';
        const tier = exercise.tier === 'apply' ? 'apply' : 'practice';
        if (type === 'gap-fill' || type === 'paragraph-gap-fill') {
          const cleaned = cleanHTML(exercise.questionHTML, true, index + 1);
          if (!cleaned.gapCount) throw new Error(`Exercise ${index + 1}: include at least one input with data-answer.`);
          const template = document.createElement('template'); template.innerHTML = cleaned.html;
          const embedded = [...template.content.querySelectorAll('input.gap-input')].map(input => input.dataset.feedback || '');
          const fallback = Array.isArray(exercise.feedback) ? exercise.feedback.slice() : Array(cleaned.gapCount).fill(exercise.feedback);
          if (fallback.length !== cleaned.gapCount) throw new Error(`Exercise ${index + 1}: each gap needs matching feedback.`);
          const feedback = embedded.map((hint, position) => hint || fallback[position]);
          if (!feedback.every(hint => typeof hint === 'string')) throw new Error(`Exercise ${index + 1}: feedback must contain strings.`);
          if (feedback.length !== cleaned.gapCount) throw new Error(`Exercise ${index + 1}: each gap needs matching feedback.`);
          return { type, questionHTML: cleaned.html, feedback, tier };
        }
        if (typeof exercise.feedback !== 'string' && !Array.isArray(exercise.feedback)) throw new Error(`Exercise ${index + 1}: provide feedback.`);
        const prompt = cleanHTML(exercise.questionHTML || (type === 'unscramble' ? 'Put the words in the correct order.' : ''));
        if (!prompt.text) throw new Error(`Exercise ${index + 1}: add a question or instruction.`);
        if (type === 'multiple-choice') {
          if (!Array.isArray(exercise.options) || exercise.options.length < 2 || !exercise.options.every(option => typeof option === 'string' && option.trim())) throw new Error(`Exercise ${index + 1}: provide at least two nonempty options.`);
          const options = exercise.options.map(option => option.trim());
          if (new Set(options.map(option => option.normalize('NFC').toLowerCase())).size !== options.length) throw new Error(`Exercise ${index + 1}: options must be distinct.`);
          if (typeof exercise.answer !== 'string' || !options.includes(exercise.answer.trim())) throw new Error(`Exercise ${index + 1}: the answer must match one option exactly.`);
          return { type, questionHTML: prompt.html, options, answer: exercise.answer.trim(), feedback: exercise.feedback || 'Choose the option that best answers the question.', tier };
        }
        if (type === 'unscramble') {
          if (!Array.isArray(exercise.words) || !exercise.words.length || !exercise.words.every(word => typeof word === 'string' && word.trim())) throw new Error(`Exercise ${index + 1}: supply a nonempty list of words.`);
          return { type, questionHTML: prompt.html, words: exercise.words.map(word => word.trim()), feedback: exercise.feedback || DEFAULT_UNSCRAMBLE_FEEDBACK, tier };
        }
        throw new Error(`Exercise ${index + 1}: unsupported type "${type}".`);
      });
    }

    function parseTXTExercise(line, index) {
      const question = line.replace(/^\d+[.)]\s*/, '').trim();
      if (question.startsWith('((')) {
        if (!question.endsWith('))')) throw new Error(`Exercise ${index + 1}: close a multiple-choice question with )).`);
        const body = question.slice(2, -2).trim();
        const divider = body.indexOf('::');
        if (divider < 0) throw new Error(`Exercise ${index + 1}: add :: feedback before )).`);
        const choices = body.slice(0, divider).trim(), feedback = body.slice(divider + 2).trim();
        const correct = choices.match(/\*\*([^*]+)\*\*/);
        if (!correct || !feedback) throw new Error(`Exercise ${index + 1}: mark one correct option with **...** and include feedback.`);
        const prompt = choices.slice(0, correct.index).trim();
        const remaining = choices.slice(correct.index + correct[0].length).trim();
        if (!prompt || !remaining.startsWith('|') || remaining.includes('**') || correct[1].includes('|')) throw new Error(`Exercise ${index + 1}: use (( Question? **correct** | wrong :: feedback )).`);
        return { type: 'multiple-choice', questionHTML: formatText(prompt), options: [correct[1].trim(), ...remaining.slice(1).split('|').map(option => option.trim())], answer: correct[1].trim(), feedback };
      }
      if (question.startsWith('~~')) {
        if (!question.endsWith('~~') || question.length <= 4 || question.slice(2, -2).includes('~~')) throw new Error(`Exercise ${index + 1}: use ~~ word1 | word2 | word3 ~~.`);
        return { type: 'unscramble', questionHTML: 'Put the words in the correct order.', words: question.slice(2, -2).split('|').map(word => word.trim()), feedback: DEFAULT_UNSCRAMBLE_FEEDBACK };
      }
      const pattern = /\{\{([^{}\n]*?)::([^{}\n]*?)\}\}/g;
      const matches = [...question.matchAll(pattern)];
      if (!matches.length || /\{\{|\}\}/.test(question.replace(pattern, ''))) throw new Error(`Exercise ${index + 1}: use {{answer::feedback}}, (( Question? **answer** | option :: feedback )), or ~~ words | in | order ~~.`);
      let questionHTML = '', cursor = 0;
      const feedback = [];
      matches.forEach(match => {
        const answer = match[1].trim(), hint = match[2].trim();
        if (!answer || !hint) throw new Error(`Exercise ${index + 1}: each gap needs an answer and feedback.`);
        questionHTML += formatText(question.slice(cursor, match.index));
        questionHTML += `<input type="text" class="gap-input" data-answer="${escapeHTML(answer)}">`;
        feedback.push(hint); cursor = match.index + match[0].length;
      });
      questionHTML += formatText(question.slice(cursor));
      return { type: 'gap-fill', questionHTML, feedback };
    }
    function normalizeDocument(title, parts) {
      if (typeof title !== 'string' || !title.trim()) throw new Error('Write a nonempty lesson title.');
      if (!Array.isArray(parts) || !parts.length) throw new Error('Include at least one lesson part.');
      const normalizedParts = parts.map((part, index) => {
        if (!part || typeof part.lessonHTML !== 'string' || !Array.isArray(part.exercises)) throw new Error(`Part ${index + 1}: provide lessonHTML and an exercises array.`);
        const cleaned = cleanHTML(part.lessonHTML);
        const questions = normalizeExercises(part.exercises);
        if (!cleaned.text && !questions.length) throw new Error(`Part ${index + 1}: add lesson content or exercises.`);
        return { title: typeof part.title === 'string' && part.title.trim() ? part.title.trim() : `Part ${index + 1}`, lessonHTML: cleaned.text ? cleaned.html : '', exercises: questions };
      });
      return { title: title.trim(), parts: normalizedParts };
    }
    function parseTXT(text) {
      const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');
      const chunks = source.split(/^--- PAGE BREAK ---$/m);
      let lessonTitle = '';
      const parts = chunks.map((chunk, index) => {
        if (!chunk.trim()) throw new Error(`Part ${index + 1}: do not leave an empty part around a page break.`);
        const sections = chunk.split(/^=== EXERCISES ===$/m);
        if (sections.length > 2) throw new Error(`Part ${index + 1}: use at most one === EXERCISES === divider.`);
        const lines = sections[0].split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('# '));
        if (index === 0 && titleIndex < 0) throw new Error('TXT: start the lesson title with # followed by a space.');
        let title = `Part ${index + 1}`;
        if (titleIndex >= 0) { title = lines.splice(titleIndex, 1)[0].slice(2).trim(); if (!title) throw new Error(`Part ${index + 1}: write a title after #.`); }
        if (index === 0) lessonTitle = title;
        const theory = lines.join('\n').trim();
        const lessonHTML = theory ? theory.split(/\n[ \t]*\n+/).map(paragraph => `<p>${formatText(paragraph.trim())}</p>`).join('') : '';
        const exerciseLines = (sections[1] || '').split('\n').map(line => line.trim()).filter(Boolean);
        if (sections.length === 2 && !exerciseLines.length) throw new Error(`Part ${index + 1}: add an exercise after the divider.`);
        return { title, lessonHTML, exercises: exerciseLines.map(parseTXTExercise) };
      });
      return normalizeDocument(lessonTitle, parts);
    }
    function requireFields(value, fields, label) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || fields.some(key => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some(key => !fields.includes(key))) throw new Error(`${label}: use exactly these fields: ${fields.join(', ')}.`);
    }
    function validateJSONExercises(exercises, partIndex) {
      if (!Array.isArray(exercises)) throw new Error(`JSON part ${partIndex + 1}: exercises must be an array.`);
      exercises.forEach((exercise, index) => {
        const label = `JSON part ${partIndex + 1}, exercise ${index + 1}`;
        if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) throw new Error(`${label}: use a question object.`);
        const type = exercise.type === undefined ? 'gap-fill' : exercise.type;
        let fields;
        if (type === 'gap-fill' || type === 'paragraph-gap-fill') {
          fields = exercise.type === undefined ? ['questionHTML'] : ['type', 'questionHTML'];
          if (Object.prototype.hasOwnProperty.call(exercise, 'feedback')) fields.push('feedback');
          if (Object.prototype.hasOwnProperty.call(exercise, 'tier')) fields.push('tier');
        }
        else if (type === 'multiple-choice') {
          fields = ['type', 'questionHTML', 'options', 'answer', 'feedback'];
          if (Object.prototype.hasOwnProperty.call(exercise, 'tier')) fields.push('tier');
        }
        else if (type === 'unscramble') {
          fields = ['type', 'questionHTML', 'words', 'feedback'];
          if (Object.prototype.hasOwnProperty.call(exercise, 'tier')) fields.push('tier');
        }
        else throw new Error(`${label}: type must be gap-fill, paragraph-gap-fill, multiple-choice, or unscramble.`);
        requireFields(exercise, fields, label);
        if (typeof exercise.questionHTML !== 'string' || (exercise.feedback !== undefined && typeof exercise.feedback !== 'string')) throw new Error(`${label}: questionHTML and feedback must be strings.`);
        if (exercise.tier !== undefined && typeof exercise.tier !== 'string') throw new Error(`${label}: tier must be a string.`);
      });
    }
    function parseJSON(text) {
      let data;
      try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
      catch { throw new Error('JSON: check double quotes, commas, and brackets.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON: provide a lesson object.');
      let parts;
      if (Object.prototype.hasOwnProperty.call(data, 'parts')) {
        requireFields(data, ['title', 'parts'], 'JSON lesson');
        if (!Array.isArray(data.parts) || !data.parts.length) throw new Error('JSON: parts must be a nonempty array.');
        parts = data.parts.map((part, index) => {
          const fields = part && Object.prototype.hasOwnProperty.call(part, 'title') ? ['title', 'lessonHTML', 'exercises'] : ['lessonHTML', 'exercises'];
          requireFields(part, fields, `JSON part ${index + 1}`);
          if (part.title !== undefined && typeof part.title !== 'string') throw new Error(`JSON part ${index + 1}: title must be a string.`);
          validateJSONExercises(part.exercises, index);
          return part;
        });
      } else {
        requireFields(data, ['title', 'lessonHTML', 'exercises'], 'JSON lesson');
        validateJSONExercises(data.exercises, 0);
        parts = [{ title: data.title, lessonHTML: data.lessonHTML, exercises: data.exercises }];
      }
      return normalizeDocument(data.title, parts);
    }

    function parseFeed(text, extension) {
      if (extension === 'txt') return parseTXT(text);
      if (extension === 'json') return parseJSON(text);
      throw new Error('Choose a .txt or .json file.');
    }

    // Folder imports accept author-friendly question markers; ordinary uploads
    // continue to use the existing strict parseJSON contract.
    function parseFolderLesson(raw, fallbackTitle = '') {
      const genericFeedback = 'Hãy xem lại lý thuyết và kiểm tra đáp án của bạn.';
      const choicePrompt = 'Chọn đáp án đúng.';
      const orderPrompt = 'Sắp xếp các từ thành câu đúng.';
      const blockedTags = 'script,style,iframe,object,embed,svg,math,link,meta,base,template';
      const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
      const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
      const fail = (label, message) => { throw new Error(`${label}: ${message}`); };

      function inertHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.querySelectorAll(blockedTags).forEach(node => node.remove());
        return template;
      }
      function htmlOf(fragment) {
        const holder = document.createElement('div');
        holder.append(fragment.cloneNode(true));
        return holder.innerHTML;
      }
      function htmlOfRange(range, root) {
        let fragment = range.cloneContents();
        let ancestor = range.commonAncestorContainer;
        if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;
        // cloneContents omits the common ancestor; restore its formatting when
        // a page boundary falls inside a paragraph or a wrapping division.
        while (ancestor && ancestor !== root) {
          const wrapper = ancestor.cloneNode(false);
          wrapper.append(fragment); fragment = wrapper; ancestor = ancestor.parentNode;
        }
        return htmlOf(fragment);
      }
      function textNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
      }
      function formattedFragment(text) {
        const template = document.createElement('template');
        template.innerHTML = formatText(text);
        return template.content;
      }
      function formatRemainingText(root) {
        textNodes(root).forEach(node => node.replaceWith(formattedFragment(node.textContent)));
      }
      function feedbackValue(value, label) {
        if (value === undefined || value === null || value === '') return genericFeedback;
        if (typeof value === 'string') return value.trim() || genericFeedback;
        if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.map(item => item.trim() || genericFeedback);
        fail(label, 'feedback phải là một chuỗi hoặc một mảng các chuỗi.');
      }
      function singleFeedback(value) { return Array.isArray(value) ? value.join(' ') || genericFeedback : value; }

      // Read markers from text nodes, never from attributes or active markup.
      // Ranges also allow a marker to span harmless inline formatting elements.
      function extractMarker(template, opening, closing, label) {
        const nodes = textNodes(template.content);
        const text = nodes.map(node => node.textContent).join('');
        const start = text.indexOf(opening);
        if (start < 0) return null;
        const end = text.indexOf(closing, start + opening.length);
        if (end < 0 || (opening !== closing && (text.indexOf(closing) < start || text.indexOf(opening, start + opening.length) >= 0)) || text.indexOf(closing, end + closing.length) >= 0) fail(label, `hãy dùng đúng một cặp ${opening} … ${closing}.`);
        function point(offset, atEnd = false) {
          let cursor = 0;
          for (const node of nodes) {
            const next = cursor + node.textContent.length;
            if (offset < next || (atEnd && offset === next)) return [node, offset - cursor];
            cursor = next;
          }
          const last = nodes[nodes.length - 1];
          return [last, last.textContent.length];
        }
        const range = document.createRange();
        range.setStart(...point(start));
        range.setEnd(...point(end + closing.length, true));
        return {
          body: text.slice(start + opening.length, end).trim(),
          replace(replacement = '') {
            range.deleteContents();
            if (replacement) range.insertNode(document.createTextNode(replacement));
          }
        };
      }
      function splitFeedback(body) {
        const separator = body.indexOf('::');
        return separator < 0 ? { content: body.trim(), feedback: '' } : { content: body.slice(0, separator).trim(), feedback: body.slice(separator + 2).trim() };
      }
      function choiceValues(content, label) {
        const options = content.split('|').map(value => value.trim());
        let prompt = '';
        // Legacy questions put their prompt before the first option. A question
        // mark/colon is unambiguous even when the marked answer is option B/C.
        const first = options[0];
        const firstMarkedOption = first.indexOf('**');
        const promptArea = firstMarkedOption < 0 ? first : first.slice(0, firstMarkedOption);
        const boundaries = [...promptArea.matchAll(/[?？:](?=\s)/g)].filter(match => first.slice(match.index + 1).trim());
        const boundary = boundaries[boundaries.length - 1];
        const prefix = first.match(/^([\s\S]+?)\s+(\*\*[\s\S]+\*\*)$/);
        if (boundary) { prompt = first.slice(0, boundary.index + 1).trim(); options[0] = first.slice(boundary.index + 1).trim(); }
        else if (prefix && !prefix[1].includes('**')) { prompt = prefix[1].trim(); options[0] = prefix[2].trim(); }
        const correct = [];
        const plainOptions = options.map((option, index) => {
          const marked = option.match(/^\*\*([^*]+)\*\*$/);
          if (marked) { correct.push(index); return marked[1].trim(); }
          if (option.includes('**')) fail(label, 'đặt **…** quanh toàn bộ một phương án đúng.');
          return option;
        });
        if (correct.length !== 1) fail(label, 'đánh dấu đúng một phương án bằng **đáp án**.');
        return { prompt, options: plainOptions, answer: plainOptions[correct[0]] };
      }
      function validateChoices(options, answer, label) {
        if (!Array.isArray(options) || options.length < 2 || !options.every(option => typeof option === 'string' && option.trim())) fail(label, 'câu trắc nghiệm cần ít nhất hai phương án không rỗng.');
        const values = options.map(option => option.trim());
        if (new Set(values.map(option => option.normalize('NFC').toLowerCase())).size !== values.length) fail(label, 'các phương án trắc nghiệm không được trùng nhau.');
        if (typeof answer !== 'string' || !values.includes(answer.trim())) fail(label, 'answer phải trùng khớp với một phương án trong options.');
        return { options: values, answer: answer.trim() };
      }

      function parseQuestion(input, index, partLabel) {
        const label = `${partLabel}, câu ${index + 1}`;
        const exercise = typeof input === 'string' ? { questionHTML: input } : input;
        if (!isObject(exercise)) fail(label, 'câu hỏi phải là một đối tượng hoặc chuỗi văn bản.');
        const source = own(exercise, 'questionHTML') ? exercise.questionHTML : own(exercise, 'question') ? exercise.question : own(exercise, 'text') ? exercise.text : '';
        if (typeof source !== 'string') fail(label, 'questionHTML phải là một chuỗi.');
        const template = inertHTML(source);
        const text = template.content.textContent;
        const hasGaps = !!template.content.querySelector('input') || /\{\{|\}\}/.test(text);
        const hasChoices = /\(\(|\)\)/.test(text);
        const hasOrder = text.includes('~~');
        const feedback = feedbackValue(exercise.feedback, label);
        const aliases = {
          gap: 'gap-fill',
          'fill-in-the-blank': 'gap-fill',
          mcq: 'multiple-choice',
          'multiple_choice': 'multiple-choice',
          scramble: 'unscramble',
          'paragraph-gap-fill': 'paragraph-gap-fill',
          'paragraph-gap': 'paragraph-gap-fill',
          'paragraph_gap_fill': 'paragraph-gap-fill'
        };
        const declaredType = exercise.type;
        if (declaredType !== undefined && typeof declaredType !== 'string') fail(label, 'type phải là một chuỗi.');
        const type = aliases[declaredType] || declaredType || (own(exercise, 'options') || hasChoices ? 'multiple-choice' : own(exercise, 'words') || hasOrder ? 'unscramble' : 'gap-fill');
        if (![ 'gap-fill', 'paragraph-gap-fill', 'multiple-choice', 'unscramble' ].includes(type)) fail(label, `loại câu hỏi “${type}” chưa được hỗ trợ.`);
        if ((hasGaps && type !== 'gap-fill' && type !== 'paragraph-gap-fill') || (hasChoices && type !== 'multiple-choice') || (hasOrder && type !== 'unscramble')) fail(label, 'không trộn nhiều loại bài tập trong cùng một câu hỏi.');

        const tier = exercise.tier === 'apply' ? 'apply' : 'practice';

        if (type === 'gap-fill' || type === 'paragraph-gap-fill') {
          const hints = [];
          const externalHint = position => Array.isArray(feedback) ? feedback[position] || genericFeedback : feedback;
          function transform(node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'INPUT') {
              if ((node.getAttribute('type') || 'text').toLowerCase() !== 'text' || !(node.getAttribute('data-answer') || '').trim()) fail(label, 'mỗi ô trống cần input kiểu text và data-answer không rỗng.');
              hints.push((node.getAttribute('data-feedback') || '').trim() || externalHint(hints.length));
              return;
            }
            if (node.nodeType !== Node.TEXT_NODE) { [...node.childNodes].forEach(transform); return; }
            const value = node.textContent;
            const pattern = /\{\{([^{}]*?)::([^{}]*?)\}\}/g;
            const matches = [...value.matchAll(pattern)];
            if (/\{\{|\}\}/.test(value.replace(pattern, ''))) fail(label, 'ô trống phải có dạng {{đáp án::giải thích}} và không bị ngắt bởi thẻ HTML.');
            const fragment = document.createDocumentFragment();
            let cursor = 0;
            matches.forEach(match => {
              const answer = match[1].trim();
              if (!answer) fail(label, 'đáp án trong {{…::…}} không được rỗng.');
              fragment.append(formattedFragment(value.slice(cursor, match.index)));
              const gap = document.createElement('input');
              gap.type = 'text'; gap.className = 'gap-input'; gap.dataset.answer = answer;
              fragment.append(gap);
              hints.push(match[2].trim() || externalHint(hints.length));
              cursor = match.index + match[0].length;
            });
            fragment.append(formattedFragment(value.slice(cursor)));
            node.replaceWith(fragment);
          }
          [...template.content.childNodes].forEach(transform);
          if (!hints.length) fail(label, 'thiếu câu hỏi: hãy thêm {{đáp án::giải thích}} hoặc input có data-answer.');
          if (Array.isArray(feedback) && feedback.length !== hints.length) fail(label, 'số phần tử feedback phải bằng số ô trống.');
          const cleaned = cleanHTML(htmlOf(template.content), true, index + 1);
          return { type, questionHTML: cleaned.html, feedback: hints, tier };
        }

        if (type === 'multiple-choice') {
          let options = exercise.options, answer = exercise.answer, hint = singleFeedback(feedback);
          const marker = extractMarker(template, '((', '))', label);
          if (marker) {
            if (own(exercise, 'options') || own(exercise, 'answer')) fail(label, 'hãy dùng options/answer hoặc ký hiệu ((…)), không dùng cả hai.');
            const parsed = splitFeedback(marker.body);
            const choices = choiceValues(parsed.content, label);
            options = choices.options; answer = choices.answer;
            hint = parsed.feedback || hint;
            marker.replace(choices.prompt);
          } else if (hasChoices) fail(label, 'câu trắc nghiệm phải có đủ (( và )).');
          const values = validateChoices(options, answer, label);
          formatRemainingText(template.content);
          const prompt = cleanHTML(htmlOf(template.content));
          return { type, questionHTML: prompt.text ? prompt.html : choicePrompt, ...values, feedback: hint, tier };
        }

        let words = exercise.words, hint = singleFeedback(feedback);
        const marker = extractMarker(template, '~~', '~~', label);
        if (marker) {
          if (own(exercise, 'words')) fail(label, 'hãy dùng words hoặc ký hiệu ~~…~~, không dùng cả hai.');
          const parsed = splitFeedback(marker.body);
          words = parsed.content.split('|').map(word => word.trim());
          hint = parsed.feedback || hint;
          marker.replace();
        }
        if (!Array.isArray(words) || !words.length || !words.every(word => typeof word === 'string' && word.trim())) fail(label, 'bài sắp xếp từ cần danh sách words không rỗng hoặc ~~ từ 1 | từ 2 ~~.');
        formatRemainingText(template.content);
        const prompt = cleanHTML(htmlOf(template.content));
        return { type, questionHTML: prompt.text ? prompt.html : orderPrompt, words: words.map(word => word.trim()), feedback: hint, tier };
      }

      function theoryPages(html, label) {
        const template = inertHTML(html);
        formatRemainingText(template.content);
        const markers = [];
        textNodes(template.content).forEach(node => {
          for (const match of node.textContent.matchAll(/---\s*PAGE BREAK\s*---/g)) markers.push({ node, start: match.index, end: match.index + match[0].length });
        });
        let chunks = [];
        if (markers.length) {
          let startNode = template.content, startOffset = 0;
          markers.forEach(marker => {
            const range = document.createRange();
            range.setStart(startNode, startOffset); range.setEnd(marker.node, marker.start);
            chunks.push(htmlOfRange(range, template.content));
            startNode = marker.node; startOffset = marker.end;
          });
          const range = document.createRange();
          range.setStart(startNode, startOffset); range.setEnd(template.content, template.content.childNodes.length);
          chunks.push(htmlOfRange(range, template.content));
          if (chunks.some(chunk => !cleanHTML(chunk).text)) fail(label, 'không để trang lý thuyết trống trước hoặc sau --- PAGE BREAK ---.');
        } else {
          let container = template.content;
          // Authors often wrap the entire lesson in a single div. Treat its
          // immediate headings as logical boundaries while retaining the wrapper.
          while (true) {
            const significant = [...container.childNodes].filter(node => node.nodeType === Node.ELEMENT_NODE ? node.tagName !== 'BR' : node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            if (significant.length !== 1 || significant[0].nodeType !== Node.ELEMENT_NODE || !['DIV', 'ARTICLE', 'MAIN', 'SECTION'].includes(significant[0].tagName)) break;
            container = significant[0];
          }
          let startNode = template.content, startOffset = 0;
          const addRange = (endNode, endOffset) => {
            const range = document.createRange();
            range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
            const chunk = htmlOfRange(range, template.content);
            if (cleanHTML(chunk).text) chunks.push(chunk);
          };
          [...container.childNodes].forEach((node, index) => {
            if (node.nodeType !== Node.ELEMENT_NODE || !['H2', 'SECTION'].includes(node.tagName)) return;
            addRange(container, index);
            startNode = container; startOffset = index;
          });
          addRange(template.content, template.content.childNodes.length);
        }
        return chunks.map(chunk => {
          const clean = cleanHTML(chunk);
          const contents = inertHTML(clean.html);
          const heading = contents.content.querySelector('h1,h2,h3,h4');
          return { title: heading?.textContent.trim() || '', html: clean.html };
        });
      }

      let data = raw;
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); }
        catch { fail('JSON', 'không đọc được dữ liệu; hãy kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.'); }
      }
      if (!isObject(data)) fail('Bài học', 'dữ liệu phải là một đối tượng JSON.');
      if (data.title !== undefined && typeof data.title !== 'string') fail('Bài học', 'title phải là một chuỗi.');
      if (typeof fallbackTitle !== 'string') fail('Bài học', 'tiêu đề dự phòng phải là một chuỗi.');
      const title = (data.title || '').trim() || fallbackTitle.trim();
      if (!title) fail('Bài học', 'thiếu tiêu đề; hãy thêm title.');
      const parts = [];
      function appendPart(part, position) {
        const label = `Phần ${position}`;
        if (typeof part === 'string') part = { lessonHTML: part };
        if (!isObject(part)) fail(label, 'mỗi phần phải là một đối tượng hoặc chuỗi HTML.');
        if (part.title !== undefined && typeof part.title !== 'string') fail(label, 'title phải là một chuỗi.');
        const partTitle = ((part.title || part.pageTitle) || '').trim() || (position === '1' ? title : `Phần ${position}`);
        const collections = ['parts', 'pages', 'sections'].filter(key => own(part, key));
        if (collections.length > 1) fail(label, 'chỉ dùng một trong các mảng parts, pages hoặc sections.');
        const html = own(part, 'lessonHTML') ? part.lessonHTML : own(part, 'contentHTML') ? part.contentHTML : own(part, 'html') ? part.html : (typeof part.content === 'string' ? part.content : '');
        if (typeof html !== 'string') fail(label, 'lessonHTML phải là một chuỗi.');
        const exercises = own(part, 'exercises') ? part.exercises : own(part, 'questions') ? part.questions : [];
        if (!Array.isArray(exercises)) fail(label, 'exercises phải là một mảng.');
        const pages = theoryPages(html, label);
        const questions = exercises.map((exercise, index) => parseQuestion(exercise, index, label));
        const firstPartIndex = parts.length;
        pages.forEach((page, index) => parts.push({ title: page.title || (pages.length > 1 ? `${partTitle} · ${index + 1}` : partTitle), lessonHTML: page.html, exercises: [] }));
        if (collections.length) {
          const children = part[collections[0]];
          if (!Array.isArray(children) || !children.length) fail(label, `${collections[0]} phải là một mảng không rỗng.`);
          children.forEach((child, index) => appendPart(child, `${position}.${index + 1}`));
        }
        for (let index = 0; index < questions.length; index += 10) {
          const chunk = questions.slice(index, index + 10);
          const last = parts[parts.length - 1];
          if (index === 0 && pages.length && !collections.length && last && !last.exercises.length) last.exercises = chunk;
          else parts.push({ title: questions.length > 10 ? `${partTitle} · Luyện tập ${Math.floor(index / 10) + 1}` : partTitle, lessonHTML: '', exercises: chunk });
        }
        if (parts.length === firstPartIndex) fail(label, 'thiếu nội dung lý thuyết hoặc câu hỏi.');
      }
      appendPart(data, '1');
      // Every HTML fragment above has already passed through cleanHTML. Keeping
      // the shared normalizer here makes persisted and newly imported data agree.
      return normalizeDocument(title, parts);
    }


export { parseFeed, parseTXT, parseJSON, parseFolderLesson, normalizeDocument };
