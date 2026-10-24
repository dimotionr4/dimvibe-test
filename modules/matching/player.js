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
  let ro = null; // следит за размером поля, чтобы линии шли за карточками

  // Единицы общего хода: подсказок и звука пока нет
  function units() {
    return data.items.map(it => ({
      id: it.id, answer: it.id, alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', wrongRight: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Столбцы перемешиваются независимо; если вышло так, что пары стоят «по строкам», тасуем ещё раз
  function reset() {
    const ids = data.items.map(i => i.id);
    leftOrder = shuffle(ids);
    rightOrder = shuffle(ids);
    for (let k = 0; k < 6 && ids.length > 1 && rightOrder.every((r, i) => r === leftOrder[i]); k++) rightOrder = shuffle(ids);
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
    const n = {};
    leftOrder.filter(id => live(gapOf(id))).forEach((id, k) => { n[id] = k + 1; });
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
    if (n) b.append(el('span', 'mt-tag', String(n)));
    b.append(el('span', 'mt-text', item(id)[side]));
    if (state === 'bad') b.append(el('span', 'mt-mark', ' ✗'));
    if (state === 'ok' && lines()) b.append(el('span', 'mt-mark', ' ✓'));
    const names = [];
    if (n) names.push(`связана, номер ${n}`);
    if (state === 'ok') names.push('верно');
    if (left && active === id) names.push('выбрана, теперь нажмите карточку справа');
    if (state === 'bad') names.push('неверно');
    if (state === 'missing') names.push('не соединена');
    b.setAttribute('aria-label', `${left ? 'Слева' : 'Справа'}: ${item(id)[side]}` + (names.length ? ', ' + names.join(', ') : ''));
    if (left) b.setAttribute('aria-pressed', String(active === id));
    if (finished) b.disabled = true;
    else b.onclick = () => (left ? selectLeft(id) : pickRight(id));
    wrap.append(b);
    // Разорвать связь: у левой карточки значок ×, у связанной правой тоже
    if (n && !finished) {
      const x = el('span', 'mt-x', '×');
      x.setAttribute('role', 'button');
      x.tabIndex = 0;
      x.setAttribute('aria-label', `Разорвать связь ${n}`);
      const go = e => { e.stopPropagation(); unlink(linkedTo.id); };
      x.onclick = go;
      x.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } };
      wrap.append(x);
    }
    return wrap;
  }

  function pairRow(id, mark) {
    const r = el('div', 'card mt-pair' + (mark ? ' ok' : ''));
    r.append(el('span', 'mt-text', item(id).left), el('span', 'mt-eq', '↔'), el('span', 'mt-text', item(id).right));
    if (mark) r.append(el('span', 'mt-mark', '✓'));
    return r;
  }

  // Линии Lines: SVG поверх поля, концы — на внутренних краях связанных карточек. Пересчитываются при любом изменении размера
  function drawLines(board) {
    if (ro) { ro.disconnect(); ro = null; }
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
      gaps.forEach(g => {
        if (!g.value) return;
        const l = board.querySelector(`.mt-card[data-side="left"][data-id="${g.id}"]`), r = board.querySelector(`.mt-card[data-side="right"][data-id="${g.value}"]`);
        if (!l || !r) return;
        const lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', lr.right - b.left); line.setAttribute('y1', lr.top + lr.height / 2 - b.top);
        line.setAttribute('x2', rr.left - b.left); line.setAttribute('y2', rr.top + rr.height / 2 - b.top);
        line.setAttribute('stroke', g.state === 'ok' ? 'var(--ok)' : g.state === 'bad' ? 'var(--bad)' : `hsl(${HUES[(num[g.id] - 1) % HUES.length]} 70% 52%)`);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        svg.append(line);
      });
      box.replaceChildren(svg);
    };
    paint();
    if (window.ResizeObserver) { ro = new ResizeObserver(paint); ro.observe(board); board.querySelectorAll('.mt-card').forEach(c => ro.observe(c)); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (board.isConnected) paint(); });
  }

  function renderInto(root) {
    const rest = leftOrder.filter(id => live(gapOf(id)));
    const unsolved = leftOrder.filter(id => !gapOf(id).locked);
    // Неверная пара отвязывается сразу после проверки: красный след остаётся на карточках, пока ученик не начнёт новое соединение.
    // В Lines связи остаются как есть: красные линии и карточки — итог единственной проверки
    if (!lines()) gaps.forEach(g => { if (g.state === 'bad' && g.value) { g.wrongRight = g.value; g.value = ''; } });
    const num = numbers();
    const wrapper = el('div', 'mt-wrap');
    if (rest.length) {
      const hint = el('p', 'mt-hint', active ? 'Теперь нажмите карточку справа.' : 'Нажмите карточку слева, потом её пару справа.');
      hint.setAttribute('role', 'status');
      const board = el('div', 'mt-board');
      const colL = el('div', 'mt-col'), colR = el('div', 'mt-col');
      colL.setAttribute('role', 'group'); colL.setAttribute('aria-label', 'Левый столбец');
      colR.setAttribute('role', 'group'); colR.setAttribute('aria-label', 'Правый столбец');
      rest.forEach(id => colL.append(cell('left', id, num)));
      rightOrder.filter(id => live(gapOf(id))).forEach(id => colR.append(cell('right', id, num)));
      board.append(colL, colR);
      if (lines()) { board.classList.add('mt-lines'); board.prepend(el('div', 'mt-svgbox')); }
      wrapper.append(finished ? el('p', 'mt-hint', lines() ? 'Проверка выполнена: верные пары зелёные, неверные красные.' : 'Упражнение закончено.') : hint, board);
    }
    const solved = lines() ? [] : leftOrder.filter(id => gapOf(id).locked);
    if (solved.length) {
      const sec = el('section', 'mt-solved');
      sec.setAttribute('aria-label', 'Верные пары');
      sec.append(el('h3', '', `Верные пары: ${solved.length}`));
      solved.forEach(id => sec.append(pairRow(id, true)));
      wrapper.append(sec);
    }
    // Верные пары для оставшихся — по желанию автора, только после конца
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
    drawLines(wrapper.querySelector('.mt-lines'));
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, goMissing, instant, maxChecks, missingNote, render: renderInto };
})();
