// Общее для редактора и плеера Mistake Mode: деление текста на слова и перепривязка пометок после правки текста.
// Слово — буквы и цифры любого языка; дефис и апостроф внутри слова остаются в слове. Знаки препинания вокруг не нажимаются.
const MistakeTokens = (() => {
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

  // После правки текста пометки (errors: {index, word, broken?}) остаются на тех же словах.
  // Слова до правленого места не двигаются, после него сдвигаются на разницу длины; внутри правки пометка сохраняется,
  // только если одно слово заменено одним словом. Остальное помечается broken: автор должен пометить слово заново.
  function reanchor(oldW, newW, errors) {
    let p = 0;
    while (p < oldW.length && p < newW.length && oldW[p] === newW[p]) p++;
    let s = 0;
    while (s < oldW.length - p && s < newW.length - p && oldW[oldW.length - 1 - s] === newW[newW.length - 1 - s]) s++;
    const oldMid = oldW.length - p - s, newMid = newW.length - p - s;
    errors.forEach(e => {
      if (e.broken) { if (newW[e.index] === e.word) delete e.broken; return; } // текст вернули как был: пометка снова на месте
      if (e.index < p) return;
      if (e.index >= oldW.length - s) { e.index += newW.length - oldW.length; return; }
      if (oldMid === 1 && newMid === 1) { e.word = newW[e.index]; return; }
      e.broken = true;
    });
  }

  return { split, words, reanchor };
})();
