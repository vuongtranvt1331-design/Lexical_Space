import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRecallAnswer, matchesTarget, clozeText, targetSegments } from '../js/core/recall-utils.js';
test('cloze blanks complete literal targets, repeated phrases and collocations without damaging other words', () => {
  assert.equal(clozeText('Think in English, in context.', 'in'), 'Think [ _____ ] English, [ _____ ] context.');
  assert.equal(clozeText('C++ is useful. Learn C++.', 'C++'), '[ _____ ] is useful. Learn [ _____ ].');
  assert.equal(clozeText('Never give up; do not give up.', 'give up'), 'Never [ _____ ]; do not [ _____ ].');
  assert.equal(clozeText('A resilient economy.', 'resilient'), 'A [ _____ ] economy.');
  assert.equal(targetSegments('<img> target', 'target')[0].text, '<img> ');
});
test('answer comparison normalizes case, Unicode, apostrophes and spaces without accepting unrelated answers', () => {
  assert.equal(matchesTarget('  GIVE   UP ', 'give up'), true); assert.equal(matchesTarget('DON’T', "don't"), true);
  assert.equal(matchesTarget('Ｒｅｃａｌｌ', 'recall'), true); assert.equal(matchesTarget('recalled', 'recall'), false);
  assert.equal(matchesTarget('', 'recall'), false); assert.equal(matchesTarget('remember', 'recall'), false);
});
test('reverse recall accepts the trimmed target or a listed synonym regardless of case', () => {
  const card = { word: ' Recall ', synonyms: ['remember', ' Bring to mind '] };
  for (const answer of [' recall ', 'REMEMBER', ' Bring to MIND ']) assert.equal(matchesRecallAnswer(answer, card), true);
  for (const answer of [' ', 'recalled', 'remind', 'bring  to mind']) assert.equal(matchesRecallAnswer(answer, card), false);
  assert.equal(matchesRecallAnswer(' recall ', { word: 'Recall' }), true);
});
test('cloze masks regular and common irregular inflections without changing typed recall acceptance', () => {
  assert.equal(clozeText('They adapted quickly and are adapting again.', 'adapt', { inflections: true }), 'They [ _____ ] quickly and are [ _____ ] again.');
  assert.equal(clozeText('We gave up, but they never give up.', 'give up', { inflections: true }), 'We [ _____ ], but they never [ _____ ].');
  assert.equal(clozeText('The constructor is available.', 'constructor', { inflections: true }), 'The [ _____ ] is available.');
  assert.equal(matchesTarget('gave up', 'give up'), false);
});
