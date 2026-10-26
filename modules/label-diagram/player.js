// Плеер модуля Label the Diagram: на картинке точки с пустыми ячейками, под ней банк подписей.
// Ученик ставит подпись в ячейку: нажимает подпись, потом ячейку — или перетаскивает (мышью сразу, пальцем после короткого удержания).
// Общая часть прохождения — шапка, инструкция, проверки, результат, сброс — живёт в index.html.
// Каждая точка — единица общего хода (unit): answer — верная подпись, value — подпись, которую поставил ученик, bankKey — ключ карточки.
// Одинаковые подписи у разных точек взаимозаменяемы (сравнение по norm). Проверки обычные (3 / 5): верные закрепляются,
// неверные остаются в ячейках с ✗ и их можно заменить; лишние подписи не оцениваются; штрафа нет.
const LabelDiagramPlayer = (() => {
  const HOLD = 250, SLOP = 10, EDGE = 48, SPEED = 14; // удержание пальцем (мс), дрожание пальца (px), зона и скорость автопрокрутки
  let pts = [];
  let cards = []; // карточки банка: {key, text}; порядок — на это прохождение
  let sel = null; // выбранная карточка (key)
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: перемешивание для предпросмотра
  let drag = null, justDragged = false;
  let imgFailed = false;
  let helpOpen = false; // показана ли инструкция под значком «?»

  const instant = () => false;
  const unitOf = id => gaps.find(g => g.id === id);
  const holder = key => gaps.find(g => g.bankKey === key); // ячейка, где лежит карточка
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  function units() {
    pts = (Array.isArray(data.points) ? data.points : []).filter(p => p && clean(p.label) && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
    fresh = true;
    return pts.map(p => ({
      id: p.id, answer: clean(p.label), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока состав подписей тот же, порядок не меняем, чтобы карточки не прыгали
  function reset() {
    const answers = pts.map(p => clean(p.label));
    const taken = new Set(answers.map(norm));
    const extra = [];
    (Array.isArray(data.distractors) ? data.distractors : []).map(clean).filter(Boolean).forEach(s => { if (!taken.has(norm(s))) { taken.add(norm(s)); extra.push(s); } });
    const texts = [...answers, ...extra];
    const sig = texts.join('\n');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    sel = null;
    endDrag();
    imgFailed = false;
    helpOpen = false;
    if (reuse) { cards = cache.cards.map(c => ({ ...c })); return; }
    cards = shuffle(texts.map((text, key) => ({ key, text })));
    cache = { sig, cards: cards.map(c => ({ ...c })) };
  }

  const started = () => gaps.some(g => g.bankKey != null);

  // Положить карточку в ячейку точки pid или вернуть в банк (pid ''); прежнее место и вытесненная карточка освобождаются сами
  function place(key, pid) {
    if (finished) return;
    const from = holder(key);
    if (from && from.locked) return;
    const card = cards.find(c => c.key === key);
    if (!card) return;
    if (pid) {
      const g = unitOf(pid);
      if (!g || g.locked) return;
      if (from) { from.bankKey = null; from.value = ''; from.state = null; }
      g.bankKey = key;
      g.value = card.text;
      g.state = null;
    } else if (from) { from.bankKey = null; from.value = ''; from.state = null; }
    sel = null;
    note = '';
    render();
  }

  // Проверка тратится, только когда подписаны все точки (закреплённые уже на месте)
  function check() {
    if (imgFailed) return { note: 'Картинка не загрузилась, проверить сейчас нельзя. Обновите страницу.' };
    const left = gaps.filter(g => !g.locked && g.bankKey == null).length;
    if (left) {
      sel = null;
      return { note: left === 1 ? 'Подпишите все точки: осталась одна без подписи.' : `Подпишите все точки: без подписи осталось ${left}.` };
    }
    sel = null;
    gaps.forEach(g => {
      if (g.locked) return;
      g.locked = norm(g.value) === norm(g.answer);
      g.state = g.locked ? 'ok' : 'bad';
    });
    return { done: gaps.every(g => g.locked) };
  }

  function status() {
    if (finished || note) return null;
    if (!checksUsed) return `Подписано: ${gaps.filter(g => g.bankKey != null).length} из ${gaps.length}`;
    const ok = gaps.filter(g => g.locked).length, bad = gaps.filter(g => g.state === 'bad').length;
    return `Верно: ${ok} из ${gaps.length} · Неверно: ${bad} · Проверок осталось: ${maxChecks - checksUsed}`;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const at = (e, x, y) => { e.style.left = x * 100 + '%'; e.style.top = y * 100 + '%'; return e; };

  // Карточка банка: нажатие выбирает её (повторное — снимает выбор). Класс .chip — Comic рисует овальный контур
  function chip(c) {
    const b = el('div', 'chip ld-chip' + (sel === c.key ? ' selected' : ''), c.text);
    b.dataset.key = c.key;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-pressed', String(sel === c.key));
    b.onclick = e => { e.stopPropagation(); if (justDragged) return; sel = sel === c.key ? null : c.key; render(); };
    b.addEventListener('pointerdown', e => press(e, c.key, b, c.text));
    b.oncontextmenu = e => e.preventDefault();
    return b;
  }

  // Ячейка точки: пустая — пунктир с номером; с подписью — её текст (✓ / ✗ после проверки). Нажатие: положить выбранную карточку
  // или, если ничего не выбрано, вернуть лежащую карточку в банк; лежащую карточку можно и перетащить
  // inline — ячейка в списке под картинкой (вид «Номера»), а не на картинке
  function slot(p, k, inline) {
    const g = unitOf(p.id);
    const has = g.bankKey != null, fixed = g.locked || finished;
    const st = g.state === 'ok' ? ' ok' : g.state === 'bad' ? ' bad' : '';
    const target = !!sel && !g.locked && !finished;
    const s = el('div', 'chip ld-slot' + (inline ? ' ld-inline' : '') + (has ? ' has' : '') + st + (target ? ' ld-target' : '') + (fixed ? ' fixed' : ''));
    s.dataset.drop = g.id;
    s.append(el('span', 'ld-no', String(k + 1)));
    if (has) s.append(el('span', 'ld-text', g.value));
    if (st) s.append(el('span', st === ' ok' ? 'ld-tick' : 'ld-cross', st === ' ok' ? '✓' : '✗'));
    if (finished && g.state === 'bad' && data.reveal !== false) s.append(el('span', 'ld-right', 'Правильно: ' + g.answer));
    s.setAttribute('aria-label', `Точка ${k + 1}` + (has ? `: ${g.value}` : ', пусто') + (st === ' ok' ? ', верно' : st === ' bad' ? ', неверно' : ''));
    if (!inline) at(s, num(p.sx, p.x), num(p.sy, p.y));
    if (!fixed) {
      s.setAttribute('role', 'button');
      s.onclick = e => {
        e.stopPropagation();
        if (justDragged) return;
        if (sel != null) place(sel, g.id); else if (has) place(g.bankKey, '');
      };
      if (has) s.addEventListener('pointerdown', e => press(e, g.bankKey, s, g.value));
    }
    return s;
  }
  const num = (v, dflt) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

  function stage() {
    const wrap = el('div', 'ld-stagewrap');
    const nums = numbered();
    const st = el('div', 'ld-stage' + (finished ? ' fixed' : '') + (data.dot === 's' || data.dot === 'l' ? ' ld-dot-' + data.dot : '') + (data.line === 'thin' || data.line === 'thick' ? ' ld-line-' + data.line : ''));
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { imgFailed = true; st.classList.add('broken'); wrap.append(el('p', 'ld-fail', 'Картинка не загрузилась.')); };
    img.onload = () => { imgFailed = false; };
    img.src = mediaSrc(data.image) || '';
    const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ov.setAttribute('class', 'ld-ov');
    ov.setAttribute('viewBox', '0 0 1 1');
    ov.setAttribute('preserveAspectRatio', 'none');
    st.append(img, ov);
    if (!nums) pts.forEach((p, k) => {
      const g = unitOf(p.id);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p.x);
      line.setAttribute('y1', p.y);
      line.setAttribute('x2', num(p.sx, p.x));
      line.setAttribute('y2', num(p.sy, p.y));
      line.setAttribute('class', 'ld-line' + (g.state === 'ok' ? ' ok' : g.state === 'bad' ? ' bad' : ''));
      ov.append(line);
    });
    pts.forEach((p, k) => {
      const g = unitOf(p.id);
      st.append(at(el('span', 'ld-dot' + (nums ? ' num' : '') + (g.state === 'ok' ? ' ok' : g.state === 'bad' ? ' bad' : ''), nums ? String(k + 1) : null), p.x, p.y));
    });
    if (!nums) pts.forEach((p, k) => st.append(slot(p, k)));
    wrap.append(st);
    return wrap;
  }

  // Вид «Номера»: на картинке только пронумерованные точки, ячейки — списком под ней (Дизайн → «Вид подписей»)
  const numbered = () => data.view === 'numbers';
  function numList() {
    const box = el('div', 'ld-numlist');
    pts.forEach((p, k) => box.append(slot(p, k, true)));
    return box;
  }

  function bankCard() {
    const placed = sel != null && holder(sel);
    const c = el('div', 'card ld-bank' + (placed ? ' ld-target' : ''));
    c.dataset.drop = '';
    // Инструкция спрятана за значком «?» (место под картинкой); подсказка «вернуть подпись» показывается сама, пока выбрана лежащая подпись
    if (placed) c.append(el('p', 'ld-label', 'Нажмите сюда, чтобы вернуть подпись'));
    else if (helpOpen) c.append(el('p', 'ld-label', 'Нажмите на подпись, потом на ячейку у точки — или перетащите подпись.'));
    const zone = el('div', 'ld-zone');
    // Значок — span, не button: Comic рисует рамку и сбивает положение у любой кнопки
    const q = el('span', 'ld-help' + (helpOpen ? ' on' : ''), '?');
    q.setAttribute('role', 'button');
    q.setAttribute('aria-label', 'Как подписывать');
    q.setAttribute('aria-expanded', String(helpOpen));
    q.title = 'Как подписывать';
    q.onclick = e => { e.stopPropagation(); helpOpen = !helpOpen; render(); };
    zone.append(q);
    const left = cards.filter(x => !holder(x.key));
    left.forEach(x => zone.append(chip(x)));
    if (!left.length) zone.append(el('span', 'ld-empty', 'Все подписи поставлены.'));    c.append(zone);
    c.onclick = () => { if (placed) place(sel, ''); };
    return c;
  }

  function renderInto(root) {
    const c = el('div', 'card ld-card' + (data.shape === 'round' ? ' ld-round' : ''));
    c.append(stage());
    if (numbered()) c.append(numList());
    root.append(c);
    if (!finished) root.append(bankCard());
  }

  // ---- Перетаскивание (как в Categories) ----
  function press(e, key, src, text) {
    if (e.button > 0 || finished || drag) return;
    e.stopPropagation();
    const touch = e.pointerType === 'touch';
    drag = { key, src, text, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch, on: false, timer: 0, ghost: null, over: null, raf: 0 };
    if (touch) drag.timer = setTimeout(() => { if (drag && !drag.on) begin(); }, HOLD);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function begin() {
    drag.on = true;
    const gh = el('div', 'chip ld-chip ld-ghost', drag.text);
    document.body.append(gh);
    drag.ghost = gh;
    drag.src.classList.add('ld-lifted');
    document.documentElement.classList.add('ld-dragging');
    if (drag.touch && navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
    follow();
    drag.raf = requestAnimationFrame(tick);
  }

  function follow() {
    drag.ghost.style.transform = `translate(${drag.x + 10}px, ${drag.y - 18}px)`;
    const under = document.elementFromPoint(drag.x, drag.y);
    const zone = under && under.closest('[data-drop]');
    if (zone !== drag.over) {
      if (drag.over) drag.over.classList.remove('ld-over');
      drag.over = zone;
      if (zone) zone.classList.add('ld-over');
    }
  }

  function tick() {
    if (!drag || !drag.on) return;
    const sc = document.getElementById('main');
    if (sc) {
      const r = sc.getBoundingClientRect();
      const v = drag.y < r.top + EDGE ? -SPEED : drag.y > r.bottom - EDGE ? SPEED : 0;
      if (v) { sc.scrollTop += v; follow(); }
    }
    drag.raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.x = e.clientX; drag.y = e.clientY;
    const far = Math.hypot(drag.x - drag.x0, drag.y - drag.y0);
    if (!drag.on) {
      if (drag.touch) { if (far > SLOP) endDrag(); return; } // палец поехал до удержания — это прокрутка
      if (far < 6) return;
      begin();
    }
    e.preventDefault();
    follow();
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const on = drag.on, key = drag.key, over = drag.over;
    endDrag();
    if (!on) return; // простое нажатие — его обработает onclick
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    if (over) place(key, over.dataset.drop); else render();
  }
  function onCancel(e) { if (drag && e.pointerId === drag.pid) { const on = drag.on; endDrag(); if (on) render(); } }

  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.raf);
    if (drag.ghost) drag.ghost.remove();
    if (drag.over) drag.over.classList.remove('ld-over');
    if (drag.src) drag.src.classList.remove('ld-lifted');
    document.documentElement.classList.remove('ld-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    drag = null;
  }

  // Пока подпись едет за пальцем, страница не прокручивается (иначе браузер отменит перенос)
  document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  // Проверка своя (check): неподписанные точки видны на картинке; эти две нужны общему ходу формально
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, status, started, instant, goMissing, missingNote, render: renderInto };
})();
