// Плеер модуля Multiple Choice: у каждого вопроса варианты, ученик выбирает один (Single) или несколько (Multiple Select).
// Общая часть прохождения — шапка, инструкция, проверки, закрепление, результат, сброс — живёт в index.html и работает с теми же
// переменными (data, gaps, finished, note, checksUsed) и функцией render(). Каждый вопрос — «пропуск» общего хода: answer — верный набор
// (ID вариантов по алфавиту через запятую), value — выбранный набор в том же виде. Балл только за точный набор.
// Номера, кнопки «Предыдущий / Следующий» и их стили общие с True / False (классы tf-dots, tf-dot, tf-pager, tf-count в modules/true-false/player.css).
const MultipleChoicePlayer = (() => {
  let idx = 0; // какой вопрос показан в режиме «по одному»
  let refocus = null, showFix = false;
  const listView = () => data.view === 'list';
  const instant = () => !listView(); // «по одному»: одна попытка на вопрос
  const ids = s => String(s || '').split(',').filter(Boolean);
  const join = a => [...a].sort().join(',');
  const modeOf = it => (it.mode === 'multiple' ? 'multiple' : 'single');

  function shuffleArr(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]); }

  // Порядок вариантов выбирается один раз при загрузке и не меняется при «Начать заново»
  function units() {
    showFix = false;
    return data.items.map(it => {
      const order = (it.options || []).map(o => o.id);
      return {
        id: it.id, answer: join(it.correct || []), alternatives: [], hint: '', audio: null, hintAudio: null,
        order: data.shuffle === false ? order : shuffleArr(order),
        value: '', bankKey: null, locked: false, state: null,
      };
    });
  }

  const reset = () => { idx = 0; refocus = null; showFix = false; };
  function goMissing() { const i = gaps.findIndex(g => g.state === 'missing'); if (i >= 0) idx = i; }
  const missingNote = n => (n === 1 ? 'Ответьте на вопрос, который остался без ответа.' : `Ответьте на все вопросы: ещё ${n}.`);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const label = n => (data.labels === 'numbers' ? String(n + 1) : String.fromCharCode(65 + n));

  function finalize(i) {
    const g = gaps[i];
    g.final = true;
    g.locked = g.value === g.answer;
    g.state = g.locked ? 'ok' : 'bad';
    checksUsed = 1;
    if (gaps.every(x => x.final)) finished = true;
  }

  function pick(i, optId) {
    const g = gaps[i], it = data.items[i];
    if (frozen(g)) return;
    if (modeOf(it) === 'single') g.value = optId;
    else { const s = new Set(ids(g.value)); if (s.has(optId)) s.delete(optId); else s.add(optId); g.value = join(s); }
    g.state = null;
    note = '';
    if (instant() && modeOf(it) === 'single') { finalize(i); refocus = null; } // Single «по одному»: ответ засчитывается сразу
    else refocus = `.mc-card[data-i="${i}"] .mc-opt[data-k="${optId}"]`;
    render();
  }

  function card(i) {
    const it = data.items[i], g = gaps[i], multi = modeOf(it) === 'multiple';
    const chosen = new Set(ids(g.value)), right = new Set(it.correct || []);
    const c = el('div', 'card mc-card' + (g.state ? ' ' + g.state : '') + (g.locked ? ' locked' : ''));
    c.dataset.i = i;
    const head = el('div', 'mc-q');
    if (data.items.length > 1) head.append(el('span', 'tf-num', `${i + 1}.`));
    head.append(el('span', 'tf-text', it.text));
    c.append(head);
    // Подсказка «Выберите N правильных ответов» — только у Multiple Select и только если включена в «Поведении»
    if (multi && data.showCount) c.append(el('div', 'mc-count', `Выберите правильных ответов: ${right.size}`));
    const list = el('div', 'mc-opts');
    list.setAttribute('role', multi ? 'group' : 'radiogroup');
    list.setAttribute('aria-label', `Варианты ответа на вопрос ${i + 1}`);
    const byId = Object.fromEntries((it.options || []).map(o => [o.id, o]));
    const showRight = showFix && finished && g.state === 'bad';
    g.order.forEach((oid, n) => {
      const o = byId[oid];
      if (!o) return;
      const on = chosen.has(oid);
      // Для Single верность выбранного варианта видна (он один); для Multiple верность отдельных вариантов не раскрывается — только вся карточка
      const b = el('button', 'mc-opt' + (multi ? ' multi' : '') + (on ? ' on' : '') + (on && g.state && !multi ? ' ' + g.state : '') + (showRight && right.has(oid) ? ' right' : ''));
      b.type = 'button';
      b.dataset.k = oid;
      b.setAttribute('role', multi ? 'checkbox' : 'radio');
      b.setAttribute('aria-checked', String(on));
      b.append(el('span', 'mc-mark'), el('span', 'mc-lab', label(n)), el('span', 'mc-text', o.text));
      if (showRight && right.has(oid)) b.append(el('span', 'mc-tick', ' ✓ верный'));
      if (frozen(g)) b.disabled = true;
      else b.onclick = () => pick(i, oid);
      list.append(b);
    });
    c.append(list);
    // Multiple Select «по одному»: ответ фиксируется кнопкой «Ответить»
    if (instant() && multi && !g.final && !finished) {
      const go = el('button', 'mc-answer primary', 'Ответить');
      go.type = 'button';
      go.disabled = !g.value;
      go.onclick = () => { finalize(i); render(); };
      c.append(go);
    }
    // Итог по вопросу: не только цветом
    if (g.state === 'ok' || g.state === 'bad') c.append(el('div', 'mc-verdict ' + g.state, g.state === 'ok' ? '✓ Верно' : '✗ Неверно'));
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Вопросы');
    gaps.forEach((g, i) => {
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (g.value ? ' answered' : '') + (g.state ? ' ' + g.state : ''), String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Вопрос ${i + 1}` + (i === idx ? ', текущий' : '') + (g.state === 'ok' ? ', верно' : g.state === 'bad' ? ', неверно' : g.value ? ', ответ выбран' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; refocus = `.tf-dot:nth-child(${i + 1})`; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущий'), next = el('button', '', 'Следующий ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= gaps.length - 1;
    prev.onclick = () => { idx--; refocus = '.tf-pager button:first-child'; render(); };
    next.onclick = () => { idx++; refocus = '.tf-pager button:last-child'; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${gaps.length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= data.items.length) idx = Math.max(0, data.items.length - 1);
    if (listView() || data.items.length < 2) data.items.forEach((_, i) => root.append(card(i)));
    else { nav(root); root.append(card(idx)); pager(root); }
    // После завершения (если включено в «Поведении»): переключатель верного набора для неверных вопросов
    if (data.showCorrect && finished && gaps.some(g => g.state === 'bad')) {
      const bar = el('div', 'mc-fixbar');
      const b = el('button', '', showFix ? 'Скрыть верные ответы' : 'Показать верные ответы');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(showFix));
      b.onclick = () => { showFix = !showFix; render(); };
      bar.append(b);
      root.append(bar);
    }
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, goMissing, missingNote, instant, render: renderInto };
})();
