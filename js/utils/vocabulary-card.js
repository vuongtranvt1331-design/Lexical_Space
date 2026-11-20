// Presentation helpers shared by the study and library cards.
export const CARD_BLANK = '[ _____ ]';

export function cardStatus(word) {
  const grade = word.lastGrade;
  return grade != null && /^[0-3]$/.test(String(grade)) ? Number(grade) : 0;
}

export function fillCardBlanks(value, target) {
  return (value || '').replace(/\[\s*_{3,}\s*\]/g, () => target);
}
