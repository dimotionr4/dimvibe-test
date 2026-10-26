// Редактор модуля Word Search: список слов, направления, размер сетки; сетку с буквами составляет сам редактор.
// Слово — ID (w1, w2…) и текст. Для сетки текст превращается в «буквы»: без пробелов и знаков препинания, заглавными
// (ice cream → ICECREAM); подпись в списке остаётся как написал автор. Составленная сетка хранится в черновике вместе
// со «слепком» настроек (sig): изменили слова, размер или направления — сетка устарела, публикация блокируется до новой.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const WordSearchEditor = (() => {
  const MAX_WORDS = 20, MIN_WORDS = 2, START_WORDS = 5, MAX_LEN = 40, MIN_SIZE = 5, MAX_SIZE = 20, MIN_LETTERS = 2;
  const { nextId } = GapEngine;
  // Восемь направлений. Порядок — как стрелки на экране (3 × 3, в середине пусто)
  const DIRS = [
    { k: 'nw', d: [-1, -1], a: '↖', n: 'вверх-влево' }, { k: 'n', d: [-1, 0], a: '↑', n: 'вверх' }, { k: 'ne', d: [-1, 1], a: '↗', n: 'вверх-вправо' },
    { k: 'w', d: [0, -1], a: '←', n: 'влево' }, null, { k: 'e', d: [0, 1], a: '→', n: 'вправо' },
    { k: 'sw', d: [1, -1], a: '↙', n: 'вниз-влево' }, { k: 's', d: [1, 0], a: '↓', n: 'вниз' }, { k: 'se', d: [1, 1], a: '↘', n: 'вниз-вправо' },
  ];
  const ALL_DIRS = DIRS.filter(Boolean);
  const LEVELS = {
    easy: { name: 'Easy', help: 'вправо и вниз', dirs: ['e', 's'] },
    medium: { name: 'Medium', help: 'ещё по диагонали вперёд', dirs: ['e', 's', 'se', 'ne'] },
    hard: { name: 'Hard', help: 'все 8 направлений, в том числе задом наперёд', dirs: ALL_DIRS.map(x => x.k) },
  };
  const DEFAULT_LEVEL = 'medium';
  let d, root, save, msgTimer = null;
  let msg, counter, listBox, addBtn, gridBox, optBox;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  // ---- Буквы слова ----
  const segmenter = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function tokens(text) {
    let s = String(text || '').normalize('NFC').replace(/[\s\p{P}]+/gu, '');
    if (!/[Ⴀ-ჿ]/.test(s)) s = s.toLocaleUpperCase(); // грузинский не переводим в заглавные: другое начертание
    return segmenter ? Array.from(segmenter.segment(s), x => x.segment) : Array.from(s);
  }
  const filled = w => tokens(w.text).length > 0;
  const rev = a => a.slice().reverse();
  // Есть ли a внутри b (вперёд или задом наперёд)
  function inside(a, b) {
    if (a.length > b.length) return false;
    const find = x => { for (let i = 0; i + x.length <= b.length; i++) if (x.every((t, k) => b[i + k] === t)) return true; return false; };
    return find(a) || find(rev(a));
  }

  // ---- Заполнитель сетки: буквы, которыми добивают пустые клетки ----
  const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const CYRILLIC = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ'.split('');
  function fillerFor(list) {
    const letters = [...new Set(list.flatMap(w => w.tok))];
    if (letters.every(t => /^[A-Z]$/.test(t))) return LATIN;
    if (letters.every(t => /^[А-ЯЁ]$/.test(t))) return CYRILLIC;
    return letters; // другой алфавит: берём буквы самих слов
  }

  // ---- Составление сетки ----
  const runKey = (r0, c0, r1, c1) => { const a = r0 + ',' + c0 + '|' + r1 + ',' + c1, b = r1 + ',' + c1 + '|' + r0 + ',' + c0; return a < b ? a : b; };
  // Сколько разных мест в сетке, где читается слово (в любом из 8 направлений, прямая и обратная прогулка по одним клеткам — одно место)
  function places(grid, size, tok) {
    const set = new Set(), n = tok.length;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      for (const dir of ALL_DIRS) {
        const [dr, dc] = dir.d, er = r + dr * (n - 1), ec = c + dc * (n - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        let ok = true;
        for (let k = 0; k < n && ok; k++) ok = grid[r + dr * k][c + dc * k] === tok[k];
        if (ok) set.add(runKey(r, c, er, ec));
      }
    }
    return set;
  }

  // Одна попытка на размере size; возвращает {cells, placed} или null
  function attempt(list, size, dirs, filler) {
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const placed = {};
    const order = list.slice().sort((a, b) => b.tok.length - a.tok.length);
    for (const w of order) {
      const n = w.tok.length, cands = [];
      for (const [dr, dc] of dirs) for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        const er = r + dr * (n - 1), ec = c + dc * (n - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        let ok = true;
        for (let k = 0; k < n && ok; k++) { const v = grid[r + dr * k][c + dc * k]; ok = v === null || v === w.tok[k]; }
        if (ok) cands.push([r, c, dr, dc]);
      }
      if (!cands.length) return null;
      const [r, c, dr, dc] = cands[Math.floor(Math.random() * cands.length)];
      for (let k = 0; k < n; k++) grid[r + dr * k][c + dc * k] = w.tok[k];
      placed[w.id] = { at: [r, c], dir: [dr, dc], len: n };
    }
    const free = [];
    grid.forEach((row, r) => row.forEach((v, c) => { if (v === null) free.push([r, c]); }));
    for (let pass = 0; pass < 25; pass++) {
      free.forEach(([r, c]) => { grid[r][c] = filler[Math.floor(Math.random() * filler.length)]; });
      // В сетке каждое слово читается ровно в одном месте — там, куда мы его поставили
      const good = list.every(w => {
        const p = placed[w.id], set = places(grid, size, w.tok);
        return set.size === 1 && set.has(runKey(p.at[0], p.at[1], p.at[0] + p.dir[0] * (p.len - 1), p.at[1] + p.dir[1] * (p.len - 1)));
      });
      if (good) return { cells: grid.map(row => row.slice()), placed };
    }
    return null;
  }

  function generate(list, sizeSetting, dirKeys) {
    const dirs = ALL_DIRS.filter(x => dirKeys.includes(x.k)).map(x => x.d);
    const filler = fillerFor(list);
    const letters = list.reduce((s, w) => s + w.tok.length, 0), longest = Math.max(...list.map(w => w.tok.length));
    const sizes = sizeSetting === 'auto'
      ? Array.from({ length: MAX_SIZE - Math.max(longest, 8, Math.ceil(Math.sqrt(letters * 2.4))) + 1 }, (_, i) => Math.max(longest, 8, Math.ceil(Math.sqrt(letters * 2.4))) + i)
      : [sizeSetting];
    const budget = sizeSetting === 'auto' ? 500 : 2500;
    for (const size of sizes) {
      const t0 = Date.now();
      for (let i = 0; i < 400 && Date.now() - t0 < budget; i++) {
        const res = attempt(list, size, dirs, filler);
        if (res) return { ...res, size };
      }
    }
    return null;
  }

  // «Слепок» настроек: по нему видно, что сетка устарела
  const dirKeys = () => ALL_DIRS.map(x => x.k).filter(k => d.dirs.includes(k));
  const sigOf = draft => JSON.stringify([draft.words.filter(filled).map(w => [w.id, tokens(w.text).join('')]), draft.size, ALL_DIRS.map(x => x.k).filter(k => draft.dirs.includes(k))]);
  const fresh = draft => !!(draft.grid && draft.grid.sig === sigOf(draft));

  // ---- Черновик ----
  const newWord = id => ({ id, text: '' });
  function create() {
    const words = [];
    for (let k = 1; k <= START_WORDS; k++) words.push(newWord('w' + k));
    return { module: 'word_search', format: 1, dirs: LEVELS[DEFAULT_LEVEL].dirs.slice(), size: 'auto', words, grid: null };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): шесть слов, все направления
  function demo() {
    const base = create();
    const texts = ['apple', 'banana', 'orange', 'lemon', 'grape', 'ice cream'];
    const dd = { ...base, instruction: DimDemo.instruction('Найдите в сетке все слова из списка.'), dirs: LEVELS.hard.dirs.slice(), words: texts.map((t, i) => ({ id: 'w' + (i + 1), text: t })) };
    buildGrid(dd);
    return dd;
  }

  function buildGrid(draft) {
    const list = draft.words.filter(filled).map(w => ({ id: w.id, tok: tokens(w.text) }));
    const res = generate(list, draft.size, ALL_DIRS.map(x => x.k).filter(k => draft.dirs.includes(k)));
    if (!res) return false;
    draft.grid = { cells: res.cells, placed: res.placed, sig: sigOf(draft) };
    return true;
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    if (!Array.isArray(d.dirs) || !d.dirs.length) d.dirs = LEVELS[DEFAULT_LEVEL].dirs.slice();
    if (d.size !== 'auto' && !(d.size >= MIN_SIZE && d.size <= MAX_SIZE)) d.size = 'auto';
    draw();
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 7000);
  }

  function draw() {
    root.innerHTML = '';
    root.className = 'ws-wrap';
    const tools = el('div', 'ws-tools');
    counter = el('span', 'ws-muted');
    const right = el('span', 'ws-right');
    right.append(help(`Напишите слова или фразы, которые ученик будет искать (от ${MIN_WORDS} до ${MAX_WORDS}). Пробелы и знаки препинания в сетке убираются: «ice cream» ищется как ICECREAM. Выберите направления (Easy, Medium, Hard или свои) и размер сетки, затем нажмите «Составить сетку»: редактор сам расставит слова и добьёт пустые клетки буквами так, чтобы каждое слово читалось в сетке ровно в одном месте. Изменили слова, размер или направления — сетку нужно составить заново. Верно найденное слово даёт 1 балл, ошибки ничего не стоят, проверок нет.`));
    tools.append(counter, right);
    msg = el('div', 'ws-msg');
    msg.hidden = true;
    listBox = el('ol', 'ws-words');
    addBtn = el('button', 'ws-add', '+ Слово');
    addBtn.type = 'button';
    addBtn.onclick = () => addWord();
    const bulk = el('button', 'ws-add', 'Вставить списком');
    bulk.type = 'button';
    const bulkBox = el('div', 'ws-bulk');
    bulkBox.hidden = true;
    const ta = el('textarea', 'ws-in');
    ta.rows = 5;
    ta.placeholder = 'По одному слову в строке (или через запятую)';
    ta.setAttribute('aria-label', 'Слова списком');
    const go = el('button', 'ws-add', 'Добавить слова');
    go.type = 'button';
    go.onclick = () => bulkAdd(ta, bulkBox);
    bulkBox.append(ta, go);
    bulk.onclick = () => { bulkBox.hidden = !bulkBox.hidden; if (!bulkBox.hidden) ta.focus(); };
    const adds = el('div', 'ws-adds');
    adds.append(addBtn, bulk);
    optBox = el('section', 'ws-opts');
    gridBox = el('section', 'ws-gridbox');
    root.append(tools, msg, listBox, adds, bulkBox, optBox, gridBox);
    drawWords();
    drawOpts();
    drawGrid();
  }

  const count = () => d.words.filter(filled).length;
  function updateCounter() {
    counter.textContent = `Слов: ${count()}/${MAX_WORDS}`;
    addBtn.disabled = d.words.length >= MAX_WORDS;
  }

  function drawWords() {
    listBox.innerHTML = '';
    d.words.forEach((w, j) => listBox.append(wordRow(w, j)));
    markProblems();
    updateCounter();
  }

  function wordRow(w, j) {
    const r = el('li', 'ws-row');
    r.append(el('span', 'ws-num', String(j + 1)));
    const inp = el('input', 'ws-in ws-word');
    inp.type = 'text';
    inp.maxLength = MAX_LEN;
    inp.placeholder = `Слово ${j + 1}`;
    inp.value = w.text;
    inp.setAttribute('aria-label', `Слово ${j + 1}`);
    inp.oninput = () => { w.text = inp.value; save(); markProblems(); updateCounter(); drawGrid(); };
    const del = el('button', 'ws-ib ws-del');
    del.type = 'button';
    del.title = 'Удалить';
    del.setAttribute('aria-label', `Удалить слово ${j + 1}`);
    del.innerHTML = '<svg class="ws-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.onclick = () => {
      d.words.splice(j, 1);
      while (d.words.length < 2) d.words.push(newWord(nextId('w', d.words.map(x => x.id))));
      save();
      drawWords();
      drawGrid();
    };
    r.append(inp, del);
    return r;
  }

  // Слова, которые мешают друг другу (повтор, одно внутри другого, слишком короткое), подсвечиваются сразу
  function problems() {
    const bad = new Set(), why = [];
    const items = d.words.map((w, j) => ({ j, tok: tokens(w.text), text: clean(w.text) })).filter(x => x.tok.length);
    items.forEach(x => {
      if (x.tok.length < MIN_LETTERS) { bad.add(x.j); why.push(`Слово ${x.j + 1} «${x.text}»: нужно хотя бы ${MIN_LETTERS} буквы.`); }
      const cap = d.size === 'auto' ? MAX_SIZE : d.size;
      if (x.tok.length > cap) { bad.add(x.j); why.push(`Слово ${x.j + 1} «${x.text}» длиннее сетки (${x.tok.length} бук. при размере ${cap}).`); }
    });
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      const A = items[a], B = items[b];
      if (A.tok.length === B.tok.length && inside(A.tok, B.tok)) { bad.add(A.j); bad.add(B.j); why.push(`«${A.text}» и «${B.text}» одинаковы в сетке. Оставьте одно слово.`); }
      else if (inside(A.tok, B.tok)) { bad.add(A.j); bad.add(B.j); why.push(`Слово «${A.text}» входит в «${B.text}»: ученик не различит их в сетке. Уберите одно из них.`); }
      else if (inside(B.tok, A.tok)) { bad.add(A.j); bad.add(B.j); why.push(`Слово «${B.text}» входит в «${A.text}»: ученик не различит их в сетке. Уберите одно из них.`); }
    }
    return { bad, why };
  }
  function markProblems() {
    const { bad } = problems();
    listBox.querySelectorAll('.ws-row').forEach((r, j) => r.classList.toggle('dup', bad.has(j)));
  }

  function addWord(text) {
    if (d.words.length >= MAX_WORDS) return say(`Слов не больше ${MAX_WORDS}.`);
    d.words.push({ id: nextId('w', d.words.map(x => x.id)), text: text || '' });
    save();
    drawWords();
    drawGrid();
    if (text == null) { const ins = listBox.querySelectorAll('.ws-word'); if (ins.length) ins[ins.length - 1].focus(); }
  }

  function bulkAdd(ta, box) {
    const parts = ta.value.split(/[\n,;]+/).map(clean).filter(Boolean);
    if (!parts.length) return say('Напишите слова: по одному в строке или через запятую.');
    // Сначала заполняем пустые строки, потом добавляем новые
    let added = 0, skipped = 0;
    parts.forEach(t => {
      const empty = d.words.find(w => !clean(w.text));
      if (empty) { empty.text = t; added++; }
      else if (d.words.length < MAX_WORDS) { d.words.push({ id: nextId('w', d.words.map(x => x.id)), text: t }); added++; }
      else skipped++;
    });
    ta.value = '';
    box.hidden = true;
    save();
    drawWords();
    drawGrid();
    say(skipped ? `Добавлено слов: ${added}. Не поместилось: ${skipped} (максимум ${MAX_WORDS}).` : `Добавлено слов: ${added}.`);
  }

  // ---- Направления и размер ----
  const levelOf = () => {
    const cur = ALL_DIRS.map(x => x.k).filter(k => d.dirs.includes(k)).join();
    return Object.keys(LEVELS).find(k => ALL_DIRS.map(x => x.k).filter(x => LEVELS[k].dirs.includes(x)).join() === cur) || '';
  };

  function drawOpts() {
    optBox.innerHTML = '';
    const lv = el('div', 'ws-opt');
    lv.append(el('b', '', 'Сложность'));
    const row = el('span', 'ws-seg');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Сложность');
    const cur = levelOf();
    Object.entries(LEVELS).forEach(([k, v]) => {
      const b = el('button', 'ws-segb' + (cur === k ? ' active' : ''), v.name);
      b.type = 'button';
      b.title = v.help;
      b.setAttribute('aria-pressed', String(cur === k));
      b.onclick = () => { d.dirs = v.dirs.slice(); save(); drawOpts(); drawGrid(); };
      row.append(b);
    });
    lv.append(row, help('Easy — слова идут вправо и вниз. Medium — ещё по диагонали вперёд. Hard — во всех 8 направлениях, в том числе задом наперёд. Ниже направления можно включать и выключать по одному: тогда сложность будет «своя».'));
    const dr = el('div', 'ws-opt');
    dr.append(el('b', '', 'Направления'));
    const pad = el('span', 'ws-dirs');
    DIRS.forEach(x => {
      if (!x) { pad.append(el('span', 'ws-dirgap')); return; }
      const on = d.dirs.includes(x.k);
      const b = el('button', 'ws-dir' + (on ? ' active' : ''), x.a);
      b.type = 'button';
      b.title = x.n;
      b.setAttribute('aria-label', x.n);
      b.setAttribute('aria-pressed', String(on));
      b.onclick = () => {
        d.dirs = on ? d.dirs.filter(k => k !== x.k) : [...d.dirs, x.k];
        save(); drawOpts(); drawGrid();
      };
      pad.append(b);
    });
    dr.append(pad);
    if (!cur) dr.append(el('span', 'ws-muted', 'Свои направления'));
    const sz = el('div', 'ws-opt');
    sz.append(el('b', '', 'Размер сетки'));
    const sel = el('select', 'ws-in ws-size');
    sel.setAttribute('aria-label', 'Размер сетки');
    sel.append(new Option('Авто', 'auto'));
    for (let n = MIN_SIZE; n <= MAX_SIZE; n++) sel.append(new Option(`${n} × ${n}`, String(n)));
    sel.value = String(d.size);
    sel.onchange = () => { d.size = sel.value === 'auto' ? 'auto' : Number(sel.value); save(); markProblems(); drawGrid(); };
    sz.append(sel, help('«Авто» подберёт самый маленький размер, в который помещаются все слова (не меньше 8 × 8). Свой размер — от 5 × 5 до 20 × 20. На телефоне крупные сетки получаются мелкими, поэтому для небольшого списка лучше брать 8–12.'));
    optBox.append(lv, dr, sz);
  }

  // ---- Сетка ----
  function drawGrid() {
    gridBox.innerHTML = '';
    const head = el('div', 'ws-ghead');
    const btn = el('button', 'ws-make', d.grid ? 'Составить заново' : 'Составить сетку');
    btn.type = 'button';
    btn.onclick = make;
    const state = el('span', 'ws-state');
    if (!d.grid) { state.textContent = 'Сетка ещё не составлена.'; state.classList.add('bad'); }
    else if (!fresh(d)) { state.textContent = 'Сетка устарела: слова, размер или направления изменились.'; state.classList.add('bad'); }
    else { state.textContent = `Сетка ${d.grid.cells.length} × ${d.grid.cells.length} готова.`; state.classList.add('ok'); }
    head.append(btn, state);
    gridBox.append(head);
    if (!d.grid) return;
    const n = d.grid.cells.length;
    const box = el('div', 'ws-grid' + (fresh(d) ? '' : ' stale'));
    box.style.setProperty('--cols', n);
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `Сетка ${n} на ${n}`);
    const mark = new Set();
    Object.values(d.grid.placed).forEach(p => { for (let k = 0; k < p.len; k++) mark.add((p.at[0] + p.dir[0] * k) + ',' + (p.at[1] + p.dir[1] * k)); });
    d.grid.cells.forEach((row, r) => row.forEach((t, c) => box.append(el('span', 'ws-cell' + (mark.has(r + ',' + c) ? ' in' : ''), t))));
    gridBox.append(box, el('p', 'ws-muted ws-hint', 'Подсвечены клетки слов (ученик подсветки не видит).'));
  }

  function make() {
    const { why } = problems();
    if (why.length) return say(why[0]);
    const list = d.words.filter(filled).map(w => ({ id: w.id, tok: tokens(w.text) }));
    if (list.length < MIN_WORDS) return say(`Нужно хотя бы ${MIN_WORDS} слова.`);
    if (!d.dirs.length) return say('Включите хотя бы одно направление.');
    if (!buildGrid(d)) return say('Не удалось уместить все слова. Увеличьте сетку, включите больше направлений или сократите слова.');
    save();
    drawGrid();
  }

  // ---- Файл упражнения ----
  // Слова в файле — только заполненные; у каждого место в сетке (at — первая клетка, dir — шаг, len — число клеток).
  // Сетка в файле — строки клеток; размер и направления нужны, чтобы открыть файл в редакторе
  function exportData(draft) {
    const g = draft.grid;
    return {
      module: 'word_search', format: 1,
      ...(draft.size === 'auto' ? { auto: true } : {}),
      dirs: ALL_DIRS.map(x => x.k).filter(k => draft.dirs.includes(k)),
      cells: g ? g.cells : [],
      words: g ? draft.words.filter(w => filled(w) && g.placed[w.id]).map(w => ({ id: w.id, text: clean(w.text), at: g.placed[w.id].at, dir: g.placed[w.id].dir, len: g.placed[w.id].len })) : [],
    };
  }

  const unitCount = draft => draft.words.filter(filled).length;
  // Проверок нет: слово засчитывается, как только ученик его выделил
  const noChecks = true;
  const noChecksNote = 'В Word Search проверок нет: верно выделенное слово сразу засчитывается и остаётся отмеченным, ошибка ничего не стоит. Упражнение заканчивается, когда найдены все слова.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const prev = d;
    d = draft; // problems() работает с текущим черновиком
    const n = draft.words.filter(filled).length;
    if (n < MIN_WORDS) errors.push(`Нужно хотя бы ${MIN_WORDS} слова.`);
    if (n > MAX_WORDS) errors.push(`Слов больше ${MAX_WORDS}.`);
    if (!draft.dirs.length) errors.push('Не выбрано ни одного направления.');
    if (draft.size !== 'auto' && !(draft.size >= MIN_SIZE && draft.size <= MAX_SIZE)) errors.push(`Размер сетки: от ${MIN_SIZE} до ${MAX_SIZE}.`);
    problems().why.forEach(m => errors.push(m));
    d = prev;
    if (!draft.grid) errors.push('Сетка не составлена: нажмите «Составить сетку».');
    else if (draft.grid.sig !== sigOf(draft)) errors.push('Сетка устарела (слова, размер или направления изменились): нажмите «Составить заново».');
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.cells) || !file.cells.length || !Array.isArray(file.words) || !file.words.length) throw new Error('В файле нет сетки или слов.');
    const n = file.cells.length;
    const cells = file.cells.map(row => (Array.isArray(row) ? row : []).map(t => String(t)));
    if (n < MIN_SIZE || n > MAX_SIZE || cells.some(row => row.length !== n)) throw new Error('Сетка в файле должна быть квадратной, от 5 × 5 до 20 × 20.');
    const used = new Set(), words = [], placed = {};
    file.words.slice(0, MAX_WORDS).forEach(w => {
      let id = String((w && w.id) || '');
      if (!id || used.has(id)) id = nextId('w', [...used]);
      used.add(id);
      words.push({ id, text: String((w && w.text) || '') });
      const at = w && w.at, dir = w && w.dir, len = Number(w && w.len);
      if (Array.isArray(at) && Array.isArray(dir) && len >= 1) placed[id] = { at: [Number(at[0]), Number(at[1])], dir: [Number(dir[0]), Number(dir[1])], len };
    });
    const dirs = Array.isArray(file.dirs) ? file.dirs.filter(k => ALL_DIRS.some(x => x.k === k)) : [];
    const draft = { ...create(), dirs: dirs.length ? dirs : LEVELS[DEFAULT_LEVEL].dirs.slice(), size: file.auto === true ? 'auto' : n, words };
    draft.grid = { cells, placed, sig: sigOf(draft) };
    return draft;
  }

  return { create, demo, render, load, exportData, validate, unitCount, noChecks, noChecksNote };
})();
