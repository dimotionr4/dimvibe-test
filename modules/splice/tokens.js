// Деление слова Splice на части — общее для редактора и плеера (одно правило в одном месте).
// Слово записано с косыми чертами: «mo/dern/ize». Части — то, что между чертами (пробелы по краям убираются, пустые пропускаются).
// Кнопка «Авто» в редакторе лишь расставляет черты примерно поровну, по графемам (буква с ударением — одна графема):
// это техническое деление, а не слоговое; автор поправляет его вручную.
const SpliceTokens = (() => {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const graphemes = s => (seg ? [...seg.segment(s)].map(x => x.segment) : Array.from(s));
  const nfc = s => String(s || '').normalize('NFC');

  // Части слова по порядку
  const split = answer => nfc(answer).split('/').map(p => p.trim()).filter(Boolean);
  // Слово целиком: части склеиваются без пробела
  const join = pieces => pieces.join('');
  // Слово так, как его увидит ученик (без косых черт)
  const text = answer => join(split(answer));
  // Части через точку для показа правильного ответа: mo·dern·ize
  const show = answer => split(answer).join(' · ');
  // Сравнение: по значению (одинаковые кусочки взаимозаменяемы), Unicode NFC, регистр и знаки важны
  const same = (a, b) => nfc(a) === nfc(b);

  // Поделить слово на n частей примерно поровну (лишние буквы достаются первым частям); n больше длины — столько частей, сколько букв
  function auto(answer, n) {
    const g = graphemes(text(answer));
    const k = Math.max(1, Math.min(n, g.length));
    const base = Math.floor(g.length / k), extra = g.length % k, out = [];
    let at = 0;
    for (let i = 0; i < k; i++) {
      const len = base + (i < extra ? 1 : 0);
      out.push(g.slice(at, at + len).join(''));
      at += len;
    }
    return out.join('/');
  }

  return { split, join, text, show, same, auto };
})();
