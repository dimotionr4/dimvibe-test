// Плеер модуля Image to Gaps: ученик ставит картинки из банка в пропуски (нажать картинку, потом пропуск; перетаскивание — второй способ).
// Общая часть прохождения — шапка, инструкция, проверки, закрепление, подсказки, звук, результат, сброс — живёт в index.html и работает
// с теми же переменными (data, gaps, selected, finished, note, bankOrder) и функцией render(). Здесь только то, что отличает модуль:
// как строится пропуск, банк и порядок картинок. Проверка идёт по идентичности картинки (mediaKey), а не по номеру карточки в банке:
// любой экземпляр правильной картинки засчитывается одинаково.
const ImageToGapsPlayer = (() => {
  const sizeOf = () => (['s', 'm', 'l'].includes(data.imageSize) ? data.imageSize : 'm');
  const fitOf = () => (data.imageFit === 'cover' ? 'cover' : 'contain');
  let refocus = null; // куда вернуть фокус после перерисовки (для управления с клавиатуры)
  let showFix = false; // показаны ли верные картинки рядом с неверными (после завершения, если включено в «Поведении»)
  let drag = null, suppressClick = false;

  // Пропуск для общего хода прохождения: answer — ключ правильной картинки, value — ключ поставленной
  function gap(id, g) {
    const im = (g && g.image) || null;
    return {
      id, answer: mediaKey(im), alternatives: [],
      hint: String((g && g.hint) || '').trim(), audio: mediaSrc(g && g.audio), hintAudio: mediaSrc(g && g.hintAudio),
      src: im ? mediaSrc(im) : null, alt: (im && im.alt) || '', value: '', bankKey: null, locked: false, state: null,
    };
  }

  // Банк: по одному экземпляру на каждый пропуск (одна картинка в двух пропусках — две карточки) и ловушки. Перемешивается один раз на прохождение
  function shuffleCards() {
    showFix = false;
    const cards = [];
    gaps.forEach(g => { if (g.answer && g.src) cards.push({ mk: g.answer, src: g.src, alt: g.alt }); });
    (data.distractors || []).forEach(im => {
      const mk = mediaKey(im), src = mediaSrc(im);
      if (mk && src) cards.push({ mk, src, alt: im.alt || '' });
    });
    return shuffle(cards.map((c, key) => ({ ...c, key })));
  }

  function picture(src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.draggable = false;
    return img;
  }

  const cardOf = g => (g.bankKey === null ? null : bankOrder.find(b => b.key === g.bankKey));

  // Карточка key встаёт в пропуск idx; прежняя картинка из этого пропуска возвращается в банк (она остаётся на своём месте)
  function putCard(idx, key) {
    const g = gaps[idx], w = bankOrder.find(b => b.key === key);
    g.value = w.mk;
    g.bankKey = w.key;
    g.state = null;
    note = '';
    selected = null;
  }
  function clearGap(idx) {
    const g = gaps[idx];
    g.value = '';
    g.bankKey = null;
    g.state = null;
    note = '';
  }

  function place(idx) {
    if (suppressClick) return;
    const g = gaps[idx];
    if (frozen(g)) return;
    if (selected !== null) putCard(idx, selected);
    else if (g.bankKey !== null) clearGap(idx);
    else return;
    refocus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.idx === String(idx) ? `.gap[data-idx="${idx}"]` : null;
    render();
  }

  function makeGap(idx) {
    const g = gaps[idx];
    const look = typeof normalizeGapDesign === 'function' ? normalizeGapDesign(data.design && data.design.gap) : { shape: 'line', dashed: false, numbered: false };
    const card = cardOf(g);
    const el = document.createElement('span');
    el.className = `gap itg-gap shape-${look.shape}${look.dashed ? ' dashed' : ''} size-${sizeOf()} fit-${fitOf()}${card ? ' has-img' : ''}${g.state ? ' ' + g.state : ''}${frozen(g) ? ' locked' : ''}${selected !== null && !card && !frozen(g) ? ' target' : ''}`;
    el.dataset.idx = idx;
    el.setAttribute('role', 'button');
    el.tabIndex = frozen(g) ? -1 : 0;
    el.setAttribute('aria-label', `Пропуск ${idx + 1}` + (card ? (card.alt ? ': ' + card.alt : ': картинка выбрана') : ': пусто'));
    if (card) el.appendChild(picture(card.src, card.alt));
    el.onclick = () => place(idx);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(idx); } };
    // Картинку из пропуска можно перетащить в другой пропуск или обратно в банк
    if (card && !frozen(g)) el.addEventListener('pointerdown', e => armDrag(e, { from: idx, src: card.src }));
    // После завершения (если включено в «Поведении» и ученик нажал переключатель): рядом с неверной картинкой верная
    if (showFix && finished && g.state === 'bad' && g.src) {
      const fx = document.createElement('span');
      fx.className = 'itg-fix';
      fx.title = 'Верная картинка';
      fx.appendChild(picture(g.src, g.alt ? 'Верная картинка: ' + g.alt : 'Верная картинка'));
      el.appendChild(fx);
    }
    // Номер на углу пропуска (как в Fill Blanks)
    if (look.numbered) {
      const num = document.createElement('span');
      num.className = 'gap-num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = idx + 1;
      el.appendChild(num);
    }
    return el;
  }

  // Использованная карточка остаётся на месте приглушённой и недоступной; вернуть её можно только через заполненный пропуск
  function renderBank(bank) {
    const used = new Set(gaps.map(g => g.bankKey).filter(k => k !== null));
    bankOrder.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'itg-card' + (used.has(c.key) ? ' used' : '') + (selected === c.key ? ' selected' : '');
      b.dataset.key = c.key;
      b.appendChild(picture(c.src, c.alt || 'Картинка'));
      if (used.has(c.key) || finished) {
        b.setAttribute('aria-disabled', 'true');
        b.tabIndex = -1;
      } else {
        b.setAttribute('aria-pressed', String(selected === c.key));
        b.onclick = () => {
          if (suppressClick) return;
          selected = selected === c.key ? null : c.key;
          refocus = `.itg-card[data-key="${c.key}"]`;
          render();
        };
        b.addEventListener('pointerdown', e => armDrag(e, { card: c.key, src: c.src }));
      }
      bank.appendChild(b);
    });
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t) t.focus({ preventScroll: true });
    }
  }

  // Под результатом: переключатель верных картинок (только если включено в «Поведении», упражнение завершено и есть неверные)
  function extras(root) {
    if (!data.showCorrect || !finished || !gaps.some(g => g.state === 'bad')) return;
    const bar = document.createElement('div');
    bar.className = 'itg-fixbar';
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = showFix ? 'Скрыть верные картинки' : 'Показать верные картинки';
    b.setAttribute('aria-pressed', String(showFix));
    b.onclick = () => { showFix = !showFix; render(); };
    bar.appendChild(b);
    root.appendChild(bar);
  }

  // ---- Перетаскивание (мышь, палец, перо). Нажатие и перетаскивание работают вместе: сдвиг больше 6 px (у касания — долгое нажатие) начинает перенос ----
  function armDrag(e, info) {
    if (finished || drag || (e.button !== undefined && e.button !== 0)) return;
    drag = { ...info, sx: e.clientX, sy: e.clientY, pid: e.pointerId, started: false, touch: e.pointerType !== 'mouse', ghost: null, hot: null };
    if (drag.touch) drag.timer = setTimeout(() => { if (drag && !drag.started) startDrag(drag.sx, drag.sy); }, 250);
  }
  function startDrag(x, y) {
    drag.started = true;
    clearTimeout(drag.timer);
    const gh = document.createElement('div');
    gh.className = 'itg-ghost';
    gh.appendChild(picture(drag.src, ''));
    document.body.appendChild(gh);
    drag.ghost = gh;
    document.body.classList.add('itg-dragging');
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    drag.ghost.style.transform = `translate(${x - 30}px, ${y - 30}px)`;
    const t = document.elementFromPoint(x, y);
    const g = t && t.closest('.gap.itg-gap'), idx = g ? Number(g.dataset.idx) : -1;
    const ok = g && !frozen(gaps[idx]) && idx !== drag.from;
    const hot = ok ? g : (drag.from !== undefined && t && t.closest('#bank') ? $('bank') : null);
    if (drag.hot !== hot) {
      if (drag.hot) drag.hot.classList.remove('drop-hot');
      if (hot) hot.classList.add('drop-hot');
      drag.hot = hot;
    }
  }
  function endDrag(drop) {
    if (!drag) return;
    const d0 = drag;
    drag = null;
    clearTimeout(d0.timer);
    if (!d0.started) return;
    if (d0.ghost) d0.ghost.remove();
    if (d0.hot) d0.hot.classList.remove('drop-hot');
    document.body.classList.remove('itg-dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    if (!drop || !d0.hot) return;
    if (d0.hot.id === 'bank') clearGap(d0.from); // картинка из пропуска вернулась в банк
    else {
      const to = Number(d0.hot.dataset.idx);
      if (d0.from !== undefined) { const key = cardOf(gaps[d0.from]).key; clearGap(d0.from); putCard(to, key); } // перенос между пропусками
      else putCard(to, d0.card);
    }
    render();
  }
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.started) {
      const far = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
      if (!drag.touch && far > 6) startDrag(e.clientX, e.clientY);
      else if (drag.touch && far > 8) { clearTimeout(drag.timer); drag = null; } // палец поехал — это прокрутка
      return;
    }
    moveGhost(e.clientX, e.clientY);
  });
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pid) endDrag(true); });
  addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) endDrag(false); });
  // Пока идёт перенос пальцем, страница не должна прокручиваться
  addEventListener('touchmove', e => { if (drag && drag.started && e.cancelable) e.preventDefault(); }, { passive: false });

  // Esc и щелчок мимо картинок и пропусков отменяют выбор (и перенос); обычная прокрутка — нет
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !data || data.module !== 'image_to_gaps') return;
    if (drag && drag.started) { endDrag(false); return; }
    if (selected !== null) { selected = null; render(); }
  });
  addEventListener('click', e => {
    if (data && data.module === 'image_to_gaps' && selected !== null && !e.target.closest('.itg-card, .gap, .itg-fixbar')) { selected = null; render(); }
  });

  return { gap, shuffle: shuffleCards, makeGap, renderBank, extras };
})();
