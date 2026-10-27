// Плеер модуля Flashcards: карточки с двумя сторонами (текст, картинка, звук). Три режима — «Просмотр» (листать и переворачивать),
// «Проверка» (перевернуть и оценить себя: «Знаю» / «Повторить») и «Повтор» (только карточки, отмеченные «Повторить»).
// Два направления — «Лицевая → Обратная» и наоборот (если автор не оставил одно): у каждого свои оценки, просмотренные и очередь повтора.
// Баллов и проверок нет: оценка — слова ученика о себе.
// Общая часть прохождения (шапка, инструкция, ↻) живёт в index.html. Единиц ответа нет (units пуст), нижняя панель скрыта (noFooter).
// Всё живёт только в открытой странице; «Начать заново» (↻) сбрасывает всё и перемешивает заново.
const FlashcardsPlayer = (() => {
  const MODES = [['study', 'Просмотр'], ['recall', 'Проверка'], ['review', 'Повтор']];
  const DIRS = [['fwd', 'Лицевая → Обратная'], ['rev', 'Обратная → Лицевая']];
  let mode = 'recall', dir = 'fwd';
  let order = []; // ID карточек в порядке этого прохождения (стабилен, пока не нажато «Начать заново»)
  let flipped = false, hintOn = false;
  let S = {}; // состояние каждого направления: { fwd, rev }
  let refocus = null;
  const cardsAll = () => data.cards || [];
  const freshState = () => ({ ratings: new Map(), visited: new Set(), studyIdx: 0, recallIdx: 0, recallDone: false,
    queue: [], qIdx: 0, qActive: false, qDone: false, qKnown: 0, qRepeat: 0 });
  const st = () => S[dir]; // ID карточки → 'known' | 'repeat' в st().ratings; нет записи — не оценена
  const twoWays = () => data.direction !== 'forward';

  const units = () => [];
  function reset() {
    const ids = cardsAll().map(c => c.id);
    order = data.order === 'fixed' ? ids : shuffle(ids);
    mode = 'recall'; dir = 'fwd'; flipped = false; hintOn = false; refocus = null;
    S = { fwd: freshState(), rev: freshState() };
    stopAudio();
  }
  const noFooter = () => true;
  const instant = () => true;
  const status = () => '';
  const goMissing = () => {};
  const missingNote = () => '';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const byId = id => cardsAll().find(c => c.id === id);
  const list = () => order.map(byId).filter(Boolean);
  const count = r => [...st().ratings.values()].filter(v => v === r).length;
  const repeatIds = () => order.filter(id => st().ratings.get(id) === 'repeat');
  // Сторона, которая лежит вверх сначала (зависит от направления), и сторона за ней
  const first = () => (dir === 'fwd' ? 'front' : 'back');
  const second = () => (dir === 'fwd' ? 'back' : 'front');

  function faceContent(c, s) {
    const box = el('span', 'fc-content');
    const src = mediaSrc(c[s + 'Image']);
    if (src) {
      const img = el('img', 'fc-img');
      img.alt = String((c[s + 'Image'] && c[s + 'Image'].alt) || '');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.draggable = false;
      img.onerror = () => { img.remove(); box.classList.add('fc-broken'); };
      img.src = src;
      box.append(img);
    }
    if (c[s]) box.append(el('span', 'fc-text', c[s]));
    return box;
  }

  // Переворот не перерисовывает страницу: иначе не будет анимации. Под карточкой — кнопка звука той стороны, что сейчас видна
  function cardView(c, onFlip) {
    const holder = el('div', 'fc-holder');
    const wrap = el('div', 'fc-scene' + (data.anim === 'fade' ? ' fc-fade' : '') + (data.size === 'compact' ? ' fc-compact' : ''));
    const btn = el('button', 'fc-card' + (flipped ? ' fc-flipped' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Перевернуть карточку');
    const inner = el('span', 'fc-inner');
    const front = el('span', 'fc-face fc-front'), back = el('span', 'fc-face fc-back');
    front.append(faceContent(c, first()));
    back.append(faceContent(c, second()));
    inner.append(front, back);
    btn.append(inner);
    wrap.append(btn);
    const audioHost = el('div', 'fc-audio');
    const sync = () => {
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
      audioHost.innerHTML = '';
      const s = flipped ? second() : first(), a = mediaSrc(c[s + 'Audio']);
      if (a) audioHost.append(audioButton(a, 'fc' + c.id + s, 'audbtn fc-aud', '🔊', 'Прослушать'));
    };
    sync();
    btn.onclick = () => { stopAudio(); flipped = !flipped; btn.classList.toggle('fc-flipped', flipped); sync(); onFlip(); };
    holder.append(wrap, audioHost);
    return holder;
  }

  // Подсказка видна только пока карточка лежит лицевой стороной
  function hintView(c) {
    if (!c.hint) return null;
    const box = el('div', 'fc-hintbox');
    const b = el('button', 'fc-hintbtn', hintOn ? 'Скрыть подсказку' : 'Подсказка');
    b.type = 'button';
    b.setAttribute('aria-expanded', String(hintOn));
    b.onclick = () => { hintOn = !hintOn; refocus = '.fc-hintbtn'; render(); };
    box.append(b);
    if (hintOn) box.append(el('p', 'fc-hint', c.hint));
    return box;
  }

  function counts() {
    const total = cardsAll().length, k = count('known'), r = count('repeat');
    const p = el('p', 'fc-counts');
    p.append(el('span', 'fc-k', `Знаю: ${k}`), el('span', 'fc-r', `Повторить: ${r}`), el('span', 'fc-u', `Не оценено: ${total - k - r}`));
    return p;
  }

  function pager(idx, total, go) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Назад'), next = el('button', '', 'Далее ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= total - 1;
    prev.onclick = () => { refocus = '.tf-pager button:first-child'; go(idx - 1); };
    next.onclick = () => { refocus = '.tf-pager button:last-child'; go(idx + 1); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${total}`), next);
    return bar;
  }
  const turnTo = fn => { stopAudio(); flipped = false; hintOn = false; fn(); render(); };
  // После переворота: кнопки оценки становятся доступными, подсказка прячется
  const afterFlip = () => {
    const r = document.querySelector('.fc-rate');
    if (r) r.querySelectorAll('button').forEach(b => { b.disabled = !flipped; });
    const hb = document.querySelector('.fc-hintbox');
    if (hb) hb.hidden = flipped;
  };

  function rateBar(c, onRate) {
    const bar = el('div', 'fc-rate');
    const known = el('button', 'fc-known', '✓ Знаю'), rep = el('button', 'fc-repeat', '↻ Повторить');
    known.type = rep.type = 'button';
    known.disabled = rep.disabled = !flipped;
    [[known, 'known'], [rep, 'repeat']].forEach(([b, r]) => {
      if (st().ratings.get(c.id) === r) b.classList.add('chosen');
      b.setAttribute('aria-pressed', String(st().ratings.get(c.id) === r));
      b.onclick = () => onRate(r);
    });
    bar.append(known, rep);
    return bar;
  }

  // ---- Просмотр ----
  function study(root) {
    const s = st(), cs = list();
    if (s.studyIdx >= cs.length) s.studyIdx = cs.length - 1;
    const c = cs[s.studyIdx];
    s.visited.add(c.id);
    root.append(cardView(c, () => { const hb = document.querySelector('.fc-hintbox'); if (hb) hb.hidden = flipped; }));
    const h = hintView(c);
    if (h) { h.hidden = flipped; root.append(h); }
    root.append(pager(s.studyIdx, cs.length, i => turnTo(() => { s.studyIdx = i; })));
    root.append(el('p', 'fc-counts', `Просмотрено: ${s.visited.size} из ${cs.length}`));
  }

  // ---- Проверка ----
  function recall(root) {
    const s = st(), cs = list();
    if (s.recallDone) {
      const box = el('div', 'fc-summary');
      box.append(el('h2', '', 'Все карточки оценены'), counts());
      const r = count('repeat');
      const row = el('div', 'fc-actions');
      if (r) { const b = el('button', 'fc-main', `Повторить непонятные (${r})`); b.type = 'button'; b.onclick = () => { s.recallDone = false; setMode('review'); }; row.append(b); }
      const again = el('button', '', 'Пройти ещё раз');
      again.type = 'button';
      again.onclick = () => { s.recallDone = false; flipped = false; hintOn = false; s.recallIdx = 0; render(); };
      row.append(again);
      box.append(row);
      root.append(box);
      return;
    }
    if (s.recallIdx >= cs.length) s.recallIdx = cs.length - 1;
    const c = cs[s.recallIdx];
    root.append(cardView(c, afterFlip));
    const h = hintView(c);
    if (h) { h.hidden = flipped; root.append(h); }
    root.append(rateBar(c, r => {
      stopAudio();
      s.ratings.set(c.id, r);
      flipped = false; hintOn = false;
      if (cs.every(x => s.ratings.has(x.id))) { s.recallDone = true; render(); return; }
      // Дальше — ближайшая карточка без оценки
      for (let k = 1; k <= cs.length; k++) { const j = (s.recallIdx + k) % cs.length; if (!s.ratings.has(cs[j].id)) { s.recallIdx = j; break; } }
      render();
    }));
    root.append(pager(s.recallIdx, cs.length, i => turnTo(() => { s.recallIdx = i; })));
    root.append(counts());
  }

  // ---- Повтор ----
  function startReview() {
    const s = st();
    s.queue = repeatIds(); // снимок: оценки в ходе круга очередь не меняют
    s.qIdx = 0; s.qActive = s.queue.length > 0; s.qDone = false; s.qKnown = 0; s.qRepeat = 0;
    flipped = false; hintOn = false;
  }
  function review(root) {
    const s = st();
    if (!s.qActive && !s.qDone) {
      const box = el('div', 'fc-summary');
      if (!s.ratings.size) {
        box.append(el('p', '', 'Сначала пройдите «Проверку» и отметьте карточки, которые нужно повторить.'));
        const b = el('button', 'fc-main', 'Перейти к проверке'); b.type = 'button'; b.onclick = () => setMode('recall'); box.append(b);
      } else box.append(el('p', '', 'Нет карточек для повтора: все отмечены «Знаю».'), counts());
      root.append(box);
      return;
    }
    if (s.qDone) {
      const box = el('div', 'fc-summary');
      box.append(el('h2', '', 'Круг закончен'), el('p', 'fc-counts', `В этом круге: знаю ${s.qKnown}, повторить ${s.qRepeat}.`), counts());
      const row = el('div', 'fc-actions');
      if (repeatIds().length) { const b = el('button', 'fc-main', `Ещё круг (${repeatIds().length})`); b.type = 'button'; b.onclick = () => { startReview(); render(); }; row.append(b); }
      else box.append(el('p', '', 'Все карточки отмечены «Знаю».'));
      box.append(row);
      root.append(box);
      return;
    }
    const c = byId(s.queue[s.qIdx]);
    root.append(cardView(c, afterFlip));
    const h = hintView(c);
    if (h) { h.hidden = flipped; root.append(h); }
    root.append(rateBar(c, r => {
      stopAudio();
      s.ratings.set(c.id, r);
      if (r === 'known') s.qKnown++; else s.qRepeat++;
      flipped = false; hintOn = false;
      s.qIdx++;
      if (s.qIdx >= s.queue.length) { s.qActive = false; s.qDone = true; }
      render();
    }));
    root.append(el('p', 'fc-counts', `Карточка ${s.qIdx + 1} из ${s.queue.length}`));
  }

  function setMode(m) {
    if (mode === m) return;
    stopAudio();
    mode = m; flipped = false; hintOn = false; refocus = null;
    if (m === 'review' && !st().qActive) startReview();
    render();
  }
  // Направления независимы: оценки и очередь одного не переходят в другое
  function setDir(x) {
    if (dir === x) return;
    stopAudio();
    dir = x; flipped = false; hintOn = false; refocus = null;
    render();
  }

  function group(items, current, label, onPick, cls) {
    const g = el('div', cls);
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    items.forEach(([v, name]) => {
      const b = el('button', 'fc-tab' + (current === v ? ' active' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(current === v));
      b.onclick = () => onPick(v);
      g.append(b);
    });
    return g;
  }

  function renderInto(root) {
    if (!cardsAll().length) { root.append(el('p', 'fc-empty', 'В колоде пока нет карточек.')); return; }
    root.append(group(MODES, mode, 'Режим', setMode, 'fc-tabs'));
    if (twoWays()) root.append(group(DIRS, dir, 'Направление', setDir, 'fc-tabs fc-dirs'));
    const body = el('div', 'fc-body');
    root.append(body);
    if (mode === 'study') study(body); else if (mode === 'review') review(body); else recall(body);
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, render: renderInto, instant, status, goMissing, missingNote, noFooter };
})();
