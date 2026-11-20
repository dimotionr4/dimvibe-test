// Редактор модуля Mini Dialogues (мини-диалоги): говорящие, диалоги, реплики и пропуски внутри реплик.
// Этап 1 (2026-11-21): только текст, ввод с клавиатуры. Этап 2 (2026-11-21): способ ответа на всё упражнение — ввод, банк слов или выпадающий список, слова-ловушки.
// Картинки и звук — следующие этапы.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Разметка пропусков в репликах — общий движок (core/gap-engine.js). Реплика хранится как parts: строки и пропуски {gap: ID}.
const MiniDialoguesEditor = (() => {
  const MAX_GAPS = 20, MAX_SPEAKERS = 6, LONG_LINE = 220;
  // Способ ответа — один на всё упражнение. Значки: банк слов, выпадающий список, ввод вручную
  const MODES = [
    ['word_bank', 'Банк слов', '<rect x="2" y="5" width="9" height="5" rx="2.5"/><rect x="13" y="5" width="9" height="5" rx="2.5"/><rect x="6" y="14" width="12" height="5" rx="2.5"/>'],
    ['dropdown', 'Выпадающий список', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 11l3 3 3-3"/>'],
    ['typing', 'Ввод вручную', '<rect x="2" y="7" width="20" height="11" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10"/>'],
  ];
  let d, root, save, openGap = null, msgTimer = null;
  let counter, msg, panelBox, gapBar, bankBox;

  const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const { isGap, nextId } = GapEngine;
  const hasGap = id => !!d.gaps[id];
  const readDom = ed => GapEngine.readDom(ed, hasGap, 'md-chip');
  const allLines = () => d.dialogues.flatMap(x => x.lines);
  const gapOrder = () => GapEngine.gapOrder(allLines());
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function create() {
    return {
      module: 'mini_dialogues', format: 1, mode: 'typing', distractors: [],
      speakers: [{ id: 'sp1', name: '', side: 'auto' }, { id: 'sp2', name: '', side: 'auto' }],
      dialogues: [{ id: 'd1', title: '', lines: [{ id: 'l1', speaker: 'sp1', parts: [''] }, { id: 'l2', speaker: 'sp2', parts: [''] }] }],
      gaps: {},
    };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): два диалога, три говорящих, ответы с вариантами и подсказками
  function demo() {
    return {
      ...create(),
      mode: 'word_bank', distractors: ['wants', 'cup'],
      instruction: DimDemo.instruction('Вставьте слова из банка в пропуски диалогов.'),
      speakers: [{ id: 'sp1', name: 'Anna', side: 'left' }, { id: 'sp2', name: 'Tom', side: 'right' }, { id: 'sp3', name: 'Waiter', side: 'left' }],
      dialogues: [
        { id: 'd1', title: 'At the café', lines: [
          { id: 'l1', speaker: 'sp3', parts: ['Good morning! What would you ', { gap: 'g1' }, '?'] },
          { id: 'l2', speaker: 'sp1', parts: ['A cup of ', { gap: 'g2' }, ', please.'] },
          { id: 'l3', speaker: 'sp2', parts: ['And I would like a ', { gap: 'g3' }, ' of orange juice.'] },
          { id: 'l4', speaker: 'sp3', parts: ['Of course. Anything ', { gap: 'g4' }, '?'] },
        ] },
        { id: 'd2', title: 'After school', lines: [
          { id: 'l5', speaker: 'sp1', parts: ['What do you usually ', { gap: 'g5' }, ' after school?'] },
          { id: 'l6', speaker: 'sp2', parts: ['I play football with my friends.'] },
        ] },
      ],
      gaps: {
        g1: { answer: 'like', alternatives: ['want'], hint: 'Вежливый вопрос о заказе' },
        g2: { answer: 'tea', alternatives: [], hint: '' },
        g3: { answer: 'glass', alternatives: [], hint: 'Ёмкость для сока' },
        g4: { answer: 'else', alternatives: [], hint: '' },
        g5: { answer: 'do', alternatives: [], hint: '' },
      },
    };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    openGap = null;
    // Кнопка «Пропуск» над выделением: ядро (editor.html) следит за выделением и вызывает эту функцию
    if (typeof selBarHooks !== 'undefined') selBarHooks.add(updateGapBar);
    draw();
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 6000);
  }

  const speakerName = (sp, i) => clean(sp.name) || `Говорящий ${i + 1}`;
  const speakerOf = id => d.speakers.find(s => s.id === id);

  function draw() {
    root.innerHTML = '';
    root.className = 'md-wrap';
    counter = el('span', 'md-muted');
    const tools = el('div', 'md-tools');
    const modes = el('span', 'md-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Способ ответа');
    MODES.forEach(([v, label, icon]) => {
      const b = el('button', d.mode === v ? 'active' : '');
      b.innerHTML = `<svg class="md-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(icon) : icon}</svg>`;
      b.dataset.tip = 'Способ ответа: ' + label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(d.mode === v));
      b.onclick = () => { d.mode = v; save(); draw(); };
      modes.append(b);
    });
    tools.append(counter, modes, help('Диалог — это несколько реплик от двух и более говорящих. Выделите слово или фразу в реплике (двойной щелчок выделяет одно слово): над ним появится кнопка «Пропуск». Нажмите на готовый пропуск, чтобы настроить ответ.'));
    msg = el('div', 'md-msg');
    msg.hidden = true;

    const box = el('div', 'md-body');
    box.append(speakersCard());
    d.dialogues.forEach((dlg, i) => box.append(dialogueCard(dlg, i)));
    const add = el('button', 'md-add', '+ Диалог');
    add.onclick = addDialogue;
    box.append(add);
    if (d.mode !== 'typing') box.append(bankSection());

    panelBox = el('div', 'md-panel-box');
    gapBar = el('div', 'selbar');
    gapBar.hidden = true;
    const gb = el('button', '', 'Пропуск');
    gb.onmousedown = e => e.preventDefault(); // иначе нажатие на кнопку сбросит выделение в тексте
    gb.onclick = () => { gapBar.hidden = true; makeGap(); };
    gapBar.append(gb);
    root.append(tools, msg, box, panelBox, gapBar);
    updateCounter();
    drawPanel();
  }

  // ---- Говорящие ----
  function speakersCard() {
    const card = el('section', 'md-card md-speakers');
    const head = el('div', 'md-head');
    head.append(el('h3', '', 'Говорящие'), help('Сторона «Авто»: первый говорящий слева, второй справа, дальше по очереди. Имя показывается у ученика всегда, поэтому говорящих различают не только по цвету и стороне.'));
    card.append(head);
    d.speakers.forEach((sp, i) => {
      const row = el('div', 'md-spk');
      const dot = el('span', 'md-dot md-c' + (i % 6), (clean(sp.name)[0] || String(i + 1)).toUpperCase());
      const name = el('input');
      name.value = sp.name;
      name.placeholder = `Имя говорящего ${i + 1}`;
      name.oninput = () => {
        sp.name = name.value;
        dot.textContent = (clean(sp.name)[0] || String(i + 1)).toUpperCase();
        root.querySelectorAll(`.md-spk-sel option[value="${sp.id}"]`).forEach(o => { o.textContent = speakerName(sp, i); });
        save();
      };
      const side = el('select', 'md-side');
      [['auto', 'Авто'], ['left', 'Слева'], ['right', 'Справа']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v; side.append(o); });
      side.value = sp.side;
      side.setAttribute('aria-label', 'Сторона');
      side.onchange = () => { sp.side = side.value; save(); };
      row.append(dot, name, side);
      if (d.speakers.length > 2) {
        const del = el('button', 'md-icon', '×');
        del.title = 'Удалить говорящего';
        del.onclick = () => removeSpeaker(sp);
        row.append(del);
      }
      card.append(row);
    });
    if (d.speakers.length < MAX_SPEAKERS) {
      const add = el('button', 'md-add', '+ Говорящий');
      add.onclick = () => {
        d.speakers.push({ id: nextId('sp', d.speakers.map(s => s.id)), name: '', side: 'auto' });
        save();
        draw();
      };
      card.append(add);
    }
    return card;
  }

  function removeSpeaker(sp) {
    const used = allLines().filter(l => l.speaker === sp.id).length;
    if (used && !confirm(`У этого говорящего реплик: ${used}. Они останутся без говорящего, и придётся выбрать им другого. Удалить?`)) return;
    d.speakers.splice(d.speakers.indexOf(sp), 1);
    allLines().forEach(l => { if (l.speaker === sp.id) l.speaker = ''; });
    save();
    draw();
  }

  // ---- Диалоги и реплики ----
  function dialogueCard(dlg, di) {
    const card = el('section', 'md-card md-dialogue');
    const head = el('div', 'md-head');
    head.append(el('h3', '', `Диалог ${di + 1}`));
    const title = el('input', 'md-title');
    title.value = dlg.title;
    title.placeholder = 'Название или сцена (необязательно)';
    title.oninput = () => { dlg.title = title.value; save(); };
    head.append(title);
    if (d.dialogues.length > 1) {
      const del = el('button', 'md-icon', '×');
      del.title = 'Удалить диалог';
      del.onclick = () => removeDialogue(dlg);
      head.append(del);
    }
    card.append(head);
    dlg.lines.forEach((line, li) => card.append(lineRow(dlg, line, li)));
    const add = el('button', 'md-add', '+ Реплика');
    add.onclick = () => addLine(dlg, dlg.lines.length);
    card.append(add);
    return card;
  }

  function lineRow(dlg, line, li) {
    const row = el('div', 'md-line');
    const sel = el('select', 'md-spk-sel');
    sel.setAttribute('aria-label', `Говорящий в реплике ${li + 1}`);
    if (!line.speaker || !speakerOf(line.speaker)) { const o = el('option', '', 'Выберите говорящего'); o.value = ''; sel.append(o); }
    d.speakers.forEach((sp, i) => { const o = el('option', '', speakerName(sp, i)); o.value = sp.id; sel.append(o); });
    sel.value = line.speaker && speakerOf(line.speaker) ? line.speaker : '';
    sel.classList.toggle('md-none', !sel.value);
    sel.onchange = () => { line.speaker = sel.value; sel.classList.toggle('md-none', !sel.value); save(); };
    const ed = el('div', 'md-edit');
    ed.contentEditable = 'true';
    ed.dataset.item = line.id;
    ed.dataset.placeholder = 'Введите реплику…';
    fillDom(ed, line.parts);
    ed.oninput = () => {
      line.parts = readDom(ed);
      markEmpty(ed, line.parts);
      placePanel();
      updateCounter();
      drawBank();
      if (openGap && !gapOrder().includes(openGap)) { openGap = null; drawPanel(); }
      save();
    };
    ed.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); addLine(dlg, dlg.lines.indexOf(line) + 1); }
      if ((e.ctrlKey || e.metaKey) && ['KeyB', 'KeyI', 'KeyU'].includes(e.code)) e.preventDefault();
    };
    ed.onpaste = e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
    };
    ed.ondrop = e => e.preventDefault();
    ed.onclick = e => {
      const c = e.target.closest('.md-chip');
      if (!c) return;
      openGap = c.dataset.gap;
      markChips();
      drawPanel();
    };
    row.append(el('span', 'md-num', `${li + 1}.`), sel, ed);
    if (dlg.lines.length > 2) {
      const del = el('button', 'md-icon', '×');
      del.title = 'Удалить реплику';
      del.onclick = () => removeLine(dlg, line);
      row.append(del);
    }
    return row;
  }

  function fillDom(ed, parts) {
    ed.innerHTML = '';
    parts.forEach(p => ed.append(isGap(p) ? chip(p.gap) : document.createTextNode(p)));
    markEmpty(ed, parts);
  }
  const markEmpty = (ed, parts) => ed.classList.toggle('empty', !parts.some(p => isGap(p) || p.trim()));

  function chip(id) {
    const c = el('span', 'md-chip' + (id === openGap ? ' open' : ''), d.gaps[id].answer || '?');
    c.contentEditable = 'false';
    c.dataset.gap = id;
    return c;
  }
  const markChips = () => root.querySelectorAll('.md-chip').forEach(c => c.classList.toggle('open', c.dataset.gap === openGap));

  function updateCounter() {
    const n = gapOrder().length;
    counter.textContent = `Пропусков: ${n}/${MAX_GAPS}`;
    counter.classList.toggle('md-limit', n >= MAX_GAPS);
  }

  // Новая реплика по умолчанию — от другого говорящего, чем предыдущая (разговор идёт по очереди)
  function nextSpeaker(dlg, index) {
    const prev = dlg.lines[index - 1], ids = d.speakers.map(s => s.id);
    if (!prev || !ids.length) return ids[0] || '';
    return ids[(ids.indexOf(prev.speaker) + 1) % ids.length];
  }

  function addLine(dlg, index) {
    const id = nextId('l', allLines().map(l => l.id));
    dlg.lines.splice(index, 0, { id, speaker: nextSpeaker(dlg, index), parts: [''] });
    save();
    draw();
    const ed = root.querySelector(`[data-item="${id}"]`);
    if (ed) ed.focus();
  }

  function removeLine(dlg, line) {
    const ids = line.parts.filter(isGap).map(p => p.gap);
    if (ids.length && !confirm(`Удалить реплику вместе с пропусками (${ids.length})?`)) return;
    dlg.lines.splice(dlg.lines.indexOf(line), 1);
    ids.forEach(id => delete d.gaps[id]);
    if (ids.includes(openGap)) openGap = null;
    save();
    draw();
  }

  function addDialogue() {
    const lineIds = allLines().map(l => l.id), sp = d.speakers.map(s => s.id);
    const a = nextId('l', lineIds), b = nextId('l', [...lineIds, a]);
    d.dialogues.push({ id: nextId('d', d.dialogues.map(x => x.id)), title: '', lines: [{ id: a, speaker: sp[0] || '', parts: [''] }, { id: b, speaker: sp[1] || sp[0] || '', parts: [''] }] });
    save();
    draw();
  }

  function removeDialogue(dlg) {
    const ids = dlg.lines.flatMap(l => l.parts.filter(isGap).map(p => p.gap));
    if (!confirm(`Удалить диалог${ids.length ? ` вместе с пропусками (${ids.length})` : ''}?`)) return;
    d.dialogues.splice(d.dialogues.indexOf(dlg), 1);
    ids.forEach(id => delete d.gaps[id]);
    if (ids.includes(openGap)) openGap = null;
    save();
    draw();
  }

  // ---- Пропуски ----
  function makeGap() {
    const r = GapEngine.fromSelection({ items: allLines(), hasGap, editClass: 'md-edit', chipClass: 'md-chip', count: gapOrder().length, max: MAX_GAPS, newId: () => nextId('g', Object.keys(d.gaps)) });
    if (r.error) return say(r.error);
    d.gaps[r.id] = { answer: r.text, alternatives: [], hint: '' };
    openGap = r.id;
    save();
    draw();
  }

  function removeGap(id) {
    GapEngine.restoreText(allLines(), id, d.gaps[id].answer);
    delete d.gaps[id];
    openGap = null;
    save();
    draw();
  }

  function input(value, placeholder) {
    const i = el('input');
    i.value = value;
    i.placeholder = placeholder;
    return i;
  }

  function tag(text, onRemove) {
    const t = el('span', 'md-tag', text);
    const x = el('button', 'md-tag-x', '×');
    x.title = 'Убрать';
    x.onclick = onRemove;
    t.append(x);
    return t;
  }

  function placePanel() {
    if (!openGap || !panelBox.firstChild) return;
    const c = root.querySelector(`.md-chip[data-gap="${openGap}"]`);
    if (!c) return;
    const r = root.getBoundingClientRect(), b = c.getBoundingClientRect();
    const w = Math.min(320, r.width);
    panelBox.style.width = w + 'px';
    panelBox.style.left = Math.max(0, Math.min(b.left - r.left, r.width - w)) + 'px';
    panelBox.style.top = (b.bottom - r.top + 6) + 'px';
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
    const p = el('div', 'md-panel');
    const head = el('div', 'md-head');
    const del = el('button', 'md-icon', '🗑');
    del.title = 'Удалить пропуск: слово вернётся в реплику';
    del.onclick = () => removeGap(id);
    const close = el('button', 'md-icon', '×');
    close.title = 'Закрыть';
    close.onclick = closePanel;
    const tools = el('span', 'md-panel-tools');
    tools.append(del, close);
    head.append(el('strong', '', `Пропуск ${gapOrder().indexOf(id) + 1}`), tools);

    const ans = input(g.answer, 'Правильный ответ');
    const noAnswer = el('div', 'md-warn', 'Без ответа пропуск нельзя будет опубликовать.');
    noAnswer.hidden = !!g.answer.trim();
    ans.oninput = () => {
      g.answer = ans.value;
      noAnswer.hidden = !!g.answer.trim();
      const c = root.querySelector(`.md-chip[data-gap="${id}"]`);
      if (c) c.textContent = g.answer || '?';
      drawBank();
      placePanel();
      save();
    };

    const altsBox = el('div', 'md-chips');
    const drawAlts = () => {
      altsBox.innerHTML = '';
      g.alternatives.forEach((a, i) => altsBox.append(tag(a, () => { g.alternatives.splice(i, 1); save(); drawAlts(); })));
    };
    drawAlts();
    const altRow = el('div', 'md-adder'), altInp = input('', 'Другой верный вариант'), altBtn = el('button', '', 'Добавить'), altErr = el('div', 'md-warn');
    altErr.hidden = true;
    const addAlt = () => {
      const text = clean(altInp.value);
      if (!text) return;
      if (norm(text) === norm(g.answer) || g.alternatives.some(a => norm(a) === norm(text))) { altErr.textContent = 'Такой ответ уже есть.'; altErr.hidden = false; return; }
      g.alternatives.push(text);
      altInp.value = '';
      altErr.hidden = true;
      save();
      drawAlts();
      altInp.focus();
    };
    altBtn.onclick = addAlt;
    altInp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addAlt(); } };
    altInp.oninput = () => { altErr.hidden = true; };
    altRow.append(altInp, altBtn);

    const hint = input(g.hint, 'Подсказка (необязательно)');
    hint.oninput = () => { g.hint = hint.value; save(); };

    const altHead = el('div', 'md-label md-labelrow', 'Другие верные ответы');
    altHead.append(help('Засчитываются как верные. Например, «don\'t» и «do not».'));
    const hintHead = el('div', 'md-label md-labelrow', 'Подсказка для ученика');
    hintHead.append(help('Значок подсказки откроется у ученика после второй проверки, если пропуск останется неверным или пустым. Баллы и проверки подсказка не тратит.'));

    p.append(head, ans, noAnswer, altHead, altsBox, altRow, altErr, hintHead, hint);
    panelBox.append(p);
    placePanel();
  }

  // Показывать кнопку «Пропуск», пока в реплике выделен текст
  function updateGapBar() {
    if (!root || !root.isConnected || !gapBar) return;
    const s = getSelection();
    const inEd = n => n && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest('.md-edit');
    if (!s.rangeCount || s.isCollapsed || !inEd(s.anchorNode) || !root.contains(s.anchorNode) || !s.toString().trim()) { gapBar.hidden = true; return; }
    placeSelBar(gapBar, root, s.getRangeAt(0));
  }
  // Щелчок мимо панели закрывает её
  if (!window.__mdOutside) {
    window.__mdOutside = true;
    addEventListener('pointerdown', e => {
      if (openGap && root && root.isConnected && !e.target.closest('.md-panel-box, .md-chip, .help, .helpbub')) closePanel();
    });
    addEventListener('resize', () => placePanel());
  }

  // ---- Банк слов и ловушки ----
  function bankSection() {
    const box = el('section', 'md-card md-bank');
    const head = el('div', 'md-head');
    head.append(el('h3', '', 'Банк слов и список'),
      help('Ответы пропусков (серые) добавляются сами. Слова-ловушки — неверные варианты; они появятся и в банке слов, и в выпадающем списке.'));
    bankBox = el('div', 'md-chips');
    const open = el('button', 'md-add', '+ Ловушка');
    const row = el('div', 'md-adder'), inp = input('', 'Неверный вариант'), btn = el('button', '', 'Добавить'), err = el('div', 'md-warn');
    err.hidden = true;
    row.hidden = true;
    const add = () => {
      const text = clean(inp.value);
      if (!text) return;
      if (gapOrder().some(id => norm(d.gaps[id].answer) === norm(text))) { err.textContent = 'Это слово уже есть среди ответов пропусков.'; err.hidden = false; return; }
      if (d.distractors.some(w => norm(w) === norm(text))) { err.textContent = 'Такое слово уже есть.'; err.hidden = false; return; }
      d.distractors.push(text);
      inp.value = '';
      err.hidden = true;
      save();
      drawBank();
      inp.focus();
    };
    btn.onclick = add;
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    inp.oninput = () => { err.hidden = true; };
    open.onclick = () => { open.hidden = true; row.hidden = false; inp.focus(); };
    row.append(inp, btn);
    box.append(head, bankBox, open, row, err);
    drawBank();
    return box;
  }
  function drawBank() {
    if (!bankBox || !bankBox.isConnected) return;
    bankBox.innerHTML = '';
    gapOrder().forEach(id => {
      const t = el('span', 'md-tag md-auto', d.gaps[id].answer || '?');
      t.title = 'Ответ пропуска: меняется в самом пропуске';
      bankBox.append(t);
    });
    d.distractors.forEach((w, i) => bankBox.append(tag(w, () => { d.distractors.splice(i, 1); save(); drawBank(); })));
  }

  // ---- Файл упражнения ----
  const cleanParts = parts => parts.map((p, k) => {
    if (isGap(p)) return p;
    let s = p.replace(/\s+/g, ' ');
    if (k === 0) s = s.trimStart();
    if (k === parts.length - 1) s = s.trimEnd();
    return s;
  }).filter(p => p !== '');
  const isEmptyLine = l => !cleanParts(l.parts).length;

  // Данные для файла: без пустых реплик и говорящих без имени-ссылок, пробелы убраны, стёртые из текста пропуски не попадают
  function exportData(draft) {
    const speakers = draft.speakers.map(s => ({ id: s.id, name: clean(s.name), side: s.side }));
    const dialogues = draft.dialogues
      .map(x => ({ id: x.id, title: clean(x.title), lines: x.lines.filter(l => !isEmptyLine(l)).map(l => ({ id: l.id, speaker: l.speaker, parts: cleanParts(l.parts) })) }))
      .filter(x => x.lines.length);
    const gaps = {};
    dialogues.forEach(x => x.lines.forEach(l => l.parts.filter(isGap).forEach(p => {
      const g = draft.gaps[p.gap];
      gaps[p.gap] = { answer: clean(g.answer), alternatives: (g.alternatives || []).map(clean).filter(Boolean), hint: clean(g.hint) };
    })));
    return { module: 'mini_dialogues', format: 1, mode: ['word_bank', 'dropdown', 'typing'].includes(draft.mode) ? draft.mode : 'typing', speakers, dialogues, gaps, distractors: (draft.distractors || []).map(clean).filter(Boolean) };
  }

  // Число пропусков — для «авто» числа проверок (3 при 1–5, 5 при 6 и больше)
  const unitCount = draft => Object.keys(exportData(draft).gaps).length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const sIds = new Set(draft.speakers.map(s => s.id));
    draft.speakers.forEach((s, i) => { if (!clean(s.name)) errors.push(`Говорящий ${i + 1}: нет имени.`); });
    const names = draft.speakers.map(s => norm(s.name)).filter(Boolean);
    if (new Set(names).size < names.length) warnings.push('Есть говорящие с одинаковыми именами: ученик не отличит их.');
    if (!draft.dialogues.length) errors.push('Нет ни одного диалога.');
    let gapTotal = 0;
    draft.dialogues.forEach((x, di) => {
      const lines = x.lines;
      if (lines.length < 2) errors.push(`Диалог ${di + 1}: нужно не меньше двух реплик.`);
      lines.forEach((l, li) => {
        const where = `Диалог ${di + 1}, реплика ${li + 1}`;
        if (!l.speaker || !sIds.has(l.speaker)) errors.push(`${where}: не выбран говорящий.`);
        if (isEmptyLine(l)) errors.push(`${where}: пустая реплика.`);
        const text = cleanParts(l.parts).map(p => (isGap(p) ? (draft.gaps[p.gap].answer || '') : p)).join('');
        if (text.length > LONG_LINE) warnings.push(`${where}: очень длинная реплика. Лучше разделить её на две.`);
        cleanParts(l.parts).filter(isGap).forEach(p => {
          gapTotal++;
          if (!clean(draft.gaps[p.gap].answer)) errors.push(`${where}: у пропуска нет правильного ответа.`);
        });
      });
    });
    if (draft.dialogues.length && !gapTotal) errors.push('Нет ни одного пропуска.');
    if (gapTotal > MAX_GAPS) errors.push(`Пропусков больше ${MAX_GAPS}. Разделите упражнение на два.`);
    const ex = exportData(draft), ids = Object.keys(ex.gaps);
    if (ex.mode === 'dropdown' && ids.length) {
      const pool = new Set([...ids.flatMap(id => [ex.gaps[id].answer, ...ex.gaps[id].alternatives]), ...ex.distractors].map(norm).filter(Boolean));
      ids.forEach((id, n) => {
        const right = new Set([ex.gaps[id].answer, ...ex.gaps[id].alternatives].map(norm));
        if (![...pool].some(w => !right.has(w))) errors.push(`Пропуск ${n + 1}: в выпадающем списке нет неверного варианта. Добавьте слово-ловушку.`);
      });
      if (pool.size > 8) warnings.push(`В выпадающем списке ${pool.size} вариантов. Обычно хватает 3–5.`);
    }
    if (ex.mode === 'word_bank' && ex.distractors.length > 6) warnings.push('В банке много слов-ловушек: на телефоне банк станет длинным.');
    const used = new Set(draft.dialogues.flatMap(x => x.lines.map(l => l.speaker)));
    draft.speakers.forEach((s, i) => { if (clean(s.name) && !used.has(s.id)) warnings.push(`Говорящий «${clean(s.name)}» не произносит ни одной реплики.`); });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика. Недостающее заполняется, пропуски без данных выбрасываются, реплики без говорящего остаются
  function load(file) {
    if (!Array.isArray(file.dialogues)) throw new Error('В файле нет диалогов.');
    const gaps = {};
    Object.entries(file.gaps || {}).forEach(([id, g]) => {
      gaps[id] = { answer: String(g.answer || ''), alternatives: Array.isArray(g.alternatives) ? g.alternatives.map(String) : [], hint: String(g.hint || '') };
    });
    const speakers = (Array.isArray(file.speakers) ? file.speakers : []).map((s, k) => ({ id: String(s.id || 'sp' + (k + 1)), name: String(s.name || ''), side: ['left', 'right'].includes(s.side) ? s.side : 'auto' }));
    while (speakers.length < 2) speakers.push({ id: 'sp' + (speakers.length + 1), name: '', side: 'auto' });
    let ln = 0;
    const dialogues = file.dialogues.map((x, di) => {
      const lines = (Array.isArray(x.lines) ? x.lines : []).map(l => {
        const parts = (Array.isArray(l.parts) ? l.parts : []).filter(p => typeof p === 'string' || (p && gaps[p.gap]));
        return { id: String(l.id || 'l' + (++ln)), speaker: String(l.speaker || ''), parts: parts.length ? parts : [''] };
      });
      return { id: String(x.id || 'd' + (di + 1)), title: String(x.title || ''), lines };
    });
    return { ...create(), mode: ['word_bank', 'dropdown', 'typing'].includes(file.mode) ? file.mode : 'typing', distractors: Array.isArray(file.distractors) ? file.distractors.map(String) : [], speakers, dialogues: dialogues.length ? dialogues : create().dialogues, gaps };
  }

  return { create, demo, render, load, exportData, validate, unitCount };
})();
