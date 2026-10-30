// Редактор модуля Fill Blanks: предложения, пропуски, ответы и слова-ловушки.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const FillBlanksEditor = (() => {
  const MAX_GAPS = 10;
  let d, root, save, openGap = null, msgTimer = null, onBank = null, panelExtra = null;
  let counter, msg, panelBox, altsBox, bankChips, gapBar;

  const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  // Разметка пропусков в тексте — общий движок (core/gap-engine.js)
  const { isGap, nextId } = GapEngine;
  const hasGap = id => !!d.gaps[id];
  const readDom = ed => GapEngine.readDom(ed, hasGap, 'fb-chip');

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

  // Демо-пример (демо-режим в «Настройках», core/demo.js): пропуски с вариантами, подсказками и звуком, ловушки, озвучка
  function demo(layout) {
    const A = DimDemo.AUD, text = layout === 'text';
    const items = text
      ? [{ id: 's1', parts: ['Every morning I ', { gap: 'g1' }, ' to school. My sister ', { gap: 'g2' }, ' tea, and my brother ', { gap: 'g3' }, ' coffee.'], audio: A.a },
        { id: 's2', parts: ['On Sundays we ', { gap: 'g4' }, ' football in the park.'], audio: '' }]
      : [{ id: 's1', parts: ['I ', { gap: 'g1' }, ' to school every day.'], audio: A.a },
        { id: 's2', parts: ['My sister ', { gap: 'g2' }, ' tea, and my brother ', { gap: 'g3' }, ' coffee.'], audio: '' },
        { id: 's3', parts: ['On Sundays we ', { gap: 'g4' }, ' football.'], audio: '' }];
    return { ...create(layout), items, distractors: ['goes', 'plays'],
      instruction: DimDemo.instruction('Вставьте слова из банка в пропуски.'),
      gaps: {
        g1: { answer: 'go', alternatives: ['walk'], hint: 'Глагол движения', audio: A.b, hintAudio: A.c },
        g2: { answer: 'drinks', alternatives: [], hint: 'Что делают с чаем?', audio: '', hintAudio: '' },
        g3: { answer: 'prefers', alternatives: ['likes'], hint: '', audio: '', hintAudio: '' },
        g4: { answer: 'play', alternatives: [], hint: 'Футбол — это игра', audio: '', hintAudio: '' },
      } };
  }

  const isText = () => d.layout === 'text';
  const LAYOUT_NAME = { sentences: 'Отдельные предложения', text: 'Связный текст' };

  // bankChange — необязательная функция: модуль на базе Fill Blanks (Prepositions) узнаёт, что банк слов поменялся
  function render(container, draft, onSave, bankChange, extra) {
    root = container;
    d = draft;
    save = onSave;
    onBank = bankChange || null;
    panelExtra = extra || null;
    openGap = null;
    // Кнопка «Пропуск» над выделением: ядро (editor.html) следит за выделением и вызывает эту функцию
    if (typeof selBarHooks !== 'undefined') selBarHooks.add(updateGapBar);
    draw();
  }

  // Пропуски в порядке появления в тексте. В d.gaps могут остаться стёртые из текста (чтобы Ctrl+Z их вернул) — их не считаем
  const gapOrder = () => GapEngine.gapOrder(d.items);

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
  const svg = inner => `<svg class="fb-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
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
    // Озвучка предложения целиком: значок динамика открывает загрузку звука под предложением (серый — звука нет, цветной — есть)
    const aud = el('div', 'fb-aud');
    aud.hidden = !item.audio;
    const sound = el('button', 'fb-icon fb-sound', '🔊');
    sound.title = isText() ? 'Озвучка абзаца' : 'Озвучка предложения';
    sound.setAttribute('aria-label', sound.title);
    sound.classList.toggle('has', !!item.audio);
    sound.onclick = () => { aud.hidden = !aud.hidden; };
    if (window.mediaPicker) aud.append(window.mediaPicker('audio', () => item.audio || '', v => { item.audio = v; sound.classList.toggle('has', !!v); save(); }, isText() ? 'Загрузить озвучку абзаца' : 'Загрузить озвучку предложения'));
    card.append(sound);
    if (d.items.length > 1) {
      const del = el('button', 'fb-icon', '×');
      del.title = isText() ? 'Удалить абзац' : 'Удалить предложение';
      del.onclick = () => removeSentence(item);
      card.append(del);
    }
    card.append(aud);
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
    const r = GapEngine.fromSelection({ items: d.items, hasGap, editClass: 'fb-edit', chipClass: 'fb-chip', count: gapOrder().length, max: MAX_GAPS, newId: () => nextId('g', Object.keys(d.gaps)) });
    if (r.error) return say(r.error);
    d.gaps[r.id] = { answer: r.text, alternatives: [], hint: '', audio: '', hintAudio: '' };
    openGap = r.id;
    save();
    draw();
  }

  // Пропуск снова становится обычным текстом
  function removeGap(id) {
    GapEngine.restoreText(d.items, id, d.gaps[id].answer);
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

    // Звуки: озвучка слова (значок динамика на пропуске) и звук подсказки. Файл загружается в хранилище, в данных лежит путь
    const pick = (kind, field, label) => window.mediaPicker
      ? window.mediaPicker(kind, () => g[field] || '', v => { g[field] = v; save(); placePanel(); }, label)
      : document.createTextNode('');
    const voiceHead = el('div', 'fb-label fb-labelrow', 'Озвучка слова');
    voiceHead.append(help('Ученик нажимает значок динамика в правом верхнем углу пропуска и слышит этот звук. Он не зависит от проверок и подсказок.'));
    const hintAudioHead = el('div', 'fb-label fb-labelrow', 'Звук подсказки');
    hintAudioHead.append(help('Звучит в окне подсказки (после второй проверки), вместе с текстом подсказки или вместо него. Баллы и проверки не тратит.'));

    p.append(head, ans, noAnswer, altHead, altsBox, altAdder.wrap, hintHead, hint, hintAudioHead, pick('audio', 'hintAudio', 'Загрузить звук подсказки'), voiceHead, pick('audio', 'audio', 'Загрузить озвучку'));
    if (panelExtra) { const x = panelExtra(g, id, placePanel); if (x) p.append(x); }
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
    if (onBank) onBank();
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
        const voice = window.safeMediaPath && window.safeMediaPath(i.audio);
        return voice ? { id: i.id, parts, audio: { media: voice } } : { id: i.id, parts };
      });
    const gaps = {};
    items.forEach(i => i.parts.filter(isGap).forEach(p => {
      const g = draft.gaps[p.gap];
      gaps[p.gap] = { answer: clean(g.answer), alternatives: (g.alternatives || []).map(clean).filter(Boolean), hint: clean(g.hint) };
      // Звуки попадают в файл только с правильным путём в хранилище
      const voice = window.safeMediaPath && window.safeMediaPath(g.audio), hintVoice = window.safeMediaPath && window.safeMediaPath(g.hintAudio);
      if (voice) gaps[p.gap].audio = { media: voice };
      if (hintVoice) gaps[p.gap].hintAudio = { media: hintVoice };
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
      gaps[id] = { answer: String(g.answer || ''), alternatives: Array.isArray(g.alternatives) ? g.alternatives.map(String) : [], hint: String(g.hint || ''), audio: (g.audio && g.audio.media) || '', hintAudio: (g.hintAudio && g.hintAudio.media) || '' };
    });
    const items = file.items.map((i, k) => {
      const parts = (Array.isArray(i.parts) ? i.parts : []).filter(p => typeof p === 'string' || (p && gaps[p.gap]));
      return { id: String(i.id || 's' + (k + 1)), parts: parts.length ? parts : [''], audio: (i.audio && i.audio.media) || '' };
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

  return { create, demo, render, load, exportData, validate };
})();
