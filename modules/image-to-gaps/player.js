// Плеер модуля Image to Gaps: ученик ставит картинки из банка в пропуски (нажать картинку, потом пропуск).
// Общая часть прохождения — шапка, инструкция, проверки, закрепление, результат, сброс — живёт в index.html и работает с теми же
// переменными (data, gaps, selected, finished, note, bankOrder) и функцией render(). Здесь только то, что отличает модуль:
// как строится пропуск, банк и порядок картинок. Проверка идёт по идентичности картинки (mediaKey), а не по номеру карточки в банке:
// любой экземпляр правильной картинки засчитывается одинаково.
const ImageToGapsPlayer = (() => {
  const sizeOf = () => (['s', 'm', 'l'].includes(data.imageSize) ? data.imageSize : 'm');
  const fitOf = () => (data.imageFit === 'cover' ? 'cover' : 'contain');
  let refocus = null; // куда вернуть фокус после перерисовки (для управления с клавиатуры)

  // Пропуск для общего хода прохождения: answer — ключ правильной картинки, value — ключ поставленной
  function gap(id, g) {
    const im = (g && g.image) || null;
    return { id, answer: mediaKey(im), alternatives: [], hint: '', audio: null, hintAudio: null, src: im ? mediaSrc(im) : null, alt: (im && im.alt) || '', value: '', bankKey: null, locked: false, state: null };
  }

  // Банк: по одному экземпляру на каждый пропуск (одна картинка в двух пропусках — две карточки) и ловушки. Перемешивается один раз на прохождение
  function shuffleCards() {
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

  function place(idx) {
    const g = gaps[idx];
    if (frozen(g)) return;
    if (selected !== null) {
      // Выбранная картинка встаёт в пропуск; прежняя картинка из этого пропуска возвращается в банк (она остаётся на своём месте)
      const w = bankOrder.find(b => b.key === selected);
      g.value = w.mk;
      g.bankKey = w.key;
      selected = null;
    } else if (g.bankKey !== null) {
      g.value = '';
      g.bankKey = null;
    } else return;
    g.state = null;
    note = '';
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
          selected = selected === c.key ? null : c.key;
          refocus = `.itg-card[data-key="${c.key}"]`;
          render();
        };
      }
      bank.appendChild(b);
    });
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t) t.focus({ preventScroll: true });
    }
  }

  // Esc и щелчок мимо картинок и пропусков отменяют выбор; обычная прокрутка — нет
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && data && data.module === 'image_to_gaps' && selected !== null) { selected = null; render(); }
  });
  addEventListener('click', e => {
    if (data && data.module === 'image_to_gaps' && selected !== null && !e.target.closest('.itg-card, .gap')) { selected = null; render(); }
  });

  return { gap, shuffle: shuffleCards, makeGap, renderBank };
})();
