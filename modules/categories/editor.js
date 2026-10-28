// Редактор модуля Categories / Sorting: категории и карточки; карточка лежит в своей правильной категории.
// У категории и карточки устойчивый ID (c1, i1…). Перенос карточки в другую категорию меняет её правильный ответ,
// переименование и порядок категорий ответ не меняют. Этап 1 (решение владельца 2026-10-25) — текст;
// этап 2 (тоже 2026-10-25) — карточка может быть картинкой или картинкой с подписью, у карточки необязательный звук.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const CategoriesEditor = (() => {
  const MIN_CATS = 2, MAX_CATS = 5, MAX_ITEMS = 20, MIN_ITEMS = 3, MAX_LEN = 100, NAME_LEN = 60; // категорий, карточек всего, символов
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, paste = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="cs-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const key = s => clean(s).normalize('NFC').toLowerCase(); // одинаковые без учёта регистра и лишних пробелов
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const picKey = im => (hasPic(im) ? (safeMediaPath(im.media) || safeImageUrl(im.url)) : '');
  const hasAud = it => !!safeMediaPath(it.audio);
  // Карточка заполнена, если есть текст, картинка или звук (карточка «только звук» — решение владельца 2026-10-25)
  const filled = it => !!clean(it.text) || hasPic(it.image) || hasAud(it);
  // «Спрятать текст» действует, только если ученику есть что показать вместо текста: картинка или звук
  const hidden = it => it.hideText === true && (hasPic(it.image) || hasAud(it));
  const shown = it => (hidden(it) ? '' : clean(it.text)); // текст, который видит ученик
  // Что ученик различает: видимый текст и картинка; у карточки «только звук» — сам звуковой файл
  // (разные файлы автор проверяет на слух сам: смысл звука система не сравнивает)
  const faceKey = it => key(shown(it)) + '|' + picKey(it.image) + (!shown(it) && !hasPic(it.image) ? '|' + safeMediaPath(it.audio) : '');
  const label = it => (clean(it.text) ? `«${clean(it.text)}»` : hasPic(it.image) ? '(картинка)' : '(звук)');
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };
  const allItemIds = () => d.cats.flatMap(c => c.items.map(i => i.id));
  const total = draft => draft.cats.reduce((n, c) => n + c.items.filter(filled).length, 0);

  const VIEWS = { columns: 'Колонками', stacked: 'Друг под другом' };
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };

  function newItem(id) { return { id, text: '', image: emptyImage(), audio: '', hideText: false }; }
  function create() {
    return { module: 'categories', format: 1, showAnswers: false, view: 'columns', imageSize: 'm',
      cats: [{ id: 'c1', name: '', items: [newItem('i1'), newItem('i2')] }, { id: 'c2', name: '', items: [newItem('i3'), newItem('i4')] }] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): четыре категории, 10 карточек (значит, 5 проверок),
  // карточки-картинки, картинка со спрятанным текстом, карточка «только звук» (текст спрятан) и текст со звуком; правильный ответ показывается
  function demo() {
    const I = DimDemo.IMG, A = DimDemo.AUD;
    const it = (id, text, media, audio, hideText) => ({ ...newItem(id), text, image: { ...emptyImage(), media: media || '' }, audio: audio || '', hideText: !!hideText });
    return { ...create(), showAnswers: true, instruction: DimDemo.instruction('Разложите карточки по категориям.'), cats: [
      { id: 'c1', name: 'Fruits', items: [it('i1', 'apple'), it('i2', 'banana'), it('i3', 'orange')] },
      { id: 'c2', name: 'Vegetables', items: [it('i4', 'carrot'), it('i5', 'potato')] },
      { id: 'c3', name: 'Animals', items: [it('i6', 'cat', '', A.b, true), it('i7', 'dog', '', A.c)] },
      { id: 'c4', name: 'Numbers', items: [it('i8', '', I.one), it('i9', '', I.two), it('i10', 'four', I.four, '', true)] },
    ] };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!VIEWS[d.view]) d.view = 'columns';
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    d.cats.forEach(c => c.items.forEach(i => {
      if (!i.image) i.image = emptyImage();
      if (typeof i.audio !== 'string') i.audio = '';
      if (typeof i.hideText !== 'boolean' || !hasPic(i.image) && !hasAud(i)) i.hideText = false;
    }));
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
    root.className = 'cs-wrap';
    const tools = el('div', 'cs-tools');
    counter = el('span', 'cs-muted');
    const right = el('span', 'cs-right');
    right.append(help(`Создайте категории и напишите в каждой её карточки: категория, в которой лежит карточка, и есть правильный ответ. Чтобы перенести карточку в другую категорию, выберите её в списке справа от карточки. Карточка — текст, картинка, звук или их сочетание. Если у карточки есть картинка или звук, можно поставить «Спрятать текст»: ученик увидит только картинку или кнопку звука, а текст — после конца упражнения. Ученик получит все карточки перемешанными и разложит их по категориям. Балл — за каждую верно разложенную карточку. Категорий от ${MIN_CATS} до ${MAX_CATS}, в каждой хотя бы одна карточка, всего карточек от ${MIN_ITEMS} до ${MAX_ITEMS}. Одинаковые карточки в разных категориях нельзя: ученик не поймёт, куда их класть.`));
    tools.append(counter, right);
    msg = el('div', 'cs-msg');
    msg.hidden = true;
    listBox = el('div', 'cs-cats');
    addBtn = el('button', 'cs-add', '+ Категория');
    addBtn.type = 'button';
    addBtn.onclick = addCat;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Категорий: ${d.cats.length}/${MAX_CATS} · Карточек: ${total(d)}/${MAX_ITEMS}`;
    addBtn.disabled = d.cats.length >= MAX_CATS;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.cats.forEach((c, k) => listBox.append(card(c, k)));
    updateCounter();
    marks();
  }

  const newCatId = () => nextId('c', d.cats.map(c => c.id));
  const newItemId = () => nextId('i', allItemIds());

  // Подсветка сразу, не дожидаясь публикации: одинаковые названия категорий и одинаковые карточки
  // (в разных категориях — красным, это ошибка; в одной — жёлтым, это только предупреждение)
  function marks() {
    const names = {};
    d.cats.forEach(c => { const k = key(c.name); if (k) names[k] = (names[k] || 0) + 1; });
    const where = {}; // лицо карточки (текст и картинка) → в каких категориях и сколько раз
    d.cats.forEach(c => c.items.forEach(i => { if (filled(i)) { const k = faceKey(i); (where[k] = where[k] || []).push(c.id); } }));
    listBox.querySelectorAll('.cs-cat').forEach(box => {
      const c = d.cats.find(x => x.id === box.dataset.id);
      if (!c) return;
      box.querySelector('.cs-name').classList.toggle('dup', !!key(c.name) && names[key(c.name)] > 1);
      box.querySelectorAll('.cs-row').forEach(r => {
        const i = c.items.find(x => x.id === r.dataset.id);
        const w = i && filled(i) ? where[faceKey(i)] : null;
        r.classList.toggle('dup', !!w && new Set(w).size > 1);
        r.classList.toggle('same', !!w && new Set(w).size === 1 && w.length > 1);
      });
    });
  }
  const touched = () => { save(); updateCounter(); marks(); };

  function card(c, k) {
    const box = el('section', 'cs-cat');
    box.dataset.id = c.id;
    box.append(head(c, k));
    const items = el('ul', 'cs-items');
    c.items.forEach((it, j) => items.append(itemRow(c, it, j)));
    const add = el('button', 'cs-add cs-additem', '+ Карточка');
    add.type = 'button';
    add.disabled = total(d) >= MAX_ITEMS;
    add.onclick = () => {
      if (total(d) >= MAX_ITEMS) return say(`Карточек не больше ${MAX_ITEMS} на всё упражнение.`);
      c.items.push(newItem(newItemId()));
      save();
      drawList();
      const ins = listBox.querySelectorAll(`.cs-cat[data-id="${c.id}"] .cs-item-in`);
      if (ins.length) ins[ins.length - 1].focus();
    };
    const bulk = el('button', 'cs-add cs-bulkbtn', paste === c.id ? 'Скрыть вставку' : 'Вставить списком');
    bulk.type = 'button';
    bulk.onclick = () => { paste = paste === c.id ? null : c.id; drawList(); if (paste) { const t = listBox.querySelector('.cs-bulk textarea'); if (t) t.focus(); } };
    const adds = el('div', 'cs-adds');
    adds.append(add, bulk);
    box.append(items, adds);
    if (paste === c.id) box.append(bulkBox(c));
    return box;
  }

  // Вставка списком: каждая непустая строка — новая карточка этой категории; пустые поля категории заменяются
  function bulkBox(c) {
    const wrap = el('div', 'cs-bulk');
    const ta = el('textarea', 'cs-in');
    ta.rows = 5;
    ta.placeholder = 'Одна карточка на строку';
    ta.setAttribute('aria-label', 'Карточки списком, одна на строку');
    const go = el('button', 'primary', 'Добавить');
    go.type = 'button';
    go.onclick = () => {
      const lines = ta.value.split(/\r?\n/).map(clean).filter(Boolean).map(s => s.slice(0, MAX_LEN));
      if (!lines.length) return say('Вставьте хотя бы одну строку.');
      c.items = c.items.filter(filled);
      const have = new Set(c.items.filter(i => !hasPic(i.image) && !hasAud(i)).map(i => key(i.text)));
      let added = 0, dups = 0, over = 0;
      lines.forEach(s => {
        if (have.has(key(s))) { dups++; return; }
        if (total(d) >= MAX_ITEMS) { over++; return; }
        const it = newItem(newItemId());
        it.text = s;
        c.items.push(it);
        have.add(key(s));
        added++;
      });
      if (!c.items.length) c.items.push(newItem(newItemId()));
      paste = null;
      save();
      drawList();
      say(`Добавлено карточек: ${added}.` + (dups ? ` Повторы пропущены: ${dups}.` : '') + (over ? ` Не поместилось (больше ${MAX_ITEMS}): ${over}.` : ''));
    };
    const row = el('div', 'cs-bulkrow');
    row.append(go);
    wrap.append(ta, row);
    return wrap;
  }

  function itemRow(c, it, j) {
    const r = el('li', 'cs-row');
    r.dataset.id = it.id;
    const inp = el('input', 'cs-in cs-item-in');
    inp.type = 'text';
    inp.maxLength = MAX_LEN;
    const ph = () => (hidden(it) ? 'Текст для себя (ученик увидит его после конца)' : hasPic(it.image) ? 'Подпись к картинке (необязательно)' : hasAud(it) ? 'Текст карточки (необязательно)' : `Карточка ${j + 1}`);
    inp.placeholder = ph();
    inp.value = it.text;
    inp.setAttribute('aria-label', `Карточка ${j + 1}`);
    inp.oninput = () => { it.text = inp.value; touched(); };
    // Перенос в другую категорию — смена правильного ответа карточки
    const mv = el('select', 'cs-move');
    mv.title = 'Категория карточки';
    mv.setAttribute('aria-label', `Категория карточки ${j + 1}`);
    d.cats.forEach((x, n) => { const o = el('option', '', clean(x.name) || `Категория ${n + 1}`); o.value = x.id; mv.append(o); });
    mv.value = c.id;
    mv.onchange = () => {
      const to = d.cats.find(x => x.id === mv.value);
      if (!to || to === c) return;
      c.items.splice(c.items.indexOf(it), 1);
      if (!c.items.length) c.items.push(newItem(newItemId()));
      // Пустое поле в новой категории занимает перенесённая карточка
      const blank = to.items.findIndex(i => !filled(i));
      if (blank >= 0 && to.items.length === 1) to.items.splice(blank, 1, it); else to.items.push(it);
      save();
      drawList();
    };
    const del = el('button', 'cs-ib cs-del');
    del.type = 'button';
    del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    del.title = 'Удалить';
    del.setAttribute('aria-label', `Удалить карточку ${j + 1}`);
    del.disabled = c.items.length <= 1;
    del.onclick = () => { c.items.splice(c.items.indexOf(it), 1); save(); drawList(); };
    // Картинка и звук карточки: общие значки «загрузить» и «из медиатеки», миниатюра и ▶ с крестиком (core/mediabar.js)
    // «Спрятать текст» (решение владельца 2026-10-25): видна, только когда есть картинка или звук; текст тогда — подсказка автору,
    // ученик увидит его только после конца упражнения
    const hide = el('label', 'cs-hide');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = it.hideText === true;
    box.onchange = () => { it.hideText = box.checked; inp.placeholder = ph(); touched(); };
    hide.append(box, document.createTextNode(' Спрятать текст'));
    hide.title = 'Ученик увидит только картинку или кнопку звука; текст появится после конца упражнения';
    // Убрали и картинку, и звук — прятать текст больше не за чем: галочка снимается сама, в той же записи истории (одна отмена)
    const fixHide = () => { if (!hasPic(it.image) && !hasAud(it) && it.hideText) { it.hideText = false; box.checked = false; } };
    const sync = () => { hide.hidden = !hasPic(it.image) && !hasAud(it); inp.placeholder = ph(); updateCounter(); marks(); };
    const audio = MediaUI.picker('audio', () => it.audio || '', v => { it.audio = v; fixHide(); save(); sync(); }, 'Загрузить звук карточки');
    // Большая плитка картинки слева, справа поле со звуком перед ним и «Спрятать текст» (наброски владельца 2026-10-27…28)
    const line = el('div', 'mb-line');
    line.append(audio, inp, mv, del);
    const pic = MediaUI.imageControl(it.image, { save: () => { fixHide(); save(); }, after: audio, audioOutside: true, big: true, change: sync });
    hide.hidden = !hasPic(it.image) && !hasAud(it);
    r.append(MediaUI.side(pic, line, hide));
    return r;
  }

  function head(c, k) {
    const top = el('div', 'cs-cattop');
    const name = el('input', 'cs-in cs-name');
    name.type = 'text';
    name.maxLength = NAME_LEN;
    name.placeholder = `Название категории ${k + 1}`;
    name.value = c.name;
    name.setAttribute('aria-label', `Название категории ${k + 1}`);
    name.oninput = () => {
      c.name = name.value;
      touched();
      // Названия в списках переноса карточек обновляются сразу
      listBox.querySelectorAll(`.cs-move option[value="${c.id}"]`).forEach(o => { o.textContent = clean(c.name) || `Категория ${k + 1}`; });
    };
    const tools = el('span', 'cs-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'cs-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, категория ${k + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const full = d.cats.length >= MAX_CATS || total(d) + c.items.filter(filled).length > MAX_ITEMS;
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => move(k, 1), k === d.cats.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(k), full),
    );
    if (delAsk === c.id) {
      const n = c.items.filter(filled).length;
      const q = el('span', 'cs-ask');
      q.append(el('span', 'cs-muted', n ? `Удалить вместе с карточками (${n})?` : 'Удалить?'));
      const yes = el('button', 'cs-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const x = b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить категорию', () => { if (clean(c.name) || c.items.some(filled)) { delAsk = c.id; drawList(); } else remove(k); }, d.cats.length <= MIN_CATS);
      x.classList.add('cs-del');
      tools.append(x);
    }
    top.append(name, tools);
    return top;
  }

  function addCat() {
    if (d.cats.length >= MAX_CATS) return say(`Категорий не больше ${MAX_CATS}.`);
    d.cats.push({ id: newCatId(), name: '', items: [newItem(newItemId())] });
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = last.querySelector('.cs-name'); if (inp) inp.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.cats.length) return;
    [d.cats[k], d.cats[j]] = [d.cats[j], d.cats[k]];
    save();
    drawList();
  }
  // Копия получает новые ID категории и карточек: она не связана с оригиналом. Одинаковые карточки в двух категориях
  // подсвечиваются красным — автор поменяет их в копии
  function duplicate(k) {
    if (d.cats.length >= MAX_CATS) return say(`Категорий не больше ${MAX_CATS}.`);
    const copy = JSON.parse(JSON.stringify(d.cats[k]));
    copy.id = newCatId();
    copy.name = clean(copy.name) ? clean(copy.name) + ' (копия)' : '';
    const ids = allItemIds();
    copy.items.forEach(i => { i.id = nextId('i', ids); ids.push(i.id); });
    d.cats.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    if (d.cats.length <= MIN_CATS) return;
    d.cats.splice(k, 1);
    delAsk = null;
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // categories — в порядке показа; items — с ID своей правильной категории, пустые в файл не попадают.
  // showAnswers — только если включено, view — только если не «колонками»; text, image, audio — только если есть;
  // imageSize — только если в упражнении есть картинка
  function exportData(draft) {
    const anyPic = draft.cats.some(c => c.items.some(i => filled(i) && imageOut(i.image)));
    return {
      module: 'categories', format: 1,
      ...(draft.showAnswers === true ? { showAnswers: true } : {}),
      ...(draft.view === 'stacked' ? { view: 'stacked' } : {}),
      ...(anyPic ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm' } : {}),
      categories: draft.cats.map(c => ({ id: c.id, name: clean(c.name) })),
      items: draft.cats.flatMap(c => c.items.filter(filled).map(i => ({
        id: i.id, categoryId: c.id,
        ...(clean(i.text) ? { text: clean(i.text) } : {}),
        ...(clean(i.text) && hidden(i) ? { hideText: true } : {}),
        ...(imageOut(i.image) ? { image: imageOut(i.image) } : {}),
        ...(audioOut(i.audio) ? { audio: audioOut(i.audio) } : {}),
      }))),
    };
  }

  // Балл — за каждую верно разложенную карточку
  const unitCount = draft => total(draft);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const nm = (c, k) => clean(c.name) ? `«${clean(c.name)}»` : String(k + 1);
    if (draft.cats.length < MIN_CATS) errors.push(`Нужно хотя бы ${MIN_CATS} категории.`);
    if (draft.cats.length > MAX_CATS) errors.push(`Категорий больше ${MAX_CATS}.`);
    const names = new Set();
    draft.cats.forEach((c, k) => {
      if (!clean(c.name)) errors.push(`Категория ${k + 1}: напишите название.`);
      else if (names.has(key(c.name))) errors.push(`Название категории «${clean(c.name)}» повторяется: у категорий должны быть разные названия.`);
      names.add(key(c.name));
      if (!c.items.some(filled)) errors.push(`Категория ${nm(c, k)}: нужна хотя бы одна карточка.`);
    });
    const n = total(draft);
    if (n < MIN_ITEMS) errors.push(`Нужно хотя бы ${MIN_ITEMS} карточки на всё упражнение.`);
    if (n > MAX_ITEMS) errors.push(`Карточек больше ${MAX_ITEMS}.`);
    // Ссылка на картинку — только полный адрес https://
    draft.cats.forEach((c, k) => c.items.forEach((i, j) => {
      const im = i.image;
      if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) errors.push(`Категория ${nm(c, k)}, карточка ${j + 1}: ссылка на картинку должна быть полным адресом с https://.`);
      // «Спрятать текст» без картинки и звука: ученику нечего показать (в редакторе галочка снимается сама, это — для старых файлов)
      if (i.hideText === true && filled(i) && !hidden(i)) errors.push(`Категория ${nm(c, k)}, карточка ${j + 1}: текст спрятан, но нет ни картинки, ни звука — ученик ничего не увидит.`);
    }));
    // Одинаковые карточки (видимый текст и картинка, у карточки «только звук» — звуковой файл): в разных категориях
    // ученик не сможет их различить (ошибка); в одной — только предупреждение. Та же картинка с разными подписями — разные карточки
    const where = new Map();
    draft.cats.forEach((c, k) => c.items.filter(filled).forEach(i => {
      const t = faceKey(i);
      if (!where.has(t)) where.set(t, { name: label(i), cats: [] });
      where.get(t).cats.push(nm(c, k));
    }));
    where.forEach(w => {
      const cats = [...new Set(w.cats)];
      if (cats.length > 1) errors.push(`Карточка ${w.name} есть в категориях ${cats.slice(0, -1).join(', ')} и ${cats[cats.length - 1]}: ученик не поймёт, куда её класть. Оставьте её в одной категории или измените текст, картинку или звук.`);
      else if (w.cats.length > 1) warnings.push(`Карточка ${w.name} повторяется в категории ${cats[0]}: ученик получит её ${w.cats.length} раза.`);
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию.
  // Карточка с неизвестной категорией попадает в первую; у категории без карточек — одно пустое поле
  function load(file) {
    if (!Array.isArray(file.categories) || !file.categories.length) throw new Error('В файле нет категорий.');
    const catIds = new Set(), used = new Set();
    const cats = file.categories.slice(0, MAX_CATS).map(c => {
      let id = String((c && c.id) || '');
      if (!id || catIds.has(id)) id = nextId('c', [...catIds]);
      catIds.add(id);
      return { id, name: String((c && c.name) || '').slice(0, NAME_LEN), items: [], src: c && c.id };
    });
    (Array.isArray(file.items) ? file.items : []).slice(0, MAX_ITEMS).forEach(i => {
      let id = String((i && i.id) || '');
      if (!id || used.has(id)) id = nextId('i', [...used]);
      used.add(id);
      const c = cats.find(x => x.src === (i && i.categoryId)) || cats[0];
      const im = i && i.image;
      c.items.push({ id, text: String((i && i.text) || '').slice(0, MAX_LEN),
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (i && i.audio && safeMediaPath(i.audio.media)) || '', hideText: !!(i && i.hideText === true) });
    });
    while (cats.length < MIN_CATS) { const id = nextId('c', [...catIds]); catIds.add(id); cats.push({ id, name: '', items: [] }); }
    cats.forEach(c => { delete c.src; if (!c.items.length) { const id = nextId('i', [...used]); used.add(id); c.items.push(newItem(id)); } });
    return { ...create(), showAnswers: file.showAnswers === true, view: VIEWS[file.view] ? file.view : 'columns', imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', cats };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): размер картинок — только если в упражнении есть картинки; вид категорий
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const size = draft.cats.some(c => c.items.some(i => hasPic(i.image)))
      ? [{ field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } }] : [];
    return [...size, { field: 'view', label: 'Категории', value: VIEWS[draft.view] ? draft.view : 'columns', names: VIEWS,
      icons: { columns: sq('<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'), stacked: sq('<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/>') } }];
  }

  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers === true,
      help: 'После последней проверки неверно разложенные карточки красные, верные — зелёные. Если включено, у каждой неверной карточки ещё подписано, в какую категорию её нужно было положить. На промежуточных проверках правильная категория не показывается никогда. По умолчанию выключено.' }];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions, behaviorOptions };
})();
