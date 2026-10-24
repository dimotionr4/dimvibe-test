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
  let fixes = {}; // ID текста → номер слова → введённое исправление
  let fixState = {}; // ID текста → номер слова → 'ok' (исправление верно) или 'bad' (неверно), до следующей правки поля
  const texts = () => data.texts || [];
  // Поля исправлений есть у текста, если хотя бы одна его ошибка требует исправления
  const needsFixes = t => (t.errors || []).some(e => e.requiresCorrection === true);

  function units() {
    return texts().flatMap(t => (t.errors || []).map(e => ({
      id: e.id, textId: t.id, index: e.index, word: e.word, explanation: String(e.explanation || '').trim(),
      requires: e.requiresCorrection === true, correction: String(e.correction || ''), fixes: Array.isArray(e.alternatives) ? e.alternatives.map(String) : [],
      answer: '', alternatives: [], hint: '', audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    idx = 0; refocus = null; marks = {}; flagged = {}; fixes = {}; fixState = {};
    texts().forEach(t => { marks[t.id] = new Set(); flagged[t.id] = new Set(); fixes[t.id] = {}; fixState[t.id] = {}; });
  }

  const unitAt = (t, i) => gaps.find(g => g.textId === t.id && g.index === i);
  const total = () => Object.values(marks).reduce((n, s) => n + s.size, 0);
  const falseCount = () => texts().reduce((n, t) => n + [...marks[t.id]].filter(i => !unitAt(t, i)).length, 0);
  const flaggedCount = () => texts().reduce((n, t) => n + flagged[t.id].size, 0);

  // Ничего не отмечено: проверку не тратим
  function check() {
    if (!total()) return { note: 'Отметьте хотя бы одно слово, потом нажмите «Проверить».' };
    // Ошибка без исправления засчитывается за находку; с исправлением — только если введено допустимое (основное или альтернатива)
    gaps.forEach(g => {
      if (g.locked || !marks[g.textId].has(g.index)) return;
      if (!g.requires) { g.locked = true; g.state = 'ok'; return; }
      const v = fixes[g.textId][g.index] || '';
      const right = [g.correction, ...g.fixes].some(a => norm(a) !== '' && norm(a) === norm(v));
      g.locked = right;
      g.state = right ? 'ok' : 'half';
      fixState[g.textId][g.index] = right ? 'ok' : 'bad';
    });
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
    if (g) g.state = null; // отметка снята или поставлена заново: прежний результат исправления не показываем
    delete fixState[t.id][i];
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

  // Картинка текста: рамка по размеру и вписыванию из «Дизайна», значок увеличения — отдельная кнопка поверх
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('div', 'mm-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { wrap.classList.add('broken'); img.remove(); };
    img.src = src;
    const z = el('button', 'hintbtn mm-zoom', '⤢');
    z.type = 'button';
    z.setAttribute('aria-label', 'Увеличить картинку');
    z.title = 'Увеличить';
    z.onclick = () => openMediaViewer(src, img.alt);
    wrap.append(img, z);
    return wrap;
  }

  function textCard(k) {
    const t = texts()[k];
    const c = el('div', 'card mm-card mm-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm') + (data.imageFit === 'cover' ? ' mm-fit-cover' : ''));
    const ins = String(t.instruction || '').trim();
    if (ins) c.append(el('p', 'mm-ins', ins));
    const pic = picture(t.image), audio = mediaSrc(t.audio);
    if (pic) c.append(pic);
    if (audio) {
      const row = el('p', 'mm-audio');
      row.append(audioButton(audio, 'mmt' + t.id, 'audbtn', '🔊', 'Прослушать текст', 'Слушать'));
      c.append(row);
    }
    const body = el('div', 'mm-body');
    body.lang = '';
    MistakeTokens.split(t.text).forEach(p => {
      if (!p.word) { body.append(document.createTextNode(p.s)); return; }
      const g = unitAt(t, p.i), marked = marks[t.id].has(p.i);
      const state = g && g.locked ? 'ok' : !marked ? (finished && g ? 'miss' : '') : g && g.state === 'half' ? 'half' : flagged[t.id].has(p.i) || (finished && !g) ? 'bad' : 'on';
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
      if (state === 'half') w.setAttribute('aria-label', p.s + ', слово найдено, исправление неверное');
      if (!frozenWord) {
        w.onclick = () => toggle(t, p.i);
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t, p.i); } };
      }
      body.append(w);
    });
    c.append(body);
    if (needsFixes(t)) c.append(fixList(t));
    // Пояснения: к найденным ошибкам — сразу, ко всем — в конце упражнения; в конце к ним добавляется правильное исправление
    const notes = gaps.filter(g => g.textId === t.id && (g.locked || finished) && (g.explanation || (finished && g.requires && !g.locked))).sort((a, b) => a.index - b.index);
    if (notes.length) {
      const box = el('div', 'mm-expl');
      notes.forEach(g => {
        const row = el('p', '');
        row.append(el('b', '', `«${g.word}»: `));
        const show = finished && g.requires && !g.locked;
        if (show) row.append(document.createTextNode(`верно — ${[g.correction, ...g.fixes].join(' / ')}. `));
        if (g.explanation) row.append(document.createTextNode(g.explanation));
        box.append(row);
      });
      c.append(box);
    }
    return c;
  }

  // Поля исправлений: по одному на каждое отмеченное слово, в том числе ошибочно отмеченное; верность до проверки не раскрывается
  function fixList(t) {
    const box = el('div', 'mm-fixes');
    const idxs = [...marks[t.id]].sort((a, b) => a - b);
    if (!idxs.length) { box.append(el('p', 'mm-fixhint', 'Отметьте слово — под текстом появится поле для исправления.')); return box; }
    const wordsOf = MistakeTokens.words(t.text);
    idxs.forEach(i => {
      const g = unitAt(t, i), st = fixState[t.id][i] || '';
      const row = el('label', 'mm-fixrow' + (st ? ' ' + st : ''));
      row.append(el('b', 'mm-fixw', wordsOf[i] + ' →'));
      const input = el('input');
      input.type = 'text';
      input.value = fixes[t.id][i] || '';
      input.placeholder = 'Исправление';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', `Исправление для слова ${wordsOf[i]}`);
      input.readOnly = finished || !!(g && g.locked);
      input.oninput = () => { fixes[t.id][i] = input.value; delete fixState[t.id][i]; row.classList.remove('ok', 'bad'); const m = row.querySelector('.mm-fixmark'); if (m) m.remove(); if (g && g.state === 'half') { g.state = null; } note = ''; };
      input.onfocus = () => setTimeout(() => row.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
      row.append(input);
      if (st) row.append(el('span', 'mm-fixmark', st === 'ok' ? '✓' : '✗'));
      box.append(row);
    });
    return box;
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
