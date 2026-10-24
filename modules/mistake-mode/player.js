// Плеер модуля Mistake Mode: ученик видит обычный текст и нажатием отмечает слова, которые считает ошибками.
// Общая часть прохождения — шапка, инструкция, число проверок, результат, сброс — живёт в index.html и работает с теми же
// переменными (data, gaps, finished, note, checksUsed) и функцией render(). Здесь то, что отличает модуль: слова-кнопки,
// своя проверка (check) и свой текст строки результата (status). Каждая настоящая ошибка — «пропуск» общего хода (unit):
// locked — найдена и закреплена. Отметки ученика (marks) лежат отдельно: среди них бывают и ложные.
const MistakeModePlayer = (() => {
  let idx = 0; // какой текст показан
  let refocus = null; // куда вернуть фокус после перерисовки
  let marks = {}; // ID текста → множество номеров слов, отмеченных учеником
  let flagged = {}; // ID текста → ложные отметки, найденные последней проверкой (красные до снятия)
  const texts = () => data.texts || [];

  function units() {
    return texts().flatMap(t => (t.errors || []).map(e => ({
      id: e.id, textId: t.id, index: e.index, word: e.word, explanation: String(e.explanation || '').trim(),
      answer: '', alternatives: [], hint: '', audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    idx = 0; refocus = null; marks = {}; flagged = {};
    texts().forEach(t => { marks[t.id] = new Set(); flagged[t.id] = new Set(); });
  }

  const unitAt = (t, i) => gaps.find(g => g.textId === t.id && g.index === i);
  const total = () => Object.values(marks).reduce((n, s) => n + s.size, 0);
  const falseCount = () => texts().reduce((n, t) => n + [...marks[t.id]].filter(i => !unitAt(t, i)).length, 0);
  const flaggedCount = () => texts().reduce((n, t) => n + flagged[t.id].size, 0);

  // Ничего не отмечено: проверку не тратим
  function check() {
    if (!total()) return { note: 'Отметьте хотя бы одно слово, потом нажмите «Проверить».' };
    gaps.forEach(g => { if (!g.locked && marks[g.textId].has(g.index)) { g.locked = true; g.state = 'ok'; } });
    texts().forEach(t => {
      flagged[t.id] = new Set([...marks[t.id]].filter(i => !unitAt(t, i)));
    });
    return { done: gaps.every(g => g.locked) && falseCount() === 0 };
  }

  function status() {
    if (finished) {
      const f = falseCount();
      return f ? `Результат: ${gaps.filter(g => g.locked).length} из ${gaps.length} · есть лишние отметки: ${f}` : null;
    }
    if (checksUsed === 0) return `Отмечено слов: ${total()}`;
    const bad = flaggedCount();
    return `Найдено: ${gaps.filter(g => g.locked).length} из ${gaps.length}` + (bad ? ` · Лишних отметок: ${bad}` : '') + ` · Проверок осталось: ${maxChecks - checksUsed}`;
  }
  // Пока осталась ложная отметка, полные 100% недоступны, даже если все ошибки найдены
  const percent = pct => (finished && falseCount() ? Math.min(pct, 99) : pct);
  const started = () => total() > 0;

  function toggle(t, i) {
    const g = unitAt(t, i);
    if (finished || (g && g.locked)) return;
    const s = marks[t.id];
    if (s.has(i)) { s.delete(i); flagged[t.id].delete(i); } else s.add(i);
    note = '';
    refocus = `.mm-card .mm-w[data-i="${i}"]`;
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function textCard(k) {
    const t = texts()[k];
    const c = el('div', 'card mm-card');
    const ins = String(t.instruction || '').trim();
    if (ins) c.append(el('p', 'mm-ins', ins));
    const body = el('div', 'mm-body');
    body.lang = '';
    MistakeTokens.split(t.text).forEach(p => {
      if (!p.word) { body.append(document.createTextNode(p.s)); return; }
      const g = unitAt(t, p.i), marked = marks[t.id].has(p.i);
      const state = g && g.locked ? 'ok' : !marked ? (finished && g ? 'miss' : '') : flagged[t.id].has(p.i) || (finished && !g) ? 'bad' : 'on';
      const w = el('span', 'mm-w' + (state ? ' ' + state : ''), p.s);
      w.dataset.i = p.i;
      w.setAttribute('role', 'button');
      w.setAttribute('aria-pressed', String(marked));
      const frozenWord = finished || (g && g.locked);
      w.tabIndex = frozenWord ? -1 : 0;
      if (frozenWord) w.setAttribute('aria-disabled', 'true');
      // Результат не только цветом: у найденной ошибки ✓, у ложной отметки ✗ (значки в CSS), для скринридера — подпись
      if (state === 'ok') w.setAttribute('aria-label', p.s + ', ошибка найдена');
      if (state === 'bad') w.setAttribute('aria-label', p.s + ', отмечено ошибочно');
      if (state === 'miss') w.setAttribute('aria-label', p.s + ', пропущенная ошибка');
      if (!frozenWord) {
        w.onclick = () => toggle(t, p.i);
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t, p.i); } };
      }
      body.append(w);
    });
    c.append(body);
    // Пояснения: к найденным ошибкам — сразу, ко всем — в конце упражнения
    const notes = gaps.filter(g => g.textId === t.id && g.explanation && (g.locked || finished)).sort((a, b) => a.index - b.index);
    if (notes.length) {
      const box = el('div', 'mm-expl');
      notes.forEach(g => {
        const row = el('p', '');
        row.append(el('b', '', `«${g.word}»: `), document.createTextNode(g.explanation));
        box.append(row);
      });
      c.append(box);
    }
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Тексты');
    texts().forEach((t, i) => {
      const mine = gaps.filter(g => g.textId === t.id);
      const done = mine.length && mine.every(g => g.locked);
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (marks[t.id].size ? ' answered' : '') + (done ? ' ok' : ''), String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Текст ${i + 1}` + (i === idx ? ', текущий' : '') + (done ? ', все ошибки найдены' : marks[t.id].size ? ', есть отметки' : ''));
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
    if (texts().length > 1) nav(root);
    if (texts().length) root.append(textCard(idx));
    if (texts().length > 1) pager(root);
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
