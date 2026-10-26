// Плеер модуля Text to Image: сетка картинок, под каждой — окошко для слова. Способ ответа один на всё упражнение (data.mode):
// word_bank — слова в банке сверху, ученик нажимает слово, потом окошко, или перетаскивает (мышью сразу, пальцем после короткого удержания);
// dropdown — выпадающий список под картинкой; typing — ввод с клавиатуры.
// Общая часть прохождения — шапка, инструкция, проверки, результат, сброс — живёт в index.html: каждая картинка — единица общего хода (gaps),
// answer — верное слово, alternatives — другие верные, value — слово ученика, bankKey — ключ карточки банка. Проверку делает общий ход:
// неполный ответ проверку не тратит, верные слова закрепляются ✓, неверные остаются с ✗ и их можно заменить. Лишние слова не оцениваются.
const TextToImagePlayer = (() => {
  const HOLD = 250, SLOP = 10, EDGE = 48, SPEED = 14; // удержание пальцем (мс), дрожание пальца (px), зона и скорость автопрокрутки
  let items = [];
  let cards = []; // карточки банка: {key, text}; порядок — на это прохождение
  let pool = []; // слова выпадающего списка
  let sel = null; // выбранная карточка банка (key)
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: перемешивание для предпросмотра
  let drag = null, justDragged = false;
  let helpOpen = false; // показана ли подсказка под значком «?»

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const modeOf = () => (['word_bank', 'dropdown', 'typing'].includes(data.mode) ? data.mode : 'word_bank');
  const sizeOf = () => (['s', 'm', 'l'].includes(data.imageSize) ? data.imageSize : 'm');
  const unitOf = id => gaps.find(g => g.id === id);
  const holder = key => gaps.find(g => g.bankKey === key); // окошко, где лежит карточка
  const instant = () => false;

  function units() {
    items = (Array.isArray(data.items) ? data.items : []).filter(i => i && clean(i.answer));
    fresh = true;
    return items.map(i => ({
      id: i.id, answer: clean(i.answer), alternatives: (Array.isArray(i.alternatives) ? i.alternatives : []).map(clean).filter(Boolean),
      hint: '', audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока состав слов тот же, порядок не меняем, чтобы карточки не прыгали
  function reset() {
    const answers = items.map(i => clean(i.answer));
    const alts = items.flatMap(i => (Array.isArray(i.alternatives) ? i.alternatives : []).map(clean).filter(Boolean));
    const dist = (Array.isArray(data.distractors) ? data.distractors : []).map(clean).filter(Boolean);
    const taken = new Set(answers.map(norm));
    const traps = uniq(dist).filter(w => !taken.has(norm(w)));
    const texts = [...answers, ...traps];
    const sig = [...texts, '|', ...alts].join('\n');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    sel = null;
    endDrag();
    helpOpen = false;
    if (reuse) { cards = cache.cards.map(c => ({ ...c })); pool = cache.pool.slice(); return; }
    cards = shuffle(texts.map((text, key) => ({ key, text })));
    pool = shuffle(uniq([...answers, ...alts, ...dist]));
    cache = { sig, cards: cards.map(c => ({ ...c })), pool: pool.slice() };
  }

  const clear = g => { g.bankKey = null; g.value = ''; g.state = null; };

  // Положить карточку в окошко pid или вернуть в банк (pid ''); прежнее место освобождается само, вытесненное слово возвращается в банк
  function place(key, pid) {
    if (finished) return;
    const from = holder(key);
    if (from && frozen(from)) return;
    const card = cards.find(c => c.key === key);
    if (!card) return;
    if (pid) {
      const g = unitOf(pid);
      if (!g || frozen(g)) return;
      if (from) clear(from);
      g.bankKey = key;
      g.value = card.text;
      g.state = null;
    } else if (from) clear(from);
    sel = null;
    note = '';
    render();
  }

  const missingNote = n => (n === 1 ? 'Подпишите картинку, которая осталась без слова.' : `Подпишите все картинки: ещё ${n}.`);
  const goMissing = () => {};

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Карточка банка: нажатие выбирает её (повторное — снимает). Уже поставленное слово остаётся на месте приглушённым. Класс .chip — Comic рисует овальный контур
  function chip(c) {
    const used = !!holder(c.key);
    const b = el('div', 'chip ti-chip' + (used ? ' used' : '') + (sel === c.key ? ' selected' : ''), c.text);
    b.dataset.key = c.key;
    if (used) return b;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-pressed', String(sel === c.key));
    b.onclick = e => { e.stopPropagation(); if (justDragged) return; sel = sel === c.key ? null : c.key; render(); };
    b.addEventListener('pointerdown', e => press(e, c.key, b, c.text));
    b.oncontextmenu = e => e.preventDefault();
    return b;
  }

  function bank() {
    const c = el('div', 'card ti-bank');
    c.dataset.drop = '';
    if (helpOpen) c.append(el('p', 'ti-label', 'Нажмите на слово, потом на окошко под картинкой — или перетащите слово. Нажмите на слово в окошке, чтобы вернуть его.'));
    const zone = el('div', 'ti-zone');
    // Значок — span, не button: Comic рисует рамку и сбивает положение у любой кнопки
    const q = el('span', 'ti-help' + (helpOpen ? ' on' : ''), '?');
    q.setAttribute('role', 'button');
    q.setAttribute('aria-label', 'Как подписывать');
    q.setAttribute('aria-expanded', String(helpOpen));
    q.title = 'Как подписывать';
    q.onclick = e => { e.stopPropagation(); helpOpen = !helpOpen; render(); };
    zone.append(q);
    cards.forEach(x => zone.append(chip(x)));
    c.append(zone);
    return c;
  }

  // Окошко под картинкой. Форма, ширина и нумерация — общие настройки пропуска из «Дизайна»; ширина окошка всегда по ширине картинки
  function slot(g, k) {
    const look = typeof normalizeGapDesign === 'function' ? normalizeGapDesign(data.design && data.design.gap) : { shape: 'line', width: 'auto', dashed: false, numbered: false };
    const mode = modeOf(), fixed = frozen(g);
    const target = mode === 'word_bank' && sel != null && !fixed;
    const s = el('span', 'gap t2i-slot ' + (typeof gapClasses === 'function' ? gapClasses(look) : 'shape-line w-auto') + (g.state ? ' ' + g.state : '') + (fixed ? ' locked' : '') + (target ? ' t2i-target' : ''));
    s.dataset.idx = k;
    if (mode === 'typing') {
      const input = el('input');
      input.value = g.value;
      input.placeholder = '…';
      input.readOnly = fixed;
      input.setAttribute('aria-label', `Слово к картинке ${k + 1}`);
      input.oninput = () => { g.value = input.value; g.bankKey = null; edited(g, s); };
      input.onfocus = () => setTimeout(() => s.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
      s.append(input);
    } else if (mode === 'dropdown') {
      const select = el('select');
      select.disabled = fixed;
      select.setAttribute('aria-label', `Слово к картинке ${k + 1}`);
      select.append(el('option'));
      pool.forEach(w => select.append(el('option', '', w)));
      select.value = g.value;
      select.onchange = () => { g.value = select.value; g.bankKey = null; edited(g, s); };
      s.append(select);
    } else {
      s.dataset.drop = g.id;
      s.textContent = g.value;
      s.setAttribute('aria-label', `Картинка ${k + 1}` + (g.value ? `: ${g.value}` : ', пусто'));
      if (!fixed) {
        s.setAttribute('role', 'button');
        s.onclick = e => {
          e.stopPropagation();
          if (justDragged) return;
          if (sel != null) place(sel, g.id); else if (g.value) place(g.bankKey, '');
        };
        if (g.value) s.addEventListener('pointerdown', e => press(e, g.bankKey, s, g.value));
      }
    }
    if (look.numbered) s.append(el('span', 'gap-num', String(k + 1)));
    return s;
  }

  function cell(it, k) {
    const g = gaps[k];
    const c = el('div', 'ti-cell');
    const pic = el('div', 'ti-pic');
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { pic.classList.add('broken'); img.remove(); };
    img.src = mediaSrc(it.image) || '';
    pic.append(img);
    c.append(pic, slot(g, k));
    if (finished && g.state === 'bad' && data.showAnswers === true) c.append(el('div', 'ti-right', 'Правильно: ' + g.answer));
    return c;
  }

  function renderInto(root) {
    if (modeOf() === 'word_bank' && !finished) root.append(bank());
    const grid = el('div', `ti-grid ti-size-${sizeOf()} ti-fit-${data.imageFit === 'cover' ? 'cover' : 'contain'}`);
    items.forEach((it, k) => grid.append(cell(it, k)));
    root.append(grid);
  }

  // ---- Перетаскивание (как в Label the Diagram) ----
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
    const gh = el('div', 'chip ti-chip ti-ghost', drag.text);
    document.body.append(gh);
    drag.ghost = gh;
    drag.src.classList.add('ti-lifted');
    document.documentElement.classList.add('ti-dragging');
    if (drag.touch && navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
    follow();
    drag.raf = requestAnimationFrame(tick);
  }

  function follow() {
    drag.ghost.style.transform = `translate(${drag.x + 10}px, ${drag.y - 18}px)`;
    const under = document.elementFromPoint(drag.x, drag.y);
    const zone = under && under.closest('[data-drop]');
    if (zone !== drag.over) {
      if (drag.over) drag.over.classList.remove('ti-over');
      drag.over = zone;
      if (zone) zone.classList.add('ti-over');
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
    if (drag.over) drag.over.classList.remove('ti-over');
    if (drag.src) drag.src.classList.remove('ti-lifted');
    document.documentElement.classList.remove('ti-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    drag = null;
  }

  // Пока слово едет за пальцем, страница не прокручивается (иначе браузер отменит перенос)
  document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  return { units, reset, instant, goMissing, missingNote, render: renderInto };
})();
