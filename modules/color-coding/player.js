// Плеер модуля Color Coding: над текстом ряд категорий (название и цвет); ученик выбирает категорию и нажимает на слова.
// Общая часть прохождения — шапка, инструкция, число проверок, результат, сброс — живёт в index.html и работает с теми же
// переменными (data, gaps, finished, note, checksUsed) и функцией render(). Каждое слово, отмеченное автором, — «пропуск» общего
// хода (unit): locked — окрашено верно и закреплено. Окраска ученика (picks) лежит отдельно: среди неё бывают и ложные отметки.
const ColorCodingPlayer = (() => {
  const { colorOf } = ColorTokens;
  let idx = 0; // какой текст показан
  let refocus = null; // куда вернуть фокус после перерисовки
  let active = null; // выбранная категория
  let picks = {}; // ID текста → Map: номер слова → ID категории, которой его окрасил ученик
  let flagged = {}; // ID текста → слова, окрашенные неверно по последней проверке (✗ до следующего нажатия)
  const texts = () => data.texts || [];
  const cats = () => data.categories || [];
  const catById = id => cats().find(c => c.id === id);
  const listView = () => data.view === 'list'; // «все тексты сразу»: карточки друг под другом, без переключателя

  function units() {
    return texts().flatMap(t => (t.marks || []).map(m => ({
      id: m.id, textId: t.id, index: m.index, word: m.word, cat: m.cat,
      answer: '', alternatives: [], hint: '', audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    idx = 0; refocus = null; picks = {}; flagged = {};
    active = cats().length ? cats()[0].id : null; // первая категория выбрана сразу: можно нажимать на слова
    texts().forEach(t => { picks[t.id] = new Map(); flagged[t.id] = new Set(); });
  }

  const unitAt = (t, i) => gaps.find(g => g.textId === t.id && g.index === i);
  const total = () => Object.values(picks).reduce((n, m) => n + m.size, 0);
  // Ложная отметка — окрашено слово без категории у автора или окрашено не той категорией
  const isFalse = (t, i) => { const g = unitAt(t, i); return !g || picks[t.id].get(i) !== g.cat; };
  const falseCount = () => texts().reduce((n, t) => n + [...picks[t.id].keys()].filter(i => isFalse(t, i)).length, 0);
  const flaggedCount = () => texts().reduce((n, t) => n + flagged[t.id].size, 0);

  // Ничего не окрашено: проверку не тратим. Сколько слов нужно окрасить, ученик не знает, поэтому полноты не требуем
  function check() {
    if (!total()) return { note: 'Окрасьте хотя бы одно слово, потом нажмите «Проверить».' };
    gaps.forEach(g => {
      if (g.locked) return;
      const v = picks[g.textId].get(g.index);
      g.locked = v === g.cat;
      g.state = g.locked ? 'ok' : null; // неверный цвет не раскрываем: слово просто помечается ✗ (flagged)
    });
    texts().forEach(t => { flagged[t.id] = new Set([...picks[t.id].keys()].filter(i => isFalse(t, i))); });
    return { done: gaps.every(g => g.locked) && falseCount() === 0 };
  }

  function status() {
    if (finished) {
      const f = falseCount();
      return f ? `Результат: ${gaps.filter(g => g.locked).length} из ${gaps.length} · неверных отметок: ${f}` : null;
    }
    if (checksUsed === 0) return `Окрашено слов: ${total()}`;
    const bad = flaggedCount();
    return `Верно: ${gaps.filter(g => g.locked).length} из ${gaps.length}` + (bad ? ` · Неверно: ${bad}` : '') + ` · Проверок осталось: ${maxChecks - checksUsed}`;
  }
  // Пока осталась ложная отметка, полные 100% недоступны, даже если все слова окрашены верно
  const percent = pct => (finished && falseCount() ? Math.min(pct, 99) : pct);
  const started = () => total() > 0;

  // Нажатие: та же категория — снять цвет, другая — перекрасить, без цвета — окрасить
  function toggle(t, i) {
    const g = unitAt(t, i);
    if (finished || (g && g.locked) || !catById(active)) return;
    const m = picks[t.id];
    if (m.get(i) === active) m.delete(i); else m.set(i, active);
    flagged[t.id].delete(i);
    note = '';
    refocus = `.cc-card .cc-w[data-t="${t.id}"][data-i="${i}"]`;
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Ряд категорий: общий для всех текстов; выбранная — с рамкой и галочкой, не только цветом
  function palette(root) {
    const row = el('div', 'cc-palette');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Категории');
    cats().forEach((c, k) => {
      const on = c.id === active;
      const b = el('button', 'cc-chip' + (on ? ' on' : ''));
      b.type = 'button';
      b.style.setProperty('--cc', colorOf(c.color));
      b.setAttribute('aria-pressed', String(on));
      b.disabled = finished;
      b.append(el('i', 'cc-chipdot'), el('span', '', c.name));
      b.onclick = () => { active = c.id; refocus = `.cc-palette .cc-chip:nth-child(${k + 1})`; render(); };
      row.append(b);
    });
    root.append(row);
  }

  function textCard(k) {
    const t = texts()[k];
    const c = el('div', 'card cc-card');
    const ins = String(t.instruction || '').trim();
    if (texts().length > 1 && listView()) c.append(el('p', 'cc-tnum', `Текст ${k + 1}`)); // при показе всех текстов сразу каждый подписан номером
    if (ins) c.append(el('p', 'cc-ins', ins));
    const body = el('div', 'cc-body');
    let missed = false;
    ColorTokens.split(t.text).forEach(p => {
      if (!p.word) { body.append(document.createTextNode(p.s)); return; }
      const g = unitAt(t, p.i), pick = picks[t.id].get(p.i);
      // Состояние: ok — верно и закреплено; bad — неверно по проверке; miss — в конце: правильный цвет слова, которое не окрашено верно
      let state = '', color = pick;
      if (g && g.locked) state = 'ok';
      else if (finished && g) { state = pick ? 'miss bad' : 'miss'; color = g.cat; missed = true; } // окрашено не той категорией — ещё и ✗
      else if (pick && (flagged[t.id].has(p.i) || finished)) state = 'bad';
      const cat = catById(color);
      const w = el('span', 'cc-w' + (cat ? ' on' : '') + (state ? ' ' + state : ''), p.s);
      if (cat) w.style.setProperty('--cc', colorOf(cat.color));
      w.dataset.i = p.i;
      w.dataset.t = t.id;
      w.setAttribute('role', 'button');
      w.setAttribute('aria-pressed', String(!!pick));
      const frozen = finished || (g && g.locked);
      w.tabIndex = frozen ? -1 : 0;
      if (frozen) w.setAttribute('aria-disabled', 'true');
      const label = state === 'ok' ? 'верно' : state === 'bad' ? 'неверно' : state === 'miss' ? 'правильная категория' : state === 'miss bad' ? 'окрашено неверно, показана правильная категория' : '';
      if (cat) { w.title = cat.name; w.setAttribute('aria-label', `${p.s}, ${cat.name}` + (label ? ', ' + label : '')); }
      if (!frozen) {
        w.onclick = () => toggle(t, p.i);
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t, p.i); } };
      }
      body.append(w);
    });
    c.append(body);
    if (finished && missed) c.append(el('p', 'cc-legend', 'Пунктиром показан правильный цвет слов, которые не были окрашены верно; ✗ — слово было окрашено неверно.'));
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Тексты');
    texts().forEach((t, i) => {
      const mine = gaps.filter(g => g.textId === t.id);
      const done = mine.length && mine.every(g => g.locked);
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (picks[t.id].size ? ' answered' : '') + (done ? ' ok' : ''), String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Текст ${i + 1}` + (i === idx ? ', текущий' : '') + (done ? ', всё окрашено верно' : picks[t.id].size ? ', есть окрашенные слова' : ''));
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
    next.disabled = idx >= texts().length - 1;
    prev.onclick = () => { idx--; refocus = '.tf-pager button:first-child'; render(); };
    next.onclick = () => { idx++; refocus = '.tf-pager button:last-child'; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${texts().length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= texts().length) idx = Math.max(0, texts().length - 1);
    if (!catById(active) && cats().length) active = cats()[0].id;
    palette(root);
    const one = texts().length > 1 && !listView(); // переключатель нужен только при показе «по одному»
    if (one) nav(root);
    if (one || texts().length < 2) { if (texts().length) root.append(textCard(idx)); }
    else texts().forEach((_, k) => root.append(textCard(k)));
    if (one) pager(root);
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && t.tabIndex >= 0) t.focus({ preventScroll: true });
    }
  }

  // Эти ветки общего хода здесь не нужны: «пустых» единиц у модуля нет
  const goMissing = () => {};
  const missingNote = () => '';
  const instant = () => false;

  return { units, reset, check, status, percent, started, goMissing, missingNote, instant, render: renderInto };
})();
