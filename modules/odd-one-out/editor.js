// Редактор модуля Odd One Out (найти лишнее): группы элементов, в каждой ровно один лишний.
// У группы и элемента устойчивый ID (g1, i1…); лишний хранится по ID элемента, а не по месту в списке,
// поэтому перестановка элементов и групп правильный ответ не меняет. Этап 1 (решение владельца 2026-10-25) — только текст.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const OddOneOutEditor = (() => {
  const MAX_GROUPS = 20, MIN_ITEMS = 3, MAX_ITEMS = 8, MAX_LEN = 100, PROMPT_LEN = 200; // групп, элементов в группе, символов
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="oo-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const key = s => clean(s).normalize('NFC').toLowerCase(); // одинаковые без учёта регистра и лишних пробелов
  const filled = it => !!clean(it.text);
  const allItemIds = () => d.groups.flatMap(g => g.items.map(i => i.id));

  const VIEWS = { one: 'По одной группе', list: 'Все группы сразу' };
  const LOOKS = { chips: 'Плашки', cards: 'Карточки' };

  const newItem = id => ({ id, text: '' });
  function newGroup(id, ids) {
    const items = [];
    for (let k = 0; k < MIN_ITEMS; k++) { const iid = nextId('i', ids); ids.push(iid); items.push(newItem(iid)); }
    return { id, prompt: '', items, odd: '', explanation: '' };
  }
  function create() {
    return { module: 'odd_one_out', format: 1, view: 'one', look: 'chips', shuffle: true, showAnswers: false, groups: [newGroup('g1', [])] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): три группы, задания, пояснения, правильный ответ показывается
  function demo() {
    const grp = (id, prompt, words, odd, explanation) => ({ id, prompt, explanation,
      items: words.map(([iid, text]) => ({ id: iid, text })), odd });
    return { ...create(), showAnswers: true, instruction: DimDemo.instruction('В каждой группе найдите лишнее слово.'), groups: [
      grp('g1', 'Что не фрукт?', [['i1', 'apple'], ['i2', 'banana'], ['i3', 'carrot'], ['i4', 'orange']], 'i3', 'Carrot — овощ, остальные — фрукты.'),
      grp('g2', '', [['i5', 'cat'], ['i6', 'dog'], ['i7', 'table'], ['i8', 'horse']], 'i7', 'Table — не животное.'),
      grp('g3', 'Какое слово не число?', [['i9', 'one'], ['i10', 'two'], ['i11', 'four'], ['i12', 'blue'], ['i13', 'ten']], 'i12', ''),
    ] };
  }

  function normalize() {
    if (!VIEWS[d.view]) d.view = 'one';
    if (!LOOKS[d.look]) d.look = 'chips';
    if (typeof d.shuffle !== 'boolean') d.shuffle = true;
    if (typeof d.showAnswers !== 'boolean') d.showAnswers = false;
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null;
    normalize();
    draw();
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 6000);
  }

  function draw() {
    root.innerHTML = '';
    root.className = 'oo-wrap';
    const tools = el('div', 'oo-tools');
    counter = el('span', 'oo-muted');
    const right = el('span', 'oo-right');
    right.append(help(`Напишите группы элементов и в каждой отметьте кружком слева лишний — он один. Ученик в каждой группе нажмёт на элемент, который лишний. Балл — за каждую верную группу. В группе от ${MIN_ITEMS} до ${MAX_ITEMS} элементов, групп до ${MAX_GROUPS}. Задание группы и пояснение необязательны: пояснение ученик увидит после верного ответа или в конце упражнения.`));
    tools.append(counter, right);
    msg = el('div', 'oo-msg');
    msg.hidden = true;
    listBox = el('div', 'oo-groups');
    addBtn = el('button', 'oo-add', '+ Группа');
    addBtn.type = 'button';
    addBtn.onclick = addGroup;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Групп: ${d.groups.length}/${MAX_GROUPS}`;
    addBtn.disabled = d.groups.length >= MAX_GROUPS;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.groups.forEach((g, k) => listBox.append(card(g, k)));
    updateCounter();
  }

  const newGroupId = () => nextId('g', d.groups.map(g => g.id));

  // Одинаковые элементы в группе разрешены (архив), но подсвечиваются жёлтым: автор, скорее всего, ошибся
  function marks(box, g) {
    const n = {};
    g.items.forEach(i => { if (filled(i)) n[key(i.text)] = (n[key(i.text)] || 0) + 1; });
    box.querySelectorAll('.oo-row').forEach(r => {
      const i = g.items.find(x => x.id === r.dataset.id);
      r.classList.toggle('same', !!i && filled(i) && n[key(i.text)] > 1);
    });
  }

  function card(g, k) {
    const box = el('section', 'oo-group');
    box.dataset.id = g.id;
    box.append(head(g, k));
    const prompt = el('input', 'oo-in oo-prompt');
    prompt.type = 'text';
    prompt.maxLength = PROMPT_LEN;
    prompt.placeholder = 'Задание группы (необязательно), например «Что не фрукт?»';
    prompt.value = g.prompt;
    prompt.setAttribute('aria-label', `Задание группы ${k + 1}`);
    prompt.oninput = () => { g.prompt = prompt.value; save(); };

    const items = el('div', 'oo-items');
    const drawItems = () => {
      items.innerHTML = '';
      items.append(el('p', 'oo-muted oo-hint', 'Кружком слева отметьте лишний элемент.'));
      g.items.forEach((it, j) => items.append(itemRow(g, it, j, drawItems, box)));
      const add = el('button', 'oo-add oo-additem', '+ Элемент');
      add.type = 'button';
      add.disabled = g.items.length >= MAX_ITEMS;
      add.onclick = () => {
        if (g.items.length >= MAX_ITEMS) return say(`Элементов в группе не больше ${MAX_ITEMS}.`);
        g.items.push(newItem(nextId('i', allItemIds())));
        save();
        drawItems();
        const ins = items.querySelectorAll('.oo-item-in');
        if (ins.length) ins[ins.length - 1].focus();
      };
      items.append(add);
      marks(box, g);
    };
    drawItems();

    const ex = el('textarea', 'oo-in oo-expl');
    ex.rows = 1;
    ex.placeholder = 'Пояснение (необязательно): ученик увидит его после верного ответа или в конце';
    ex.value = g.explanation;
    ex.setAttribute('aria-label', `Пояснение к группе ${k + 1}`);
    const fitEx = () => { ex.style.height = 'auto'; ex.style.height = ex.scrollHeight + 2 + 'px'; };
    ex.oninput = () => { g.explanation = ex.value; fitEx(); save(); };
    setTimeout(fitEx, 0);

    box.append(prompt, items, ex);
    return box;
  }

  function itemRow(g, it, j, redraw, box) {
    const r = el('div', 'oo-row' + (g.odd === it.id ? ' odd' : ''));
    r.dataset.id = it.id;
    const mark = el('button', 'oo-mark');
    mark.type = 'button';
    mark.setAttribute('role', 'radio');
    mark.setAttribute('aria-checked', String(g.odd === it.id));
    mark.setAttribute('aria-label', `Лишний: элемент ${j + 1}`);
    mark.title = g.odd === it.id ? 'Лишний элемент' : 'Сделать лишним';
    mark.onclick = () => { g.odd = it.id; save(); redraw(); };
    const inp = el('input', 'oo-in oo-item-in');
    inp.type = 'text';
    inp.maxLength = MAX_LEN;
    inp.placeholder = `Элемент ${j + 1}`;
    inp.value = it.text;
    inp.setAttribute('aria-label', `Элемент ${j + 1}`);
    inp.oninput = () => { it.text = inp.value; save(); marks(box, g); };
    const b = (html, tip, fn, disabled) => { const x = el('button', 'oo-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, элемент ${j + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const swap = dir => { const i = j + dir; [g.items[j], g.items[i]] = [g.items[i], g.items[j]]; save(); redraw(); };
    const tools = el('span', 'oo-tools2');
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => swap(-1), j === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => swap(1), j === g.items.length - 1),
      // Удаление лишнего снимает отметку: автор должен выбрать лишний заново
      b(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить', () => {
        g.items.splice(j, 1);
        if (g.odd === it.id) { g.odd = ''; say('Удалён лишний элемент — отметьте кружком новый лишний.'); }
        save(); redraw();
      }, g.items.length <= MIN_ITEMS),
    );
    tools.lastChild.classList.add('oo-del');
    r.append(mark, inp, tools);
    return r;
  }

  function head(g, k) {
    const top = el('div', 'oo-grouptop');
    top.append(el('b', '', `Группа ${k + 1}`));
    const tools = el('span', 'oo-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'oo-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, группа ${k + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Группа выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Группа ниже', () => move(k, 1), k === d.groups.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать группу', () => duplicate(k), d.groups.length >= MAX_GROUPS),
    );
    if (delAsk === g.id) {
      const q = el('span', 'oo-ask');
      const yes = el('button', 'oo-yes', 'Удалить группу');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const x = b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить группу', () => {
        if (clean(g.prompt) || clean(g.explanation) || g.items.some(filled)) { delAsk = g.id; drawList(); } else remove(k);
      });
      x.classList.add('oo-del');
      tools.append(x);
    }
    top.append(tools);
    return top;
  }

  function addGroup() {
    if (d.groups.length >= MAX_GROUPS) return say(`Групп не больше ${MAX_GROUPS}.`);
    d.groups.push(newGroup(newGroupId(), allItemIds()));
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = last.querySelector('.oo-item-in'); if (inp) inp.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.groups.length) return;
    [d.groups[k], d.groups[j]] = [d.groups[j], d.groups[k]];
    save();
    drawList();
  }
  // Копия получает новые ID группы и элементов; отметка лишнего переходит на новый ID того же элемента
  function duplicate(k) {
    if (d.groups.length >= MAX_GROUPS) return say(`Групп не больше ${MAX_GROUPS}.`);
    const copy = JSON.parse(JSON.stringify(d.groups[k]));
    copy.id = newGroupId();
    const ids = allItemIds();
    copy.items.forEach(i => { const id = nextId('i', ids); ids.push(id); if (copy.odd === i.id) copy.odd = id; i.id = id; });
    d.groups.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.groups.splice(k, 1);
    delAsk = null;
    if (!d.groups.length) d.groups.push(newGroup(newGroupId(), allItemIds()));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // Пустые поля элементов в файл не попадают. view — только при «list», look — только при «cards», shuffle — только выключенное,
  // showAnswers — только включённое; prompt и explanation — только если не пустые
  function exportData(draft) {
    return {
      module: 'odd_one_out', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      ...(draft.look === 'cards' ? { look: 'cards' } : {}),
      ...(draft.shuffle === false ? { shuffle: false } : {}),
      ...(draft.showAnswers === true ? { showAnswers: true } : {}),
      groups: draft.groups.map(g => ({
        id: g.id,
        ...(clean(g.prompt) ? { prompt: clean(g.prompt) } : {}),
        items: g.items.filter(filled).map(i => ({ id: i.id, text: clean(i.text) })),
        odd: g.odd,
        ...(g.explanation.trim() ? { explanation: g.explanation.trim() } : {}),
      })),
    };
  }

  // Балл — за каждую группу
  const unitCount = draft => draft.groups.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.groups.length > 1;
    if (!draft.groups.length) errors.push('Нет ни одной группы.');
    if (draft.groups.length > MAX_GROUPS) errors.push(`Групп больше ${MAX_GROUPS}.`);
    draft.groups.forEach((g, k) => {
      const pre = many ? `Группа ${k + 1}: ` : '';
      const full = g.items.filter(filled);
      if (full.length < MIN_ITEMS) errors.push(`${pre}нужно хотя бы ${MIN_ITEMS} элемента.`);
      if (full.length > MAX_ITEMS) errors.push(`${pre}элементов больше ${MAX_ITEMS}.`);
      const odd = g.items.find(i => i.id === g.odd);
      if (!odd) errors.push(`${pre}не отмечен лишний элемент.`);
      else if (!filled(odd)) errors.push(`${pre}лишний элемент пустой.`);
      const seen = new Map();
      full.forEach(i => seen.set(key(i.text), (seen.get(key(i.text)) || 0) + 1));
      seen.forEach((n, t) => { if (n > 1) warnings.push(`${pre}элемент «${clean(full.find(i => key(i.text) === t).text)}» повторяется ${n} раза.`); });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию.
  // Повтор ID получает новый; лишний, указывающий на несуществующий элемент, становится пустым (ошибка публикации)
  function load(file) {
    if (!Array.isArray(file.groups) || !file.groups.length) throw new Error('В файле нет групп.');
    const gIds = new Set(), used = new Set();
    const groups = file.groups.slice(0, MAX_GROUPS).map(s => {
      let gid = String((s && s.id) || '');
      if (!gid || gIds.has(gid)) gid = nextId('g', [...gIds]);
      gIds.add(gid);
      let odd = '';
      const items = (Array.isArray(s && s.items) ? s.items : []).slice(0, MAX_ITEMS).map(i => {
        let id = String((i && i.id) || '');
        const src = id;
        if (!id || used.has(id)) id = nextId('i', [...used]);
        used.add(id);
        if (src && src === (s && s.odd) && !odd) odd = id;
        return { id, text: String((i && i.text) || '').slice(0, MAX_LEN) };
      });
      while (items.length < MIN_ITEMS) { const id = nextId('i', [...used]); used.add(id); items.push(newItem(id)); }
      return { id: gid, prompt: String((s && s.prompt) || '').slice(0, PROMPT_LEN), items, odd, explanation: String((s && s.explanation) || '') };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', look: file.look === 'cards' ? 'cards' : 'chips',
      shuffle: file.shuffle !== false, showAnswers: file.showAnswers === true, groups };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): показ групп и вид элементов
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'view', label: 'Показ групп', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
        icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } },
      { field: 'look', label: 'Вид элементов', value: LOOKS[draft.look] ? draft.look : 'chips', names: LOOKS,
        icons: { chips: sq('<rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>'), cards: sq('<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>') } },
    ];
  }

  // Выключатели во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [
      { field: 'shuffle', label: 'Перемешивать элементы', value: draft.shuffle !== false,
        help: 'Элементы каждой группы перемешиваются при открытии упражнения и при «Начать заново»; внутри одного прохождения порядок не меняется. Лишний привязан к самому элементу, а не к месту. По умолчанию включено.' },
      { field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers === true,
        help: 'Если включено, после конца упражнения в неверно решённых группах лишний элемент обведён зелёным пунктиром с ✓. До конца правильный ответ не показывается никогда. По умолчанию выключено.' },
    ];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions, behaviorOptions };
})();
