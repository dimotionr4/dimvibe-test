// Редактор модуля Text to Image: набор карточек «картинка + верное слово». Ученик подписывает каждую картинку словом:
// берёт слово из банка (нажатием или перетаскиванием), выбирает из списка или вводит с клавиатуры — способ ответа один на всё упражнение, его выбирает автор.
// У карточки устойчивый ID (i1, i2…). Лишние слова (ловушки) попадают в банк и в список, но не оцениваются.
// Этап 1 (решение владельца 2026-10-26): только картинки и слова, без звука и подсказок.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const TextToImageEditor = (() => {
  const MIN_ITEMS = 2, MAX_ITEMS = 12, MAX_DIST = 10, MAX_LEN = 60, MAX_ALTS = 5; // карточек, лишних слов, символов в слове, других верных ответов
  const { nextId } = GapEngine;
  let d, root, save, msg, counter, listBox, addBtn, msgTimer;

  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const MODES = [
    ['word_bank', 'Банк слов', '<rect x="2" y="5" width="9" height="5" rx="2.5"/><rect x="13" y="5" width="9" height="5" rx="2.5"/><rect x="6" y="14" width="12" height="5" rx="2.5"/>'],
    ['dropdown', 'Выпадающий список', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 11l3 3 3-3"/>'],
    ['typing', 'Ввод вручную', '<rect x="2" y="7" width="20" height="11" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10"/>'],
  ];
  const modeOk = m => MODES.some(x => x[0] === m);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="ti-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const key = s => clean(s).normalize('NFC').toLowerCase().replace(/[.,?!]+$/, ''); // как norm() плеера: без регистра, пробелов и точки в конце
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const picKey = im => (hasPic(im) ? (safeMediaPath(im.media) || safeImageUrl(im.url)) : '');
  const filled = it => !!clean(it.answer) || hasPic(it.image) || !!clean(it.alts);
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, ...(alt ? { alt } : {}) };
    const url = safeImageUrl(im.url);
    return url ? { url, ...(alt ? { alt } : {}) } : null;
  };
  // Другие верные ответы: через запятую, без повторов и без самого ответа
  const altsOf = it => {
    const seen = new Set([key(it.answer)]);
    return String(it.alts || '').split(/[,;\n]/).map(clean).filter(s => { const k = key(s); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_ALTS);
  };
  const distOf = draft => (draft.distractors || []).map(clean).filter(Boolean);
  const total = draft => draft.items.filter(filled).length;
  const allIds = () => d.items.map(i => i.id);
  const newItem = id => ({ id, answer: '', alts: '', image: emptyImage() });

  function create() {
    // design.gap — окошко под картинкой по умолчанию рамкой (как на образце владельца 2026-10-26); форму можно сменить во вкладке «Дизайн»
    return { module: 'text_to_image', format: 1, mode: 'word_bank', imageSize: 'm', imageFit: 'contain', showAnswers: false,
      items: [newItem('i1'), newItem('i2')], distractors: [], design: { gap: { shape: 'frame' } } };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): пять картинок из общей медиатеки, другой верный ответ и лишние слова
  function demo() {
    const I = DimDemo.IMG;
    const it = (id, answer, media, alts) => ({ ...newItem(id), answer, alts: alts || '', image: { ...emptyImage(), media } });
    return { ...create(), instruction: DimDemo.instruction('Подпишите каждую картинку словом.'), showAnswers: true,
      items: [it('i1', 'one', I.one), it('i2', 'two', I.two), it('i3', 'four', I.four), it('i4', 'house', I.house, 'home'), it('i5', 'question mark', I.question)],
      distractors: ['three', 'tree'] };
  }

  // Черновики с неполными полями получают значения по умолчанию
  function normalize() {
    if (!modeOk(d.mode)) d.mode = 'word_bank';
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    if (!FITS[d.imageFit]) d.imageFit = 'contain';
    d.showAnswers = d.showAnswers === true;
    if (!Array.isArray(d.items) || !d.items.length) d.items = [newItem('i1'), newItem('i2')];
    d.items.forEach(i => { if (!i.image) i.image = emptyImage(); if (typeof i.alts !== 'string') i.alts = ''; if (typeof i.answer !== 'string') i.answer = ''; });
    if (!Array.isArray(d.distractors)) d.distractors = [];
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
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
    root.className = 'ti-wrap';
    const tools = el('div', 'ti-tools');
    const modes = el('span', 'ti-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Способ ответа');
    MODES.forEach(([v, label, icon]) => {
      const b = el('button', d.mode === v ? 'active' : '');
      b.type = 'button';
      b.innerHTML = svg(icon);
      b.title = 'Способ ответа: ' + label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(d.mode === v));
      b.onclick = () => {
        d.mode = v;
        save();
        modes.querySelectorAll('button').forEach((x, i) => { x.classList.toggle('active', MODES[i][0] === v); x.setAttribute('aria-pressed', String(MODES[i][0] === v)); });
        sync();
      };
      modes.append(b);
    });
    counter = el('span', 'ti-muted');
    const right = el('span', 'ti-right');
    right.append(help(`Добавьте картинки и впишите к каждой верное слово. Способ ответа (значки вверху) один на всё упражнение: банк слов (ученик нажимает слово, потом пустое окошко под картинкой, или перетаскивает), выпадающий список или ввод с клавиатуры. «Другие верные ответы» — через запятую (например, color, colour): они тоже засчитываются. Лишние слова попадают в банк и в список, но не оцениваются. Если у двух картинок одно слово, подойдёт любая из них. Балл — за каждую верно подписанную картинку. Карточек от ${MIN_ITEMS} до ${MAX_ITEMS}, лишних слов до ${MAX_DIST}.`));
    tools.append(modes, counter, right);
    msg = el('div', 'ti-msg');
    msg.hidden = true;
    listBox = el('ul', 'ti-list');
    addBtn = el('button', 'ti-add', '+ Карточка');
    addBtn.type = 'button';
    addBtn.onclick = add;
    const dist = el('section', 'ti-sec');
    dist.append(el('h3', 'ti-h', 'Лишние слова (необязательно)'));
    const ta = el('textarea', 'ti-in ti-dist');
    ta.rows = 2;
    ta.placeholder = 'По одному в строке. Они попадут в банк или список, но не подходят ни к одной картинке.';
    ta.value = d.distractors.join('\n');
    ta.setAttribute('aria-label', 'Лишние слова');
    ta.oninput = () => { d.distractors = ta.value.split('\n'); save(); sync(); };
    dist.append(ta);
    root.append(tools, msg, listBox, addBtn, dist);
    drawList();
  }

  // Счётчик и подсветка повторов: одинаковые слова у разных карточек взаимозаменяемы — только предупреждение
  function sync() {
    counter.textContent = `Карточек: ${total(d)}/${MAX_ITEMS}`;
    addBtn.disabled = d.items.length >= MAX_ITEMS;
    const count = {};
    d.items.forEach(i => { const k = key(i.answer); if (k) count[k] = (count[k] || 0) + 1; });
    listBox.querySelectorAll('.ti-row').forEach(r => {
      const i = d.items.find(x => x.id === r.dataset.id);
      r.classList.toggle('same', !!i && !!key(i.answer) && count[key(i.answer)] > 1);
    });
  }
  const touched = () => { save(); sync(); };

  function drawList() {
    listBox.innerHTML = '';
    d.items.forEach((it, k) => listBox.append(row(it, k)));
    sync();
  }

  function row(it, k) {
    const r = el('li', 'ti-row');
    r.dataset.id = it.id;
    r.append(el('span', 'ti-no', String(k + 1)));
    const pic = el('div', 'ti-pic');
    pic.append(MediaUI.imageControl(it.image, { save, change: sync }));
    const fields = el('div', 'ti-fields');
    const ans = el('input', 'ti-in ti-answer');
    ans.type = 'text';
    ans.maxLength = MAX_LEN;
    ans.placeholder = 'Верное слово';
    ans.value = it.answer;
    ans.setAttribute('aria-label', `Верное слово, карточка ${k + 1}`);
    ans.oninput = () => { it.answer = ans.value; touched(); };
    const alts = el('input', 'ti-in ti-alts');
    alts.type = 'text';
    alts.maxLength = MAX_LEN * 3;
    alts.placeholder = 'Другие верные ответы через запятую (необязательно)';
    alts.value = it.alts;
    alts.setAttribute('aria-label', `Другие верные ответы, карточка ${k + 1}`);
    alts.oninput = () => { it.alts = alts.value; touched(); };
    fields.append(ans, alts);
    const tools = el('span', 'ti-tools2');
    const b = (inner, tip, fn, disabled) => { const x = el('button', 'ti-ib'); x.type = 'button'; x.innerHTML = svg(inner); x.title = tip; x.setAttribute('aria-label', `${tip}, карточка ${k + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const del = b('<path d="M6 6l12 12M18 6L6 18"/>', 'Удалить', () => remove(k), d.items.length <= 1);
    del.classList.add('ti-del');
    tools.append(b('<path d="M6 15l6-6 6 6"/>', 'Выше', () => move(k, -1), k === 0), b('<path d="M6 9l6 6 6-6"/>', 'Ниже', () => move(k, 1), k === d.items.length - 1), del);
    r.append(pic, fields, tools);
    return r;
  }

  function add() {
    if (d.items.length >= MAX_ITEMS) return say(`Карточек не больше ${MAX_ITEMS}.`);
    d.items.push(newItem(nextId('i', allIds())));
    save();
    drawList();
    const ins = listBox.querySelectorAll('.ti-answer');
    if (ins.length) { ins[ins.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' }); ins[ins.length - 1].focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.items.length) return;
    [d.items[k], d.items[j]] = [d.items[j], d.items[k]];
    save();
    drawList();
  }
  function remove(k) {
    if (d.items.length <= 1) return;
    d.items.splice(k, 1);
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // items — в порядке показа; пустые карточки в файл не попадают. alternatives и distractors — только если есть,
  // showAnswers — только если включено
  function exportData(draft) {
    const dist = [], seen = new Set(draft.items.filter(filled).map(i => key(i.answer)));
    distOf(draft).forEach(s => { const k = key(s); if (!seen.has(k)) { seen.add(k); dist.push(s); } });
    return {
      module: 'text_to_image', format: 1,
      mode: modeOk(draft.mode) ? draft.mode : 'word_bank',
      imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm',
      imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain',
      ...(draft.showAnswers === true ? { showAnswers: true } : {}),
      items: draft.items.filter(filled).map(i => ({
        id: i.id, answer: clean(i.answer),
        ...(altsOf(i).length ? { alternatives: altsOf(i) } : {}),
        ...(imageOut(i.image) ? { image: imageOut(i.image) } : {}),
      })),
      ...(dist.length ? { distractors: dist } : {}),
    };
  }

  // Балл — за каждую карточку (общее число проверок: 3 при 1–5 карточках, 5 при 6 и больше)
  const unitCount = draft => total(draft);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const list = draft.items.filter(filled);
    if (list.length < MIN_ITEMS) errors.push(`Нужно хотя бы ${MIN_ITEMS} карточки.`);
    if (list.length > MAX_ITEMS) errors.push(`Карточек больше ${MAX_ITEMS}.`);
    draft.items.forEach((i, k) => {
      if (!filled(i)) return;
      const n = k + 1, im = i.image;
      if (!clean(i.answer)) errors.push(`Карточка ${n}: впишите верное слово.`);
      if (!hasPic(im)) {
        if (im && !safeMediaPath(im.media) && clean(im.url)) errors.push(`Карточка ${n}: ссылка на картинку должна быть полным адресом с https://.`);
        else errors.push(`Карточка ${n}: добавьте картинку.`);
      }
    });
    if (distOf(draft).length > MAX_DIST) errors.push(`Лишних слов больше ${MAX_DIST}.`);
    // Повторы: одинаковое слово у двух карточек — любая подойдёт; одна картинка дважды — скорее всего ошибка
    const words = new Map(), pics = new Map();
    draft.items.forEach((i, k) => {
      if (!filled(i)) return;
      const w = key(i.answer), p = picKey(i.image);
      if (w) words.set(w, [...(words.get(w) || []), k + 1]);
      if (p) pics.set(p, [...(pics.get(p) || []), k + 1]);
    });
    words.forEach((ns, w) => { if (ns.length > 1) warnings.push(`Слово «${clean(draft.items[ns[0] - 1].answer)}» у карточек ${ns.join(', ')}: они взаимозаменяемы, подойдёт любое окошко с этим словом.`); });
    pics.forEach(ns => { if (ns.length > 1) warnings.push(`Одна и та же картинка у карточек ${ns.join(', ')}.`); });
    // Другой верный ответ карточки совпадает со словом другой карточки: ответ получится двусмысленным
    draft.items.forEach((i, k) => {
      if (!filled(i)) return;
      altsOf(i).forEach(a => {
        const other = draft.items.findIndex((x, j) => j !== k && filled(x) && key(x.answer) === key(a));
        if (other >= 0) warnings.push(`Карточка ${k + 1}: другой верный ответ «${a}» совпадает со словом карточки ${other + 1}.`);
      });
    });
    const have = new Set(list.flatMap(i => [key(i.answer), ...altsOf(i).map(key)]));
    distOf(draft).forEach(s => { if (have.has(key(s))) warnings.push(`Лишнее слово «${s}» совпадает с верным ответом: оно не добавится в банк.`); });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию, пустой файл не открывается
  function load(file) {
    if (!Array.isArray(file.items) || !file.items.length) throw new Error('В файле нет карточек.');
    const used = new Set();
    const items = file.items.slice(0, MAX_ITEMS).map(i => {
      let id = String((i && i.id) || '');
      if (!id || used.has(id)) id = nextId('i', [...used]);
      used.add(id);
      const im = i && i.image;
      return { id, answer: String((i && i.answer) || '').slice(0, MAX_LEN),
        alts: Array.isArray(i && i.alternatives) ? i.alternatives.map(s => String(s || '')).join(', ') : '',
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') } };
    });
    return { ...create(), mode: modeOk(file.mode) ? file.mode : 'word_bank',
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain',
      showAnswers: file.showAnswers === true, items,
      distractors: (Array.isArray(file.distractors) ? file.distractors : []).map(s => String(s || '').slice(0, MAX_LEN)).slice(0, MAX_DIST) };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): размер картинки и как она ложится в рамку
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'imageSize', label: 'Размер картинки', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }

  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers === true,
      help: 'После конца упражнения под неверно подписанной картинкой появится верное слово. На промежуточных проверках верное слово не показывается никогда. По умолчанию выключено.' }];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions, behaviorOptions };
})();
