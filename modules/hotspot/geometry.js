// Геометрия Hotspot — общая для редактора и плеера. Область (зона) — прямоугольник, эллипс или многоугольник.
// Все координаты — в долях картинки (0–1): область не зависит от размера картинки на экране.
// У любой области есть описывающий прямоугольник {x, y, w, h}; у многоугольника он считается по вершинам pts = [[x, y], …] (fit).
const HotspotGeo = (() => {
  const SHAPES = { rect: 'Прямоугольник', ellipse: 'Эллипс', polygon: 'Многоугольник' };
  const TOL = 0.006; // допуск попадания точки «на границу» (в долях ширины картинки), одинаковый при любом размере экрана
  const MIN = 0.01; // меньше этого сторона области не бывает
  const MIN_AREA = 0.0001; // меньше этого (в долях площади картинки) многоугольник — «нулевой»
  const STEP = 1 / 256; // сетка подсчёта совпадения контуров (IoU): одна и та же при любом размере экрана
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = v => Math.round(v * 10000) / 10000;

  function bbox(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x: round(x), y: round(y), w: round(Math.max(...xs) - x), h: round(Math.max(...ys) - y) };
  }
  // Описывающий прямоугольник многоугольника обновляется после любой правки вершин
  function fit(z) {
    if (z.shape === 'polygon' && Array.isArray(z.pts) && z.pts.length) Object.assign(z, bbox(z.pts));
    return z;
  }

  function area(pts) {
    let s = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; });
    return Math.abs(s) / 2;
  }
  const orient = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
  function segCross(a, b, c, d) {
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
  }
  // Пересекает ли замкнутый контур сам себя (соседние стороны касаются в общей вершине — это нормально)
  function selfIntersects(pts) {
    const n = pts.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
    return false;
  }
  // Годится ли контур: не меньше 3 вершин, внутри картинки, ненулевая площадь, без самопересечений
  function polyValid(pts) {
    if (!Array.isArray(pts) || pts.length < 3) return false;
    if (!pts.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -1e-6 && p[0] <= 1 + 1e-6 && p[1] >= -1e-6 && p[1] <= 1 + 1e-6)) return false;
    return area(pts) >= MIN_AREA && !selfIntersects(pts);
  }

  // Область годится: известная форма, положительные размеры, целиком внутри картинки (многоугольник — ещё и простой контур)
  function valid(z) {
    if (!z || !SHAPES[z.shape]) return false;
    if (z.shape === 'polygon' && !polyValid(z.pts)) return false;
    const { x, y, w, h } = z;
    if (![x, y, w, h].every(Number.isFinite)) return false;
    return w >= MIN && h >= MIN && x >= -1e-6 && y >= -1e-6 && x + w <= 1 + 1e-6 && y + h <= 1 + 1e-6;
  }

  function inPoly(pts, px, py) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function distSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    const t = l ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  // Попадает ли точка (px, py) в область; tol расширяет область (по умолчанию — допуск границы)
  function hit(z, px, py, tol) {
    const t = tol == null ? TOL : tol;
    if (z.shape === 'polygon') {
      if (inPoly(z.pts, px, py)) return true;
      return t > 0 && z.pts.some((a, i) => distSeg(px, py, a, z.pts[(i + 1) % z.pts.length]) <= t);
    }
    if (z.shape === 'ellipse') {
      const rx = z.w / 2 + t, ry = z.h / 2 + t;
      const dx = (px - (z.x + z.w / 2)) / rx, dy = (py - (z.y + z.h / 2)) / ry;
      return dx * dx + dy * dy <= 1;
    }
    return px >= z.x - t && px <= z.x + z.w + t && py >= z.y - t && py <= z.y + z.h + t;
  }

  // Пересекаются ли две области: проверяем сетку точек в общей части описывающих прямоугольников
  function overlap(a, b) {
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) return false;
    const N = 40;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const px = x0 + (x1 - x0) * i / N, py = y0 + (y1 - y0) * j / N;
      if (hit(a, px, py, 0) && hit(b, px, py, 0)) return true;
    }
    return false;
  }

  // Совпадение двух областей: площадь пересечения / площадь объединения (IoU), 0–1. Подсчёт по фиксированной сетке 1/256 картинки,
  // центры клеток; результат один и тот же при любом размере экрана
  function iou(a, b) {
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h);
    let inter = 0, uni = 0;
    for (let py = Math.floor(y0 / STEP) * STEP + STEP / 2; py < y1; py += STEP) {
      for (let px = Math.floor(x0 / STEP) * STEP + STEP / 2; px < x1; px += STEP) {
        const ia = hit(a, px, py, 0), ib = hit(b, px, py, 0);
        if (ia && ib) inter++;
        if (ia || ib) uni++;
      }
    }
    return uni ? inter / uni : 0;
  }

  // Каждой точке — своя область, и наоборот (не «по количеству»): наибольшее паросочетание, алгоритм Куна.
  // edges[i] — номера областей, подходящих i-му ответу; возвращает для каждого ответа номер области или -1
  function match(edges, zoneCount) {
    const owner = Array(zoneCount).fill(-1);
    const tryItem = (i, seen) => {
      for (const j of edges[i]) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (owner[j] < 0 || tryItem(owner[j], seen)) { owner[j] = i; return true; }
      }
      return false;
    };
    edges.forEach((_, i) => tryItem(i, new Set()));
    const res = edges.map(() => -1);
    owner.forEach((i, j) => { if (i >= 0) res[i] = j; });
    return res;
  }
  function assign(points, zones) {
    return match(points.map(p => zones.map((z, j) => (hit(z, p.x, p.y) ? j : -1)).filter(j => j >= 0)), zones.length);
  }
  // Контуры ученика против областей: совпадение не меньше порога thr (доля 0–1). Для каждого контура — {j: номер области или -1, iou}
  // (у неподошедшего контура iou — лучшее совпадение среди областей, для показа в итоге)
  function assignOutline(contours, zones, thr) {
    const m = contours.map(c => zones.map(z => iou(c, z)));
    const at = match(m.map(row => row.map((v, j) => (v >= thr ? j : -1)).filter(j => j >= 0)), zones.length);
    return at.map((j, i) => ({ j, iou: j >= 0 ? m[i][j] : Math.max(0, ...m[i]) }));
  }

  return { SHAPES, TOL, MIN, clamp, round, bbox, fit, area, selfIntersects, polyValid, valid, hit, overlap, iou, assign, assignOutline, distSeg };
})();
