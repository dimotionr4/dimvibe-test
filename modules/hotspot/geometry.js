// Геометрия Hotspot — общая для редактора и плеера. Область (зона) — прямоугольник или эллипс, заданные
// описывающим прямоугольником {x, y, w, h} в долях картинки (0–1): так область не зависит от размера картинки на экране.
const HotspotGeo = (() => {
  const SHAPES = { rect: 'Прямоугольник', ellipse: 'Эллипс' };
  const TOL = 0.006; // допуск попадания точки «на границу» (в долях ширины картинки), одинаковый при любом размере экрана
  const MIN = 0.01; // меньше этого сторона области не бывает
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = v => Math.round(v * 10000) / 10000;

  // Область годится: известная форма, положительные размеры, целиком внутри картинки
  function valid(z) {
    if (!z || !SHAPES[z.shape]) return false;
    const { x, y, w, h } = z;
    if (![x, y, w, h].every(Number.isFinite)) return false;
    return w >= MIN && h >= MIN && x >= -1e-6 && y >= -1e-6 && x + w <= 1 + 1e-6 && y + h <= 1 + 1e-6;
  }

  // Попадает ли точка (px, py) в область; tol расширяет область (по умолчанию — допуск границы)
  function hit(z, px, py, tol) {
    const t = tol == null ? TOL : tol;
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

  // Каждой точке — своя область, и наоборот (не «по количеству»): наибольшее паросочетание, алгоритм Куна.
  // Возвращает для каждой точки номер подошедшей области в zones или -1
  function assign(points, zones) {
    const adj = points.map(p => zones.map((z, j) => (hit(z, p.x, p.y) ? j : -1)).filter(j => j >= 0));
    const owner = zones.map(() => -1);
    const tryPoint = (i, seen) => {
      for (const j of adj[i]) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (owner[j] < 0 || tryPoint(owner[j], seen)) { owner[j] = i; return true; }
      }
      return false;
    };
    points.forEach((_, i) => tryPoint(i, new Set()));
    const res = points.map(() => -1);
    owner.forEach((i, j) => { if (i >= 0) res[i] = j; });
    return res;
  }

  return { SHAPES, TOL, MIN, clamp, round, valid, hit, overlap, assign };
})();
