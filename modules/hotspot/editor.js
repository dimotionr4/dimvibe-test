// Редактор модуля Hotspot (найти место на картинке). Этап 1 (решение владельца 2026-10-26): ответ «Зона» (нажать на готовую область)
// или «Точка» (поставить маркер), задания «найти одно» и «найти несколько» (определяется числом верных областей).
// Одна картинка, на ней области (прямоугольник или эллипс) в долях картинки 0–1; у области устойчивый ID (z1…), задания (t1…)
// ссылаются на области по ID, поэтому перестановка и правка названий верные ответы не ломают.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const HotspotEditor = (() => {
  const MAX_ZONES = 30, MAX_TASKS = 20, MAX_TARGETS = 10, LABEL_LEN = 60, PROMPT_LEN = 200;
  const { nextId } = GapEngine;
  const G = HotspotGeo;
  const MODES = { zone: 'Зона', point: 'Точка' };
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, canvasBox, zoneBox, taskBox, addTaskBtn;
  let tool = 'move', selId = null; // инструмент холста: move / rect / ellipse; выбранная область

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
  const newTask = id => ({ id, prompt: '', targets: [], explanation: '' });
  const validTargets = (draft, t) => t.targets.filter(id => draft.zones.some(z => z.id === id && G.valid(z)));

  function create() {
    return { module: 'hotspot', format: 1, interaction: 'zone', image: emptyImage(), zones: [], tasks: [newTask('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): дом на фото; три области, три задания — одно «найти одно»
  // и два «найти несколько»; пояснения. Ответ «Зона»
  function demo() {
    const zone = (id, label, shape, x, y, w, h) => ({ id, label, shape, x, y, w, h });
    return { ...create(), image: DimDemo.img('house'), instruction: DimDemo.instruction('Найдите на картинке нужные места.'),
      zones: [zone('z1', 'Гостиная', 'rect', 0.12, 0.38, 0.38, 0.3), zone('z2', 'Спальня', 'rect', 0.22, 0.2, 0.16, 0.17), zone('z3', 'Кухня', 'rect', 0.52, 0.3, 0.17, 0.17), zone('z4', 'Круглая комната', 'ellipse', 0.72, 0.12, 0.2, 0.25)],
      tasks: [
        { id: 't1', prompt: 'Где спальня?', targets: ['z2'], explanation: 'Bedroom — спальня.' },
        { id: 't2', prompt: 'Найдите гостиную и кухню.', targets: ['z1', 'z3'], explanation: 'Living room — гостиная, kitchen — кухня.' },
        { id: 't3', prompt: '', targets: ['z2', 'z4'], explanation: '' },
      ] };
  }

  function normalize() {
    if (!MODES[d.interaction]) d.interaction = 'zone';
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
    right.append(help(`Загрузите картинку и нарисуйте на ней области — места, которые должен найти ученик. Потом создайте задания и отметьте у каждого верные области: одна область — «найти одно», несколько — «найти несколько». «Зона»: ученик нажимает на готовую область (все области видны). «Точка»: ученик ставит маркер, он верный, если попал в область. За каждую найденную область — 1 балл. В «найти несколько» каждая оставшаяся неверная отметка в конце отнимает 1 балл (не ниже нуля). Областей до ${MAX_ZONES}, заданий до ${MAX_TASKS}.`));
    tools.append(counter, right);
    msg = el('div', 'hs-msg');
    msg.hidden = true;
    const pic = el('section', 'hs-sec');
    pic.append(el('h3', 'hs-h', '1. Картинка'), MediaUI.imageControl(d.image, { save: () => { selId = null; save(); }, change: () => { drawCanvas(); } }));
    const mode = el('section', 'hs-sec');
    mode.append(el('h3', 'hs-h', '2. Как отвечает ученик'), modeButtons());
    const areas = el('section', 'hs-sec');
    areas.append(el('h3', 'hs-h', '3. Области на картинке'));
    canvasBox = el('div', 'hs-canvasbox');
    zoneBox = el('div', 'hs-zones');
    areas.append(canvasBox, zoneBox);
    const tasks = el('section', 'hs-sec');
    tasks.append(el('h3', 'hs-h', '4. Задания'));
    taskBox = el('div', 'hs-tasks');
    addTaskBtn = el('button', 'hs-add', '+ Задание');
    addTaskBtn.type = 'button';
    addTaskBtn.onclick = addTask;
    tasks.append(taskBox, addTaskBtn);
    root.append(tools, msg, pic, mode, areas, tasks);
    drawCanvas();
    drawZones();
    drawTasks();
  }

  function updateCounter() {
    counter.textContent = `Областей: ${d.zones.length}/${MAX_ZONES} · Заданий: ${d.tasks.length}/${MAX_TASKS}`;
    addTaskBtn.disabled = d.tasks.length >= MAX_TASKS;
  }

  function modeButtons() {
    const row = el('div', 'hs-seg');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Как отвечает ученик');
    const tips = { zone: 'Ученик нажимает на готовую область картинки.', point: 'Ученик ставит маркер на нужное место.' };
    Object.keys(MODES).forEach(k => {
      const b = el('button', 'hs-segbtn' + (d.interaction === k ? ' on' : ''), MODES[k]);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(d.interaction === k));
      b.title = tips[k];
      b.onclick = () => { d.interaction = k; save(); row.querySelectorAll('.hs-segbtn').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); };
      row.append(b);
    });
    const hint = el('span', 'hs-muted hs-modehint');
    row.append(hint);
    return row;
  }

  // ---- Холст: картинка и области поверх неё ----
  let cv = null, ov = null;
  function drawCanvas() {
    canvasBox.innerHTML = '';
    const bar = el('div', 'hs-bar');
    const t = (id, label, ico) => {
      const b = el('button', 'hs-tool' + (tool === id ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = svg(ico) + `<span>${label}</span>`;
      b.setAttribute('aria-pressed', String(tool === id));
      b.onclick = () => { tool = id; if (id !== 'move') selId = null; drawCanvas(); };
      return b;
    };
    bar.append(
      t('move', 'Выбрать и двигать', '<path d="M5 3l14 8-6 2-2 6z"/>'),
      t('rect', 'Прямоугольник', '<rect x="4" y="6" width="16" height="12" rx="1"/>'),
      t('ellipse', 'Эллипс', '<ellipse cx="12" cy="12" rx="9" ry="6"/>'),
    );
    canvasBox.append(bar);
    if (!hasPic(d.image)) {
      canvasBox.append(el('div', 'hs-empty', 'Сначала загрузите картинку (шаг 1): области рисуют прямо на ней.'));
      cv = ov = null;
      return;
    }
    canvasBox.append(el('p', 'hs-muted hs-hint', tool === 'move' ? 'Нажмите на область, чтобы выбрать её: тяните за середину — двигать, за точки на краях — менять размер.' : 'Зажмите кнопку мыши на картинке и потяните: появится область.'));
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
    paint();
  }

  const NS = 'http://www.w3.org/2000/svg';
  function paint() {
    if (!ov) return;
    ov.innerHTML = '';
    cv.querySelectorAll('.hs-num, .hs-hd').forEach(n => n.remove());
    d.zones.forEach((z, k) => {
      if (!G.valid(z) && !(drag && drag.zone === z)) return;
      const s = document.createElementNS(NS, z.shape === 'ellipse' ? 'ellipse' : 'rect');
      if (z.shape === 'ellipse') { s.setAttribute('cx', z.x + z.w / 2); s.setAttribute('cy', z.y + z.h / 2); s.setAttribute('rx', z.w / 2); s.setAttribute('ry', z.h / 2); }
      else { s.setAttribute('x', z.x); s.setAttribute('y', z.y); s.setAttribute('width', z.w); s.setAttribute('height', z.h); }
      s.setAttribute('class', 'hs-shape' + (z.id === selId ? ' sel' : ''));
      ov.append(s);
      const n = el('span', 'hs-num' + (z.id === selId ? ' sel' : ''), String(k + 1));
      n.style.left = z.x * 100 + '%';
      n.style.top = z.y * 100 + '%';
      cv.append(n);
    });
    const sel = selId && zoneById(selId);
    if (sel && G.valid(sel)) {
      const pts = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
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
    if (h && sel) drag = { kind: 'resize', h, start: p, z0: { ...sel }, zone: sel };
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
      inp.placeholder = 'Название (для себя), например «Дверь»';
      inp.value = z.label;
      inp.setAttribute('aria-label', `Название области ${k + 1}`);
      inp.oninput = () => { z.label = inp.value; save(); drawTasks(); };
      inp.onfocus = () => { if (selId !== z.id) { selId = z.id; paint(); r.parentElement.querySelectorAll('.hs-zrow').forEach(x => x.classList.toggle('sel', x === r)); } };
      const shape = el('span', 'hs-muted hs-shape-name', G.SHAPES[z.shape] || '');
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
    top.append(el('span', 'hs-kind hs-muted', ok > 1 ? 'найти несколько' : ok === 1 ? 'найти одно' : ''));
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

    const tg = el('div', 'hs-targets');
    tg.append(el('p', 'hs-muted hs-hint', d.zones.length ? 'Верные области (нажмите, чтобы отметить):' : 'Сначала нарисуйте области на картинке (шаг 3).'));
    const chips = el('div', 'hs-chips');
    d.zones.forEach((z, j) => {
      const on = t.targets.includes(z.id);
      const c = el('button', 'hs-chip' + (on ? ' on' : ''), zoneName(z, j));
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

    box.append(top, prompt, tg, ex);
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
  // Числа округлены до 4 знаков; interaction — только «point»; пустые поля в файл не попадают. Области без верных
  // ответов остаются (в режиме «Зона» это неверные варианты), неверные по геометрии — нет
  function exportData(draft) {
    return {
      module: 'hotspot', format: 1,
      ...(draft.interaction === 'point' ? { interaction: 'point' } : {}),
      ...(imageOut(draft.image) ? { image: imageOut(draft.image) } : {}),
      zones: draft.zones.filter(G.valid).map(z => ({
        id: z.id,
        ...(clean(z.label) ? { label: clean(z.label) } : {}),
        shape: z.shape, x: G.round(z.x), y: G.round(z.y), w: G.round(z.w), h: G.round(z.h),
      })),
      tasks: draft.tasks.map(t => ({
        id: t.id,
        ...(clean(t.prompt) ? { prompt: clean(t.prompt) } : {}),
        targets: validTargets(draft, t),
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
    if (!draft.zones.length) errors.push('Нет ни одной области на картинке.');
    if (draft.zones.length > MAX_ZONES) errors.push(`Областей больше ${MAX_ZONES}.`);
    draft.zones.forEach((z, k) => {
      if (!G.valid(z)) errors.push(`Область ${k + 1}: неверные размеры или выходит за картинку.`);
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
      if (draft.interaction === 'point') {
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
      return { id, label: String((z && z.label) || '').slice(0, LABEL_LEN), shape: z && G.SHAPES[z.shape] ? z.shape : 'rect', x: num(z && z.x), y: num(z && z.y), w: num(z && z.w), h: num(z && z.h) };
    });
    const tIds = new Set();
    const tasks = file.tasks.slice(0, MAX_TASKS).map(s => {
      let id = String((s && s.id) || '');
      if (!id || tIds.has(id)) id = nextId('t', [...tIds]);
      tIds.add(id);
      const targets = [...new Set((Array.isArray(s && s.targets) ? s.targets : []).map(String))].filter(x => zIds.has(x)).slice(0, MAX_TARGETS);
      return { id, prompt: String((s && s.prompt) || '').slice(0, PROMPT_LEN), targets, explanation: String((s && s.explanation) || '') };
    });
    const im = file.image;
    return { ...create(), interaction: file.interaction === 'point' ? 'point' : 'zone',
      image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: '' },
      zones, tasks };
  }

  return { create, demo, render, load, exportData, validate, unitCount };
})();
