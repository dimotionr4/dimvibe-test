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
  let repl = {}; // ID текста → слова, которые ученик решил заменить (перечёркнуты, рядом поле); остальные отмеченные — просто в кружке
  let look = {}; // ID текста → номер слова → {v, seed}: как нарисован кружок в Comic (одна из трёх степеней кривизны); выбирается при отметке и потом не меняется
  let fresh = ''; // слово, у которого кружок только что поставлен: он рисуется с анимацией
  let freshStrike = ''; // слово, которое только что перешло в замену (✎): перечёркивание рисуется с анимацией
  const texts = () => data.texts || [];
  // Замена слова (значок ✎ и поле) доступна во всём тексте, если хотя бы одна его ошибка требует исправления: так по значку не видно, какое слово настоящая ошибка
  const needsFixes = t => (t.errors || []).some(e => e.requiresCorrection === true);

  function units() {
    return texts().flatMap(t => (t.errors || []).map(e => ({
      id: e.id, textId: t.id, index: e.index, word: e.word, explanation: String(e.explanation || '').trim(),
      requires: e.requiresCorrection === true, correction: String(e.correction || ''), fixes: Array.isArray(e.alternatives) ? e.alternatives.map(String) : [],
      answer: '', alternatives: [], hint: '', audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null,
    })));
  }

  function reset() {
    idx = 0; refocus = null; marks = {}; flagged = {}; fixes = {}; fixState = {}; repl = {}; look = {}; fresh = ''; freshStrike = '';
    texts().forEach(t => { marks[t.id] = new Set(); flagged[t.id] = new Set(); fixes[t.id] = {}; fixState[t.id] = {}; repl[t.id] = new Set(); });
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
      if (!g.requires) { g.locked = true; g.state = 'ok'; repl[g.textId].delete(g.index); return; }
      // Исправление засчитывается, только если ученик выбрал замену слова (✎); просто кружок не считается исправлением
      const v = repl[g.textId].has(g.index) ? fixes[g.textId][g.index] || '' : '';
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
    if (s.has(i)) { s.delete(i); flagged[t.id].delete(i); repl[t.id].delete(i); delete (look[t.id] || {})[i]; }
    else { s.add(i); delete (look[t.id] || {})[i]; fresh = t.id + ':' + i; } // каждая новая отметка получает свой кружок
    if (g) g.state = null; // отметка снята или поставлена заново: прежний результат исправления не показываем
    delete fixState[t.id][i];
    note = '';
    refocus = `.mm-card .mm-w[data-i="${i}"]`;
    render();
  }

  // ✎ — слово из кружка переходит в замену (перечёркнуто, справа поле); × в поле возвращает кружок, введённое слово запоминается
  function setRepl(t, i, on) {
    const g = unitAt(t, i);
    if (finished || (g && g.locked)) return;
    if (on) { repl[t.id].add(i); freshStrike = t.id + ':' + i; } else repl[t.id].delete(i);
    if (g) g.state = null;
    delete fixState[t.id][i];
    note = '';
    refocus = on ? `.mm-card .mm-fixin[data-i="${i}"] input` : `.mm-card .mm-edit[data-i="${i}"]`;
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

  // ---- Comic: кружок вокруг слова, нарисованный от руки ----
  // Три степени кривизны (0 — почти ровный, 2 — самый неровный, с «хвостиком», уходящим за начало). Кривая зависит от seed отметки,
  // поэтому у разных слов кружки разные, а при перерисовке страницы один и тот же.
  const comicNow = () => document.documentElement.classList.contains('style-comic');
  const NS = 'http://www.w3.org/2000/svg';
  function lookOf(tid, i) {
    look[tid] = look[tid] || {};
    return look[tid][i] || (look[tid][i] = { v: Math.floor(Math.random() * 3), seed: Math.floor(Math.random() * 1e9) });
  }
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f2 = n => Math.round(n * 100) / 100;
  function ringPath(w, h, v, seed) {
    const r = rng(seed), amp = [0.025, 0.06, 0.1][v], over = [0.2, 0.5, 0.95][v], drift = [0.01, 0.05, 0.11][v];
    const a0 = -Math.PI * (0.6 + r() * 0.8), sweep = Math.PI * 2 + over + r() * 0.2, n = Math.max(14, Math.round(sweep / 0.32));
    const ph = [r() * 6.28, r() * 6.28], tilt = (r() - 0.5) * 0.14 * (v + 1), cx = w / 2, cy = h / 2, rx = w / 2 - 2.5, ry = h / 2 - 2.5;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, a = a0 + sweep * u, rad = 1 + amp * Math.sin(a * 2 + ph[0]) + amp * 0.6 * Math.sin(a * 3.3 + ph[1]) + drift * u;
      const x = rx * rad * Math.cos(a), y = ry * rad * Math.sin(a);
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    let d = `M${f2(pts[0][0])} ${f2(pts[0][1])}`;
    for (let k = 1; k < pts.length - 1; k++) d += `Q${f2(pts[k][0])} ${f2(pts[k][1])} ${f2((pts[k][0] + pts[k + 1][0]) / 2)} ${f2((pts[k][1] + pts[k + 1][1]) / 2)}`;
    return d + `L${f2(pts[pts.length - 1][0])} ${f2(pts[pts.length - 1][1])}`;
  }
  // Перечёркивание от руки: слегка волнистая линия через середину слова
  function strikePath(W, H, seed) {
    const r = rng(seed ^ 0x5bd1e995), y = H * (0.5 + (r() - 0.5) * 0.1), a = (r() - 0.5) * H * 0.18, b = (r() - 0.5) * H * 0.18;
    return `M${f2(3)} ${f2(y + a)}Q${f2(W * 0.3)} ${f2(y - a)} ${f2(W * 0.5)} ${f2(y + b * 0.4)}T${f2(W - 3)} ${f2(y + b)}`;
  }
  const ringObs = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => paintRing(e.target, false, false))) : null;
  // anim: кружок рисуется по линии (только что поставленная отметка), animStrike — то же для перечёркивания (нажали ✎);
  // при смене размера (шрифт Comic догрузился, перенос) всё перерисовывается без анимации
  function paintRing(w, anim, animStrike) {
    const info = w._ring;
    if (!info || !w.isConnected) return;
    const W = w.offsetWidth + 8, H = w.offsetHeight + 6;
    if (!W || !H || (info.w && Math.abs(info.w - W) < 1 && Math.abs(info.h - H) < 1)) return;
    info.w = W; info.h = H;
    const old = w.querySelector('.mm-ring');
    if (old) old.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mm-ring');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const add = (d, cls) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      path.setAttribute('class', cls);
      svg.appendChild(path);
    };
    add(ringPath(W, H, info.v, info.seed), 'mm-circ' + (anim ? ' draw' : ''));
    if (info.repl) add(strikePath(W, H, info.seed), 'mm-strike' + (animStrike ? ' draw' : ''));
    w.appendChild(svg);
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
      const inRepl = marked && repl[t.id].has(p.i);
      const w = el('span', 'mm-w' + (state ? ' ' + state : '') + (inRepl ? ' repl' : ''), p.s);
      w.dataset.i = p.i;
      if (marked && comicNow() && state && state !== 'miss') w._ring = { ...lookOf(t.id, p.i), key: t.id + ':' + p.i, repl: inRepl };
      w.setAttribute('role', 'button');
      w.setAttribute('aria-pressed', String(marked));
      const frozenWord = finished || (g && g.locked);
      w.tabIndex = frozenWord ? -1 : 0;
      if (frozenWord) w.setAttribute('aria-disabled', 'true');
      // Результат не только цветом: у найденной ошибки ✓, у ложной отметки ✗ (значки в CSS), для скринридера — подпись
      if (state === 'ok') w.setAttribute('aria-label', p.s + ', ошибка найдена');
      if (state === 'bad') w.setAttribute('aria-label', p.s + ', отмечено ошибочно');
      if (state === 'miss') w.setAttribute('aria-label', p.s + ', пропущенная ошибка');
      if (state === 'half') w.setAttribute('aria-label', p.s + ', слово найдено, нужно верное исправление');
      if (!frozenWord) {
        w.onclick = () => toggle(t, p.i);
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t, p.i); } };
      }
      // Текст с исправлениями: у слова в кружке в правом верхнем углу значок ✎ (слово и значок — в общей обёртке);
      // после его нажатия слово перечёркнуто, а справа стоит поле для нового слова
      if (marked && needsFixes(t) && !inRepl && !frozenWord) {
        const wrap = el('span', 'mm-wwrap');
        wrap.append(w, editBtn(t, p.i, p.s));
        body.append(wrap);
      } else body.append(w);
      if (marked && needsFixes(t) && inRepl) body.append(fixInput(t, p.i, g, p.s));
    });
    body.classList.toggle('mm-fixmode', needsFixes(t));
    c.append(body);
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

  // Значок ✎ справа от слова в кружке: перейти к замене слова
  function editBtn(t, i, word) {
    const b = el('span', 'mm-edit', '✎');
    b.dataset.i = i;
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `Заменить слово «${word}»`);
    b.title = 'Заменить слово';
    b.onclick = () => setRepl(t, i, true);
    b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRepl(t, i, true); } };
    return b;
  }

  // Поле исправления справа от перечёркнутого слова (и от ошибочно отмеченного тоже); верность до проверки не раскрывается.
  // На узком экране поле переносится на следующую строку вместе с текстом
  function fixInput(t, i, g, word) {
    const st = fixState[t.id][i] || '';
    const box = el('span', 'mm-fixin' + (st ? ' ' + st : ''));
    box.dataset.i = i;
    const input = el('input');
    input.type = 'text';
    input.value = fixes[t.id][i] || '';
    input.placeholder = '…';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', `Новое слово вместо «${word}»`);
    input.readOnly = finished || !!(g && g.locked);
    const fit = () => { input.size = Math.max(7, input.value.length + 2); };
    fit();
    input.oninput = () => {
      fixes[t.id][i] = input.value; delete fixState[t.id][i]; fit();
      box.classList.remove('ok', 'bad');
      const m = box.querySelector('.mm-fixmark'); if (m) m.remove();
      if (g && g.state === 'half') g.state = null;
      note = '';
    };
    input.onfocus = () => setTimeout(() => box.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    box.append(input);
    if (st) box.append(el('span', 'mm-fixmark', st === 'ok' ? '✓' : '✗'));
    if (!input.readOnly) {
      const back = el('span', 'mm-back', '×');
      back.tabIndex = 0;
      back.setAttribute('role', 'button');
      back.setAttribute('aria-label', `Не заменять слово «${word}», оставить кружок`);
      back.title = 'Вернуть кружок';
      back.onclick = () => setRepl(t, i, false);
      back.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRepl(t, i, false); } };
      box.append(back);
    }
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
    if (ringObs) ringObs.disconnect();
    if (texts().length > 1) nav(root);
    if (texts().length) root.append(textCard(idx));
    if (texts().length > 1) pager(root);
    // Comic: кружки рисуются, когда слова уже стоят на странице (нужны их размеры)
    root.querySelectorAll('.mm-w').forEach(w => {
      if (!w._ring) return;
      paintRing(w, w._ring.key === fresh, w._ring.key === freshStrike);
      if (ringObs) ringObs.observe(w);
    });
    fresh = ''; freshStrike = '';
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
