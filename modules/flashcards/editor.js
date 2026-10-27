// Редактор модуля Flashcards: колода карточек. У карточки две стороны (лицевая и обратная) и необязательная подсказка.
// Баллов и проверок нет: ученик листает карточки и сам отмечает «Знаю» / «Повторить».
// У карточки устойчивый ID (c1, c2…); он не зависит от текста и места в колоде.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const FlashcardsEditor = (() => {
  const MAX_CARDS = 100;
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="fcx-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim();
  const ORDERS = { shuffle: 'Перемешать', fixed: 'По порядку' };
  const ANIMS = { flip: 'Поворот', fade: 'Появление' };

  const newCard = () => ({ id: nextId('c', d.cards.map(c => c.id)), front: '', back: '', hint: '' });

  function create() {
    return { module: 'flashcards', format: 1, order: 'shuffle', anim: 'flip', cards: [{ id: 'c1', front: '', back: '', hint: '' }] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): несколько карточек, у одной подсказка
  function demo() {
    return { ...create(), instruction: DimDemo.instruction('Переверните карточку, вспомните ответ и отметьте, знаете вы его или нужно повторить.'), cards: [
      { id: 'c1', front: 'apple', back: 'яблоко', hint: 'Фрукт, который растёт на яблоне.' },
      { id: 'c2', front: 'to look forward to', back: 'ждать с нетерпением', hint: '' },
      { id: 'c3', front: 'Столица Франции?', back: 'Париж', hint: 'Город на Сене.' },
      { id: 'c4', front: 'I ___ (to be) a student.', back: 'am', hint: '' },
    ] };
  }

  function normalize() {
    if (!ORDERS[d.order]) d.order = 'shuffle';
    if (!ANIMS[d.anim]) d.anim = 'flip';
    d.cards.forEach(c => { if (typeof c.hint !== 'string') c.hint = ''; });
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
    root.className = 'fcx-wrap';
    const tools = el('div', 'fcx-tools');
    counter = el('span', 'fcx-muted');
    const right = el('span', 'fcx-right');
    right.append(help(`Здесь собирается колода. У каждой карточки две стороны: ученик видит лицевую, переворачивает и видит обратную. Подсказка необязательна: ученик открывает её, пока карточка лежит лицевой стороной. Баллов и проверок нет: ученик сам отмечает «Знаю» или «Повторить». Карточек до ${MAX_CARDS}. Порядок (по порядку или перемешать) и вид переворота выбираются во вкладке «Дизайн».`));
    tools.append(counter, right);
    msg = el('div', 'fcx-msg');
    msg.hidden = true;
    listBox = el('div', 'fcx-cards');
    addBtn = el('button', 'fcx-add', '+ Карточка');
    addBtn.type = 'button';
    addBtn.onclick = addCard;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function drawList() {
    listBox.innerHTML = '';
    d.cards.forEach((c, k) => listBox.append(card(c, k)));
    counter.textContent = `Карточек: ${d.cards.length}/${MAX_CARDS}`;
    addBtn.disabled = d.cards.length >= MAX_CARDS;
  }

  const area = (value, placeholder, label, onInput, cls) => {
    const t = el('textarea', 'fcx-in ' + cls);
    t.rows = 2;
    t.maxLength = 500;
    t.placeholder = placeholder;
    t.value = value;
    t.setAttribute('aria-label', label);
    t.oninput = () => onInput(t.value);
    return t;
  };
  const iconBtn = (html, tip, label, fn, disabled) => {
    const x = el('button', 'fcx-ib');
    x.type = 'button';
    x.innerHTML = html;
    x.title = tip;
    x.setAttribute('aria-label', label);
    x.disabled = !!disabled;
    x.onclick = fn;
    return x;
  };

  function card(c, k) {
    const box = el('section', 'fcx-card');
    box.dataset.id = c.id;
    const top = el('div', 'fcx-top');
    top.append(el('b', '', `Карточка ${k + 1}`));
    const tools = el('span', 'fcx-tools2');
    const n = ` ${k + 1}`;
    tools.append(
      iconBtn(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', 'Карточка выше,' + n, () => move(k, -1), k === 0),
      iconBtn(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', 'Карточка ниже,' + n, () => move(k, 1), k === d.cards.length - 1),
      iconBtn(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', 'Дублировать карточку,' + n, () => duplicate(k), d.cards.length >= MAX_CARDS),
    );
    if (delAsk === c.id) {
      const q = el('span', 'fcx-ask');
      const yes = el('button', 'fcx-yes', 'Удалить карточку');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const del = iconBtn(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', 'Удалить карточку,' + n, () => {
        if (clean(c.front) || clean(c.back) || clean(c.hint)) { delAsk = c.id; drawList(); } else remove(k);
      });
      del.classList.add('fcx-del');
      tools.append(del);
    }
    top.append(tools);

    const sides = el('div', 'fcx-sides');
    sides.append(
      area(c.front, 'Лицевая сторона', `Лицевая сторона карточки ${k + 1}`, v => { c.front = v; save(); }, 'fcx-front'),
      area(c.back, 'Обратная сторона', `Обратная сторона карточки ${k + 1}`, v => { c.back = v; save(); }, 'fcx-back'),
    );
    const hint = el('input', 'fcx-in fcx-hint');
    hint.type = 'text';
    hint.maxLength = 300;
    hint.placeholder = 'Подсказка (необязательно)';
    hint.value = c.hint;
    hint.setAttribute('aria-label', `Подсказка карточки ${k + 1}`);
    hint.oninput = () => { c.hint = hint.value; save(); };
    box.append(top, sides, hint);
    return box;
  }

  function addCard() {
    if (d.cards.length >= MAX_CARDS) return say(`Карточек не больше ${MAX_CARDS}.`);
    d.cards.push(newCard());
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const t = last.querySelector('.fcx-front'); if (t) t.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.cards.length) return;
    [d.cards[k], d.cards[j]] = [d.cards[j], d.cards[k]];
    save();
    drawList();
  }
  // Копия получает новый ID
  function duplicate(k) {
    if (d.cards.length >= MAX_CARDS) return say(`Карточек не больше ${MAX_CARDS}.`);
    const copy = { ...d.cards[k], id: nextId('c', d.cards.map(c => c.id)) };
    d.cards.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.cards.splice(k, 1);
    delAsk = null;
    if (!d.cards.length) d.cards.push(newCard());
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  const filled = c => clean(c.front) || clean(c.back);
  const cardOut = c => ({ id: c.id, front: clean(c.front), back: clean(c.back), ...(clean(c.hint) ? { hint: clean(c.hint) } : {}) });
  function exportData(draft) {
    return {
      module: 'flashcards', format: 1,
      ...(draft.order === 'fixed' ? { order: 'fixed' } : {}),
      ...(draft.anim === 'fade' ? { anim: 'fade' } : {}),
      cards: draft.cards.filter(filled).map(cardOut),
    };
  }

  const unitCount = draft => draft.cards.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    if (!draft.cards.length) errors.push('Нет ни одной карточки.');
    if (draft.cards.length > MAX_CARDS) errors.push(`Карточек больше ${MAX_CARDS}.`);
    const seen = new Map();
    draft.cards.forEach((c, k) => {
      const pre = `Карточка ${k + 1}: `;
      const f = clean(c.front), b = clean(c.back);
      if (!f && !b && !clean(c.hint)) { errors.push(`${pre}пустая.`); return; }
      if (!f) errors.push(`${pre}не заполнена лицевая сторона.`);
      if (!b) errors.push(`${pre}не заполнена обратная сторона.`);
      if (f && b) { const key = (f + '\u0000' + b).normalize('NFC').toLowerCase(); seen.set(key, [...(seen.get(key) || []), k + 1]); }
    });
    seen.forEach(nums => { if (nums.length > 1) warnings.push(`Одинаковые карточки: ${nums.join(', ')}.`); });
    if (draft.cards.length === 1) warnings.push('В колоде одна карточка.');
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.cards) || !file.cards.length) throw new Error('В файле нет карточек.');
    const ids = new Set();
    const cards = file.cards.slice(0, MAX_CARDS).map(s => {
      let id = String((s && s.id) || '');
      if (!id || ids.has(id)) id = nextId('c', [...ids]);
      ids.add(id);
      return { id, front: String((s && s.front) || ''), back: String((s && s.back) || ''), hint: String((s && s.hint) || '') };
    });
    return { ...create(), order: file.order === 'fixed' ? 'fixed' : 'shuffle', anim: file.anim === 'fade' ? 'fade' : 'flip', cards };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'order', label: 'Порядок карточек', value: ORDERS[draft.order] ? draft.order : 'shuffle', names: ORDERS,
        icons: { shuffle: sq('<path d="M4 7h4l8 10h4M4 17h4l2-2.5M14 9.5L16 7h4M18 5l2 2-2 2M18 15l2 2-2 2"/>'), fixed: sq('<path d="M5 7h14M5 12h14M5 17h14"/>') } },
      { field: 'anim', label: 'Переворот карточки', value: ANIMS[draft.anim] ? draft.anim : 'flip', names: ANIMS,
        icons: { flip: sq('<rect x="7" y="5" width="10" height="14" rx="2"/><path d="M3 9v6M21 9v6"/>'), fade: sq('<rect x="4" y="6" width="10" height="12" rx="2"/><rect x="10" y="6" width="10" height="12" rx="2" fill="currentColor" fill-opacity=".3"/>') } },
    ];
  }

  // У колоды нет проверок и баллов: вкладка «Поведение» объясняет это
  const noChecks = true;
  const noChecksNote = 'В Flashcards нет проверок и баллов. Ученик сам отмечает карточки «Знаю» или «Повторить»; это не оценка.';

  return { create, demo, render, load, exportData, validate, unitCount, noChecks, noChecksNote, designOptions };
})();
