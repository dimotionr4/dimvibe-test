// Плеер модуля Flashcards: карточки с двумя сторонами. Три режима — «Просмотр» (листать и переворачивать), «Проверка» (перевернуть и
// оценить себя: «Знаю» / «Повторить») и «Повтор» (только карточки, отмеченные «Повторить»). Баллов и проверок нет: оценка — слова ученика о себе.
// Общая часть прохождения (шапка, инструкция, ↻) живёт в index.html. Единиц ответа нет (units пуст), нижняя панель скрыта (noFooter).
// Оценки, просмотренные карточки и очередь повтора живут только в открытой странице; «Начать заново» (↻) сбрасывает всё и перемешивает заново.
const FlashcardsPlayer = (() => {
  const MODES = [['study', 'Просмотр'], ['recall', 'Проверка'], ['review', 'Повтор']];
  let mode = 'recall';
  let order = []; // ID карточек в порядке этого прохождения (стабилен, пока не нажато «Начать заново»)
  let studyIdx = 0, recallIdx = 0;
  let flipped = false, hintOn = false;
  let ratings = new Map(); // ID карточки → 'known' | 'repeat'; нет записи — не оценена
  let visited = new Set(); // карточки, показанные в «Просмотре»
  let recallDone = false; // показан итог «Проверки»
  let queue = [], qIdx = 0, qActive = false, qDone = false, qKnown = 0, qRepeat = 0; // очередь повтора — снимок на момент начала круга
  let refocus = null;
  const cardsAll = () => data.cards || [];

  const units = () => [];
  function reset() {
    const ids = cardsAll().map(c => c.id);
    order = data.order === 'fixed' ? ids : shuffle(ids);
    mode = 'recall'; studyIdx = 0; recallIdx = 0; flipped = false; hintOn = false;
    ratings = new Map(); visited = new Set(); recallDone = false;
    queue = []; qIdx = 0; qActive = false; qDone = false; qKnown = 0; qRepeat = 0; refocus = null;
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
  const count = r => [...ratings.values()].filter(v => v === r).length;
  const repeatIds = () => order.filter(id => ratings.get(id) === 'repeat');

  // Переворот не перерисовывает страницу: иначе не будет анимации
  function cardView(c, onFlip) {
    const fade = data.anim === 'fade';
    const wrap = el('div', 'fc-scene' + (fade ? ' fc-fade' : ''));
    const btn = el('button', 'fc-card' + (flipped ? ' fc-flipped' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Перевернуть карточку');
    const inner = el('span', 'fc-inner');
    const front = el('span', 'fc-face fc-front'), back = el('span', 'fc-face fc-back');
    front.append(el('span', 'fc-text', c.front));
    back.append(el('span', 'fc-text', c.back));
    const sync = () => { front.setAttribute('aria-hidden', String(flipped)); back.setAttribute('aria-hidden', String(!flipped)); };
    sync();
    inner.append(front, back);
    btn.append(inner);
    btn.onclick = () => { flipped = !flipped; btn.classList.toggle('fc-flipped', flipped); sync(); onFlip(); };
    wrap.append(btn);
    return wrap;
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

  function counts(extra) {
    const total = cardsAll().length, k = count('known'), r = count('repeat');
    const p = el('p', 'fc-counts');
    p.append(el('span', 'fc-k', `Знаю: ${k}`), el('span', 'fc-r', `Повторить: ${r}`), el('span', 'fc-u', `Не оценено: ${total - k - r}`));
    if (extra) p.append(el('span', 'fc-u', extra));
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
  const turnTo = fn => { flipped = false; hintOn = false; fn(); render(); };

  function rateBar(c, onRate) {
    const bar = el('div', 'fc-rate');
    const known = el('button', 'fc-known', '✓ Знаю'), rep = el('button', 'fc-repeat', '↻ Повторить');
    known.type = rep.type = 'button';
    known.disabled = rep.disabled = !flipped;
    [[known, 'known'], [rep, 'repeat']].forEach(([b, r]) => {
      if (ratings.get(c.id) === r) b.classList.add('chosen');
      b.setAttribute('aria-pressed', String(ratings.get(c.id) === r));
      b.onclick = () => onRate(r);
    });
    bar.append(known, rep);
    return { bar, known, rep };
  }

  // ---- Просмотр ----
  function study(root) {
    const cs = list();
    if (studyIdx >= cs.length) studyIdx = cs.length - 1;
    const c = cs[studyIdx];
    visited.add(c.id);
    root.append(cardView(c, () => {}));
    if (!flipped) { const h = hintView(c); if (h) root.append(h); }
    root.append(pager(studyIdx, cs.length, i => turnTo(() => { studyIdx = i; })));
    root.append(el('p', 'fc-counts', `Просмотрено: ${visited.size} из ${cs.length}`));
  }

  // ---- Проверка ----
  function recall(root) {
    const cs = list();
    if (recallDone) {
      const box = el('div', 'fc-summary');
      box.append(el('h2', '', 'Все карточки оценены'), counts());
      const r = count('repeat');
      const row = el('div', 'fc-actions');
      if (r) { const b = el('button', 'fc-main', `Повторить непонятные (${r})`); b.type = 'button'; b.onclick = () => { stopAudio(); recallDone = false; setMode('review'); }; row.append(b); }
      const again = el('button', '', 'Пройти ещё раз');
      again.type = 'button';
      again.onclick = () => { recallDone = false; flipped = false; hintOn = false; recallIdx = 0; render(); };
      row.append(again);
      box.append(row);
      root.append(box);
      return;
    }
    if (recallIdx >= cs.length) recallIdx = cs.length - 1;
    const c = cs[recallIdx];
    root.append(cardView(c, () => {
      const r = document.querySelector('.fc-rate');
      if (r) r.querySelectorAll('button').forEach(b => { b.disabled = !flipped; });
      const hb = document.querySelector('.fc-hintbox');
      if (hb) hb.hidden = flipped;
    }));
    const h = hintView(c);
    if (h) { h.hidden = flipped; root.append(h); }
    const { bar } = rateBar(c, r => {
      ratings.set(c.id, r);
      flipped = false; hintOn = false;
      if (cs.every(x => ratings.has(x.id))) { recallDone = true; render(); return; }
      // Дальше — ближайшая карточка без оценки
      for (let s = 1; s <= cs.length; s++) { const j = (recallIdx + s) % cs.length; if (!ratings.has(cs[j].id)) { recallIdx = j; break; } }
      render();
    });
    root.append(bar);
    root.append(pager(recallIdx, cs.length, i => turnTo(() => { recallIdx = i; })));
    root.append(counts());
  }

  // ---- Повтор ----
  function startReview() {
    queue = repeatIds(); // снимок: оценки в ходе круга очередь не меняют
    qIdx = 0; qActive = queue.length > 0; qDone = false; qKnown = 0; qRepeat = 0;
    flipped = false; hintOn = false;
  }
  function review(root) {
    if (!qActive && !qDone) {
      const box = el('div', 'fc-summary');
      if (!ratings.size) {
        box.append(el('p', '', 'Сначала пройдите «Проверку» и отметьте карточки, которые нужно повторить.'));
        const b = el('button', 'fc-main', 'Перейти к проверке'); b.type = 'button'; b.onclick = () => setMode('recall'); box.append(b);
      } else box.append(el('p', '', 'Нет карточек для повтора: все отмечены «Знаю».'), counts());
      root.append(box);
      return;
    }
    if (qDone) {
      const box = el('div', 'fc-summary');
      box.append(el('h2', '', 'Круг закончен'), el('p', 'fc-counts', `В этом круге: знаю ${qKnown}, повторить ${qRepeat}.`), counts());
      const row = el('div', 'fc-actions');
      if (repeatIds().length) { const b = el('button', 'fc-main', `Ещё круг (${repeatIds().length})`); b.type = 'button'; b.onclick = () => { startReview(); render(); }; row.append(b); }
      else box.append(el('p', '', 'Все карточки отмечены «Знаю».'));
      box.append(row);
      root.append(box);
      return;
    }
    const c = byId(queue[qIdx]);
    root.append(cardView(c, () => {
      const r = document.querySelector('.fc-rate');
      if (r) r.querySelectorAll('button').forEach(b => { b.disabled = !flipped; });
      const hb = document.querySelector('.fc-hintbox');
      if (hb) hb.hidden = flipped;
    }));
    const h = hintView(c);
    if (h) { h.hidden = flipped; root.append(h); }
    const { bar } = rateBar(c, r => {
      ratings.set(c.id, r);
      if (r === 'known') qKnown++; else qRepeat++;
      flipped = false; hintOn = false;
      qIdx++;
      if (qIdx >= queue.length) { qActive = false; qDone = true; }
      render();
    });
    root.append(bar);
    root.append(el('p', 'fc-counts', `Карточка ${qIdx + 1} из ${queue.length}`));
  }

  function setMode(m) {
    if (mode === m) return;
    stopAudio();
    mode = m; flipped = false; hintOn = false; refocus = null;
    if (m === 'review' && !qActive && !qDone) startReview();
    render();
  }

  function renderInto(root) {
    if (!cardsAll().length) { root.append(el('p', 'fc-empty', 'В колоде пока нет карточек.')); return; }
    const tabs = el('div', 'fc-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Режим');
    MODES.forEach(([m, name]) => {
      const b = el('button', 'fc-tab' + (mode === m ? ' active' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(mode === m));
      b.onclick = () => setMode(m);
      tabs.append(b);
    });
    root.append(tabs);
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
