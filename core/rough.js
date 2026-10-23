// «Нарисованный от руки» контур для стиля Comic. Для каждого элемента строится плавная кривая с лёгкой неровностью
// и кладётся внутрь него обычным SVG-рисунком под содержимым (стили — core/comic.css). Кривая векторная, поэтому
// края гладкие при любом масштабе. Цвета и толщину задаёт CSS, а не этот файл.
// Форма контура зависит только от «ключа» элемента (какой это пропуск, какое слово), а не от порядка перерисовок,
// поэтому при нажатиях контуры не меняются. Номер версии `?v=` у подключения поднимайте при изменении.
(() => {
  const SELECTOR = '.gap, .chip, .card, .instr, .panel, button:not(.hintbtn):not(.instr-head)';
  const INSET = 2.5, STEP = 14, WOBBLE = 1.1, NS = 'http://www.w3.org/2000/svg';

  // Воспроизводимые «случайные» числа
  const rng = seed => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  // Ключ элемента: у пропуска его номер, у слова — само слово, у остальных — вид и порядковый номер среди таких же
  function keyOf(el) {
    if (el.dataset.idx !== undefined) return 'gap' + el.dataset.idx;
    if (el.classList.contains('gap')) return 'gap' + el.textContent; // образец в редакторе без номера
    if (el.classList.contains('chip')) return 'chip' + el.textContent;
    if (el.classList.contains('panel')) return 'panel';
    const kind = el.classList.contains('card') ? 'card' : el.classList.contains('instr') ? 'instr' : 'btn';
    return kind + [...document.querySelectorAll(kind === 'btn' ? 'button' : '.' + kind)].indexOf(el) + (el.id || '');
  }

  // Точки по контуру скруглённого прямоугольника (по часовой стрелке) с радиусами углов [лв, пв, пн, лн]
  function outline(w, h, radii) {
    const x0 = INSET, y0 = INSET, x1 = w - INSET, y1 = h - INSET, pts = [];
    const [tl, tr, br, bl] = radii.map(r => Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2)));
    const edge = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / STEP));
      for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]);
    };
    const arc = (cx, cy, r, a0, a1) => {
      if (!r) return;
      const n = Math.max(3, Math.round(Math.abs(a1 - a0) * r / (STEP / 2)));
      for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    };
    edge(x0 + tl, y0, x1 - tr, y0); arc(x1 - tr, y0 + tr, tr, -Math.PI / 2, 0);
    edge(x1, y0 + tr, x1, y1 - br); arc(x1 - br, y1 - br, br, 0, Math.PI / 2);
    edge(x1 - br, y1, x0 + bl, y1); arc(x0 + bl, y1 - bl, bl, Math.PI / 2, Math.PI);
    edge(x0, y1 - bl, x0, y0 + tl); arc(x0 + tl, y0 + tl, tl, Math.PI, Math.PI * 1.5);
    return pts;
  }

  // Плавные волны вместо случайных скачков: сумма двух синусоид со случайными фазами
  function wobble(pts, rand) {
    const p = [0, 1, 2, 3].map(() => rand() * 6.28), f = 0.7 + rand() * 0.5;
    return pts.map(([x, y], i) => [
      x + WOBBLE * (Math.sin(i * f + p[0]) + 0.5 * Math.sin(i * f * 2.3 + p[1])),
      y + WOBBLE * (Math.sin(i * f + p[2]) + 0.5 * Math.sin(i * f * 2.1 + p[3])),
    ]);
  }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f2 = n => Math.round(n * 100) / 100;
  const pt = p => `${f2(p[0])} ${f2(p[1])}`;

  // Замкнутая гладкая кривая через середины отрезков (квадратичные кривые)
  function closedPath(pts) {
    const n = pts.length;
    let d = `M${pt(mid(pts[n - 1], pts[0]))}`;
    for (let i = 0; i < n; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[(i + 1) % n]))}`;
    return d + 'Z';
  }

  // Открытая линия (для формы «Линия»): слегка волнистая
  function openLine(w, h, rand) {
    const y = h - INSET - 0.5, n = Math.max(2, Math.round((w - 2 * INSET) / STEP));
    const raw = [];
    for (let i = 0; i <= n; i++) raw.push([INSET + (w - 2 * INSET) * i / n, y]);
    const pts = wobble(raw, rand);
    let d = `M${pt(pts[0])}`;
    for (let i = 1; i < pts.length - 1; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[i + 1]))}`;
    return d + `L${pt(pts[pts.length - 1])}`;
  }

  // Какой формы контур нужен элементу
  function shapeOf(el, h) {
    if (el.classList.contains('gap')) {
      if (el.classList.contains('shape-frame')) return { radii: [8, 8, 8, 8] };
      if (el.classList.contains('shape-pill')) return { radii: [h / 2, h / 2, h / 2, h / 2] };
      if (el.classList.contains('shape-free')) return { radii: [16, 6, 13, 5] };
      return { line: true };
    }
    if (el.classList.contains('chip')) return { radii: [h / 2, h / 2, h / 2, h / 2] };
    if (el.classList.contains('panel')) return { radii: [18, 18, 18, 18] };
    if (el.classList.contains('card') || el.classList.contains('instr')) return { radii: [14, 14, 14, 14] };
    return { radii: [10, 10, 10, 10] };
  }

  function paint(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const old = [...el.children].find(c => c.classList && c.classList.contains('rough'));
    if (old) old.remove();
    const rand = rng(hash(keyOf(el)));
    const shape = shapeOf(el, h);
    const d = shape.line ? openLine(w, h, rand) : closedPath(wobble(outline(w, h, shape.radii), rand));
    // Прерывистые линии: пропуск с классом dashed или «не заполнен»
    const dashed = el.classList.contains('gap') && (el.classList.contains('dashed') || el.classList.contains('missing'));
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'rough');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (!shape.line) { // заливка по той же кривой (у линии заливки нет)
      const fill = document.createElementNS(NS, 'path');
      fill.setAttribute('class', 'rough-fill');
      fill.setAttribute('d', d);
      svg.appendChild(fill);
    }
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('class', 'rough-line');
    line.setAttribute('d', d);
    if (dashed) line.setAttribute('stroke-dasharray', '9 7');
    svg.appendChild(line);
    el.appendChild(svg);
  }

  // Следим за размером: контур перерисовывается, когда элемент меняет размер (сворачивание инструкции, перенос строки, поворот экрана)
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => entries.forEach(e => paint(e.target))) : null;

  // Вызывается после каждой перерисовки страницы; в стиле Classic ничего не делает
  // Без аргумента — вся страница (стиль включён на <html>); с аргументом — только образец внутри элемента со стилем (редактор)
  window.roughen = function (root) {
    const comic = root ? root.closest('.style-comic') : document.documentElement.classList.contains('style-comic');
    if (!comic) return;
    (root || document).querySelectorAll(SELECTOR).forEach(el => {
      paint(el);
      if (observer) observer.observe(el);
    });
  };
})();
