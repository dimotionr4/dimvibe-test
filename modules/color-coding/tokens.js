// Общее для редактора и плеера Color Coding: набор цветов категорий, деление текста на слова и перепривязка отметок после правки текста.
// Деление на слова скопировано из Mistake Mode (modules/mistake-mode/tokens.js), чтобы модули оставались независимыми (решение владельца 2026-10-25).
const ColorTokens = (() => {
  // Набор цветов категорий: ключ хранится в файле упражнения, цвет — здесь. Красного и зелёного нет: это цвета результата.
  // ink — цвет надписи на залитом цветом теге категории (в любой теме один и тот же, потому что фон тега не зависит от темы)
  const DARK = '#1d1d2b', LIGHT = '#ffffff';
  const PALETTE = {
    yellow: { label: 'Жёлтый', hex: '#f5c400', ink: DARK },
    orange: { label: 'Оранжевый', hex: '#ff8a3d', ink: DARK },
    pink: { label: 'Розовый', hex: '#ff5fa2', ink: DARK },
    purple: { label: 'Фиолетовый', hex: '#9b6bff', ink: DARK },
    blue: { label: 'Синий', hex: '#3d8bff', ink: DARK },
    teal: { label: 'Бирюзовый', hex: '#14b8a6', ink: DARK },
    lime: { label: 'Салатовый', hex: '#9acd32', ink: DARK },
    brown: { label: 'Коричневый', hex: '#a0703c', ink: LIGHT },
  };
  const colorOf = key => (PALETTE[key] ? PALETTE[key].hex : '#9a9aa8');
  const inkOf = key => (PALETTE[key] ? PALETTE[key].ink : DARK);

  const WORD = /[\p{L}\p{N}\p{M}]+(?:['’‐-][\p{L}\p{N}\p{M}]+)*/gu;

  // Кусочки текста по порядку: слово {word:true, s, i} (i — номер слова в тексте с нуля) или промежуток {word:false, s}
  function split(text) {
    const str = String(text || '');
    const out = [];
    let last = 0, i = 0;
    for (const m of str.matchAll(WORD)) {
      if (m.index > last) out.push({ word: false, s: str.slice(last, m.index) });
      out.push({ word: true, s: m[0], i: i++ });
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push({ word: false, s: str.slice(last) });
    return out;
  }
  const words = text => split(text).filter(t => t.word).map(t => t.s);

  // После правки текста отметки (marks: {index, word, broken?}) остаются на тех же словах.
  // Слова до правленого места не двигаются, после него сдвигаются на разницу длины; внутри правки отметка сохраняется,
  // только если одно слово заменено одним словом. Остальное помечается broken: автор должен отметить слово заново.
  function reanchor(oldW, newW, marks) {
    let p = 0;
    while (p < oldW.length && p < newW.length && oldW[p] === newW[p]) p++;
    let s = 0;
    while (s < oldW.length - p && s < newW.length - p && oldW[oldW.length - 1 - s] === newW[newW.length - 1 - s]) s++;
    const oldMid = oldW.length - p - s, newMid = newW.length - p - s;
    marks.forEach(e => {
      if (e.broken) { if (newW[e.index] === e.word) delete e.broken; return; } // текст вернули как был: отметка снова на месте
      if (e.index < p) return;
      if (e.index >= oldW.length - s) { e.index += newW.length - oldW.length; return; }
      if (oldMid === 1 && newMid === 1) { e.word = newW[e.index]; return; }
      e.broken = true;
    });
  }

  return { PALETTE, colorOf, inkOf, split, words, reanchor };
})();
