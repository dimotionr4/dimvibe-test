// Плеер модуля Word Search: ученик находит слова из списка в сетке букв — проводит пальцем или мышью по слову
// либо нажимает на его первую и последнюю букву (Tap–Tap). Клавиатуру не поддерживаем (решение владельца 2026-10-24).
// Общая часть прохождения — шапка, инструкция, результат, сброс — живёт в index.html.
// Каждое слово — единица общего хода (unit): найденное закрепляется (locked, state 'ok'), 1 балл. Проверок нет:
// неверное выделение просто сбрасывается без штрафа. Слово засчитывается, только если выделены именно его клетки
// (с любого конца), а не любые клетки с теми же буквами.
const WordSearchPlayer = (() => {
  const COLORS = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#e03131', '#c28a00', '#0c8599', '#c2255c'];
  const SVGNS = 'http://www.w3.org/2000/svg';
  let words = [], cells = [], size = 0;
  let found = [];      // ID найденных слов в порядке нахождения
  let anchor = null;   // первая нажатая клетка [строка, столбец], пока ждём вторую (Tap–Tap)
  let msg = '', msgEl = null, selG = null, gridEl = null;

  const instant = () => true;

  function units() {
    words = (Array.isArray(data.words) ? data.words : []).filter(w => w && w.id && Array.isArray(w.at) && Array.isArray(w.dir) && w.len >= 1);
    cells = Array.isArray(data.cells) ? data.cells : [];
    size = cells.length;
    return words.map(w => ({
      id: w.id, answer: String(w.text || ''), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  function reset() {
    found = [];
    anchor = null;
    msg = '';
  }

  const status = () => (finished ? null : `Найдено: ${found.length} из ${words.length}`);
  const started = () => found.length > 0;
  const goMissing = () => {};
  const missingNote = () => '';
  const check = () => ({ note: 'Проверять ничего не нужно: найденные слова засчитываются сразу.' });

  const endOf = w => [w.at[0] + w.dir[0] * (w.len - 1), w.at[1] + w.dir[1] * (w.len - 1)];
  const colorOf = id => COLORS[Math.max(0, words.findIndex(w => w.id === id)) % COLORS.length];

  // Клетки по прямой от a до b (вертикаль, горизонталь или диагональ 45°) или null
  function run(a, b) {
    const dr = b[0] - a[0], dc = b[1] - a[1];
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    const n = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc);
    return Array.from({ length: n + 1 }, (_, k) => [a[0] + sr * k, a[1] + sc * k]);
  }

  // Выделены клетки от a до b: ищем слово, которое лежит ровно на них (с любого конца)
  function evaluate(a, b) {
    const same = (p, q) => p[0] === q[0] && p[1] === q[1];
    const w = words.find(x => { const e = endOf(x); return (same(x.at, a) && same(e, b)) || (same(x.at, b) && same(e, a)); });
    if (!w) { msg = 'Здесь нет слова из списка. Попробуйте ещё раз.'; return; }
    if (found.includes(w.id)) { msg = `Слово «${w.text}» уже найдено.`; return; }
    found.push(w.id);
    const g = gaps.find(x => x.id === w.id);
    if (g) { g.locked = true; g.state = 'ok'; g.final = true; }
    msg = '';
    if (found.length >= words.length) finished = true;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function line(r0, c0, r1, c1, color, cls) {
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', c0 + 0.5); l.setAttribute('y1', r0 + 0.5);
    l.setAttribute('x2', c1 + 0.5); l.setAttribute('y2', r1 + 0.5);
    l.setAttribute('class', cls);
    if (color) l.style.stroke = color;
    return l;
  }

  function setMsg(t) {
    msg = t;
    if (msgEl) msgEl.textContent = t;
  }
  function paintAnchor() {
    if (!gridEl) return;
    gridEl.querySelectorAll('.ws-c.anchor').forEach(c => c.classList.remove('anchor'));
    if (anchor) { const c = gridEl.children[anchor[0] * size + anchor[1]]; if (c) c.classList.add('anchor'); }
  }
  function paintSel(from, to) {
    if (!selG) return;
    selG.innerHTML = '';
    if (from) selG.append(line(from[0], from[1], to[0], to[1], '', 'ws-sel'));
  }

  // Ограничение: все клетки выделения внутри сетки. Конец подбирается по направлению пальца с шагом 45°
  function snap(start, fx, fy) {
    const vx = fx - (start[1] + 0.5), vy = fy - (start[0] + 0.5);
    if (Math.hypot(vx, vy) < 0.55) return start;
    const sector = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    const DIR = { 0: [0, 1], 1: [1, 1], 2: [1, 0], 3: [1, -1], 4: [0, -1], '-4': [0, -1], '-3': [-1, -1], '-2': [-1, 0], '-1': [-1, 1] };
    const [dr, dc] = DIR[sector];
    let steps = Math.round((vx * dc + vy * dr) / (dr * dr + dc * dc));
    const inside = k => { const r = start[0] + dr * k, c = start[1] + dc * k; return r >= 0 && r < size && c >= 0 && c < size; };
    while (steps > 0 && !inside(steps)) steps--;
    return steps > 0 ? [start[0] + dr * steps, start[1] + dc * steps] : start;
  }

  function attach(grid) {
    let drag = null;
    const pos = e => {
      const rc = grid.getBoundingClientRect();
      const fx = (e.clientX - rc.left) / rc.width * size, fy = (e.clientY - rc.top) / rc.height * size;
      const cl = v => Math.min(size - 1, Math.max(0, Math.floor(v)));
      return { fx, fy, cell: [cl(fy), cl(fx)] };
    };
    grid.addEventListener('pointerdown', e => {
      if (finished || drag || (e.pointerType === 'mouse' && e.button !== 0)) return; // второй палец и правая кнопка не в счёт
      const p = pos(e);
      drag = { id: e.pointerId, start: p.cell, end: p.cell };
      try { grid.setPointerCapture(e.pointerId); } catch (_) { /* не критично */ }
      setMsg('');
      e.preventDefault();
    });
    grid.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = pos(e);
      drag.end = snap(drag.start, p.fx, p.fy);
      if (drag.end !== drag.start) paintSel(drag.start, drag.end); else paintSel(null);
    });
    const done = (e, ok) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { start, end } = drag;
      drag = null;
      paintSel(null);
      if (!ok) return; // жест прерван (отмена, смена окна): ничего не засчитываем
      if (end !== start) { anchor = null; evaluate(start, end); render(); return; }
      // Нажатие без движения: первая или вторая буква слова
      if (!anchor) { anchor = start; paintAnchor(); return; }
      if (anchor[0] === start[0] && anchor[1] === start[1]) { anchor = null; paintAnchor(); return; }
      const a = anchor;
      anchor = null;
      if (run(a, start)) { evaluate(a, start); render(); return; }
      anchor = start; // клетки не на одной прямой: новая первая буква
      setMsg('Эти клетки не лежат на одной прямой. Выберите первую букву слова ещё раз.');
      paintAnchor();
    };
    grid.addEventListener('pointerup', e => done(e, true));
    grid.addEventListener('pointercancel', e => done(e, false));
    grid.addEventListener('lostpointercapture', e => done(e, false));
  }

  function renderInto(root) {
    const card = el('div', 'card ws-card');
    if (!size || !words.length) { card.append(el('p', '', 'В упражнении нет сетки.')); root.append(card); return; }
    const layout = el('div', 'ws-layout');
    const board = el('div', 'ws-board');
    board.style.setProperty('--n', size);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'ws-lines');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('aria-hidden', 'true');
    found.forEach(id => {
      const w = words.find(x => x.id === id);
      if (!w) return;
      const e = endOf(w);
      svg.append(line(w.at[0], w.at[1], e[0], e[1], colorOf(id), 'ws-found'));
    });
    selG = document.createElementNS(SVGNS, 'g');
    svg.append(selG);
    gridEl = el('div', 'ws-grid' + (finished ? ' over' : ''));
    gridEl.setAttribute('role', 'group');
    gridEl.setAttribute('aria-label', 'Сетка букв');
    cells.forEach(row => row.forEach(t => gridEl.append(el('span', 'ws-c', t))));
    if (!finished) attach(gridEl);
    board.append(svg, gridEl);
    const list = el('ul', 'ws-list');
    list.setAttribute('aria-label', 'Слова для поиска');
    words.forEach(w => {
      const ok = found.includes(w.id);
      const li = el('li', 'ws-word' + (ok ? ' found' : ''));
      const dot = el('span', 'ws-dot', ok ? '✓' : '');
      if (ok) dot.style.background = colorOf(w.id);
      li.append(dot, el('span', 'ws-wt', w.text));
      if (ok) li.setAttribute('aria-label', `${w.text}, найдено`);
      list.append(li);
    });
    layout.append(board, list);
    msgEl = el('p', 'ws-msg', msg);
    msgEl.setAttribute('aria-live', 'polite');
    card.append(layout, msgEl);
    root.append(card);
    paintAnchor();
  }

  return { units, reset, check, status, started, instant, goMissing, missingNote, render: renderInto };
})();
