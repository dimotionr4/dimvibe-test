// Деление ответа Word Scramble на кусочки — общее для редактора и плеера (одно правило в одном месте).
// Ответ преподавателя — единственный источник кусочков (решение владельца 2026-10-25, вариант 2А): своя нарезка задаётся
// косой чертой прямо в ответе («I have / been to / London.», «app / le»), без неё режется автоматически:
// «слово» — на буквы (графемы: буква с ударением или составной знак — один кусочек), «фраза» и «предложение» — по пробелам,
// знаки препинания остаются у своего слова («Hello,», «book.»).
const WordScrambleTokens = (() => {
  const MODES = { word: 'Слово', phrase: 'Фраза', sentence: 'Предложение' };
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const graphemes = s => (seg ? [...seg.segment(s)].map(x => x.segment) : Array.from(s));
  const clean = s => String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const manual = answer => String(answer || '').includes('/');

  // Кусочки ответа по режиму; пустые кусочки (лишние «/») пропускаются
  function split(mode, answer) {
    const a = String(answer || '').normalize('NFC');
    if (manual(a)) return a.split('/').map(clean).filter(Boolean);
    const c = clean(a);
    if (!c) return [];
    if (mode === 'word') return graphemes(c).filter(g => g.trim());
    return c.split(' ');
  }
  // Собранный текст: у слова кусочки склеиваются без пробела, у фразы и предложения — через пробел
  const join = (mode, pieces) => pieces.join(mode === 'word' ? '' : ' ');
  // Правильный ответ так, как его увидит ученик (без косых черт)
  const text = (mode, answer) => join(mode, split(mode, answer));
  // Сравнение кусочков: по значению (одинаковые взаимозаменяемы), Unicode NFC, регистр и знаки важны
  const same = (a, b) => a.length === b.length && a.every((x, i) => x.normalize('NFC') === b[i].normalize('NFC'));

  return { MODES, split, join, text, same, manual };
})();
