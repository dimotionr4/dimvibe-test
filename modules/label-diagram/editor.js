// Редактор модуля Label the Diagram (подписать схему). Этап 1 (решение владельца 2026-10-26, «все рекомендации»):
// одна картинка, на ней точки с подписями; ученик ставит подписи из банка к точкам (нажать подпись, потом ячейку — или перетащить).
// Точка и её ячейка хранятся в долях картинки 0–1 (x, y — сама точка; sx, sy — центр ячейки, от точки к ячейке идёт линия),
// у точки устойчивый ID (p1…). Лишние подписи (отвлекающие) — отдельный список. Ядро (editor.html) передаёт сюда черновик и функцию сохранения.
const LabelDiagramEditor = (() => {
  const MAX_POINTS = 20, MAX_DIST = 10, LABEL_LEN = 60;
  const { nextId } = GapEngine;
  let d, root, save, msgTimer = null;
  let msg, counter, canvasBox, listBox;
  let selId = null; // выбранная точка
  let cv = null, ov = null, drag = null, justDragged = false;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="ld-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = v => Math.round(v * 10000) / 10000;
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const imageOut = im => {
    if (!im) return null;
    const media = safeMediaPath(im.media);
    if (media) return { media };
    const url = safeImageUrl(im.url);
    return url ? { url } : null;
  };
  // Настройки «Дизайна» (этап 2, решения владельца 2026-10-26): вид подписей, форма ячеек, размер точки, толщина линии, «Правильно: …» в конце
  const VIEWS = { cells: 'Ячейки на картинке', numbers: 'Номера' }, SHAPES = { rect: 'Прямоугольные', round: 'Скруглённые' };
  const DASHES = { solid: 'Сплошная', dashed: 'Пунктирная' };
  const DOTS = { s: 'Маленькая', m: 'Средняя', l: 'Крупная' }, LINES = { thin: 'Тонкая', normal: 'Обычная', thick: 'Толстая' }, REVEALS = { on: 'Показывать', off: 'Не показывать' };
  const pick = (map, v, dflt) => (map[v] ? v : dflt);
  const pointById = id => d.points.find(p => p.id === id);
  const distractorsOf = draft => (draft.distractors || []).map(clean).filter(Boolean).slice(0, MAX_DIST);
  // Ячейка по умолчанию — над точкой (у верхнего края — под ней)
  const slotFor = (x, y) => ({ sx: round(clamp(x, 0.08, 0.92)), sy: round(clamp(y > 0.22 ? y - 0.12 : y + 0.12, 0.06, 0.94)) });

  function create() {
    return { module: 'label_diagram', format: 1, view: 'cells', shape: 'rect', dot: 'm', line: 'normal', dash: 'solid', reveal: 'on', image: emptyImage(), points: [], distractors: [] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): дом на фото, пять точек с подписями, две лишние подписи
  function demo() {
    const pt = (id, label, x, y, sx, sy) => ({ id, label, x, y, sx, sy });
    return { ...create(), image: DimDemo.img('house'), instruction: DimDemo.instruction('Подпишите комнаты дома.'),
      points: [pt('p1', 'Bedroom', 0.3, 0.285, 0.1, 0.12), pt('p2', 'Kitchen', 0.605, 0.385, 0.86, 0.62), pt('p3', 'Living room', 0.31, 0.53, 0.12, 0.8), pt('p4', 'Round room', 0.82, 0.245, 0.86, 0.1), pt('p5', 'Hall', 0.6, 0.19, 0.55, 0.05)],
      distractors: ['Garage', 'Bathroom'] };
  }

  function normalize() {
    d.view = pick(VIEWS, d.view, 'cells');
    d.shape = pick(SHAPES, d.shape, 'rect');
    d.dot = pick(DOTS, d.dot, 'm');
    d.line = pick(LINES, d.line, 'normal');
    d.dash = pick(DASHES, d.dash, 'solid');
    d.reveal = pick(REVEALS, d.reveal, 'on');
    if (!d.image) d.image = emptyImage();
    if (!Array.isArray(d.points)) d.points = [];
    if (!Array.isArray(d.distractors)) d.distractors = [];
    if (selId && !pointById(selId)) selId = null;
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    selId = null;
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
    root.className = 'ld-wrap';
    const tools = el('div', 'ld-tools');
    counter = el('span', 'ld-muted');
    const right = el('span', 'ld-right');
    right.append(help(`Загрузите картинку и нажимайте на ней, чтобы поставить точки: каждая точка — то, что надо подписать. От точки идёт линия к ячейке — туда ученик положит подпись; точку и ячейку можно перетаскивать. Впишите верную подпись для каждой точки. Ученик видит подписи в банке под картинкой в случайном порядке: нажимает подпись, потом ячейку — или перетаскивает. Одинаковые подписи у разных точек взаимозаменяемы. Лишние подписи попадают в банк, но не оцениваются. За каждую верно подписанную точку — 1 балл. Точек до ${MAX_POINTS}, лишних подписей до ${MAX_DIST}.`));
    tools.append(counter, right);
    msg = el('div', 'ld-msg');
    msg.hidden = true;
    const pts = el('section', 'ld-sec');
    pts.append(toolbar());
    canvasBox = el('div', 'ld-canvasbox');
    listBox = el('div', 'ld-list');
    // Картинка слева, подписи точек — в панели справа (на узкой колонке панель уходит под картинку)
    const split = el('div', 'ld-split');
    split.append(canvasBox, listBox);
    pts.append(split);
    const dist = el('section', 'ld-sec');
    dist.append(el('h3', 'ld-h', 'Лишние подписи (необязательно)'));
    const ta = el('textarea', 'ld-in ld-dist');
    ta.rows = 2;
    ta.placeholder = 'По одной в строке. Они попадут в банк, но не подходят ни к одной точке.';
    ta.value = d.distractors.join('\n');
    ta.setAttribute('aria-label', 'Лишние подписи');
    ta.oninput = () => { d.distractors = ta.value.split('\n'); save(); };
    dist.append(ta);
    root.append(tools, msg, pts, dist);
    drawCanvas();
    drawList();
  }

  // Панель над картинкой (как в Hotspot): слева картинка (два значка и маленькая миниатюра с ×), справа значок ученика и вид подписей
  // («Ячейки на картинке» / «Номера» — та же настройка, что во вкладке «Дизайн»); под панелью одна строка-подсказка
  const VIEW_ICONS = {
    cells: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="15" r="1.5"/><path d="M9 14l5-6"/><rect x="13" y="5" width="6" height="3" rx="1"/>',
    numbers: '<rect x="3" y="3" width="18" height="11" rx="2"/><path d="M8 8.5h.01M16 8.5h.01M4 18h16M4 21h16"/>',
  };
  let barBox, hintLine;
  function toolbar() {
    const wrap = el('div', 'ld-topwrap');
    barBox = el('div', 'ld-top');
    const left = el('div', 'ld-grp');
    const pic = el('div', 'ld-picbox');
    pic.append(MediaUI.imageControl(d.image, { save: () => { save(); }, change: () => { drawCanvas(); refreshBar(); } }));
    left.append(pic);
    const right = el('div', 'ld-grp');
    const who = el('span', 'ld-who');
    who.innerHTML = svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>');
    who.title = 'Как ученик видит подписи';
    right.append(who);
    const row = el('span', 'ld-modes');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Вид подписей');
    Object.keys(VIEWS).forEach(k => {
      const b = el('button', 'ld-tbtn');
      b.type = 'button';
      b.innerHTML = svg(VIEW_ICONS[k]);
      b.title = k === 'cells' ? 'Ячейки на картинке: у каждой точки ячейка для подписи, соединённая линией.' : 'Номера: на картинке точки с номерами, ячейки — списком под картинкой.';
      b.dataset.view = k;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', VIEWS[k]);
      b.onclick = () => { d.view = k; save(); refreshBar(); drawCanvas(); };
      row.append(b);
    });
    right.append(row);
    barBox.append(left, right);
    hintLine = el('p', 'ld-muted ld-status');
    wrap.append(barBox, hintLine);
    return wrap;
  }
  function refreshBar() {
    if (!barBox) return;
    barBox.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === d.view; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    const nums = d.view === 'numbers';
    hintLine.textContent = !hasPic(d.image) ? 'Сначала загрузите картинку (значки слева): точки ставят прямо на ней.'
      : nums ? 'Нажмите на картинку, чтобы поставить точку; точку можно перетаскивать. Ячейки ученик увидит списком под картинкой. Удалить точку — × на точке или в списке.'
      : 'Нажмите на картинку, чтобы поставить точку. Круг — точка, прямоугольник — ячейка для подписи: оба можно перетаскивать. Удалить точку — × на ярлыке или в списке.';
  }

  function updateCounter() {
    counter.textContent = `Точек: ${d.points.length}/${MAX_POINTS}`;
  }

  // ---- Холст ----
  function drawCanvas() {
    canvasBox.innerHTML = '';
    refreshBar();
    if (!hasPic(d.image)) {
      canvasBox.append(el('div', 'ld-empty', 'Здесь появится картинка.'));
      cv = ov = null;
      return;
    }
    cv = el('div', 'ld-cv');
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.onerror = () => { cv.classList.add('broken'); };
    img.src = mediaSrc(safeMediaPath(d.image.media) ? { media: d.image.media } : { url: d.image.url }) || '';
    ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ov.setAttribute('class', 'ld-ov');
    ov.setAttribute('viewBox', '0 0 1 1');
    ov.setAttribute('preserveAspectRatio', 'none');
    cv.append(img, ov);
    canvasBox.append(cv);
    cv.onpointerdown = down;
    cv.onpointermove = move;
    cv.onpointerup = cv.onpointercancel = up;
    cv.onclick = addByClick;
    paint();
  }

  // Крестик «удалить точку» на ярлыке (ячейке; в виде «Номера» — на выбранной точке)
  function cross(k) {
    const x = el('span', 'ld-x', '×');
    x.dataset.del = k;
    x.title = 'Удалить точку';
    return x;
  }
  function removePoint(k) {
    const p = d.points[k];
    if (!p) return;
    d.points.splice(k, 1);
    if (selId === p.id) selId = null;
    save();
    paint();
    drawList();
  }

  function paint() {
    if (!ov) return;
    ov.innerHTML = '';
    cv.querySelectorAll('.ld-dot, .ld-slot').forEach(n => n.remove());
    const nums = d.view === 'numbers'; // «Номера»: ни ячеек, ни линий — точки с номерами
    d.points.forEach((p, k) => {
      const on = p.id === selId;
      const dot = el('span', 'ld-dot' + (on ? ' sel' : '') + (nums ? ' num' : ''), nums ? String(k + 1) : null);
      dot.dataset.i = k;
      dot.dataset.kind = 'a';
      dot.style.left = p.x * 100 + '%';
      dot.style.top = p.y * 100 + '%';
      if (nums) { if (on) dot.append(cross(k)); cv.append(dot); return; }
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p.x);
      line.setAttribute('y1', p.y);
      line.setAttribute('x2', p.sx);
      line.setAttribute('y2', p.sy);
      line.setAttribute('class', 'ld-line' + (on ? ' sel' : '') + (d.dash === 'dashed' ? ' dashed' : ''));
      ov.append(line);
      const slot = el('span', 'ld-slot' + (on ? ' sel' : ''), `${k + 1}${clean(p.label) ? ' · ' + clean(p.label) : ''}`);
      slot.dataset.i = k;
      slot.dataset.kind = 's';
      slot.append(cross(k));
      slot.style.left = p.sx * 100 + '%';
      slot.style.top = p.sy * 100 + '%';
      cv.append(dot, slot);
    });
  }

  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }

  function down(e) {
    if (e.button > 0 || !cv) return;
    const t = e.target.dataset;
    if (t && t.del !== undefined) { e.preventDefault(); justDragged = true; setTimeout(() => { justDragged = false; }, 0); removePoint(+t.del); return; }
    if (!t || t.i === undefined) return;
    const p = d.points[+t.i];
    if (!p) return;
    drag = { p, kind: t.kind, moved: false };
    if (selId !== p.id) { selId = p.id; paint(); drawList(); }
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function move(e) {
    if (!drag) return;
    const q = pt(e);
    if (drag.kind === 'a') { drag.p.x = round(q.x); drag.p.y = round(q.y); } else { drag.p.sx = round(clamp(q.x, 0.06, 0.94)); drag.p.sy = round(clamp(q.y, 0.04, 0.96)); }
    drag.moved = true;
    paint();
  }
  function up() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 0); save(); }
  }

  function addByClick(e) {
    if (justDragged || !cv || (e.target.dataset && (e.target.dataset.i !== undefined || e.target.dataset.del !== undefined))) return;
    if (d.points.length >= MAX_POINTS) return say(`Точек не больше ${MAX_POINTS}.`);
    const q = pt(e), x = round(q.x), y = round(q.y);
    const p = { id: nextId('p', d.points.map(z => z.id)), label: '', x, y, ...slotFor(x, y) };
    d.points.push(p);
    selId = p.id;
    save();
    paint();
    drawList();
    const inp = listBox.querySelector('.ld-row.sel .ld-label');
    if (inp) inp.focus({ preventScroll: true });
  }

  // ---- Список точек ----
  function drawList() {
    listBox.innerHTML = '';
    d.points.forEach((p, k) => {
      const r = el('div', 'ld-row' + (p.id === selId ? ' sel' : ''));
      const n = el('button', 'ld-n', String(k + 1));
      n.type = 'button';
      n.title = 'Выбрать точку';
      n.setAttribute('aria-label', `Выбрать точку ${k + 1}`);
      n.onclick = () => { selId = p.id; paint(); drawList(); };
      const inp = el('input', 'ld-in ld-label');
      inp.type = 'text';
      inp.maxLength = LABEL_LEN;
      inp.placeholder = 'Подпись';
      inp.title = 'Верная подпись точки, например «Корень»';
      inp.value = p.label;
      inp.setAttribute('aria-label', `Подпись точки ${k + 1}`);
      inp.oninput = () => { p.label = inp.value; save(); paint(); };
      inp.onfocus = () => { if (selId !== p.id) { selId = p.id; paint(); listBox.querySelectorAll('.ld-row').forEach(x => x.classList.toggle('sel', x === r)); } };
      const del = el('button', 'ld-ib ld-del');
      del.type = 'button';
      del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
      del.title = 'Удалить точку';
      del.setAttribute('aria-label', `Удалить точку ${k + 1}`);
      del.onclick = () => removePoint(k);
      r.append(n, inp, del);
      listBox.append(r);
    });
    if (!d.points.length) listBox.append(el('p', 'ld-muted', 'Точек пока нет.'));
    updateCounter();
  }

  // ---- Файл упражнения ----
  // Числа округлены до 4 знаков; пустые подписи и пустые точки в файл не попадают; лишние подписи — без повторов
  function exportData(draft) {
    const points = draft.points.filter(p => clean(p.label)).map(p => ({ id: p.id, label: clean(p.label), x: round(p.x), y: round(p.y), sx: round(p.sx), sy: round(p.sy) }));
    const seen = new Set(), dist = distractorsOf(draft).filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    return {
      module: 'label_diagram', format: 1,
      ...(draft.view === 'numbers' ? { view: 'numbers' } : {}),
      ...(draft.shape === 'round' ? { shape: 'round' } : {}),
      ...(draft.dot === 's' || draft.dot === 'l' ? { dot: draft.dot } : {}),
      ...(draft.line === 'thin' || draft.line === 'thick' ? { line: draft.line } : {}),
      ...(draft.dash === 'dashed' ? { dash: 'dashed' } : {}),
      ...(draft.reveal === 'off' ? { reveal: false } : {}),
      ...(imageOut(draft.image) ? { image: imageOut(draft.image) } : {}),
      points,
      ...(dist.length ? { distractors: dist } : {}),
    };
  }

  const unitCount = draft => draft.points.filter(p => clean(p.label)).length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const im = draft.image;
    if (!hasPic(im)) {
      if (im && clean(im.url) && !safeMediaPath(im.media)) errors.push('Ссылка на картинку должна быть полным адресом с https://.');
      else errors.push('Нет картинки.');
    }
    if (!draft.points.length) errors.push('Нет ни одной точки на картинке.');
    if (draft.points.length > MAX_POINTS) errors.push(`Точек больше ${MAX_POINTS}.`);
    draft.points.forEach((p, k) => { if (!clean(p.label)) errors.push(`Точка ${k + 1}: нет подписи.`); });
    const byLabel = {};
    draft.points.forEach((p, k) => { const l = clean(p.label).toLowerCase(); if (l) (byLabel[l] = byLabel[l] || []).push(k + 1); });
    Object.values(byLabel).forEach(ks => { if (ks.length > 1) warnings.push(`Подписи точек ${ks.join(' и ')} одинаковы: ученик сможет поставить любую из них в любую из этих точек.`); });
    const dist = distractorsOf(draft);
    if ((draft.distractors || []).map(clean).filter(Boolean).length > MAX_DIST) errors.push(`Лишних подписей больше ${MAX_DIST}.`);
    dist.forEach(s => { if (byLabel[s.toLowerCase()]) warnings.push(`Лишняя подпись «${s}» совпадает с подписью точки и не будет добавлена в банк.`); });
    for (let a = 0; a < draft.points.length; a++) for (let b = a + 1; b < draft.points.length; b++) {
      const p = draft.points[a], q = draft.points[b];
      if (Math.hypot(p.x - q.x, p.y - q.y) < 0.03) warnings.push(`Точки ${a + 1} и ${b + 1} почти совпадают: ученику будет трудно понять, какая к какой ячейке.`);
      if (draft.view !== 'numbers' && Math.hypot(p.sx - q.sx, p.sy - q.sy) < 0.06) warnings.push(`Ячейки точек ${a + 1} и ${b + 1} накладываются друг на друга: раздвиньте их.`);
    }
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию, повтор ID получает новый
  function load(file) {
    if (!Array.isArray(file.points) || !file.points.length) throw new Error('В файле нет точек.');
    const ids = new Set();
    const points = file.points.slice(0, MAX_POINTS).map(p => {
      let id = String((p && p.id) || '');
      if (!id || ids.has(id)) id = nextId('p', [...ids]);
      ids.add(id);
      const x = round(clamp(num(p && p.x), 0, 1)), y = round(clamp(num(p && p.y), 0, 1));
      const hasSlot = p && Number.isFinite(Number(p.sx)) && Number.isFinite(Number(p.sy));
      return { id, label: String((p && p.label) || '').slice(0, LABEL_LEN), x, y, ...(hasSlot ? { sx: round(clamp(num(p.sx), 0.06, 0.94)), sy: round(clamp(num(p.sy), 0.04, 0.96)) } : slotFor(x, y)) };
    });
    const im = file.image;
    return { ...create(), view: file.view === 'numbers' ? 'numbers' : 'cells', shape: file.shape === 'round' ? 'round' : 'rect', dot: pick(DOTS, file.dot, 'm'), line: pick(LINES, file.line, 'normal'), dash: file.dash === 'dashed' ? 'dashed' : 'solid', reveal: file.reveal === false ? 'off' : 'on',
      image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: '' },
      points, distractors: (Array.isArray(file.distractors) ? file.distractors : []).map(s => String(s || '').slice(0, LABEL_LEN)).slice(0, MAX_DIST) };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'view', label: 'Вид подписей', value: pick(VIEWS, draft.view, 'cells'), names: VIEWS,
        icons: { cells: sq('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="15" r="1.5"/><path d="M9 14l5-6"/><rect x="13" y="5" width="6" height="3" rx="1"/>'), numbers: sq('<rect x="3" y="3" width="18" height="11" rx="2"/><path d="M8 8.5h.01M16 8.5h.01M4 18h16M4 21h16"/>') } },
      { field: 'shape', label: 'Форма ячеек', value: pick(SHAPES, draft.shape, 'rect'), names: SHAPES,
        icons: { rect: sq('<rect x="4" y="8" width="16" height="8" rx="1"/>'), round: sq('<rect x="4" y="8" width="16" height="8" rx="4"/>') } },
      { field: 'dot', label: 'Размер точки', value: pick(DOTS, draft.dot, 'm'), names: DOTS,
        icons: { s: sq('<circle cx="12" cy="12" r="2"/>'), m: sq('<circle cx="12" cy="12" r="4"/>'), l: sq('<circle cx="12" cy="12" r="7"/>') } },
      { field: 'line', label: 'Толщина линии к ячейке', value: pick(LINES, draft.line, 'normal'), names: LINES,
        icons: { thin: sq('<path d="M4 18L20 6" stroke-width="1"/>'), normal: sq('<path d="M4 18L20 6" stroke-width="2"/>'), thick: sq('<path d="M4 18L20 6" stroke-width="4"/>') } },
      { field: 'dash', label: 'Вид линии', value: pick(DASHES, draft.dash, 'solid'), names: DASHES,
        icons: { solid: sq('<path d="M4 18L20 6"/>'), dashed: sq('<path d="M4 18L20 6" stroke-dasharray="3 3"/>') } },
      { field: 'reveal', label: 'Верная подпись в конце', value: pick(REVEALS, draft.reveal, 'on'), names: REVEALS,
        icons: { on: sq('<path d="M4 12l5 5 11-11"/>'), off: sq('<path d="M5 5l14 14M19 5L5 19"/>') } },
    ];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions };
})();
