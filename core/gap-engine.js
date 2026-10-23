// Общий движок пропусков (Gap Engine): разметка текста с пропусками и операции над ней.
// Им пользуются редакторы Fill Blanks и Image to Gaps. Движок знает только текст и устойчивые ID пропусков:
// правильные ответы, картинки, банки, подсказки и баллы остаются в модулях (см. docs/spec/02_ARCHITECTURE/GAP_ENGINE.md).
// Предложение хранится как parts: строки текста и пропуски {gap: ID}. Номер версии `?v=` у подключения поднимайте при любом изменении.
const GapEngine = (() => {
  const isGap = p => typeof p !== 'string';

  // Пропуски в порядке появления в тексте. Стёртые из текста (но оставшиеся в данных, чтобы Ctrl+Z их вернул) не считаются
  const gapOrder = items => items.flatMap(i => i.parts.filter(isGap).map(p => p.gap));

  function nextId(prefix, ids) {
    return prefix + (Math.max(0, ...ids.map(id => parseInt(id.slice(prefix.length), 10) || 0)) + 1);
  }

  // Предложение как массив отдельных символов и пропусков: так удобно резать по позициям выделения
  const toTokens = parts => parts.flatMap(p => isGap(p) ? [p] : p.split(''));

  function fromTokens(tokens) {
    const parts = [];
    tokens.forEach(t => {
      if (!isGap(t) && typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += t;
      else parts.push(t);
    });
    return parts.length ? parts : [''];
  }

  const isChip = (n, chipClass) => n.classList && n.classList.contains(chipClass);

  // Текст из поля предложения обратно в данные; браузер может вставлять неразрывные пробелы и обёртки — их убираем.
  // hasGap(id) — известен ли модулю такой пропуск (чужие и стёртые значки отбрасываются)
  function readDom(ed, hasGap, chipClass) {
    const tokens = [], seen = new Set();
    const walk = n => n.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) tokens.push(...c.data.replace(/ /g, ' ').split(''));
      else if (isChip(c, chipClass)) {
        const id = c.dataset.gap;
        if (hasGap(id) && !seen.has(id)) { seen.add(id); tokens.push({ gap: id }); }
      } else walk(c);
    });
    walk(ed);
    return fromTokens(tokens);
  }

  // Позиция точки выделения в тех же единицах, что и toTokens: символ текста = 1, пропуск = 1
  function offsetIn(ed, node, off, hasGap, chipClass) {
    const r = document.createRange();
    r.setStart(ed, 0);
    r.setEnd(node, off);
    let n = 0;
    const walk = x => x.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) n += c.data.length;
      else if (isChip(c, chipClass)) n += hasGap(c.dataset.gap) ? 1 : 0;
      else walk(c);
    });
    walk(r.cloneContents());
    return n;
  }

  // Делает пропуск из выделенного в поле предложения текста. Меняет parts предложения.
  // o: {items, hasGap, editClass, chipClass, count (сколько пропусков уже есть), max, newId()}
  // Возвращает {error} или {id, text}: данные пропуска (ответ, картинка) заводит сам модуль
  function fromSelection(o) {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return { error: 'Сначала выделите слово или фразу в предложении.' };
    const r = sel.getRangeAt(0);
    const edOf = n => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest('.' + o.editClass);
    const ed = edOf(r.startContainer);
    if (!ed || ed !== edOf(r.endContainer)) return { error: 'Выделение должно быть внутри одного предложения.' };
    if (o.count >= o.max) return { error: `В задании не больше ${o.max} пропусков. Разделите его на два задания.` };

    const item = o.items.find(i => i.id === ed.dataset.item);
    item.parts = readDom(ed, o.hasGap, o.chipClass);
    const t = toTokens(item.parts);
    let s = offsetIn(ed, r.startContainer, r.startOffset, o.hasGap, o.chipClass), e = offsetIn(ed, r.endContainer, r.endOffset, o.hasGap, o.chipClass);
    const space = x => !isGap(x) && /\s/.test(x);
    while (s < e && space(t[s])) s++;
    while (e > s && space(t[e - 1])) e--;
    if (s === e) return { error: 'Выделите слово или фразу, а не пробел.' };
    if (t.slice(s, e).some(isGap)) return { error: 'В выделении уже есть пропуск. Выделите только обычный текст.' };

    const id = o.newId(), text = t.slice(s, e).join('');
    t.splice(s, e - s, { gap: id });
    item.parts = fromTokens(t);
    sel.removeAllRanges();
    return { id, text };
  }

  // Пропуск снова становится обычным текстом (text — что вернуть на его место)
  function restoreText(items, id, text) {
    const item = items.find(i => i.parts.some(p => isGap(p) && p.gap === id));
    if (!item) return;
    item.parts = fromTokens(toTokens(item.parts).flatMap(t => isGap(t) && t.gap === id ? String(text || '').split('') : [t]));
  }

  return { isGap, gapOrder, nextId, toTokens, fromTokens, readDom, offsetIn, fromSelection, restoreText };
})();
