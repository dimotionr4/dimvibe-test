// Плеер модуля Hotspot: ученик находит места на картинке — нажимает на готовую область («Зона») или ставит маркер («Точка»).
// Общая часть прохождения — шапка, инструкция, проверка, число проверок, результат, сброс — живёт в index.html.
// Единица общего хода (unit) — одна верная область одного задания: число единиц = число баллов, от него считаются 3 или 5 проверок.
// Проверка своя (check): неполный ответ проверку не тратит; верные отметки закрепляются, неверные можно убрать и поставить заново.
// «Найти несколько»: каждая неверная отметка, оставшаяся в конце, отнимает 1 балл, но не ниже нуля (решение владельца в архиве, HS-04 C).
const HotspotPlayer = (() => {
  const G = HotspotGeo;
  const NS = 'http://www.w3.org/2000/svg';
  let idx = 0; // какое задание показано
  let marks = {}; // ID задания → отметки ученика: {zone | x, y, locked, state}
  let missing = new Set(); // задания, где не хватает отметок (после попытки проверки)
  let imgFailed = false; // картинка не загрузилась: без неё не проверяем

  const zones = () => (data.zones || []).filter(G.valid);
  const zoneOf = id => zones().find(z => z.id === id);
  const tasks = () => (data.tasks || []).filter(t => targetsOf(t).length);
  const targetsOf = t => (t.targets || []).filter(id => zoneOf(id));
  const unitId = (t, zid) => t.id + ':' + zid;
  const unitOf = (t, zid) => gaps.find(g => g.id === unitId(t, zid));
  const pointMode = () => data.interaction === 'point';
  const marksOf = t => marks[t.id] || (marks[t.id] = []);
  const free = t => marksOf(t).filter(m => !m.locked); // ещё не закреплённые отметки
  const left = t => targetsOf(t).filter(zid => !unitOf(t, zid).locked); // ещё не найденные области
  const done = t => !left(t).length;

  function units() {
    return tasks().flatMap(t => targetsOf(t).map(zid => ({
      id: unitId(t, zid), answer: '', alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    marks = {};
    missing = new Set();
    idx = 0;
    imgFailed = false;
  }

  const started = () => Object.values(marks).some(a => a.length);

  // Правка отметок снимает «не хватает» и сообщение
  function edit() { missing.clear(); note = ''; render(); }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Нажатие на область («Зона»): повторное нажатие снимает отметку; в «найти одно» новая область заменяет прежнюю;
  // в «найти несколько» отметок не больше, чем верных областей (лишнюю надо сначала убрать)
  function pickZone(t, zid) {
    if (finished) return;
    const mine = marksOf(t), cur = mine.find(m => m.zone === zid);
    if (cur) { if (!cur.locked) { mine.splice(mine.indexOf(cur), 1); edit(); } return; }
    const n = targetsOf(t).length;
    if (n === 1) marks[t.id] = mine.filter(m => m.locked);
    else if (mine.length >= n) { note = 'Уберите лишнюю отметку, чтобы выбрать другую область.'; render(); return; }
    marksOf(t).push({ zone: zid, locked: false, state: null });
    edit();
  }

  // Нажатие на картинку («Точка»): в «найти одно» маркер переставляется; в «найти несколько» маркеров не больше, чем верных областей
  function placePoint(t, x, y) {
    if (finished) return;
    const mine = marksOf(t), n = targetsOf(t).length;
    if (n === 1) marks[t.id] = mine.filter(m => m.locked);
    else if (mine.length >= n) { note = 'Все маркеры поставлены: нажмите на маркер, чтобы убрать его.'; render(); return; }
    marksOf(t).push({ x, y, locked: false, state: null });
    edit();
  }
  function removeMark(t, m) {
    if (finished || m.locked) return;
    const mine = marksOf(t);
    mine.splice(mine.indexOf(m), 1);
    edit();
  }

  // ---- Проверка ----
  function check() {
    if (imgFailed) return { note: 'Картинка не загрузилась, проверить сейчас нельзя. Обновите страницу.' };
    const need = [];
    tasks().forEach((t, k) => { const n = left(t).length; if (n && free(t).length < n) need.push({ k, n: n - free(t).length }); });
    if (need.length) {
      missing = new Set(need.map(x => tasks()[x.k].id));
      idx = need[0].k;
      const sum = need.reduce((s, x) => s + x.n, 0);
      return { note: pointMode()
        ? (sum === 1 ? 'Поставьте ещё один маркер, потом нажмите «Проверить».' : `Поставьте маркеры: ещё ${sum}.`)
        : (sum === 1 ? 'Выберите ещё одну область, потом нажмите «Проверить».' : `Выберите области: ещё ${sum}.`) };
    }
    missing.clear();
    tasks().forEach(t => {
      const rest = left(t).map(zoneOf), cand = free(t);
      if (!rest.length) return;
      if (pointMode()) {
        const at = G.assign(cand, rest);
        cand.forEach((m, i) => {
          if (at[i] >= 0) { m.locked = true; m.state = null; m.zone = rest[at[i]].id; unitOf(t, m.zone).locked = true; } else m.state = 'bad';
        });
      } else {
        cand.forEach(m => {
          if (rest.some(z => z.id === m.zone)) { m.locked = true; m.state = null; unitOf(t, m.zone).locked = true; } else m.state = 'bad';
        });
      }
    });
    return { done: gaps.every(g => g.locked) };
  }

  // Баллы: найденные области; в «найти несколько» минус неверные отметки, оставшиеся в конце (не ниже нуля)
  function score() {
    let got = 0, total = 0, wrong = 0;
    tasks().forEach(t => {
      const n = targetsOf(t).length, ok = n - left(t).length, fp = free(t).length;
      total += n;
      got += n > 1 && finished ? Math.max(0, ok - fp) : ok;
      wrong += free(t).filter(m => m.state === 'bad').length;
    });
    return { got, total, wrong, placed: Object.values(marks).reduce((s, a) => s + a.length, 0) };
  }
  function status() {
    const s = score();
    if (finished) return `Результат: ${s.got} из ${s.total} (${s.total ? Math.round(s.got / s.total * 100) : 0}%)`;
    if (checksUsed === 0) return `Отмечено: ${s.placed} из ${s.total}`;
    return `Верно: ${gaps.filter(g => g.locked).length} из ${s.total} · Неверно: ${s.wrong} · Проверок осталось: ${maxChecks - checksUsed}`;
  }
  const percent = () => { const s = score(); return s.total ? Math.round(s.got / s.total * 100) : 0; };

  // ---- Рисование ----
  function shape(z, cls) {
    const s = document.createElementNS(NS, z.shape === 'ellipse' ? 'ellipse' : 'rect');
    if (z.shape === 'ellipse') { s.setAttribute('cx', z.x + z.w / 2); s.setAttribute('cy', z.y + z.h / 2); s.setAttribute('rx', z.w / 2); s.setAttribute('ry', z.h / 2); }
    else { s.setAttribute('x', z.x); s.setAttribute('y', z.y); s.setAttribute('width', z.w); s.setAttribute('height', z.h); }
    s.setAttribute('class', 'hs-zone ' + cls);
    return s;
  }
  const at = (e, x, y) => { e.style.left = x * 100 + '%'; e.style.top = y * 100 + '%'; return e; };
  const center = z => [z.x + z.w / 2, z.y + z.h / 2];

  function stage(t) {
    const wrap = el('div', 'hs-stagewrap');
    const st = el('div', 'hs-stage' + (pointMode() ? ' point' : ' zone') + (finished ? ' fixed' : ''));
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { imgFailed = true; st.classList.add('broken'); wrap.append(el('p', 'hs-fail', 'Картинка не загрузилась.')); };
    img.onload = () => { imgFailed = false; };
    img.src = mediaSrc(data.image) || '';
    const ov = document.createElementNS(NS, 'svg');
    ov.setAttribute('class', 'hs-ov');
    ov.setAttribute('viewBox', '0 0 1 1');
    ov.setAttribute('preserveAspectRatio', 'none');
    st.append(img, ov);
    const mine = marksOf(t), tg = targetsOf(t);
    const badges = [];
    if (!pointMode()) {
      // «Зона»: видны все области (выбирают нажатием); выбранная, верная и неверная окрашены и помечены ✓ / ✗ — не только цветом
      zones().forEach(z => {
        const m = mine.find(x => x.zone === z.id);
        const cls = m ? (m.locked ? 'ok' : m.state === 'bad' ? 'bad' : 'on') : finished && tg.includes(z.id) ? 'right' : '';
        const s = shape(z, cls);
        if (!finished && !(m && m.locked)) s.onclick = () => pickZone(t, z.id);
        ov.append(s);
        if (m) badges.push([z, m.locked ? '✓' : m.state === 'bad' ? '✗' : '', m.locked ? 'ok' : m.state === 'bad' ? 'bad' : 'on']);
        else if (finished && tg.includes(z.id)) badges.push([z, '✓', 'right']);
      });
    } else {
      // «Точка»: области скрыты; в конце неотгаданные показываются пунктиром
      if (finished) tg.forEach(zid => { const z = zoneOf(zid); if (!unitOf(t, zid).locked) { ov.append(shape(z, 'right')); badges.push([z, '✓', 'right']); } });
      st.onclick = e => {
        if (finished || e.target.closest('.hs-mark')) return;
        const r = st.getBoundingClientRect();
        placePoint(t, G.round(G.clamp((e.clientX - r.left) / r.width, 0, 1)), G.round(G.clamp((e.clientY - r.top) / r.height, 0, 1)));
      };
    }
    badges.forEach(([z, sign, cls]) => {
      const [cx, cy] = center(z);
      if (sign) st.append(at(el('span', 'hs-badge ' + cls, sign), cx, cy));
      if (finished && clean(z.label)) st.append(at(el('span', 'hs-lbl', clean(z.label)), z.x, z.y + z.h));
    });
    if (pointMode()) {
      mine.forEach((m, i) => {
        const b = el('button', 'hs-mark' + (m.locked ? ' ok' : m.state === 'bad' ? ' bad' : ''), m.locked ? '✓' : m.state === 'bad' ? '✗' : String(i + 1));
        b.type = 'button';
        b.setAttribute('aria-label', `Маркер ${i + 1}` + (m.locked ? ', верно' : m.state === 'bad' ? ', неверно' : '') + (m.locked || finished ? '' : ', нажмите, чтобы убрать'));
        if (m.locked || finished) b.disabled = true;
        else b.onclick = () => removeMark(t, m);
        st.append(at(b, m.x, m.y));
      });
    }
    wrap.append(st);
    return wrap;
  }

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  function card(k) {
    const t = tasks()[k], n = targetsOf(t).length;
    const c = el('div', 'card hs-card' + (missing.has(t.id) ? ' missing' : ''));
    c.dataset.t = t.id;
    const prompt = clean(t.prompt);
    const dflt = pointMode()
      ? (n === 1 ? 'Поставьте маркер на нужное место.' : `Поставьте маркеры на нужные места: ${n}.`)
      : (n === 1 ? 'Нажмите на нужную область картинки.' : `Нажмите на нужные области картинки: ${n}.`);
    c.append(el('p', 'hs-ask' + (prompt ? ' hs-own' : ''), prompt || dflt));
    if (n > 1) c.append(el('p', 'hs-count', `Отмечено: ${marksOf(t).length} из ${n}`));
    c.append(stage(t));
    const ex = String(t.explanation || '').trim();
    if (ex && (done(t) || finished)) c.append(el('p', 'hs-expl', ex));
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Задания');
    tasks().forEach((t, i) => {
      const bad = free(t).some(m => m.state === 'bad');
      const st = done(t) ? ' ok' : bad ? ' bad' : missing.has(t.id) ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (marksOf(t).length ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Задание ${i + 1}` + (i === idx ? ', текущее' : '') + (done(t) ? ', верно' : bad ? ', есть неверные отметки' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущее'), next = el('button', '', 'Следующее ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= tasks().length - 1;
    prev.onclick = () => { idx--; render(); };
    next.onclick = () => { idx++; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${tasks().length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= tasks().length) idx = Math.max(0, tasks().length - 1);
    const many = tasks().length > 1;
    if (many) nav(root);
    if (tasks().length) root.append(card(idx));
    if (many) pager(root);
  }

  const goMissing = () => {};
  const missingNote = () => '';
  const instant = () => false;

  return { units, reset, check, status, percent, started, goMissing, missingNote, instant, render: renderInto };
})();
