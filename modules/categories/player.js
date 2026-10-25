// Плеер модуля Categories / Sorting: ученик раскладывает перемешанные карточки по категориям.
// Два способа без переключателя (решение владельца 2026-10-25): нажать карточку, потом категорию — или перетащить карточку.
// Перетаскивание на событиях указателя: мышью — сразу, пальцем — после короткого удержания (иначе палец прокручивает страницу).
// Общая часть прохождения — шапка, инструкция, проверки, результат, сброс — живёт в index.html.
// Каждая карточка — единица общего хода (unit): answer — ID правильной категории, value — ID категории, куда её положил ученик.
// Проверки обычные (3 / 5): верные закрепляются, неверные возвращаются в банк; на последней проверке всё замирает на местах.
const CategoriesPlayer = (() => {
  const HOLD = 250, SLOP = 10, EDGE = 48, SPEED = 14; // удержание пальцем (мс), дрожание пальца (px), зона и скорость автопрокрутки
  let cats = [], items = [], byId = {};
  let order = []; // порядок карточек на это прохождение (банк и категории показывают их в нём)
  let sel = null; // выбранная карточка (ID)
  let lastWrong = 0; // сколько карточек вернулось в банк на последней проверке
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: перемешивание для предпросмотра
  let drag = null, justDragged = false;

  const instant = () => false;
  const unitOf = id => gaps.find(g => g.id === id);
  const catName = id => { const c = cats.find(x => x.id === id); return c ? String(c.name || '') : ''; };

  function units() {
    cats = Array.isArray(data.categories) ? data.categories : [];
    items = Array.isArray(data.items) ? data.items : [];
    byId = Object.fromEntries(items.map(i => [i.id, i]));
    fresh = true;
    return items.map(i => ({
      id: i.id, answer: i.categoryId, alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока набор карточек тот же, порядок не меняем, чтобы карточки не прыгали
  function reset() {
    const sig = items.map(i => i.id).sort().join(' ');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    sel = null; lastWrong = 0;
    endDrag();
    if (reuse) { order = cache.order.slice(); return; }
    order = shuffle(items.map(i => i.id));
    cache = { sig, order: order.slice() };
  }

  // Положить карточку в категорию (catId) или вернуть в банк (''); прежнее место освобождается само
  function place(id, catId) {
    const g = unitOf(id);
    if (!g || g.locked || finished) return;
    g.value = catId;
    g.state = null;
    sel = null;
    note = '';
    render();
  }

  // Проверка тратится, только когда разложены все карточки (закреплённые уже на месте).
  // Неверные на промежуточной проверке возвращаются в банк с пометкой ✗, правильная категория не раскрывается;
  // на последней проверке они остаются там, куда их положил ученик
  function check() {
    const left = gaps.filter(g => !g.locked && !g.value).length;
    if (left) {
      sel = null;
      return { note: left === 1 ? 'Разложите все карточки: в банке осталась одна.' : `Разложите все карточки: в банке осталось ${left}.` };
    }
    const last = checksUsed + 1 >= maxChecks;
    lastWrong = 0;
    sel = null;
    gaps.forEach(g => {
      if (g.locked) return;
      g.locked = g.value === g.answer;
      g.state = g.locked ? 'ok' : 'bad';
      if (!g.locked) { lastWrong++; if (!last) g.value = ''; }
    });
    return { done: gaps.every(g => g.locked) };
  }

  function status() {
    if (finished || note) return null;
    if (!checksUsed) return `Разложено: ${gaps.filter(g => g.value).length} из ${gaps.length}`;
    const ok = gaps.filter(g => g.locked).length;
    return `Верно: ${ok} из ${gaps.length} · Вернулись в банк: ${lastWrong} · Проверок осталось: ${maxChecks - checksUsed}`;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Картинка карточки: высота по «Размеру картинок», лупа увеличения на углу (addZoom, core/mediaviewer.js).
  // Лупа и звук — свои кнопки: не выбирают и не переносят карточку, проверку не тратят
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('span', 'cs-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { wrap.classList.add('broken'); img.remove(); };
    img.src = src;
    wrap.append(img);
    addZoom(wrap, wrap, src, img.alt);
    return wrap;
  }
  const label = it => String(it.text || '').trim() || 'картинка';

  // Карточка: нажатие выбирает её (повторное — снимает выбор); закреплённые и после конца не двигаются.
  // Карточка — блок, а не кнопка: внутри неё кнопки лупы и звука (кнопку в кнопке браузер не нажимает).
  // Класс .chip даёт в Comic овальный контур, у карточки с картинкой — .card (прямоугольный, иначе высокая карточка станет кругом)
  function chip(it) {
    const g = unitOf(it.id);
    const fixed = !g || g.locked || finished;
    const st = g && g.state === 'ok' ? ' ok' : g && g.state === 'bad' ? ' bad' : '';
    const pic = picture(it.image);
    const b = el('div', (pic ? 'card' : 'chip') + ' cs-chip' + st + (sel === it.id ? ' selected' : '') + (fixed ? ' fixed' : ''));
    b.dataset.id = it.id;
    if (pic) b.append(pic);
    const line = el('span', 'cs-cline');
    if (String(it.text || '').trim()) line.append(el('span', 'cs-ctext', it.text));
    const audio = mediaSrc(it.audio);
    if (audio) line.append(audioButton(audio, 'csa' + it.id, 'audbtn cs-aud', '🔊', 'Прослушать карточку'));
    if (st) line.append(el('span', st === ' ok' ? 'cs-tick' : 'cs-cross', st === ' ok' ? '✓' : '✗'));
    if (line.childNodes.length) b.append(line);
    const where = g && g.value ? `, в категории «${catName(g.value)}»` : '';
    b.setAttribute('aria-label', label(it) + where + (st === ' ok' ? ', верно' : st === ' bad' ? ', неверно' : ''));
    if (fixed) b.setAttribute('aria-disabled', 'true');
    else {
      b.setAttribute('role', 'button');
      b.setAttribute('aria-pressed', String(sel === it.id));
      b.onclick = e => { e.stopPropagation(); if (justDragged || e.target.closest('button')) return; sel = sel === it.id ? null : it.id; render(); };
      b.addEventListener('pointerdown', e => { if (!e.target.closest('button')) press(e, it.id, b); });
      b.oncontextmenu = e => e.preventDefault();
    }
    // После конца: у неверной карточки — нужная категория (если автор включил «Показывать правильный ответ»)
    if (finished && st === ' bad' && data.showAnswers === true && g) {
      const r = el('span', 'cs-right');
      r.append(el('span', 'cs-right-l', 'Правильно: '), document.createTextNode(catName(g.answer)));
      b.append(r);
    }
    return b;
  }

  function bankCard() {
    const selPlaced = sel && unitOf(sel) && unitOf(sel).value;
    const c = el('div', 'card cs-bank' + (selPlaced ? ' cs-target' : ''));
    c.dataset.drop = '';
    c.append(el('p', 'cs-label', selPlaced ? 'Нажмите сюда, чтобы вернуть карточку' : 'Нажмите на карточку, потом на категорию — или перетащите карточку.'));
    const zone = el('div', 'cs-zone');
    const left = order.filter(id => { const g = unitOf(id); return g && !g.value; });
    left.forEach(id => zone.append(chip(byId[id])));
    if (!left.length) zone.append(el('span', 'cs-empty', 'Все карточки разложены.'));
    c.append(zone);
    c.onclick = () => { if (selPlaced) place(sel, ''); };
    return c;
  }

  function catCard(cat) {
    const selG = sel && unitOf(sel);
    const target = !!selG && selG.value !== cat.id;
    const c = el('div', 'card cs-cat' + (target ? ' cs-target' : ''));
    c.dataset.drop = cat.id;
    c.append(el('p', 'cs-cname', cat.name));
    const zone = el('div', 'cs-zone');
    const here = order.filter(id => { const g = unitOf(id); return g && g.value === cat.id; });
    here.forEach(id => zone.append(chip(byId[id])));
    if (!here.length) zone.append(el('span', 'cs-empty', target ? 'Нажмите, чтобы положить сюда' : 'Пусто'));
    c.append(zone);
    if (!finished) {
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', `Категория «${cat.name}»`);
      c.onclick = () => { if (sel) place(sel, cat.id); };
    }
    return c;
  }

  function renderInto(root) {
    const size = 'cs-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm');
    if (!finished) { const bank = bankCard(); bank.classList.add(size); root.append(bank); }
    const grid = el('div', 'cs-grid ' + size + ' ' + (data.view === 'stacked' ? 'cs-stacked' : 'cs-columns'));
    cats.forEach(cat => grid.append(catCard(cat)));
    root.append(grid);
  }

  // ---- Перетаскивание ----
  // Мышь: перенос начинается, когда указатель сдвинулся на несколько точек. Палец: после удержания HOLD мс на месте;
  // если палец поехал раньше — это прокрутка страницы, перенос не начинается
  function press(e, id, src) {
    if (e.button > 0 || finished || drag) return;
    const touch = e.pointerType === 'touch';
    drag = { id, src, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch, on: false, timer: 0, ghost: null, over: null, raf: 0, dx: 0, dy: 0 };
    if (touch) drag.timer = setTimeout(() => { if (drag && !drag.on) begin(); }, HOLD);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function begin() {
    const r = drag.src.getBoundingClientRect();
    drag.on = true;
    drag.dx = drag.x0 - r.left;
    drag.dy = drag.y0 - r.top;
    const gh = drag.src.cloneNode(true);
    gh.classList.add('cs-ghost');
    gh.classList.remove('selected');
    gh.style.width = r.width + 'px';
    document.body.append(gh);
    drag.ghost = gh;
    drag.src.classList.add('cs-lifted');
    document.documentElement.classList.add('cs-dragging');
    if (drag.touch && navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
    follow();
    drag.raf = requestAnimationFrame(tick);
  }

  function follow() {
    drag.ghost.style.transform = `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)`;
    const under = document.elementFromPoint(drag.x, drag.y);
    const zone = under && under.closest('[data-drop]');
    if (zone !== drag.over) {
      if (drag.over) drag.over.classList.remove('cs-over');
      drag.over = zone;
      if (zone) zone.classList.add('cs-over');
    }
  }

  // У верхнего или нижнего края области упражнения она прокручивается сама
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
    const on = drag.on, id = drag.id, over = drag.over;
    endDrag();
    if (!on) return; // простое нажатие — его обработает onclick
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    if (over) place(id, over.dataset.drop); else render();
  }
  function onCancel(e) { if (drag && e.pointerId === drag.pid) { const on = drag.on; endDrag(); if (on) render(); } }

  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.raf);
    if (drag.ghost) drag.ghost.remove();
    if (drag.over) drag.over.classList.remove('cs-over');
    if (drag.src) drag.src.classList.remove('cs-lifted');
    document.documentElement.classList.remove('cs-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    drag = null;
  }

  // Пока карточка едет за пальцем, страница не прокручивается (иначе браузер отменит перенос)
  document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  // Проверка своя (check): неразложенные карточки видны в банке; эти две нужны общему ходу формально
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, status, instant, goMissing, missingNote, render: renderInto };
})();
