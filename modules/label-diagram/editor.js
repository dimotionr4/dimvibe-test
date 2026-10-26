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
  const pointById = id => d.points.find(p => p.id === id);
  const distractorsOf = draft => (draft.distractors || []).map(clean).filter(Boolean).slice(0, MAX_DIST);
  // Ячейка по умолчанию — над точкой (у верхнего края — под ней)
  const slotFor = (x, y) => ({ sx: round(clamp(x, 0.08, 0.92)), sy: round(clamp(y > 0.22 ? y - 0.12 : y + 0.12, 0.06, 0.94)) });

  function create() {
    return { module: 'label_diagram', format: 1, image: emptyImage(), points: [], distractors: [] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): дом на фото, пять точек с подписями, две лишние подписи
  function demo() {
    const pt = (id, label, x, y, sx, sy) => ({ id, label, x, y, sx, sy });
    return { ...create(), image: DimDemo.img('house'), instruction: DimDemo.instruction('Подпишите комнаты дома.'),
      points: [pt('p1', 'Bedroom', 0.3, 0.285, 0.1, 0.12), pt('p2', 'Kitchen', 0.605, 0.385, 0.86, 0.62), pt('p3', 'Living room', 0.31, 0.53, 0.12, 0.8), pt('p4', 'Round room', 0.82, 0.245, 0.86, 0.1), pt('p5', 'Hall', 0.6, 0.19, 0.55, 0.05)],
      distractors: ['Garage', 'Bathroom'] };
  }

  function normalize() {
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
    const pic = el('section', 'ld-sec');
    pic.append(el('h3', 'ld-h', '1. Картинка'), MediaUI.imageControl(d.image, { save: () => { save(); }, change: () => { drawCanvas(); } }));
    const pts = el('section', 'ld-sec');
    pts.append(el('h3', 'ld-h', '2. Точки и подписи'));
    canvasBox = el('div', 'ld-canvasbox');
    listBox = el('div', 'ld-list');
    pts.append(canvasBox, listBox);
    const dist = el('section', 'ld-sec');
    dist.append(el('h3', 'ld-h', '3. Лишние подписи (необязательно)'));
    const ta = el('textarea', 'ld-in ld-dist');
    ta.rows = 2;
    ta.placeholder = 'По одной в строке. Они попадут в банк, но не подходят ни к одной точке.';
    ta.value = d.distractors.join('\n');
    ta.setAttribute('aria-label', 'Лишние подписи');
    ta.oninput = () => { d.distractors = ta.value.split('\n'); save(); };
    dist.append(ta);
    root.append(tools, msg, pic, pts, dist);
    drawCanvas();
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Точек: ${d.points.length}/${MAX_POINTS}`;
  }

  // ---- Холст ----
  function drawCanvas() {
    canvasBox.innerHTML = '';
    if (!hasPic(d.image)) {
      canvasBox.append(el('div', 'ld-empty', 'Сначала загрузите картинку (шаг 1): точки ставят прямо на ней.'));
      cv = ov = null;
      return;
    }
    canvasBox.append(el('p', 'ld-muted ld-hint', 'Нажмите на картинку, чтобы поставить точку. Круг — сама точка, прямоугольник — ячейка для подписи: оба можно перетаскивать. Выбранную точку удаляет крестик в списке ниже.'));
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

  function paint() {
    if (!ov) return;
    ov.innerHTML = '';
    cv.querySelectorAll('.ld-dot, .ld-slot').forEach(n => n.remove());
    d.points.forEach((p, k) => {
      const on = p.id === selId;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p.x);
      line.setAttribute('y1', p.y);
      line.setAttribute('x2', p.sx);
      line.setAttribute('y2', p.sy);
      line.setAttribute('class', 'ld-line' + (on ? ' sel' : ''));
      ov.append(line);
      const dot = el('span', 'ld-dot' + (on ? ' sel' : ''));
      dot.dataset.i = k;
      dot.dataset.kind = 'a';
      dot.style.left = p.x * 100 + '%';
      dot.style.top = p.y * 100 + '%';
      const slot = el('span', 'ld-slot' + (on ? ' sel' : ''), `${k + 1}${clean(p.label) ? ' · ' + clean(p.label) : ''}`);
      slot.dataset.i = k;
      slot.dataset.kind = 's';
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
    if (justDragged || !cv || (e.target.dataset && e.target.dataset.i !== undefined)) return;
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
      inp.placeholder = 'Подпись, например «Корень»';
      inp.value = p.label;
      inp.setAttribute('aria-label', `Подпись точки ${k + 1}`);
      inp.oninput = () => { p.label = inp.value; save(); paint(); };
      inp.onfocus = () => { if (selId !== p.id) { selId = p.id; paint(); listBox.querySelectorAll('.ld-row').forEach(x => x.classList.toggle('sel', x === r)); } };
      const del = el('button', 'ld-ib ld-del');
      del.type = 'button';
      del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
      del.title = 'Удалить точку';
      del.setAttribute('aria-label', `Удалить точку ${k + 1}`);
      del.onclick = () => { d.points.splice(k, 1); if (selId === p.id) selId = null; save(); paint(); drawList(); };
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
      if (Math.hypot(p.sx - q.sx, p.sy - q.sy) < 0.06) warnings.push(`Ячейки точек ${a + 1} и ${b + 1} накладываются друг на друга: раздвиньте их.`);
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
    return { ...create(), image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: '' },
      points, distractors: (Array.isArray(file.distractors) ? file.distractors : []).map(s => String(s || '').slice(0, LABEL_LEN)).slice(0, MAX_DIST) };
  }

  return { create, demo, render, load, exportData, validate, unitCount };
})();
