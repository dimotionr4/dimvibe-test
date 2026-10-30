// Редактор модуля Flashcards: колода карточек. У карточки две стороны (лицевая и обратная), у каждой — текст, картинка и звук
// (любое сочетание, но сторона не пустая), и необязательная подсказка. Баллов и проверок нет: ученик листает карточки
// и сам отмечает «Знаю» / «Повторить».
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
  const svg = inner => `<svg class="fcx-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim();
  const ORDERS = { shuffle: 'Перемешать', fixed: 'По порядку' };
  const ANIMS = { flip: 'Поворот', fade: 'Появление' };
  const SIZES = { standard: 'Стандартный', compact: 'Компактный' };
  const DIRS = { both: 'Ученик выбирает', forward: 'Только лицевая → обратная' };

  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  // Звук стороны: {media} или нет
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };
  const imageOut = im => {
    if (!im) return null;
    const alt = String(im.alt || '').trim().replace(/\s+/g, ' '), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const sideFilled = (c, s) => !!(clean(c[s]) || hasPic(c[s + 'Image']) || safeMediaPath(c[s + 'Audio']));

  const blank = id => ({ id, front: '', back: '', hint: '', frontImage: emptyImage(), backImage: emptyImage(), frontAudio: '', backAudio: '' });
  const newCard = () => blank(nextId('c', d.cards.map(c => c.id)));

  function create() {
    return { module: 'flashcards', format: 1, order: 'shuffle', anim: 'flip', size: 'standard', direction: 'both', cards: [blank('c1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): текст, картинка, звук и подсказка
  function demo() {
    const c = (id, front, back, hint, extra) => ({ ...blank(id), front, back, hint: hint || '', ...extra });
    return { ...create(), instruction: DimDemo.instruction('Переверните карточку, вспомните ответ и отметьте, знаете вы его или нужно повторить.'), cards: [
      c('c1', 'house', 'дом', 'Здание, где живут люди.', { frontImage: { ...emptyImage(), media: DimDemo.IMG.house }, frontAudio: DimDemo.AUD.a }),
      c('c2', 'apple', 'яблоко', 'Фрукт, который растёт на яблоне.'),
      c('c3', 'to look forward to', 'ждать с нетерпением', '', { backAudio: DimDemo.AUD.a }),
      c('c4', 'Столица Франции?', 'Париж', 'Город на Сене.'),
      c('c5', '', 'house', '', { frontImage: { ...emptyImage(), media: DimDemo.IMG.house } }),
    ] };
  }

  function normalize() {
    if (!ORDERS[d.order]) d.order = 'shuffle';
    if (!ANIMS[d.anim]) d.anim = 'flip';
    if (!SIZES[d.size]) d.size = 'standard';
    if (!DIRS[d.direction]) d.direction = 'both';
    d.cards.forEach(c => {
      if (typeof c.hint !== 'string') c.hint = '';
      ['frontImage', 'backImage'].forEach(k => { if (!c[k]) c[k] = emptyImage(); });
      ['frontAudio', 'backAudio'].forEach(k => { if (typeof c[k] !== 'string') c[k] = ''; });
    });
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
    right.append(help(`Здесь собирается колода. У каждой карточки две стороны: ученик видит одну, переворачивает и видит другую. На стороне может быть текст, одна картинка и один звук в любом сочетании; пустой сторона быть не может. Подсказка необязательна: ученик открывает её, пока карточка лежит лицевой стороной. Баллов и проверок нет: ученик сам отмечает «Знаю» или «Повторить». Карточек до ${MAX_CARDS}. Порядок, переворот, размер и направления выбираются во вкладке «Дизайн». Карточки можно переносить за ручку.`));
    tools.append(counter, right);
    msg = el('div', 'fcx-msg');
    msg.hidden = true;
    listBox = el('div', 'fcx-cards');
    // Перетаскивание за ручку: новое место карточки сразу становится её местом в колоде
    Reorder.attach(listBox, { itemSel: '.fcx-card', handleSel: '.fcx-grip', dragClass: 'fcx-dragging', listClass: 'fcx-dragging-list', onDrop: (from, to) => {
      const [c] = d.cards.splice(from, 1);
      d.cards.splice(to, 0, c);
      save();
      drawList();
    } });
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

  // Одна сторона: текст, картинка и звук
  function side(c, s, k) {
    const name = s === 'front' ? 'Лицевая' : 'Обратная';
    const box = el('div', 'fcx-side');
    box.append(el('span', 'fcx-sidename', name));
    const t = el('textarea', 'fcx-in fcx-' + s);
    t.rows = 2;
    t.maxLength = 500;
    t.placeholder = `${name} сторона`;
    t.value = c[s];
    t.setAttribute('aria-label', `${name} сторона карточки ${k + 1}`);
    t.oninput = () => { c[s] = t.value; save(); };
    const audio = MediaUI.picker('audio', () => c[s + 'Audio'] || '', v => { c[s + 'Audio'] = v; save(); }, `Загрузить звук: ${name.toLowerCase()} сторона`);
    // Картинка стороны — большая плитка слева, звук — перед полем текста (наброски владельца 2026-10-27…28, core/mediabar.js)
    const pic = MediaUI.imageControl(c[s + 'Image'], { save, after: audio, audioOutside: true, big: true });
    box.append(MediaUI.side(pic, MediaUI.withAudio(audio, t, true)));
    return box;
  }

  function card(c, k) {
    const box = el('section', 'fcx-card');
    box.dataset.id = c.id;
    const top = el('div', 'fcx-top');
    const grip = el('button', 'fcx-grip');
    grip.type = 'button';
    grip.innerHTML = Reorder.GRIP;
    grip.title = 'Перетащить';
    grip.setAttribute('aria-label', `Перетащить карточку ${k + 1}`);
    top.append(grip, el('b', '', `Карточка ${k + 1}`));
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
        if (sideFilled(c, 'front') || sideFilled(c, 'back') || clean(c.hint)) { delAsk = c.id; drawList(); } else remove(k);
      });
      del.classList.add('fcx-del');
      tools.append(del);
    }
    top.append(tools);

    const sides = el('div', 'fcx-sides');
    sides.append(side(c, 'front', k), side(c, 'back', k));
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
    const copy = { ...JSON.parse(JSON.stringify(d.cards[k])), id: nextId('c', d.cards.map(c => c.id)) };
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
  const filled = c => sideFilled(c, 'front') || sideFilled(c, 'back') || clean(c.hint);
  const cardOut = c => ({
    id: c.id, front: clean(c.front), back: clean(c.back),
    ...(clean(c.hint) ? { hint: clean(c.hint) } : {}),
    ...(imageOut(c.frontImage) ? { frontImage: imageOut(c.frontImage) } : {}),
    ...(imageOut(c.backImage) ? { backImage: imageOut(c.backImage) } : {}),
    ...(audioOut(c.frontAudio) ? { frontAudio: audioOut(c.frontAudio) } : {}),
    ...(audioOut(c.backAudio) ? { backAudio: audioOut(c.backAudio) } : {}),
  });
  function exportData(draft) {
    return {
      module: 'flashcards', format: 1,
      ...(draft.order === 'fixed' ? { order: 'fixed' } : {}),
      ...(draft.anim === 'fade' ? { anim: 'fade' } : {}),
      ...(draft.size === 'compact' ? { size: 'compact' } : {}),
      ...(draft.direction === 'forward' ? { direction: 'forward' } : {}),
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
      if (!filled(c)) { errors.push(`${pre}пустая.`); return; }
      [['front', 'лицевой'], ['back', 'обратной']].forEach(([s, name]) => {
        const im = c[s + 'Image'];
        if (im && !safeMediaPath(im.media) && String(im.url || '').trim() && !safeImageUrl(im.url)) errors.push(`${pre}ссылка на картинку ${name} стороны должна быть полным адресом с https://.`);
      });
      const f = sideFilled(c, 'front'), b = sideFilled(c, 'back');
      if (!f) errors.push(`${pre}не заполнена лицевая сторона.`);
      if (!b) errors.push(`${pre}не заполнена обратная сторона.`);
      if (f && b) {
        const key = [clean(c.front), clean(c.back), safeMediaPath(c.frontImage.media) || '', safeMediaPath(c.backImage.media) || ''].join('\u0000').normalize('NFC').toLowerCase();
        seen.set(key, [...(seen.get(key) || []), k + 1]);
      }
    });
    seen.forEach(nums => { if (nums.length > 1) warnings.push(`Одинаковые карточки: ${nums.join(', ')}.`); });
    if (draft.cards.length === 1) warnings.push('В колоде одна карточка.');
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.cards) || !file.cards.length) throw new Error('В файле нет карточек.');
    const ids = new Set();
    const img = im => ({ media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') });
    const aud = a => (a && safeMediaPath(a.media)) || '';
    const cards = file.cards.slice(0, MAX_CARDS).map(s => {
      let id = String((s && s.id) || '');
      if (!id || ids.has(id)) id = nextId('c', [...ids]);
      ids.add(id);
      return { id, front: String((s && s.front) || ''), back: String((s && s.back) || ''), hint: String((s && s.hint) || ''),
        frontImage: img(s && s.frontImage), backImage: img(s && s.backImage), frontAudio: aud(s && s.frontAudio), backAudio: aud(s && s.backAudio) };
    });
    return { ...create(), order: file.order === 'fixed' ? 'fixed' : 'shuffle', anim: file.anim === 'fade' ? 'fade' : 'flip',
      size: file.size === 'compact' ? 'compact' : 'standard', direction: file.direction === 'forward' ? 'forward' : 'both', cards };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'order', label: 'Порядок карточек', value: ORDERS[draft.order] ? draft.order : 'shuffle', names: ORDERS,
        icons: { shuffle: sq('<path d="M4 7h4l8 10h4M4 17h4l2-2.5M14 9.5L16 7h4M18 5l2 2-2 2M18 15l2 2-2 2"/>'), fixed: sq('<path d="M5 7h14M5 12h14M5 17h14"/>') } },
      { field: 'anim', label: 'Переворот карточки', value: ANIMS[draft.anim] ? draft.anim : 'flip', names: ANIMS,
        icons: { flip: sq('<rect x="7" y="5" width="10" height="14" rx="2"/><path d="M3 9v6M21 9v6"/>'), fade: sq('<rect x="4" y="6" width="10" height="12" rx="2"/><rect x="10" y="6" width="10" height="12" rx="2" fill="currentColor" fill-opacity=".3"/>') } },
      { field: 'size', label: 'Размер карточки', value: SIZES[draft.size] ? draft.size : 'standard', names: SIZES,
        icons: { standard: sq('<rect x="4" y="5" width="16" height="14" rx="2"/>'), compact: sq('<rect x="6" y="8" width="12" height="8" rx="2"/>') } },
      { field: 'direction', label: 'Направление', value: DIRS[draft.direction] ? draft.direction : 'both', names: DIRS,
        icons: { both: sq('<path d="M4 9h14M14 5l4 4-4 4M20 15H6M10 11l-4 4 4 4"/>'), forward: sq('<path d="M4 12h15M14 7l5 5-5 5"/>') } },
    ];
  }

  // У колоды нет проверок и баллов: вкладка «Поведение» объясняет это
  const noChecks = true;
  const noChecksNote = 'В Flashcards нет проверок и баллов. Ученик сам отмечает карточки «Знаю» или «Повторить»; это не оценка.';

  return { create, demo, render, load, exportData, validate, unitCount, noChecks, noChecksNote, designOptions };
})();
