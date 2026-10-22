// Редактор модуля Fill Blanks: предложения, пропуски, ответы и слова-ловушки.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const FillBlanksEditor = (() => {
  const MAX_GAPS = 10;
  let d, root, save, openGap = null, msgTimer = null;
  let counter, msg, panelBox, altsBox, bankChips;

  const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const isGap = p => typeof p !== 'string';
  const isChip = n => n.classList && n.classList.contains('fb-chip');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function create() {
    return { module: 'fill_blanks', format: 2, layout: 'sentences', mode: 'word_bank', items: [{ id: 's1', parts: [''] }], gaps: {}, distractors: [] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    openGap = null;
    draw();
  }

  // Пропуски в порядке появления в тексте. В d.gaps могут остаться стёртые из текста (чтобы Ctrl+Z их вернул) — их не считаем
  const gapOrder = () => d.items.flatMap(i => i.parts.filter(isGap).map(p => p.gap));

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

  // Текст из поля предложения обратно в данные; браузер может вставлять неразрывные пробелы и обёртки — их убираем
  function readDom(ed) {
    const tokens = [], seen = new Set();
    const walk = n => n.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) tokens.push(...c.data.replace(/ /g, ' ').split(''));
      else if (isChip(c)) {
        const id = c.dataset.gap;
        if (d.gaps[id] && !seen.has(id)) { seen.add(id); tokens.push({ gap: id }); }
      } else walk(c);
    });
    walk(ed);
    return fromTokens(tokens);
  }

  // Позиция точки выделения в тех же единицах, что и toTokens: символ текста = 1, пропуск = 1
  function offsetIn(ed, node, off) {
    const r = document.createRange();
    r.setStart(ed, 0);
    r.setEnd(node, off);
    let n = 0;
    const walk = x => x.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) n += c.data.length;
      else if (isChip(c)) n += d.gaps[c.dataset.gap] ? 1 : 0;
      else walk(c);
    });
    walk(r.cloneContents());
    return n;
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 6000);
  }

  function draw() {
    root.innerHTML = '';
    const opts = el('div', 'fb-row');
    opts.append(
      select('Вид текста', [['sentences', 'Отдельные предложения'], ['text', 'Связный текст (будет позже)', true]], d.layout, v => { d.layout = v; save(); }),
      select('Способ ответа', [['word_bank', 'Банк слов'], ['dropdown', 'Выпадающий список'], ['typing', 'Ввод вручную']], d.mode, v => { d.mode = v; save(); })
    );

    const bar = el('div', 'fb-bar');
    const make = el('button', 'primary', 'Сделать пропуском');
    make.onmousedown = e => e.preventDefault(); // иначе нажатие на кнопку сбросит выделение в тексте
    make.onclick = makeGap;
    counter = el('span', 'fb-muted');
    bar.append(make, counter);

    msg = el('div', 'fb-msg');
    msg.hidden = true;

    const grid = el('div', 'fb-grid');
    const left = el('div', 'fb-left');
    d.items.forEach((item, i) => left.append(sentence(item, i)));
    const add = el('button', 'fb-add', '+ Предложение');
    add.onclick = () => addSentence(d.items.length);
    left.append(add, bankSection());
    panelBox = el('div', 'fb-panel-box');
    grid.append(left, panelBox);

    root.append(opts, bar,
      el('p', 'fb-help', 'Выделите слово или фразу в предложении (двойной щелчок выделяет одно слово) и нажмите «Сделать пропуском». Нажмите на пропуск, чтобы настроить ответ.'),
      msg, grid);
    updateCounter();
    drawBank();
    drawPanel();
  }

  function select(label, options, value, onPick) {
    const wrap = el('label', 'fb-field', label);
    const s = el('select');
    options.forEach(([v, text, disabled]) => {
      const o = el('option', '', text);
      o.value = v;
      o.disabled = !!disabled;
      s.append(o);
    });
    s.value = value;
    s.onchange = () => onPick(s.value);
    wrap.append(s);
    return wrap;
  }

  function sentence(item, i) {
    const card = el('div', 'fb-sentence');
    card.append(el('span', 'fb-num', `${i + 1}.`));
    const ed = el('div', 'fb-edit');
    ed.contentEditable = 'true';
    ed.dataset.item = item.id;
    ed.dataset.placeholder = 'Введите предложение…';
    fillDom(ed, item.parts);
    ed.oninput = () => {
      item.parts = readDom(ed);
      markEmpty(ed, item.parts);
      updateCounter();
      drawBank();
      if (openGap && !gapOrder().includes(openGap)) { openGap = null; drawPanel(); }
      save();
    };
    ed.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); addSentence(d.items.indexOf(item) + 1); }
      // Жирный/курсив в предложениях не нужен
      if ((e.ctrlKey || e.metaKey) && ['KeyB', 'KeyI', 'KeyU'].includes(e.code)) e.preventDefault();
    };
    ed.onpaste = e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
    };
    ed.ondrop = e => e.preventDefault();
    ed.onclick = e => {
      const c = e.target.closest('.fb-chip');
      if (!c) return;
      openGap = c.dataset.gap;
      markChips();
      drawPanel();
    };
    card.append(ed);
    if (d.items.length > 1) {
      const del = el('button', 'fb-icon', '×');
      del.title = 'Удалить предложение';
      del.onclick = () => removeSentence(item);
      card.append(del);
    }
    return card;
  }

  function fillDom(ed, parts) {
    ed.innerHTML = '';
    parts.forEach(p => ed.append(isGap(p) ? chip(p.gap) : document.createTextNode(p)));
    markEmpty(ed, parts);
  }

  const markEmpty = (ed, parts) => ed.classList.toggle('empty', !parts.some(p => isGap(p) || p.trim()));

  function chip(id) {
    const c = el('span', 'fb-chip' + (id === openGap ? ' open' : ''), d.gaps[id].answer || '?');
    c.contentEditable = 'false';
    c.dataset.gap = id;
    return c;
  }

  const markChips = () => root.querySelectorAll('.fb-chip').forEach(c => c.classList.toggle('open', c.dataset.gap === openGap));

  function updateCounter() {
    const n = gapOrder().length;
    counter.textContent = `Пропусков: ${n} из ${MAX_GAPS}`;
    counter.classList.toggle('fb-limit', n >= MAX_GAPS);
  }

  function makeGap() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return say('Сначала выделите слово или фразу в предложении.');
    const r = sel.getRangeAt(0);
    const edOf = n => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest('.fb-edit');
    const ed = edOf(r.startContainer);
    if (!ed || ed !== edOf(r.endContainer)) return say('Выделение должно быть внутри одного предложения.');
    if (gapOrder().length >= MAX_GAPS) return say(`В задании не больше ${MAX_GAPS} пропусков. Разделите его на два задания.`);

    const item = d.items.find(i => i.id === ed.dataset.item);
    item.parts = readDom(ed);
    const t = toTokens(item.parts);
    let s = offsetIn(ed, r.startContainer, r.startOffset), e = offsetIn(ed, r.endContainer, r.endOffset);
    const space = x => !isGap(x) && /\s/.test(x);
    while (s < e && space(t[s])) s++;
    while (e > s && space(t[e - 1])) e--;
    if (s === e) return say('Выделите слово или фразу, а не пробел.');
    if (t.slice(s, e).some(isGap)) return say('В выделении уже есть пропуск. Выделите только обычный текст.');

    const id = nextId('g', Object.keys(d.gaps));
    d.gaps[id] = { answer: t.slice(s, e).join(''), alternatives: [], hint: '' };
    t.splice(s, e - s, { gap: id });
    item.parts = fromTokens(t);
    sel.removeAllRanges();
    openGap = id;
    save();
    draw();
  }

  // Пропуск снова становится обычным текстом
  function removeGap(id) {
    const item = d.items.find(i => i.parts.some(p => isGap(p) && p.gap === id));
    item.parts = fromTokens(toTokens(item.parts).flatMap(t => isGap(t) && t.gap === id ? d.gaps[id].answer.split('') : [t]));
    delete d.gaps[id];
    openGap = null;
    save();
    draw();
  }

  function addSentence(index) {
    const id = nextId('s', d.items.map(i => i.id));
    d.items.splice(index, 0, { id, parts: [''] });
    save();
    draw();
    root.querySelector(`[data-item="${id}"]`).focus();
  }

  function removeSentence(item) {
    const ids = item.parts.filter(isGap).map(p => p.gap);
    if (ids.length && !confirm(`Удалить предложение вместе с пропусками (${ids.length})?`)) return;
    d.items.splice(d.items.indexOf(item), 1);
    ids.forEach(id => delete d.gaps[id]);
    if (ids.includes(openGap)) openGap = null;
    save();
    draw();
  }

  function field(label, control) {
    const wrap = el('label', 'fb-field', label);
    wrap.append(control);
    return wrap;
  }

  function input(value, placeholder) {
    const i = el('input');
    i.value = value;
    i.placeholder = placeholder;
    return i;
  }

  function tag(text, onRemove, cls) {
    const t = el('span', 'fb-tag' + (cls ? ' ' + cls : ''), text);
    if (onRemove) {
      const x = el('button', 'fb-tag-x', '×');
      x.title = 'Убрать';
      x.onclick = onRemove;
      t.append(x);
    }
    return t;
  }

  // Поле «добавить слово»: onAdd возвращает текст ошибки или ничего
  function adder(placeholder, onAdd) {
    const row = el('div', 'fb-adder');
    const inp = input('', placeholder);
    const btn = el('button', '', 'Добавить');
    const err = el('div', 'fb-warn');
    err.hidden = true;
    const go = () => {
      const text = inp.value.trim().replace(/\s+/g, ' ');
      if (!text) return;
      const problem = onAdd(text);
      err.hidden = !problem;
      err.textContent = problem || '';
      if (problem) return;
      inp.value = '';
      inp.focus();
    };
    btn.onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    inp.oninput = () => { err.hidden = true; };
    row.append(inp, btn);
    const wrap = el('div');
    wrap.append(row, err);
    return { wrap, inp };
  }

  function drawPanel() {
    panelBox.innerHTML = '';
    if (!openGap) {
      panelBox.append(el('p', 'fb-muted', 'Нажмите на пропуск в тексте, чтобы настроить ответ.'));
      return;
    }
    const id = openGap, g = d.gaps[id];
    const p = el('div', 'fb-panel');
    const head = el('div', 'fb-panel-head');
    const close = el('button', 'fb-icon', '×');
    close.title = 'Закрыть';
    close.onclick = () => { openGap = null; markChips(); drawPanel(); };
    head.append(el('strong', '', `Пропуск ${gapOrder().indexOf(id) + 1}`), close);

    const ans = input(g.answer, 'Правильный ответ');
    const noAnswer = el('div', 'fb-warn', 'Без ответа пропуск нельзя будет опубликовать.');
    noAnswer.hidden = !!g.answer.trim();
    ans.oninput = () => {
      g.answer = ans.value;
      noAnswer.hidden = !!g.answer.trim();
      const c = root.querySelector(`.fb-chip[data-gap="${id}"]`);
      if (c) c.textContent = g.answer || '?';
      drawBank();
      save();
    };

    altsBox = el('div', 'fb-chips');
    const drawAlts = () => {
      altsBox.innerHTML = '';
      g.alternatives.forEach((a, i) => altsBox.append(tag(a, () => { g.alternatives.splice(i, 1); save(); drawAlts(); })));
    };
    drawAlts();
    const altAdder = adder('Другой верный вариант', text => {
      if (norm(text) === norm(g.answer) || g.alternatives.some(a => norm(a) === norm(text))) return 'Такой ответ уже есть.';
      g.alternatives.push(text);
      save();
      drawAlts();
    });

    const hint = input(g.hint, 'Необязательно');
    hint.oninput = () => { g.hint = hint.value; save(); };

    const del = el('button', 'fb-danger', 'Удалить пропуск');
    del.onclick = () => removeGap(id);

    p.append(head,
      field('Правильный ответ', ans), noAnswer,
      el('div', 'fb-label', 'Другие верные ответы'), altsBox, altAdder.wrap,
      el('p', 'fb-help', 'Засчитываются как верные. В выпадающий список попадают сами, в банк слов — нет (добавьте их ловушкой, если нужно).'),
      field('Подсказка для ученика', hint),
      el('p', 'fb-help', 'Пока только сохраняется, показывать ученику будем позже.'),
      del, el('p', 'fb-help', 'Слово вернётся в текст.'));
    panelBox.append(p);
  }

  function bankSection() {
    const box = el('div', 'fb-bank');
    bankChips = el('div', 'fb-chips');
    const open = el('button', 'fb-add', '+ Добавить слово');
    const trapAdder = adder('Неверный вариант', text => {
      if (gapOrder().some(id => norm(d.gaps[id].answer) === norm(text))) return 'Это слово уже есть среди ответов пропусков.';
      if (d.distractors.some(w => norm(w) === norm(text))) return 'Такое слово уже есть.';
      d.distractors.push(text);
      save();
      drawBank();
    });
    trapAdder.wrap.hidden = true;
    open.onclick = () => { open.hidden = true; trapAdder.wrap.hidden = false; trapAdder.inp.focus(); };
    box.append(el('h3', '', 'Банк слов и выпадающий список'),
      el('p', 'fb-help', 'Ответы пропусков (серые) добавляются сами. Слова-ловушки — неверные варианты; они появятся и в банке слов, и в выпадающем списке.'),
      bankChips, open, trapAdder.wrap);
    return box;
  }

  function drawBank() {
    bankChips.innerHTML = '';
    gapOrder().forEach(id => {
      const t = tag(d.gaps[id].answer || '?', null, 'fb-auto');
      t.title = 'Ответ пропуска: меняется в самом пропуске';
      bankChips.append(t);
    });
    d.distractors.forEach((w, i) => bankChips.append(tag(w, () => { d.distractors.splice(i, 1); save(); drawBank(); }, 'fb-trap')));
  }

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  // Данные для файла упражнения: без пустых предложений, лишних пробелов и стёртых из текста пропусков
  function exportData(draft) {
    const items = draft.items
      .filter(i => i.parts.some(p => isGap(p) || p.trim()))
      .map(i => {
        const parts = i.parts.map((p, k) => {
          if (isGap(p)) return p;
          let s = p.replace(/\s+/g, ' ');
          if (k === 0) s = s.trimStart();
          if (k === i.parts.length - 1) s = s.trimEnd();
          return s;
        }).filter(p => p !== '');
        return { id: i.id, parts };
      });
    const gaps = {};
    items.forEach(i => i.parts.filter(isGap).forEach(p => {
      const g = draft.gaps[p.gap];
      gaps[p.gap] = { answer: clean(g.answer), alternatives: (g.alternatives || []).map(clean).filter(Boolean), hint: clean(g.hint) };
    }));
    return { module: 'fill_blanks', format: 2, layout: draft.layout, mode: draft.mode, items, gaps, distractors: draft.distractors.map(clean).filter(Boolean) };
  }

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const ex = exportData(draft), errors = [], warnings = [];
    const order = ex.items.flatMap(i => i.parts.filter(isGap).map(p => p.gap));
    if (!order.length) errors.push('Нет ни одного пропуска.');
    if (order.length > MAX_GAPS) errors.push(`Пропусков больше ${MAX_GAPS}. Разделите задание на два.`);
    order.forEach((id, n) => { if (!ex.gaps[id].answer) errors.push(`Пропуск ${n + 1}: нет правильного ответа.`); });
    if (ex.mode === 'dropdown' && order.length) {
      const pool = new Set([...order.flatMap(id => [ex.gaps[id].answer, ...ex.gaps[id].alternatives]), ...ex.distractors].map(norm).filter(Boolean));
      order.forEach((id, n) => {
        const right = new Set([ex.gaps[id].answer, ...ex.gaps[id].alternatives].map(norm));
        if (![...pool].some(w => !right.has(w))) errors.push(`Пропуск ${n + 1}: в выпадающем списке нет неверного варианта. Добавьте слово-ловушку.`);
      });
      if (pool.size > 8) warnings.push(`В выпадающем списке ${pool.size} вариантов. Обычно хватает 3–5.`);
    }
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика. Недостающее заполняется, пропуски без данных выбрасываются
  function load(file) {
    if (!Array.isArray(file.items)) throw new Error('В файле нет предложений.');
    const gaps = {};
    Object.entries(file.gaps || {}).forEach(([id, g]) => {
      gaps[id] = { answer: String(g.answer || ''), alternatives: Array.isArray(g.alternatives) ? g.alternatives.map(String) : [], hint: String(g.hint || '') };
    });
    const items = file.items.map((i, k) => {
      const parts = (Array.isArray(i.parts) ? i.parts : []).filter(p => typeof p === 'string' || (p && gaps[p.gap]));
      return { id: String(i.id || 's' + (k + 1)), parts: parts.length ? parts : [''] };
    });
    return {
      ...create(),
      layout: file.layout === 'text' ? 'text' : 'sentences',
      mode: ['word_bank', 'dropdown', 'typing'].includes(file.mode) ? file.mode : 'word_bank',
      items: items.length ? items : create().items,
      gaps,
      distractors: Array.isArray(file.distractors) ? file.distractors.map(String) : [],
    };
  }

  return { create, render, load, exportData, validate };
})();
