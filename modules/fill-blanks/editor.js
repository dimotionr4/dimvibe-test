// Редактор модуля Fill Blanks: предложения, пропуски, ответы и слова-ловушки.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const FillBlanksEditor = (() => {
  const MAX_GAPS = 10;
  let d, root, save, openGap = null, msgTimer = null;
  let counter, msg, panelBox, altsBox, bankChips, gapBar;

  const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const isGap = p => typeof p !== 'string';
  const isChip = n => n.classList && n.classList.contains('fb-chip');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // layout выбирается один раз при создании упражнения и потом не меняется:
  // 'sentences' — отдельные предложения, 'text' — связный текст (его абзацы хранятся как items)
  function create(layout) {
    return { module: 'fill_blanks', format: 2, layout: layout === 'text' ? 'text' : 'sentences', mode: 'word_bank', items: [{ id: 's1', parts: [''] }], gaps: {}, distractors: [] };
  }

  const isText = () => d.layout === 'text';
  const LAYOUT_NAME = { sentences: 'Отдельные предложения', text: 'Связный текст' };

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    openGap = null;
    // Кнопка «Пропуск» над выделением: ядро (editor.html) следит за выделением и вызывает эту функцию
    if (typeof selBarHooks !== 'undefined') selBarHooks.add(updateGapBar);
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

  // Значки способов ответа (подписи — в подсказках)
  const MODES = [
    ['word_bank', 'Банк слов', '<rect x="2" y="5" width="9" height="5" rx="2.5"/><rect x="13" y="5" width="9" height="5" rx="2.5"/><rect x="6" y="14" width="12" height="5" rx="2.5"/>'],
    ['dropdown', 'Выпадающий список', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 11l3 3 3-3"/>'],
    ['typing', 'Ввод вручную', '<rect x="2" y="7" width="20" height="11" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10"/>'],
  ];
  const svg = inner => `<svg class="fb-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));

  function draw() {
    root.innerHTML = '';
    root.className = 'fb-wrap';
    // Одна строка: способ ответа значками, счётчик, вид текста и «?»
    const tools = el('div', 'fb-tools');
    const modes = el('span', 'fb-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Способ ответа');
    MODES.forEach(([v, label, icon]) => {
      const b = el('button', d.mode === v ? 'active' : '');
      b.innerHTML = svg(icon);
      b.dataset.tip = 'Способ ответа: ' + label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(d.mode === v));
      b.onclick = () => {
        d.mode = v;
        save();
        modes.querySelectorAll('button').forEach((x, i) => { x.classList.toggle('active', MODES[i][0] === v); x.setAttribute('aria-pressed', String(MODES[i][0] === v)); });
      };
      modes.append(b);
    });
    counter = el('span', 'fb-muted');
    const kind = el('span', 'fb-kindtag', LAYOUT_NAME[d.layout]);
    kind.title = 'Вид текста выбирается при создании упражнения и не меняется';
    const right = el('span', 'fb-right');
    right.append(kind, help((isText() ? 'Вставьте или наберите текст, Enter начинает новый абзац. ' : '')
        + `Выделите слово или фразу ${isText() ? 'в тексте' : 'в предложении'} (двойной щелчок выделяет одно слово): над ним появится кнопка «Пропуск». Нажмите на готовый пропуск, чтобы настроить ответ.`));
    tools.append(counter, modes, right);

    msg = el('div', 'fb-msg');
    msg.hidden = true;

    const left = el('div', 'fb-left');
    d.items.forEach((item, i) => left.append(sentence(item, i)));
    left.classList.toggle('fb-textmode', isText());
    const add = el('button', 'fb-add', isText() ? '+ Абзац' : '+ Предложение');
    add.onclick = () => addSentence(d.items.length);
    left.append(add, bankSection());
    panelBox = el('div', 'fb-panel-box');
    // Кнопка «Пропуск» плавает над выделенным текстом
    gapBar = el('div', 'selbar');
    gapBar.hidden = true;
    const gb = el('button', '');
    gb.innerHTML = svg('<rect x="3" y="8" width="18" height="8" rx="3.5"/>') + ' Пропуск';
    gb.onmousedown = e => e.preventDefault(); // иначе нажатие на кнопку сбросит выделение в тексте
    gb.onclick = () => { gapBar.hidden = true; makeGap(); };
    gapBar.append(gb);
    root.append(tools, msg, left, panelBox, gapBar);
    updateCounter();
    drawBank();
    drawPanel();
  }
  function sentence(item, i) {
    const card = el('div', 'fb-sentence');
    if (!isText()) card.append(el('span', 'fb-num', `${i + 1}.`));
    const ed = el('div', 'fb-edit');
    ed.contentEditable = 'true';
    ed.dataset.item = item.id;
    ed.dataset.placeholder = isText() ? 'Введите или вставьте текст…' : 'Введите предложение…';
    fillDom(ed, item.parts);
    ed.oninput = () => {
      item.parts = readDom(ed);
      markEmpty(ed, item.parts);
      placePanel();
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
      const raw = e.clipboardData.getData('text/plain');
      // В связном тексте каждая строка вставленного текста становится отдельным абзацем
      const paras = isText() ? raw.split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
      if (paras.length < 2) { document.execCommand('insertText', false, raw.replace(/\s+/g, ' ')); return; }
      document.execCommand('insertText', false, paras[0]);
      item.parts = readDom(ed);
      let at = d.items.indexOf(item) + 1;
      const ids = d.items.map(i => i.id);
      paras.slice(1).forEach(p => {
        const id = nextId('s', ids);
        ids.push(id);
        d.items.splice(at++, 0, { id, parts: [p] });
      });
      save();
      draw();
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
      del.title = isText() ? 'Удалить абзац' : 'Удалить предложение';
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
    counter.textContent = `Пропусков: ${n}/${MAX_GAPS}`;
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
    if (ids.length && !confirm(`Удалить ${isText() ? 'абзац' : 'предложение'} вместе с пропусками (${ids.length})?`)) return;
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

  // Панель пропуска стоит рядом с самим пропуском (под ним) и закрывается щелчком мимо
  function placePanel() {
    if (!openGap || !panelBox.firstChild) return;
    const chip = root.querySelector(`.fb-chip[data-gap="${openGap}"]`);
    if (!chip) return;
    const r = root.getBoundingClientRect(), c = chip.getBoundingClientRect();
    const w = Math.min(320, r.width);
    panelBox.style.width = w + 'px';
    panelBox.style.left = Math.max(0, Math.min(c.left - r.left, r.width - w)) + 'px';
    panelBox.style.top = (c.bottom - r.top + 6) + 'px';
  }

  function closePanel() {
    if (!openGap) return;
    openGap = null;
    markChips();
    drawPanel();
  }

  function drawPanel() {
    panelBox.innerHTML = '';
    panelBox.hidden = !openGap;
    if (!openGap) return;
    const id = openGap, g = d.gaps[id];
    const p = el('div', 'fb-panel');
    const head = el('div', 'fb-panel-head');
    const del = el('button', 'fb-icon fb-trash', '');
    del.innerHTML = svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>');
    del.dataset.tip = 'Удалить пропуск: слово вернётся в текст';
    del.setAttribute('aria-label', 'Удалить пропуск');
    del.onclick = () => removeGap(id);
    const close = el('button', 'fb-icon', '×');
    close.title = 'Закрыть';
    close.onclick = closePanel;
    const tools = el('span', 'fb-panel-tools');
    tools.append(del, close);
    head.append(el('strong', '', `Пропуск ${gapOrder().indexOf(id) + 1}`), tools);

    const ans = input(g.answer, 'Правильный ответ');
    const noAnswer = el('div', 'fb-warn', 'Без ответа пропуск нельзя будет опубликовать.');
    noAnswer.hidden = !!g.answer.trim();
    ans.oninput = () => {
      g.answer = ans.value;
      noAnswer.hidden = !!g.answer.trim();
      const c = root.querySelector(`.fb-chip[data-gap="${id}"]`);
      if (c) c.textContent = g.answer || '?';
      drawBank();
      placePanel();
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

    const hint = input(g.hint, 'Подсказка (необязательно)');
    hint.oninput = () => { g.hint = hint.value; save(); };

    const altHead = el('div', 'fb-label fb-labelrow', 'Другие верные ответы');
    altHead.append(help('Засчитываются как верные. В выпадающий список попадают сами, в банк слов — нет (добавьте их ловушкой, если нужно).'));
    const hintHead = el('div', 'fb-label fb-labelrow', 'Подсказка для ученика');
    hintHead.append(help('Значок подсказки откроется у ученика после второй проверки, если пропуск останется неверным или пустым. Баллы и проверки подсказка не тратит. Подсказка не покажется, если проверка всего одна.'));

    p.append(head, ans, noAnswer, altHead, altsBox, altAdder.wrap, hintHead, hint);
    panelBox.append(p);
    placePanel();
  }

  // Показывать кнопку «Пропуск», пока в предложении выделен текст
  function updateGapBar() {
    if (!root || !root.isConnected || !gapBar) return;
    const s = getSelection();
    const inEd = n => n && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest('.fb-edit');
    if (!s.rangeCount || s.isCollapsed || !inEd(s.anchorNode) || !root.contains(s.anchorNode) || !s.toString().trim()) { gapBar.hidden = true; return; }
    placeSelBar(gapBar, root, s.getRangeAt(0));
  }
  // Щелчок мимо панели закрывает её (щелчки по пропускам, внутри панели и по подсказкам «?» не в счёт)
  if (!window.__fbOutside) {
    window.__fbOutside = true;
    addEventListener('pointerdown', e => {
      if (openGap && root && root.isConnected && !e.target.closest('.fb-panel-box, .fb-chip, .help, .helpbub')) closePanel();
    });
    addEventListener('resize', () => placePanel());
  }

  function bankSection() {
    const box = el('div', 'fb-bank');
    bankChips = el('div', 'fb-chips');
    const open = el('button', 'fb-add', '+ Ловушка');
    open.dataset.tip = 'Добавить неверный вариант';
    const trapAdder = adder('Неверный вариант', text => {
      if (gapOrder().some(id => norm(d.gaps[id].answer) === norm(text))) return 'Это слово уже есть среди ответов пропусков.';
      if (d.distractors.some(w => norm(w) === norm(text))) return 'Такое слово уже есть.';
      d.distractors.push(text);
      save();
      drawBank();
    });
    trapAdder.wrap.hidden = true;
    open.onclick = () => { open.hidden = true; trapAdder.wrap.hidden = false; trapAdder.inp.focus(); };
    const head = el('div', 'fb-labelrow');
    head.append(el('h3', '', 'Банк слов и список'),
      help('Ответы пропусков (серые) добавляются сами. Слова-ловушки — неверные варианты; они появятся и в банке слов, и в выпадающем списке.'));
    box.append(head, bankChips, open, trapAdder.wrap);
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
