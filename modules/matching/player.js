// Плеер модуля Matching (режим Standard): два столбца карточек, ученик соединяет пары нажатием «слева, потом справа».
// Общая часть прохождения — шапка, инструкция, проверки, закрепление, результат, сброс — живёт в index.html и работает
// с теми же переменными (data, gaps, finished, note, checksUsed) и функцией render(). Здесь только то, что отличает модуль.
// Каждая левая карточка — «пропуск» общего хода: answer — ID её пары (он же ID правой карточки), value — ID выбранной правой.
// Верные пары закрепляются (locked) и уходят в зелёную зону под столбцами, неверные краснеют и отвязываются.
const MatchingPlayer = (() => {
  let leftOrder = [], rightOrder = []; // порядок карточек на экране (ID пар), перемешивается при каждом новом прохождении
  let active = null; // ID левой карточки, ожидающей пару
  let refocus = null; // куда вернуть фокус после перерисовки
  let showAnswers = false; // раскрыты ли верные пары в конце
  const HUES = [210, 25, 285, 150, 335, 50, 185, 100, 5, 250]; // цвета связей; номер рядом с цветом — чтобы связь читалась и без цвета

  const item = id => data.items.find(i => i.id === id);
  const gapOf = id => gaps.find(g => g.id === id);
  const instant = () => false; // проверки общие, ответ не засчитывается сразу
  // Режим Lines (lines_pair_colors): все карточки остаются на местах, пары соединены линиями, проверка одна, итоговая
  const lines = () => data.mode === 'lines_pair_colors';
  const maxChecks = () => (lines() ? 1 : 0);
  const live = g => lines() || !g.locked; // в Lines верные пары не уходят в зелёную зону, связи остаются
  let ros = []; // наблюдатели за размером полей, чтобы линии шли за карточками
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: порядок карточек для предпросмотра
  let sets = [], setOf = {}; // наборы пар упражнения и номер набора у каждой пары

  // Единицы общего хода: подсказок и звука пока нет
  function units() {
    // Файл с одним набором хранит пары плоским списком items, с несколькими — sets; дальше работаем с обоими видами одинаково
    sets = Array.isArray(data.sets) ? data.sets : [{ id: 's1', instruction: '', items: data.items || [] }];
    data.items = sets.flatMap(s => s.items);
    setOf = {};
    fresh = true;
    sets.forEach((s, k) => s.items.forEach(i => { setOf[i.id] = k; }));
    return data.items.map(it => ({
      id: it.id, answer: it.id, alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', wrongRight: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Столбцы перемешиваются независимо; если вышло так, что пары стоят «по строкам», тасуем ещё раз
  function reset() {
    // Каждый набор перемешивается отдельно. В предпросмотре редактора каждая правка пересобирает упражнение: пока состав пар тот же, порядок карточек не меняем, чтобы они не прыгали
    const sig = sets.map(s => s.items.map(i => i.id).join( )).join('|');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    if (reuse) { leftOrder = cache.l.slice(); rightOrder = cache.r.slice(); active = null; refocus = null; showAnswers = false; return; }
    leftOrder = []; rightOrder = [];
    sets.forEach(s => {
      const ids = s.items.map(i => i.id);
      const l = shuffle(ids);
      let r = shuffle(ids);
      for (let k = 0; k < 6 && ids.length > 1 && r.every((x, i) => x === l[i]); k++) r = shuffle(ids);
      leftOrder.push(...l); rightOrder.push(...r);
    });
    cache = { sig, l: leftOrder.slice(), r: rightOrder.slice() };
    active = null; refocus = null; showAnswers = false;
  }

  function goMissing() {
    const g = gaps.find(x => x.state === 'missing');
    if (g) refocus = `.mt-card[data-side="left"][data-id="${g.id}"]`;
  }
  const missingNote = n => (n === 1 ? 'Соедините карточку, у которой нет пары.' : `Соедините все карточки: ещё ${n}.`);

  // Новое соединение снимает красную отметку прошлой проверки и пометку «не соединено»
  function clearMarks() {
    gaps.forEach(g => { if (g.state === 'bad' || g.state === 'missing') { g.state = null; g.wrongRight = ''; } });
    note = '';
  }

  function selectLeft(id) {
    const g = gapOf(id);
    if (frozen(g)) return;
    active = active === id ? null : id;
    refocus = `.mt-card[data-side="left"][data-id="${id}"]`;
    render();
  }
  function pickRight(rid) {
    const occupant = gaps.find(g => live(g) && g.value === rid);
    if (active && setOf[active] !== setOf[rid]) { active = null; render(); return; } // пару можно составить только внутри одного набора
    if (!active) {
      if (occupant && !finished) { active = occupant.id; refocus = `.mt-card[data-side="left"][data-id="${occupant.id}"]`; render(); } // нажатие на связанную карточку выбирает её пару для переназначения
      return;
    }
    clearMarks();
    if (occupant && occupant.id !== active) occupant.value = ''; // занятая карточка отдаёт прежнюю связь новой
    gapOf(active).value = rid;
    const left = active;
    active = null;
    refocus = `.mt-card[data-side="left"][data-id="${left}"]`;
    render();
  }
  function unlink(id) {
    const g = gapOf(id);
    if (frozen(g)) return;
    clearMarks();
    g.value = '';
    refocus = `.mt-card[data-side="left"][data-id="${id}"]`;
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Номер связи — место левой карточки среди ещё не решённых (оно же определяет цвет)
  function numbers() {
    const n = {}, cnt = {}; // нумерация идёт заново в каждом наборе
    leftOrder.filter(id => live(gapOf(id))).forEach(id => { const k = setOf[id]; cnt[k] = (cnt[k] || 0) + 1; n[id] = cnt[k]; });
    return n;
  }

  function cell(side, id, num) {
    const g = gapOf(id);
    const left = side === 'left';
    // У левой карточки своё состояние; у правой — состояние связанной с ней левой
    const owner = left ? g : (gaps.find(x => live(x) && x.value === id) || gaps.find(x => x.state === 'bad' && x.wrongRight === id) || null);
    const linkedTo = left ? (g.value ? g : null) : gaps.find(x => live(x) && x.value === id) || null;
    const n = linkedTo ? num[linkedTo.id] : 0;
    const state = owner && owner.state && (left || !linkedTo || owner === linkedTo) ? owner.state : null;
    const wrap = el('div', 'mt-cell');
    const b = el('button', 'mt-card' + (n ? ' linked' : '') + (left && active === id ? ' sel' : '') + (state ? ' ' + state : ''));
    b.type = 'button';
    b.dataset.side = side;
    b.dataset.id = id;
    if (n) b.style.setProperty('--mt-c', `hsl(${HUES[(n - 1) % HUES.length]} 70% 52%)`);
    const it = item(id), text = String(it[side] || '').trim();
    const pic = picture(it[side + 'Image']);
    const audio = mediaSrc(it[side + 'Audio']);
    if (pic) b.classList.add('has-pic');
    if (n) b.append(el('span', 'mt-tag', String(n)));
    if (pic) b.append(pic.box);
    if (text || !pic) b.append(el('span', 'mt-text', text));
    if (state === 'bad') b.append(el('span', 'mt-mark', ' ✗'));
    if (state === 'ok' && lines()) b.append(el('span', 'mt-mark', ' ✓'));
    const names = [];
    if (n) names.push(`связана, номер ${n}`);
    if (state === 'ok') names.push('верно');
    if (left && active === id) names.push('выбрана, теперь нажмите карточку справа');
    if (state === 'bad') names.push('неверно');
    if (state === 'missing') names.push('не соединена');
    b.setAttribute('aria-label', `${left ? 'Слева' : 'Справа'}: ${text || (pic && pic.alt) || 'картинка'}` + (names.length ? ', ' + names.join(', ') : ''));
    if (left) b.setAttribute('aria-pressed', String(active === id));
    if (finished) b.disabled = true;
    else b.onclick = () => (left ? selectLeft(id) : pickRight(id));
    wrap.append(b);
    // Значки поверх карточки (отдельные от неё элементы, карточку не выбирают): звук, разрыв связи;
    // лупа увеличения — на углу самой картинки (addZoom, core/mediaviewer.js)
    const ctl = el('span', 'mt-ctl' + (pic ? ' top' : ''));
    if (pic) addZoom(wrap, pic.box, pic.src, pic.alt);
    if (audio) ctl.append(audioButton(audio, `m${side}${id}`, 'hintbtn mt-tool mt-voice', '🔊', 'Прослушать карточку'));
    // Ручка для перетаскивания связи на правую карточку (необязательная замена двум нажатиям; ручка не мешает прокрутке страницы)
    if (left && !finished) {
      const h = el('span', 'mt-grab', '⠿');
      h.setAttribute('aria-hidden', 'true');
      h.title = 'Потяните к карточке справа';
      h.onpointerdown = e => startDrag(e, id, b);
      ctl.append(h);
    }
    // Разорвать связь: у левой карточки значок ×, у связанной правой тоже
    if (n && !finished) {
      const x = el('span', 'mt-x', '×');
      x.setAttribute('role', 'button');
      x.tabIndex = 0;
      x.setAttribute('aria-label', `Разорвать связь ${n}`);
      const go = e => { e.stopPropagation(); unlink(linkedTo.id); };
      x.onclick = go;
      x.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } };
      ctl.append(x);
    }
    // Запас справа под значки; ручка перетаскивания в узком окне (телефон) скрыта и места не занимает
    if (ctl.childElementCount) { wrap.append(ctl); b.style.setProperty('--mt-n', ctl.querySelectorAll('.mt-tool, .mt-x').length); b.style.setProperty('--mt-g', ctl.querySelector('.mt-grab') ? 1 : 0); }
    return wrap;
  }

  // Перетаскивание: от ручки левой карточки тянется линия за указателем, отпустили над правой карточкой — связь создана (как два нажатия)
  function startDrag(e, id, btn) {
    if (finished || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    const h = e.currentTarget;
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает: события придут на документ */ }
    const NS = 'http://www.w3.org/2000/svg';
    const r = btn.getBoundingClientRect(), x0 = r.right, y0 = r.top + r.height / 2;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mt-dragline');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(NS, 'line');
    [['x1', x0], ['y1', y0], ['x2', e.clientX], ['y2', e.clientY]].forEach(([k, v]) => line.setAttribute(k, v));
    svg.append(line);
    document.body.append(svg);
    btn.classList.add('dragging');
    let over = null;
    const stop = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', cancel);
      svg.remove(); btn.classList.remove('dragging');
      if (over) over.classList.remove('drop');
    };
    const move = ev => {
      line.setAttribute('x2', ev.clientX); line.setAttribute('y2', ev.clientY);
      const t = document.elementFromPoint(ev.clientX, ev.clientY), c = t && t.closest ? t.closest('.mt-card[data-side="right"]') : null;
      if (c !== over) { if (over) over.classList.remove('drop'); over = c; if (over) over.classList.add('drop'); }
    };
    const up = () => {
      const target = over && over.dataset.id;
      stop();
      if (target && setOf[target] === setOf[id]) { active = id; pickRight(target); }
    };
    const cancel = () => stop();
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', cancel);
  }

  // Картинка карточки: рамка по размеру и вписыванию из «Дизайна»; src и alt нужны для увеличения
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const box = el('span', 'mt-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { box.classList.add('broken'); img.remove(); };
    img.src = src;
    box.append(img);
    return { box, src, alt: img.alt };
  }

  // Одна сторона пары в списке верных пар: уменьшенная картинка и текст
  function face(id, side) {
    const s = el('span', 'mt-face');
    const pic = picture(item(id)[side + 'Image']);
    if (pic) { pic.box.classList.add('mini'); s.append(pic.box); }
    const t = String(item(id)[side] || '').trim();
    if (t || !pic) s.append(el('span', 'mt-text', t));
    return s;
  }

  function pairRow(id, mark) {
    const r = el('div', 'card mt-pair' + (mark ? ' ok' : ''));
    r.append(face(id, 'left'), el('span', 'mt-eq', '↔'), face(id, 'right'));
    if (mark) r.append(el('span', 'mt-mark', '✓'));
    return r;
  }

  // Линии Lines: SVG поверх поля, концы — на внутренних краях связанных карточек. Пересчитываются при любом изменении размера
  function drawLines(board) {
    if (!board) return;
    const box = board.querySelector('.mt-svgbox');
    const paint = () => {
      const b = board.getBoundingClientRect();
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'mt-svg');
      svg.setAttribute('width', b.width);
      svg.setAttribute('height', b.height);
      svg.setAttribute('aria-hidden', 'true');
      const num = numbers();
      const comic = document.documentElement.classList.contains('style-comic');
      gaps.forEach(g => {
        if (!g.value) return;
        const l = board.querySelector(`.mt-card[data-side="left"][data-id="${g.id}"]`), r = board.querySelector(`.mt-card[data-side="right"][data-id="${g.value}"]`);
        if (!l || !r) return;
        const lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();
        const x1 = lr.right - b.left, y1 = lr.top + lr.height / 2 - b.top, x2 = rr.left - b.left, y2 = rr.top + rr.height / 2 - b.top;
        const color = g.state === 'ok' ? 'var(--ok)' : g.state === 'bad' ? 'var(--bad)' : `hsl(${HUES[(num[g.id] - 1) % HUES.length]} 70% 52%)`;
        const draw = (el, w, op) => {
          el.setAttribute('stroke', color); el.setAttribute('stroke-width', w); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
          el.setAttribute('fill', 'none'); if (op) el.setAttribute('opacity', op);
          svg.append(el);
        };
        if (comic) {
          // Как нарисовано от руки: линия слегка виляет, рядом второй, тоньше, штрих. Неровность зависит от ID пары, поэтому не дрожит при перерисовке
          const seed = [...g.id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
          const rnd = k => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1 - 0.5;
          [0, 1].forEach(pass => {
            const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(len / 28));
            const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
            const pts = Array.from({ length: n + 1 }, (_, k) => {
              const t = k / n, off = k === 0 || k === n ? rnd(k + pass * 50) * 2 : rnd(k + pass * 50) * 7;
              return [x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off];
            });
            let dd = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
            for (let k = 1; k < pts.length; k++) { const mx = (pts[k - 1][0] + pts[k][0]) / 2, my = (pts[k - 1][1] + pts[k][1]) / 2; dd += ` Q${pts[k - 1][0].toFixed(1)} ${pts[k - 1][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
            dd += ` L${pts[n][0].toFixed(1)} ${pts[n][1].toFixed(1)}`;
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', dd);
            path.setAttribute('class', 'mt-hand');
            draw(path, pass ? 1.5 : 3, pass ? 0.7 : 0);
          });
        } else {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
          draw(line, 3, 0);
        }
      });
      box.replaceChildren(svg);
    };
    paint();
    if (window.ResizeObserver) { const o = new ResizeObserver(paint); ros.push(o); o.observe(board); board.querySelectorAll('.mt-card').forEach(c => o.observe(c)); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (board.isConnected) paint(); });
  }

  function renderInto(root) {
    const rest = leftOrder.filter(id => live(gapOf(id)));
    const unsolved = leftOrder.filter(id => !gapOf(id).locked);
    // Неверная пара отвязывается сразу после проверки: красный след остаётся на карточках, пока ученик не начнёт новое соединение.
    // В Lines связи остаются как есть: красные линии и карточки — итог единственной проверки
    if (!lines()) gaps.forEach(g => { if (g.state === 'bad' && g.value) { g.wrongRight = g.value; g.value = ''; } });
    const num = numbers();
    // Выравнивание текста: «авто» — по центру, а если в упражнении есть длинная карточка, то у всех по левому краю
    const long = data.items.some(i => String(i.left).length > 40 || String(i.right).length > 40);
    const wrapper = el('div', 'mt-wrap mt-al-' + (data.align === 'left' || (data.align !== 'center' && long) ? 'left' : 'center') + ' mt-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm') + (data.imageFit === 'cover' ? ' mt-fit-cover' : ''));
    ros.forEach(r => r.disconnect()); ros = [];
    const many = sets.length > 1;
    if (rest.length) {
      const hint = el('p', 'mt-hint', active ? 'Теперь нажмите карточку справа.' : 'Нажмите карточку слева, потом её пару справа.');
      hint.setAttribute('role', 'status');
      wrapper.append(finished ? el('p', 'mt-hint', lines() ? 'Проверка выполнена: верные пары зелёные, неверные красные.' : 'Упражнение закончено.') : hint);
    }
    // Каждый набор — своя инструкция, своё поле из двух столбцов и своя зелёная зона; ход проверок и баллы общие
    sets.forEach((set, k) => {
      const box = el('section', 'mt-set');
      if (many) {
        box.setAttribute('aria-label', `Набор ${k + 1}`);
        if (String(set.instruction || '').trim()) box.append(el('p', 'mt-setins', set.instruction));
      }
      const mine = rest.filter(id => setOf[id] === k);
      if (mine.length) {
        const board = el('div', 'mt-board');
        const colL = el('div', 'mt-col'), colR = el('div', 'mt-col');
        colL.setAttribute('role', 'group'); colL.setAttribute('aria-label', many ? `Набор ${k + 1}, левый столбец` : 'Левый столбец');
        colR.setAttribute('role', 'group'); colR.setAttribute('aria-label', many ? `Набор ${k + 1}, правый столбец` : 'Правый столбец');
        mine.forEach(id => colL.append(cell('left', id, num)));
        rightOrder.filter(id => setOf[id] === k && live(gapOf(id))).forEach(id => colR.append(cell('right', id, num)));
        board.append(colL, colR);
        if (lines()) { board.classList.add('mt-lines'); board.prepend(el('div', 'mt-svgbox')); }
        box.append(board);
      }
      const solved = lines() ? [] : leftOrder.filter(id => setOf[id] === k && gapOf(id).locked);
      if (solved.length) {
        const sec = el('section', 'mt-solved');
        sec.setAttribute('aria-label', 'Верные пары');
        sec.append(el('h3', '', `Верные пары: ${solved.length}`));
        solved.forEach(id => sec.append(pairRow(id, true)));
        box.append(sec);
      }
      if (box.childElementCount) wrapper.append(box);
    });    // Верные пары для оставшихся — по желанию автора, только после конца
    if (finished && data.showCorrect === true && unsolved.length) {
      const btn = el('button', 'mt-reveal', showAnswers ? 'Скрыть верные пары' : 'Показать верные пары');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', String(showAnswers));
      btn.onclick = () => { showAnswers = !showAnswers; refocus = '.mt-reveal'; render(); };
      wrapper.append(btn);
      if (showAnswers) {
        const sec = el('section', 'mt-answers');
        sec.append(el('h3', '', 'Правильные пары'));
        unsolved.forEach(id => sec.append(pairRow(id, false)));
        wrapper.append(sec);
      }
    }
    root.append(wrapper);
    wrapper.querySelectorAll('.mt-lines').forEach(drawLines);
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, goMissing, instant, maxChecks, missingNote, render: renderInto };
})();
