// Редактор модуля Hotspot (найти место на картинке). Этап 1 (решение владельца 2026-10-26): ответ «Зона» (нажать на готовую область)
// или «Точка» (поставить маркер), задания «найти одно» и «найти несколько» (определяется числом верных областей).
// Этап 2: «найти по порядку»; этап 3: ответ «Контур» (ученик обводит объект, порог совпадения) и области-многоугольники.
// Одна картинка, на ней области (прямоугольник, эллипс или многоугольник) в долях картинки 0–1; у области устойчивый ID (z1…), задания (t1…)
// ссылаются на области по ID, поэтому перестановка и правка названий верные ответы не ломают.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const HotspotEditor = (() => {
  const MAX_ZONES = 30, MAX_TASKS = 20, MAX_TARGETS = 10, LABEL_LEN = 60, PROMPT_LEN = 200;
  const { nextId } = GapEngine;
  const G = HotspotGeo;
  const MODES = { zone: 'Зона', point: 'Точка', outline: 'Контур' };
  const THR_MIN = 30, THR_MAX = 90, THR_DEF = 65, MAX_VERTS = 40;
  // Настройки «Дизайна»: границы областей до проверки (пусто = как принято для способа: в «Зоне» видны, в «Точке» и «Контуре» скрыты),
  // прозрачность заливки областей, номера на областях
  const BOUNDS = { show: 'Видны', hide: 'Скрыты' }, FILLS = { low: 'Слабая', mid: 'Средняя', high: 'Сильная' }, NUMBERS = { off: 'Нет', on: 'Да' };
  const boundsOf = draft => (BOUNDS[draft.bounds] ? draft.bounds : draft.interaction === 'zone' ? 'show' : 'hide');
  const thrOf = v => { const n = Math.round(Number(v)); return n >= THR_MIN && n <= THR_MAX ? n : THR_DEF; };
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, canvasBox, zoneBox, taskBox, addTaskBtn, barBox, statusLine;
  let tool = 'move', selId = null; // инструмент холста: move / rect / ellipse / polygon; выбранная область
  let poly = null; // многоугольник в процессе рисования: вершины [[x, y], …]

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="hs-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const imageOut = im => {
    if (!im) return null;
    const media = safeMediaPath(im.media);
    if (media) return { media };
    const url = safeImageUrl(im.url);
    return url ? { url } : null;
  };
  const zoneName = (z, k) => `${k + 1}${clean(z.label) ? ' · ' + clean(z.label) : ''}`;
  const zoneById = id => d.zones.find(z => z.id === id);
  const newTask = id => ({ id, prompt: '', targets: [], ordered: false, explanation: '' });
  const validTargets = (draft, t) => t.targets.filter(id => draft.zones.some(z => z.id === id && G.valid(z)));

  function create() {
    return { module: 'hotspot', format: 1, interaction: 'zone', threshold: THR_DEF, bounds: '', fill: 'low', numbers: 'off', image: emptyImage(), zones: [], tasks: [newTask('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): дом на фото; три области, три задания — одно «найти одно»
  // и два «найти несколько»; пояснения. Ответ «Зона»
  function demo() {
    const zone = (id, label, shape, x, y, w, h) => ({ id, label, shape, x, y, w, h });
    const hall = G.fit({ id: 'z5', label: 'Холл', shape: 'polygon', pts: [[0.5, 0.11], [0.66, 0.1], [0.68, 0.27], [0.55, 0.28]] }); // многоугольник
    return { ...create(), image: DimDemo.img('house'), instruction: DimDemo.instruction('Найдите на картинке нужные места.'),
      zones: [zone('z1', 'Гостиная', 'rect', 0.12, 0.38, 0.38, 0.3), zone('z2', 'Спальня', 'rect', 0.22, 0.2, 0.16, 0.17), zone('z3', 'Кухня', 'rect', 0.52, 0.3, 0.17, 0.17), zone('z4', 'Круглая комната', 'ellipse', 0.72, 0.12, 0.2, 0.25), hall],
      tasks: [
        { id: 't1', prompt: 'Где спальня?', targets: ['z2'], explanation: 'Bedroom — спальня.' },
        { id: 't2', prompt: 'Найдите гостиную и кухню.', targets: ['z1', 'z3'], explanation: 'Living room — гостиная, kitchen — кухня.' },
        { id: 't3', prompt: '', targets: ['z2', 'z4'], explanation: '' },
        { id: 't4', prompt: 'Найдите комнаты по очереди.', targets: ['z3', 'z1', 'z4'], ordered: true, explanation: 'Kitchen, living room, round room.' },
      ] };
  }

  function normalize() {
    if (!MODES[d.interaction]) d.interaction = 'zone';
    d.threshold = thrOf(d.threshold);
    if (d.bounds !== '' && !BOUNDS[d.bounds]) d.bounds = '';
    if (!FILLS[d.fill]) d.fill = 'low';
    if (!NUMBERS[d.numbers]) d.numbers = 'off';
    if (!d.image) d.image = emptyImage();
    if (!Array.isArray(d.zones)) d.zones = [];
    if (!Array.isArray(d.tasks) || !d.tasks.length) d.tasks = [newTask('t1')];
    if (selId && !zoneById(selId)) selId = null;
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null;
    tool = 'move';
    selId = null;
    poly = null;
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
    root.className = 'hs-wrap';
    const tools = el('div', 'hs-tools');
    counter = el('span', 'hs-muted');
    const right = el('span', 'hs-right');
    right.append(help(`Загрузите картинку и нарисуйте на ней области — места, которые должен найти ученик. Потом создайте задания и отметьте у каждого верные области: одна область — «найти одно», несколько — «найти несколько». «Зона»: ученик нажимает на готовую область (все области видны). «Точка»: ученик ставит маркер, он верный, если попал в область. «Контур»: ученик обводит объект по точкам; верно, если его контур совпал с областью не меньше чем на порог (площадь пересечения / площадь объединения). Для контура рисуйте области-многоугольники по форме предмета. За каждую найденную область — 1 балл. В «найти несколько» каждая оставшаяся неверная отметка в конце отнимает 1 балл (не ниже нуля). «Искать по порядку» (переключатель у задания): ученик ищет области по одной в том порядке, в котором вы их отметили; у каждого шага свои проверки (по умолчанию 3), штрафа нет, названия областей ученик видит как задание шага. Областей до ${MAX_ZONES}, заданий до ${MAX_TASKS}.`));
    tools.append(counter, right);
    msg = el('div', 'hs-msg');
    msg.hidden = true;
    // Одна панель инструментов над картинкой (решение владельца 2026-10-26): картинка и рисование слева, способ ответа ученика справа;
    // без заголовков блоков, названия кнопок — в подсказках, под панелью одна строка про выбранный инструмент
    const areas = el('section', 'hs-sec');
    areas.append(toolbar(), statusLine = el('p', 'hs-muted hs-status'));
    canvasBox = el('div', 'hs-canvasbox');
    zoneBox = el('div', 'hs-zones');
    // Картинка слева, названия областей — в панели справа (на узкой колонке панель уходит под картинку)
    const split = el('div', 'hs-split');
    split.append(canvasBox, zoneBox);
    areas.append(split);
    const tasks = el('section', 'hs-sec');
    tasks.append(el('h3', 'hs-h', 'Задания'));
    taskBox = el('div', 'hs-tasks');
    addTaskBtn = el('button', 'hs-add', '+ Задание');
    addTaskBtn.type = 'button';
    addTaskBtn.onclick = addTask;
    tasks.append(taskBox, addTaskBtn);
    root.append(tools, msg, areas, tasks);
    refreshBar();
    drawCanvas();
    drawZones();
    drawTasks();
  }

  function updateCounter() {
    counter.textContent = `Областей: ${d.zones.length}/${MAX_ZONES} · Заданий: ${d.tasks.length}/${MAX_TASKS}`;
    addTaskBtn.disabled = d.tasks.length >= MAX_TASKS;
  }

  // Панель инструментов: слева картинка (два значка и маленькая миниатюра с ×) и инструменты рисования, справа значок ученика,
  // три способа ответа («Зона», «Точка», «Контур») и, только при «Контуре», порог совпадения
  const TOOLS = [
    ['move', 'Выбрать и двигать', '<path d="M5 3l14 8-6 2-2 6z"/>', 'Выбрать и двигать: нажмите на область; середина — двигать, края — менять размер.', 'Выбрать и двигать: нажмите на область, тяните за середину — двигать, за точки на краях — менять размер. У многоугольника двойное нажатие на край добавляет вершину, на вершину — убирает её.'],
    ['rect', 'Прямоугольник', '<rect x="4" y="6" width="16" height="12" rx="1"/>', 'Прямоугольник: зажмите кнопку мыши на картинке и потяните.', 'Прямоугольник: зажмите кнопку мыши на картинке и потяните.'],
    ['ellipse', 'Эллипс', '<ellipse cx="12" cy="12" rx="9" ry="6"/>', 'Эллипс: зажмите кнопку мыши на картинке и потяните.', 'Эллипс: зажмите кнопку мыши на картинке и потяните.'],
    ['polygon', 'Многоугольник', '<path d="M5 9l7-5 7 6-3 9H7z"/>', 'Многоугольник: нажимайте вершины, замкните — нажатием на первую.', 'Многоугольник: нажимайте на картинку, расставляя вершины; замкните — нажатием на первую вершину, двойным нажатием или кнопкой «Замкнуть».'],
  ];
  const MODE_ICONS = {
    zone: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>',
    point: '<circle cx="12" cy="12" r="6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    outline: '<path d="M5 14c0-4 3-8 8-8s6 4 5 7-5 5-9 5-4-2-4-4z"/>',
  };
  const MODE_TIPS = { zone: 'Зона: ученик нажимает на готовую область картинки.', point: 'Точка: ученик ставит маркер на нужное место.', outline: 'Контур: ученик обводит объект по точкам; верно, если контур совпал с областью не меньше порога.' };

  function toolbar() {
    barBox = el('div', 'hs-top');
    const left = el('div', 'hs-grp');
    const pic = el('div', 'hs-picbox');
    pic.append(MediaUI.imageControl(d.image, { save: () => { selId = null; save(); }, change: () => { drawCanvas(); refreshBar(); } }));
    left.append(pic, el('span', 'hs-sep'));
    TOOLS.forEach(([id, name, ico, , tip]) => {
      const b = el('button', 'hs-tbtn');
      b.type = 'button';
      b.innerHTML = svg(ico);
      b.title = tip;
      b.dataset.tool = id;
      b.setAttribute('aria-label', name);
      b.onclick = () => { tool = id; poly = null; if (id !== 'move') selId = null; refreshBar(); drawCanvas(); drawZones(); };
      left.append(b);
    });
    const right = el('div', 'hs-grp hs-grp-r');
    const who = el('span', 'hs-who');
    who.innerHTML = svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>');
    who.title = 'Как отвечает ученик';
    right.append(who);
    const row = el('span', 'hs-modes');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Как отвечает ученик');
    Object.keys(MODES).forEach(k => {
      const b = el('button', 'hs-tbtn');
      b.type = 'button';
      b.innerHTML = svg(MODE_ICONS[k]);
      b.title = MODE_TIPS[k];
      b.dataset.mode = k;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', MODES[k]);
      b.onclick = () => { d.interaction = k; save(); refreshBar(); };
      row.append(b);
    });
    right.append(row);
    // Порог совпадения контура — маленькое число рядом со значком «Контур», только при этом способе ответа
    const thr = el('label', 'hs-thr');
    thr.title = `Порог совпадения контура, % (от ${THR_MIN} до ${THR_MAX}, по умолчанию ${THR_DEF}): какая часть контура ученика должна совпасть с областью — площадь пересечения, делённая на площадь объединения`;
    const num = el('input', 'hs-in hs-thrin');
    num.type = 'number';
    num.min = THR_MIN;
    num.max = THR_MAX;
    num.step = 5;
    num.value = d.threshold;
    num.setAttribute('aria-label', 'Порог совпадения контура, %');
    num.onchange = () => { d.threshold = thrOf(num.value); num.value = d.threshold; save(); };
    thr.append(num, document.createTextNode('%'));
    right.append(thr);
    barBox.append(left, right);
    return barBox;
  }

  // Подсветка выбранных инструмента и способа ответа, порог, строка под панелью про выбранный инструмент
  function refreshBar() {
    if (!barBox) return;
    barBox.querySelectorAll('[data-tool]').forEach(b => { const on = b.dataset.tool === tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    barBox.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === d.interaction; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    barBox.querySelector('.hs-thr').hidden = d.interaction !== 'outline';
    if (statusLine) {
      const t = TOOLS.find(x => x[0] === tool);
      statusLine.textContent = hasPic(d.image) ? `${t[3]} Ответ ученика — ${MODES[d.interaction]}.` : 'Сначала загрузите картинку (значки слева): области рисуют прямо на ней.';
    }
  }

  // ---- Холст: картинка и области поверх неё ----
  let cv = null, ov = null;
  function drawCanvas() {
    canvasBox.innerHTML = '';
    refreshBar();
    if (tool === 'polygon' && poly && poly.length) {
      // Рисование многоугольника: замкнуть, убрать последнюю точку или отменить
      const act = el('div', 'hs-bar hs-polybar');
      const a = (label, fn, dis) => { const b = el('button', 'hs-tool', label); b.type = 'button'; b.disabled = !!dis; b.onclick = fn; return b; };
      act.append(a('Замкнуть', closePoly, poly.length < 3), a('Убрать точку', () => { poly.pop(); if (!poly.length) poly = null; drawCanvas(); }), a('Отмена', () => { poly = null; drawCanvas(); }));
      canvasBox.append(act);
    }
    if (!hasPic(d.image)) {
      canvasBox.append(el('div', 'hs-empty', 'Здесь появится картинка.'));
      cv = ov = null;
      return;
    }
    cv = el('div', 'hs-cv' + (tool === 'move' ? '' : ' drawing'));
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    const src = mediaSrc(safeMediaPath(d.image.media) ? { media: d.image.media } : { url: d.image.url });
    img.onerror = () => { cv.classList.add('broken'); };
    img.src = src || '';
    ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ov.setAttribute('class', 'hs-ov');
    ov.setAttribute('viewBox', '0 0 1 1');
    ov.setAttribute('preserveAspectRatio', 'none');
    cv.append(img, ov);
    canvasBox.append(cv);
    cv.onpointerdown = down;
    cv.onpointermove = move;
    cv.onpointerup = cv.onpointercancel = up;
    cv.ondblclick = dbl;
    paint();
  }

  const NS = 'http://www.w3.org/2000/svg';
  function paint() {
    if (!ov) return;
    ov.innerHTML = '';
    cv.querySelectorAll('.hs-num, .hs-hd, .hs-x, .hs-vh, .hs-pv').forEach(n => n.remove());
    d.zones.forEach((z, k) => {
      if (!G.valid(z) && !(drag && drag.zone === z) && !(z.shape === 'polygon' && Array.isArray(z.pts) && z.pts.length >= 3)) return;
      const s = document.createElementNS(NS, z.shape === 'ellipse' ? 'ellipse' : z.shape === 'polygon' ? 'polygon' : 'rect');
      if (z.shape === 'ellipse') { s.setAttribute('cx', z.x + z.w / 2); s.setAttribute('cy', z.y + z.h / 2); s.setAttribute('rx', z.w / 2); s.setAttribute('ry', z.h / 2); }
      else if (z.shape === 'polygon') s.setAttribute('points', z.pts.map(p => p.join(',')).join(' '));
      else { s.setAttribute('x', z.x); s.setAttribute('y', z.y); s.setAttribute('width', z.w); s.setAttribute('height', z.h); }
      s.setAttribute('class', 'hs-shape' + (z.id === selId ? ' sel' : ''));
      ov.append(s);
      const n = el('span', 'hs-num' + (z.id === selId ? ' sel' : ''), String(k + 1));
      n.style.left = z.x * 100 + '%';
      n.style.top = z.y * 100 + '%';
      cv.append(n);
    });
    if (poly && poly.length) { // многоугольник в процессе рисования: ломаная и вершины
      const pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', poly.map(p => p.join(',')).join(' '));
      pl.setAttribute('class', 'hs-poly');
      ov.append(pl);
      poly.forEach((p, i) => { const v = el('span', 'hs-pv' + (i === 0 ? ' first' : '')); v.style.left = p[0] * 100 + '%'; v.style.top = p[1] * 100 + '%'; cv.append(v); });
    }
    const sel = selId && zoneById(selId);
    if (sel && sel.shape === 'polygon' && Array.isArray(sel.pts)) { // у многоугольника ручки — его вершины
      sel.pts.forEach((p, i) => { const v = el('span', 'hs-vh'); v.dataset.v = i; v.style.left = p[0] * 100 + '%'; v.style.top = p[1] * 100 + '%'; cv.append(v); });
    }
    if (sel && (G.valid(sel) || sel.shape === 'polygon')) {
      const pts = sel.shape === 'polygon' ? {} : { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
      const x = el('span', 'hs-x', '×'); // крестик «удалить область» в правом верхнем углу выбранной области
      x.dataset.del = '1';
      x.title = 'Удалить область';
      x.style.left = (sel.x + sel.w) * 100 + '%';
      x.style.top = sel.y * 100 + '%';
      cv.append(x);
      Object.keys(pts).forEach(h => {
        const e = el('span', 'hs-hd hs-hd-' + h);
        e.dataset.h = h;
        e.style.left = (sel.x + sel.w * pts[h][0]) * 100 + '%';
        e.style.top = (sel.y + sel.h * pts[h][1]) * 100 + '%';
        cv.append(e);
      });
    }
  }

  // Точка события → доли картинки (учитывает любой размер и масштаб экрана)
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: G.clamp((e.clientX - r.left) / r.width, 0, 1), y: G.clamp((e.clientY - r.top) / r.height, 0, 1) };
  }
  // Область под точкой: из нескольких — самая маленькая (вложенную область можно выбрать)
  function zoneAt(p) {
    let best = null;
    d.zones.forEach(z => { if (G.valid(z) && G.hit(z, p.x, p.y, 0) && (!best || z.w * z.h < best.w * best.h)) best = z; });
    return best;
  }

  let drag = null;
  function down(e) {
    if (e.button > 0 || !cv) return;
    const p = pt(e);
    const h = e.target.dataset && e.target.dataset.h;
    const sel = selId && zoneById(selId);
    if (e.target.dataset && e.target.dataset.del && sel) { e.preventDefault(); removeZone(sel); return; }
    if (tool === 'polygon') { e.preventDefault(); polyDown(p); return; }
    const v = e.target.dataset && e.target.dataset.v;
    if (v !== undefined && sel && sel.shape === 'polygon') drag = { kind: 'vertex', v: +v, start: p, zone: sel };
    else if (h && sel) drag = { kind: 'resize', h, start: p, z0: { ...sel }, zone: sel };
    else if (tool !== 'move') {
      if (d.zones.length >= MAX_ZONES) { say(`Областей не больше ${MAX_ZONES}.`); return; }
      drag = { kind: 'new', start: p, shape: tool, zone: null };
    } else {
      const z = zoneAt(p);
      selId = z ? z.id : null;
      drag = z ? { kind: 'move', start: p, z0: { ...z }, zone: z } : null;
      paint();
      drawZones();
    }
    if (drag) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  }

  function move(e) {
    if (!drag) return;
    const p = pt(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.kind === 'move') {
      const z = drag.zone, z0 = drag.z0;
      z.x = G.round(G.clamp(z0.x + dx, 0, 1 - z.w));
      z.y = G.round(G.clamp(z0.y + dy, 0, 1 - z.h));
      if (z.shape === 'polygon') { const ox = z.x - z0.x, oy = z.y - z0.y; z.pts = z0.pts.map(q => [G.round(q[0] + ox), G.round(q[1] + oy)]); }
      drag.moved = true;
    } else if (drag.kind === 'vertex') {
      drag.zone.pts[drag.v] = [G.round(p.x), G.round(p.y)];
      G.fit(drag.zone);
      drag.moved = true;
    } else if (drag.kind === 'resize') {
      const z = drag.zone, z0 = drag.z0, h = drag.h;
      let x0 = z0.x, y0 = z0.y, x1 = z0.x + z0.w, y1 = z0.y + z0.h;
      if (h.includes('w')) x0 = G.clamp(p.x, 0, x1 - G.MIN);
      if (h.includes('e')) x1 = G.clamp(p.x, x0 + G.MIN, 1);
      if (h.includes('n')) y0 = G.clamp(p.y, 0, y1 - G.MIN);
      if (h.includes('s')) y1 = G.clamp(p.y, y0 + G.MIN, 1);
      Object.assign(z, { x: G.round(x0), y: G.round(y0), w: G.round(x1 - x0), h: G.round(y1 - y0) });
      drag.moved = true;
    } else if (drag.kind === 'new') {
      if (!drag.zone && (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004)) {
        drag.zone = { id: nextId('z', d.zones.map(z => z.id)), label: '', shape: drag.shape, x: 0, y: 0, w: G.MIN, h: G.MIN };
        d.zones.push(drag.zone);
        selId = drag.zone.id;
      }
      if (drag.zone) {
        const x0 = Math.min(drag.start.x, p.x), y0 = Math.min(drag.start.y, p.y);
        Object.assign(drag.zone, { x: G.round(x0), y: G.round(y0), w: G.round(Math.max(Math.abs(dx), 0.001)), h: G.round(Math.max(Math.abs(dy), 0.001)) });
      }
    }
    paint();
  }

  function up() {
    if (!drag) return;
    const dr = drag;
    drag = null;
    if (dr.kind === 'new') {
      if (dr.zone && (dr.zone.w < G.MIN || dr.zone.h < G.MIN)) { // слишком маленькая — не создаём
        d.zones.splice(d.zones.indexOf(dr.zone), 1);
        selId = null;
        say('Область слишком маленькая — потяните дальше.');
      } else if (dr.zone) {
        tool = 'move';
        save();
        drawCanvas();
        drawZones();
        drawTasks();
        return;
      }
    } else if (dr.moved) save();
    paint();
    drawZones();
  }

  // ---- Многоугольник: рисование вершин, двойное нажатие (добавить / убрать вершину) ----
  function polyDown(p) {
    if (!poly) {
      if (d.zones.length >= MAX_ZONES) return say(`Областей не больше ${MAX_ZONES}.`);
      poly = [[G.round(p.x), G.round(p.y)]];
    } else {
      const r = cv.getBoundingClientRect(), f = poly[0];
      if (poly.length >= 3 && Math.hypot((p.x - f[0]) * r.width, (p.y - f[1]) * r.height) <= 12) return closePoly(); // нажали на первую вершину
      if (poly.length >= MAX_VERTS) return say(`Вершин не больше ${MAX_VERTS}: замкните многоугольник.`);
      const l = poly[poly.length - 1];
      if (Math.hypot((p.x - l[0]) * r.width, (p.y - l[1]) * r.height) < 5) return; // вторая точка почти в том же месте (двойное нажатие) — не добавляем
      poly.push([G.round(p.x), G.round(p.y)]);
    }
    drawCanvas();
  }
  function closePoly() {
    if (!poly || poly.length < 3) return say('Нужно хотя бы 3 вершины.');
    const z = G.fit({ id: nextId('z', d.zones.map(x => x.id)), label: '', shape: 'polygon', pts: poly.map(q => [G.round(q[0]), G.round(q[1])]) });
    if (!G.valid(z)) return say('Контур пересекает сам себя или слишком мал. Уберите последнюю вершину и поставьте иначе.');
    d.zones.push(z);
    selId = z.id;
    poly = null;
    tool = 'move';
    save();
    drawCanvas();
    drawZones();
    drawTasks();
  }
  function dbl(e) {
    if (!cv) return;
    if (tool === 'polygon' && poly) { if (poly.length >= 3) closePoly(); return; } // двойное нажатие замыкает (вторая точка в том же месте не добавляется)
    const sel = selId && zoneById(selId);
    if (tool !== 'move' || !sel || sel.shape !== 'polygon') return;
    const v = e.target.dataset && e.target.dataset.v;
    if (v !== undefined) { // убрать вершину (не меньше трёх)
      if (sel.pts.length <= 3) return say('У многоугольника не меньше трёх вершин.');
      sel.pts.splice(+v, 1);
    } else { // добавить вершину на ближайшем краю
      const p = pt(e);
      let best = -1, bd = 0.02;
      sel.pts.forEach((a, i) => { const dd = G.distSeg(p.x, p.y, a, sel.pts[(i + 1) % sel.pts.length]); if (dd < bd) { bd = dd; best = i; } });
      if (best < 0 || sel.pts.length >= MAX_VERTS) return;
      sel.pts.splice(best + 1, 0, [G.round(p.x), G.round(p.y)]);
    }
    G.fit(sel);
    save();
    paint();
    drawZones();
  }

  // Смена формы области: прямоугольник ↔ эллипс — те же размеры; в многоугольник — по углам или по 24 точкам эллипса; из многоугольника — по его описывающему прямоугольнику
  function reshape(z, id) {
    if (z.shape === id) return;
    if (id === 'polygon') {
      z.pts = z.shape === 'ellipse'
        ? Array.from({ length: 24 }, (_, i) => [G.round(z.x + z.w / 2 + z.w / 2 * Math.cos(i * Math.PI / 12)), G.round(z.y + z.h / 2 + z.h / 2 * Math.sin(i * Math.PI / 12))])
        : [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]].map(q => [G.round(q[0]), G.round(q[1])]);
      z.shape = 'polygon';
      G.fit(z);
    } else {
      z.shape = id;
      delete z.pts;
    }
  }

  // ---- Список областей (библиотека зон) ----
  function drawZones() {
    zoneBox.innerHTML = '';
    d.zones.forEach((z, k) => {
      const r = el('div', 'hs-zrow' + (z.id === selId ? ' sel' : ''));
      const n = el('button', 'hs-zn', String(k + 1));
      n.type = 'button';
      n.title = 'Выбрать область';
      n.setAttribute('aria-label', `Выбрать область ${k + 1}`);
      n.onclick = () => { selId = z.id; tool = 'move'; drawCanvas(); drawZones(); };
      const inp = el('input', 'hs-in hs-zlabel');
      inp.type = 'text';
      inp.maxLength = LABEL_LEN;
      inp.placeholder = 'Название';
      inp.title = 'Название области, например «Дверь». В заданиях «по порядку» его видит ученик.';
      inp.value = z.label;
      inp.setAttribute('aria-label', `Название области ${k + 1}`);
      inp.oninput = () => { z.label = inp.value; save(); drawTasks(); };
      inp.onfocus = () => { if (selId !== z.id) { selId = z.id; paint(); r.parentElement.querySelectorAll('.hs-zrow').forEach(x => x.classList.toggle('sel', x === r)); } };
      // Форма области меняется здесь же: прямоугольник / эллипс / многоугольник
      const shape = el('span', 'hs-shapes');
      shape.setAttribute('role', 'radiogroup');
      shape.setAttribute('aria-label', `Форма области ${k + 1}`);
      [['rect', 'Прямоугольник', '<rect x="4" y="6" width="16" height="12" rx="1"/>'], ['ellipse', 'Эллипс', '<ellipse cx="12" cy="12" rx="9" ry="6"/>'], ['polygon', 'Многоугольник', '<path d="M5 9l7-5 7 6-3 9H7z"/>']].forEach(([id, name, ico]) => {
        const sb = el('button', 'hs-shbtn' + (z.shape === id ? ' on' : ''));
        sb.type = 'button';
        sb.innerHTML = svg(ico);
        sb.title = name;
        sb.setAttribute('role', 'radio');
        sb.setAttribute('aria-checked', String(z.shape === id));
        sb.setAttribute('aria-label', name);
        sb.onclick = () => { if (z.shape === id) return; reshape(z, id); selId = z.id; save(); paint(); drawZones(); };
        shape.append(sb);
      });
      const del = el('button', 'hs-ib hs-del');
      del.type = 'button';
      del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
      del.title = 'Удалить область';
      del.setAttribute('aria-label', `Удалить область ${k + 1}`);
      del.onclick = () => removeZone(z);
      r.append(n, inp, shape, del);
      zoneBox.append(r);
    });
    updateCounter();
  }

  function removeZone(z) {
    const used = d.tasks.filter(t => t.targets.includes(z.id)).length;
    d.zones.splice(d.zones.indexOf(z), 1);
    d.tasks.forEach(t => { t.targets = t.targets.filter(id => id !== z.id); });
    if (selId === z.id) selId = null;
    save();
    drawCanvas();
    drawZones();
    drawTasks();
    if (used) say(`Область удалена и убрана из заданий: ${used}. Проверьте их верные области.`);
  }

  // ---- Задания ----
  function drawTasks() {
    taskBox.innerHTML = '';
    d.tasks.forEach((t, k) => taskBox.append(taskCard(t, k)));
    updateCounter();
  }

  function taskCard(t, k) {
    const box = el('div', 'hs-task');
    const top = el('div', 'hs-tasktop');
    top.append(el('b', '', `Задание ${k + 1}`));
    const ok = validTargets(d, t).length;
    top.append(el('span', 'hs-kind hs-muted', ok > 1 && t.ordered ? 'по порядку' : ok > 1 ? 'найти несколько' : ok === 1 ? 'найти одно' : ''));
    const tools = el('span', 'hs-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'hs-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, задание ${k + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Задание выше', () => moveTask(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Задание ниже', () => moveTask(k, 1), k === d.tasks.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать задание', () => duplicateTask(k), d.tasks.length >= MAX_TASKS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'hs-ask');
      const yes = el('button', 'hs-yes', 'Удалить задание');
      yes.type = 'button';
      yes.onclick = () => removeTask(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawTasks(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const x = b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить задание', () => {
        if (clean(t.prompt) || t.targets.length || clean(t.explanation)) { delAsk = t.id; drawTasks(); } else removeTask(k);
      }, d.tasks.length <= 1);
      x.classList.add('hs-del');
      tools.append(x);
    }
    top.append(tools);

    const prompt = el('input', 'hs-in hs-prompt');
    prompt.type = 'text';
    prompt.maxLength = PROMPT_LEN;
    prompt.placeholder = 'Задание (необязательно), например «Где дверь?»';
    prompt.value = t.prompt;
    prompt.setAttribute('aria-label', `Текст задания ${k + 1}`);
    prompt.oninput = () => { t.prompt = prompt.value; save(); };

    const ord = el('label', 'hs-ord');
    const chk = el('input');
    chk.type = 'checkbox';
    chk.checked = t.ordered === true;
    chk.onchange = () => { t.ordered = chk.checked; save(); drawTasks(); };
    ord.append(chk, document.createTextNode(' Искать по порядку'));
    ord.title = 'Ученик ищет области по одной, в том порядке, в котором вы их отметите; у каждого шага свои проверки';

    const tg = el('div', 'hs-targets');
    tg.append(el('p', 'hs-muted hs-hint', !d.zones.length ? 'Сначала нарисуйте области на картинке (шаг 3).'
      : t.ordered ? 'Верные области: нажимайте в нужном порядке, цифра — номер шага (названия увидит ученик). Чтобы поменять порядок, снимите отметку и поставьте заново.' : 'Верные области (нажмите, чтобы отметить):'));
    const chips = el('div', 'hs-chips');
    d.zones.forEach((z, j) => {
      const on = t.targets.includes(z.id);
      const c = el('button', 'hs-chip' + (on ? ' on' : ''), (t.ordered && on ? `${t.targets.indexOf(z.id) + 1}. ` : '') + zoneName(z, j));
      c.type = 'button';
      c.setAttribute('aria-pressed', String(on));
      c.onclick = () => {
        if (on) t.targets = t.targets.filter(id => id !== z.id);
        else if (t.targets.length >= MAX_TARGETS) return say(`Верных областей в задании не больше ${MAX_TARGETS}.`);
        else t.targets.push(z.id);
        save();
        drawTasks();
      };
      chips.append(c);
    });
    tg.append(chips);

    const ex = el('textarea', 'hs-in hs-expl');
    ex.rows = 1;
    ex.placeholder = 'Пояснение (необязательно): ученик увидит его после верного ответа или в конце';
    ex.value = t.explanation;
    ex.setAttribute('aria-label', `Пояснение к заданию ${k + 1}`);
    const fit = () => { ex.style.height = 'auto'; ex.style.height = ex.scrollHeight + 2 + 'px'; };
    ex.oninput = () => { t.explanation = ex.value; fit(); save(); };
    setTimeout(fit, 0);

    box.append(top, prompt, ord, tg, ex);
    return box;
  }

  const newTaskId = () => nextId('t', d.tasks.map(t => t.id));
  function addTask() {
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    d.tasks.push(newTask(newTaskId()));
    save();
    drawTasks();
    const last = taskBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = last.querySelector('.hs-prompt'); if (inp) inp.focus({ preventScroll: true }); }
  }
  function moveTask(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.tasks.length) return;
    [d.tasks[k], d.tasks[j]] = [d.tasks[j], d.tasks[k]];
    save();
    drawTasks();
  }
  function duplicateTask(k) {
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    const copy = JSON.parse(JSON.stringify(d.tasks[k]));
    copy.id = newTaskId();
    d.tasks.splice(k + 1, 0, copy);
    save();
    drawTasks();
  }
  function removeTask(k) {
    d.tasks.splice(k, 1);
    delAsk = null;
    if (!d.tasks.length) d.tasks.push(newTask(newTaskId()));
    save();
    drawTasks();
  }

  // ---- Файл упражнения ----
  // Числа округлены до 4 знаков; interaction — только «point» и «outline» (threshold — только при «outline» и не 65);
  // пустые поля в файл не попадают. Многоугольник хранится вершинами pts (размеры считаются при загрузке).
  // Области без верных ответов остаются (в режиме «Зона» это неверные варианты), неверные по геометрии — нет
  function exportData(draft) {
    return {
      module: 'hotspot', format: 1,
      ...(draft.interaction === 'point' || draft.interaction === 'outline' ? { interaction: draft.interaction } : {}),
      ...(draft.interaction === 'outline' && thrOf(draft.threshold) !== THR_DEF ? { threshold: thrOf(draft.threshold) } : {}),
      ...(BOUNDS[draft.bounds] ? { bounds: draft.bounds } : {}),
      ...(FILLS[draft.fill] && draft.fill !== 'low' ? { fill: draft.fill } : {}),
      ...(draft.numbers === 'on' ? { numbers: true } : {}),
      ...(imageOut(draft.image) ? { image: imageOut(draft.image) } : {}),
      zones: draft.zones.filter(G.valid).map(z => ({
        id: z.id,
        ...(clean(z.label) ? { label: clean(z.label) } : {}),
        shape: z.shape,
        ...(z.shape === 'polygon' ? { pts: z.pts.map(p => [G.round(p[0]), G.round(p[1])]) } : { x: G.round(z.x), y: G.round(z.y), w: G.round(z.w), h: G.round(z.h) }),
      })),
      tasks: draft.tasks.map(t => ({
        id: t.id,
        ...(clean(t.prompt) ? { prompt: clean(t.prompt) } : {}),
        targets: validTargets(draft, t),
        ...(t.ordered === true ? { ordered: true } : {}),
        ...(t.explanation.trim() ? { explanation: t.explanation.trim() } : {}),
      })),
    };
  }

  // Балл — за каждую верную область каждого задания
  const unitCount = draft => draft.tasks.reduce((n, t) => n + validTargets(draft, t).length, 0);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const im = draft.image;
    if (!hasPic(im)) {
      if (im && clean(im.url) && !safeMediaPath(im.media)) errors.push('Ссылка на картинку должна быть полным адресом с https://.');
      else errors.push('Нет картинки.');
    }
    if (draft.interaction === 'outline') {
      const n = Number(draft.threshold);
      if (!(n >= THR_MIN && n <= THR_MAX)) errors.push(`Порог совпадения контура должен быть от ${THR_MIN} до ${THR_MAX}%.`);
    }
    if (!draft.zones.length) errors.push('Нет ни одной области на картинке.');
    if (draft.zones.length > MAX_ZONES) errors.push(`Областей больше ${MAX_ZONES}.`);
    draft.zones.forEach((z, k) => {
      if (!G.valid(z)) errors.push(`Область ${k + 1}: ${z.shape === 'polygon' ? 'многоугольник пересекает сам себя, слишком мал или выходит за картинку' : 'неверные размеры или выходит за картинку'}.`);
      else if (z.w < 0.02 || z.h < 0.02) warnings.push(`Область ${zoneName(z, k)} очень маленькая — ученику будет трудно попасть.`);
    });
    const labels = {};
    draft.zones.forEach((z, k) => { const l = clean(z.label).toLowerCase(); if (l) (labels[l] = labels[l] || []).push(k + 1); });
    Object.values(labels).forEach(ks => { if (ks.length > 1) warnings.push(`Названия областей ${ks.join(' и ')} одинаковы.`); });
    // «Зона»: ученик выбирает область нажатием, поэтому области не должны пересекаться; «Точка»: пересечение верных областей одного задания — предупреждение
    const ok = draft.zones.filter(G.valid);
    if (draft.interaction === 'zone') {
      for (let a = 0; a < ok.length; a++) for (let b = a + 1; b < ok.length; b++) {
        if (G.overlap(ok[a], ok[b])) errors.push(`Области ${draft.zones.indexOf(ok[a]) + 1} и ${draft.zones.indexOf(ok[b]) + 1} пересекаются: в режиме «Зона» ученик не сможет выбрать нужную. Раздвиньте их или выберите ответ «Точка».`);
      }
    }
    if (!draft.tasks.length) errors.push('Нет ни одного задания.');
    if (draft.tasks.length > MAX_TASKS) errors.push(`Заданий больше ${MAX_TASKS}.`);
    const many = draft.tasks.length > 1;
    draft.tasks.forEach((t, k) => {
      const pre = many ? `Задание ${k + 1}: ` : '';
      const good = validTargets(draft, t);
      if (!t.targets.length) errors.push(`${pre}не отмечена верная область.`);
      else if (!good.length) errors.push(`${pre}верные области неверны или удалены.`);
      if (t.targets.length > MAX_TARGETS) errors.push(`${pre}верных областей больше ${MAX_TARGETS}.`);
      // «По порядку»: нужны хотя бы два шага, и у каждой области есть название — ученик видит его как задание шага
      if (t.ordered === true) {
        if (good.length < 2) errors.push(`${pre}«по порядку» нужно хотя бы две верные области.`);
        good.forEach(id => { const k2 = draft.zones.findIndex(z => z.id === id); if (!clean(draft.zones[k2].label)) errors.push(`${pre}у области ${k2 + 1} нет названия — ученик не поймёт, что искать на этом шаге.`); });
      }
      if (draft.interaction === 'outline') {
        good.forEach(id => {
          const k2 = draft.zones.findIndex(z => z.id === id), w = `Область ${k2 + 1} — не многоугольник: в режиме «Контур» предмет точно не обвести, нарисуйте область по его форме.`;
          if (draft.zones[k2].shape !== 'polygon' && !warnings.includes(w)) warnings.push(w);
        });
      }
      if (draft.interaction === 'point' || draft.interaction === 'outline') {
        const zs = good.map(id => draft.zones.find(z => z.id === id));
        for (let a = 0; a < zs.length; a++) for (let b = a + 1; b < zs.length; b++) {
          if (G.overlap(zs[a], zs[b])) warnings.push(`${pre}верные области ${draft.zones.indexOf(zs[a]) + 1} и ${draft.zones.indexOf(zs[b]) + 1} пересекаются: одна точка может подойти к обеим (засчитается только одной).`);
        }
      }
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию.
  // Повтор ID получает новый; верные области, которых нет среди областей, отбрасываются (ошибка публикации, если не осталось)
  function load(file) {
    if (!Array.isArray(file.tasks) || !file.tasks.length) throw new Error('В файле нет заданий.');
    const zIds = new Set();
    const zones = (Array.isArray(file.zones) ? file.zones : []).slice(0, MAX_ZONES).map(z => {
      let id = String((z && z.id) || '');
      if (!id || zIds.has(id)) id = nextId('z', [...zIds]);
      zIds.add(id);
      const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const shape = z && G.SHAPES[z.shape] ? z.shape : 'rect';
      const out = { id, label: String((z && z.label) || '').slice(0, LABEL_LEN), shape, x: num(z && z.x), y: num(z && z.y), w: num(z && z.w), h: num(z && z.h) };
      if (shape === 'polygon') { // вершины pts; описывающий прямоугольник считается по ним
        out.pts = (Array.isArray(z.pts) ? z.pts : []).slice(0, MAX_VERTS).map(p => [num(p && p[0]), num(p && p[1])]);
        if (out.pts.length) G.fit(out);
      }
      return out;
    });
    const tIds = new Set();
    const tasks = file.tasks.slice(0, MAX_TASKS).map(s => {
      let id = String((s && s.id) || '');
      if (!id || tIds.has(id)) id = nextId('t', [...tIds]);
      tIds.add(id);
      const targets = [...new Set((Array.isArray(s && s.targets) ? s.targets : []).map(String))].filter(x => zIds.has(x)).slice(0, MAX_TARGETS);
      return { id, prompt: String((s && s.prompt) || '').slice(0, PROMPT_LEN), targets, ordered: !!(s && s.ordered === true), explanation: String((s && s.explanation) || '') };
    });
    const im = file.image;
    return { ...create(), interaction: file.interaction === 'point' || file.interaction === 'outline' ? file.interaction : 'zone', threshold: thrOf(file.threshold),
      bounds: BOUNDS[file.bounds] ? file.bounds : '', fill: FILLS[file.fill] ? file.fill : 'low', numbers: file.numbers === true ? 'on' : 'off',
      image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: '' },
      zones, tasks };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const shape = 'M5 6h14v12H5z';
    return [
      { field: 'bounds', label: 'Границы областей до проверки', value: boundsOf(draft), names: BOUNDS,
        icons: { show: sq(`<path d="${shape}" stroke-dasharray="0"/>`), hide: sq(`<path d="${shape}" stroke-dasharray="2 3" opacity=".5"/>`) } },
      { field: 'fill', label: 'Прозрачность областей', value: FILLS[draft.fill] ? draft.fill : 'low', names: FILLS,
        icons: { low: sq(`<path d="${shape}" fill="currentColor" fill-opacity=".12"/>`), mid: sq(`<path d="${shape}" fill="currentColor" fill-opacity=".3"/>`), high: sq(`<path d="${shape}" fill="currentColor" fill-opacity=".55"/>`) } },
      { field: 'numbers', label: 'Номера на областях', value: NUMBERS[draft.numbers] ? draft.numbers : 'off', names: NUMBERS,
        icons: { off: sq(`<path d="${shape}"/>`), on: sq(`<path d="${shape}"/><path d="M10 10l2-1v6"/>`) } },
    ];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions };
})();
