// Плеер модуля Hotspot: ученик находит места на картинке — нажимает на готовую область («Зона») или ставит маркер («Точка»).
// Общая часть прохождения — шапка, инструкция, проверка, результат, сброс — живёт в index.html.
// Единица общего хода (unit) — одна верная область одного задания: число единиц = число баллов.
// Проверка своя (check). Два вида заданий:
//  • обычное («найти одно / несколько»): общие проверки (3 при 1–5 областях, 5 при 6+, автор выбирает 1–5); неполный ответ проверку не тратит;
//    верные отметки закрепляются, неверные можно убрать; в «найти несколько» каждая неверная отметка, оставшаяся в конце, отнимает 1 балл (не ниже нуля);
//  • «по порядку» (task.ordered): области ищутся по одной в порядке автора, у каждого шага свои проверки (по умолчанию 3, не из общих);
//    верно — шаг закреплён, проверки кончились — верное место показано, за шаг 0, дальше. Штрафа нет.
// Счёт проверок общего хода (checksUsed, maxChecks) модуль не использует: maxChecks() отдаёт большое число, конец прохождения решает check().
const HotspotPlayer = (() => {
  const G = HotspotGeo;
  const NS = 'http://www.w3.org/2000/svg';
  let idx = 0; // какое задание показано
  let marks = {}; // ID задания → отметки ученика: {zone | x, y, locked, state}
  let steps = {}; // ID задания «по порядку» → {used, missed: Set, banner}
  let missing = new Set(); // обычные задания, где не хватает отметок (после попытки проверки)
  let freeUsed = 0; // потрачено общих проверок (обычные задания)
  let imgFailed = false; // картинка не загрузилась: без неё не проверяем

  const zones = () => (data.zones || []).filter(G.valid);
  const zoneOf = id => zones().find(z => z.id === id);
  const targetsOf = t => (t.targets || []).filter(id => zoneOf(id));
  const tasks = () => (data.tasks || []).filter(t => targetsOf(t).length);
  const isOrdered = t => t.ordered === true && targetsOf(t).length > 1;
  const freeTasks = () => tasks().filter(t => !isOrdered(t));
  const unitId = (t, zid) => t.id + ':' + zid;
  const unitOf = (t, zid) => gaps.find(g => g.id === unitId(t, zid));
  const pointMode = () => data.interaction === 'point';
  const marksOf = t => marks[t.id] || (marks[t.id] = []);
  const free = t => marksOf(t).filter(m => !m.locked); // ещё не закреплённые отметки
  const left = t => targetsOf(t).filter(zid => !unitOf(t, zid).locked); // ещё не найденные области
  const stOf = t => steps[t.id] || (steps[t.id] = { used: 0, missed: new Set(), banner: null });
  const resolved = (t, zid) => unitOf(t, zid).locked || stOf(t).missed.has(zid);
  const curTarget = t => targetsOf(t).find(zid => !resolved(t, zid)) || null; // текущий шаг «по порядку»
  const done = t => (isOrdered(t) ? !curTarget(t) : !left(t).length);
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  // Число проверок: выбрал автор (1–5) — оно же на каждый шаг «по порядку»; иначе 3 на шаг и 3 / 5 на общий счёт
  const set = () => { const n = Number(data.behavior && data.behavior.checks); return n >= 1 && n <= 5 ? Math.floor(n) : 0; };
  const stepBudget = () => set() || 3;
  const freeUnits = () => freeTasks().reduce((n, t) => n + targetsOf(t).length, 0);
  const freeMax = () => set() || (freeUnits() <= 5 ? 3 : 5);
  const freeDone = () => freeTasks().every(done);
  const freeOver = () => freeTasks().length > 0 && freeUsed >= freeMax() && !freeDone(); // общие проверки кончились
  const allResolved = () => tasks().filter(isOrdered).every(t => !curTarget(t)) && (freeDone() || freeOver());
  // Задание больше нельзя править: конец, кончились общие проверки или пройден последний шаг
  const frozen = t => finished || (isOrdered(t) ? !curTarget(t) : freeOver() || !left(t).length);

  function units() {
    return tasks().flatMap(t => targetsOf(t).map(zid => ({
      id: unitId(t, zid), answer: '', alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    marks = {};
    steps = {};
    missing = new Set();
    freeUsed = 0;
    idx = 0;
    imgFailed = false;
  }

  const started = () => Object.values(marks).some(a => a.length);
  const maxChecks = () => 999;

  // Правка отметок снимает «не хватает», сообщение и подсказку шага
  function edit(t) { missing.clear(); note = ''; if (t && isOrdered(t)) stOf(t).banner = null; render(); }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Сколько отметок можно держать: «найти несколько» — по числу верных областей; «найти одно» и шаг «по порядку» — одну (новая заменяет прежнюю)
  const cap = t => (isOrdered(t) ? 1 : targetsOf(t).length);

  // Нажатие на область («Зона»): повторное нажатие снимает отметку
  function pickZone(t, zid) {
    if (frozen(t)) return;
    const mine = marksOf(t), cur = mine.find(m => m.zone === zid);
    if (cur) { if (!cur.locked) { mine.splice(mine.indexOf(cur), 1); edit(t); } return; }
    if (cap(t) === 1) marks[t.id] = mine.filter(m => m.locked);
    else if (mine.length >= cap(t)) { note = 'Уберите лишнюю отметку, чтобы выбрать другую область.'; render(); return; }
    marksOf(t).push({ zone: zid, locked: false, state: null });
    edit(t);
  }

  // Нажатие на картинку («Точка»): маркер ставится; в «найти несколько» маркеров не больше, чем верных областей
  function placePoint(t, x, y) {
    if (frozen(t)) return;
    const mine = marksOf(t);
    if (cap(t) === 1) marks[t.id] = mine.filter(m => m.locked);
    else if (mine.length >= cap(t)) { note = 'Все маркеры поставлены: нажмите на маркер, чтобы убрать его.'; render(); return; }
    marksOf(t).push({ x, y, locked: false, state: null });
    edit(t);
  }
  function removeMark(t, m) {
    if (frozen(t) || m.locked) return;
    const mine = marksOf(t);
    mine.splice(mine.indexOf(m), 1);
    edit(t);
  }

  // ---- Проверка ----
  function check() {
    if (imgFailed) return { note: 'Картинка не загрузилась, проверить сейчас нельзя. Обновите страницу.' };
    const t = tasks()[idx];
    if (t && isOrdered(t)) return checkStep(t);
    if (!t || frozen(t)) return { note: 'В этом задании проверки закончились. Перейдите к другому заданию.' };
    return checkFree();
  }

  // Шаг «по порядку»: одна отметка проверяется на текущую область; верно — шаг закреплён, кончились проверки шага — место показано
  function checkStep(t) {
    const zid = curTarget(t);
    if (!zid) return { note: 'Все шаги этого задания пройдены. Перейдите к другому заданию.' };
    const cand = free(t);
    if (!cand.length) return { note: pointMode() ? 'Поставьте маркер, потом нажмите «Проверить».' : 'Выберите область, потом нажмите «Проверить».' };
    const s = stOf(t), m = cand[0], z = zoneOf(zid), i = targetsOf(t).indexOf(zid) + 1;
    const ok = pointMode() ? G.hit(z, m.x, m.y) : m.zone === zid;
    s.used++;
    if (ok) {
      m.locked = true; m.state = null; m.zone = zid;
      unitOf(t, zid).locked = true;
      s.banner = { kind: 'ok', i };
      s.used = 0;
    } else if (s.used >= stepBudget()) {
      marks[t.id] = marksOf(t).filter(x => x !== m); // неверная отметка убирается, верное место показывается
      s.missed.add(zid);
      s.banner = { kind: 'miss', i };
      s.used = 0;
    } else {
      m.state = 'bad';
      s.banner = { kind: 'retry', i, left: stepBudget() - s.used };
    }
    return { done: allResolved() };
  }

  // Обычные задания: все должны иметь нужное число отметок, потом оценка всех сразу
  function checkFree() {
    const need = [];
    freeTasks().forEach(t => { const n = left(t).length; if (n && free(t).length < n) need.push({ t, n: n - free(t).length }); });
    if (need.length) {
      missing = new Set(need.map(x => x.t.id));
      idx = Math.max(0, tasks().indexOf(need[0].t));
      const sum = need.reduce((s, x) => s + x.n, 0);
      return { note: pointMode()
        ? (sum === 1 ? 'Поставьте ещё один маркер, потом нажмите «Проверить».' : `Поставьте маркеры: ещё ${sum}.`)
        : (sum === 1 ? 'Выберите ещё одну область, потом нажмите «Проверить».' : `Выберите области: ещё ${sum}.`) };
    }
    missing.clear();
    freeTasks().forEach(t => {
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
    freeUsed++;
    return { done: allResolved() };
  }

  // Баллы: найденные области; в «найти несколько» минус неверные отметки, оставшиеся в конце (не ниже нуля); «по порядку» без вычета
  function score() {
    let got = 0, total = 0, wrong = 0, placed = 0;
    const over = finished || freeOver();
    tasks().forEach(t => {
      const n = targetsOf(t).length, ok = n - left(t).length, fp = free(t).length;
      total += n;
      got += !isOrdered(t) && n > 1 && over ? Math.max(0, ok - fp) : ok;
      wrong += free(t).filter(m => m.state === 'bad').length;
      if (!isOrdered(t)) placed += marksOf(t).length;
    });
    return { got, total, wrong, placed };
  }
  function status() {
    const s = score();
    if (finished) return `Результат: ${s.got} из ${s.total} (${s.total ? Math.round(s.got / s.total * 100) : 0}%)`;
    const t = tasks()[idx];
    if (t && isOrdered(t)) {
      const zid = curTarget(t);
      return zid ? `Шаг ${targetsOf(t).indexOf(zid) + 1} из ${targetsOf(t).length} · Проверок на шаге: ${stepBudget() - stOf(t).used}` : 'Все шаги пройдены';
    }
    const fu = freeUnits(), found = freeTasks().reduce((n, x) => n + targetsOf(x).length - left(x).length, 0);
    if (freeUsed === 0) return `Отмечено: ${s.placed} из ${fu}`;
    return `Верно: ${found} из ${fu} · Неверно: ${s.wrong} · Проверок осталось: ${Math.max(0, freeMax() - freeUsed)}`;
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

  // Показывать ли верную область, которую ученик не нашёл: в конце; у обычных заданий — когда кончились общие проверки; у шага «по порядку» — когда шаг не найден
  function revealed(t, zid) {
    if (unitOf(t, zid).locked) return false;
    if (isOrdered(t)) return finished || stOf(t).missed.has(zid);
    return finished || freeOver();
  }

  function stage(t) {
    const wrap = el('div', 'hs-stagewrap');
    const fixed = frozen(t);
    const st = el('div', 'hs-stage' + (pointMode() ? ' point' : ' zone') + (fixed ? ' fixed' : ''));
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
        const rev = tg.includes(z.id) && revealed(t, z.id);
        const cls = m ? (m.locked ? 'ok' : m.state === 'bad' ? 'bad' : 'on') : rev ? 'right' : '';
        const s = shape(z, cls);
        if (!fixed && !(m && m.locked)) s.onclick = () => pickZone(t, z.id);
        ov.append(s);
        if (m) badges.push([z, m.locked ? '✓' : m.state === 'bad' ? '✗' : '', m.locked ? 'ok' : m.state === 'bad' ? 'bad' : 'on']);
        else if (rev) badges.push([z, '✓', 'right']);
      });
    } else {
      // «Точка»: области скрыты; показываются только ненайденные, когда их пора раскрыть
      tg.forEach(zid => { if (revealed(t, zid)) { const z = zoneOf(zid); ov.append(shape(z, 'right')); badges.push([z, '✓', 'right']); } });
      st.onclick = e => {
        if (fixed || e.target.closest('.hs-mark')) return;
        const r = st.getBoundingClientRect();
        placePoint(t, G.round(G.clamp((e.clientX - r.left) / r.width, 0, 1)), G.round(G.clamp((e.clientY - r.top) / r.height, 0, 1)));
      };
    }
    badges.forEach(([z, sign, cls]) => {
      const [cx, cy] = center(z);
      if (sign) st.append(at(el('span', 'hs-badge ' + cls, sign), cx, cy));
      if (clean(z.label) && (finished || cls === 'right')) st.append(at(el('span', 'hs-lbl', clean(z.label)), z.x, z.y + z.h));
    });
    if (pointMode()) {
      mine.forEach((m, i) => {
        // Маркер — span, а не button: Comic рисует рамку и сбивает положение у любой кнопки (rough.js, comic.css)
        const fx = m.locked || fixed;
        const b = el('span', 'hs-mark' + (m.locked ? ' ok' : m.state === 'bad' ? ' bad' : '') + (fx ? ' fixed' : ''), m.locked ? '✓' : m.state === 'bad' ? '✗' : String(i + 1));
        b.setAttribute('role', 'button');
        b.setAttribute('aria-label', `Маркер ${i + 1}` + (m.locked ? ', верно' : m.state === 'bad' ? ', неверно' : '') + (fx ? '' : ', нажмите, чтобы убрать'));
        if (fx) b.setAttribute('aria-disabled', 'true');
        else b.onclick = () => removeMark(t, m);
        st.append(at(b, m.x, m.y));
      });
    }
    wrap.append(st);
    return wrap;
  }

  // Шаг «по порядку»: «Шаг 2 из 4: Кухня» и итог прошлой попытки
  function stepInfo(t) {
    const box = el('div', 'hs-stepbox'), s = stOf(t), tg = targetsOf(t), zid = curTarget(t);
    if (zid) {
      const p = el('p', 'hs-step', `Шаг ${tg.indexOf(zid) + 1} из ${tg.length}: найдите `);
      p.append(el('b', '', clean(zoneOf(zid).label) || `область ${tg.indexOf(zid) + 1}`));
      box.append(p);
    } else box.append(el('p', 'hs-step', 'Все шаги этого задания пройдены.'));
    const b = s.banner;
    if (b) {
      const text = b.kind === 'ok' ? `Шаг ${b.i}: верно ✓` : b.kind === 'miss' ? `Шаг ${b.i}: не найден — верное место показано пунктиром ✓` : `Неверно ✗. Попробуйте ещё раз: проверок на шаге — ${b.left}.`;
      box.append(el('p', 'hs-banner ' + b.kind, text));
    }
    return box;
  }

  function card(k) {
    const t = tasks()[k], n = targetsOf(t).length, ord = isOrdered(t);
    const c = el('div', 'card hs-card' + (missing.has(t.id) ? ' missing' : ''));
    c.dataset.t = t.id;
    const prompt = clean(t.prompt);
    const dflt = ord ? 'Найдите места по порядку.' : pointMode()
      ? (n === 1 ? 'Поставьте маркер на нужное место.' : `Поставьте маркеры на нужные места: ${n}.`)
      : (n === 1 ? 'Нажмите на нужную область картинки.' : `Нажмите на нужные области картинки: ${n}.`);
    c.append(el('p', 'hs-ask' + (prompt ? ' hs-own' : ''), prompt || dflt));
    if (ord) c.append(stepInfo(t));
    else if (n > 1) c.append(el('p', 'hs-count', `Отмечено: ${marksOf(t).length} из ${n}`));
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
      const ok = isOrdered(t) ? done(t) && targetsOf(t).every(z => unitOf(t, z).locked) : !left(t).length;
      const st = ok ? ' ok' : bad ? ' bad' : missing.has(t.id) ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (marksOf(t).length ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Задание ${i + 1}` + (i === idx ? ', текущее' : '') + (ok ? ', верно' : bad ? ', есть неверные отметки' : ''));
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

  return { units, reset, check, status, percent, started, maxChecks, goMissing, missingNote, instant, render: renderInto };
})();
