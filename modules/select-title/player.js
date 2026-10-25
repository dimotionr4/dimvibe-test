// Плеер модуля Select Title: ученик читает текст и выбирает лучший заголовок из кнопок под ним.
// Общая часть прохождения — шапка, инструкция, проверка, число проверок, результат, сброс — живёт в index.html.
// Каждый текст — единица общего хода (unit): answer — ID правильного заголовка, value — ID выбранного.
// Проверка общая (index.html): все тексты должны иметь выбор, верные закрепляются, неверные можно поменять.
const SelectTitlePlayer = (() => {
  let idx = 0; // какой текст показан
  let refocus = null; // куда вернуть фокус после перерисовки
  const orders = {}; // ID текста → {key, ids}: порядок заголовков; выбирается один раз и не меняется, пока набор заголовков тот же
  const texts = () => data.texts || [];
  const listView = () => data.view === 'list'; // «все тексты сразу»: карточки друг под другом, без переключателя

  // Перемешивание один раз: предпросмотр пересобирает упражнение после каждой правки, и порядок не должен «прыгать»
  function orderOf(t) {
    const ids = (t.options || []).map(o => o.id), key = ids.join(',') + (data.shuffle === false ? '|fixed' : '');
    if (!orders[t.id] || orders[t.id].key !== key) orders[t.id] = { key, ids: data.shuffle === false ? ids : shuffle(ids) };
    return orders[t.id].ids;
  }

  function units() {
    return texts().map(t => ({
      id: t.id, answer: String(t.correct || ''), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  function reset() { idx = 0; refocus = null; }

  const unitOf = t => gaps.find(g => g.id === t.id);

  function choose(t, optId, pos) {
    const g = unitOf(t);
    if (!g || finished || g.locked) return;
    g.value = optId; // выбор другого заголовка заменяет прежний
    g.state = null;
    note = '';
    refocus = `.st-card[data-t="${t.id}"] .st-opt:nth-child(${pos + 1})`;
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Картинка текста: рамка по размеру и вписыванию из «Дизайна», значок увеличения — отдельная кнопка поверх.
  // Просмотр картинки и прослушивание звука не тратят проверок и не меняют ответ
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('div', 'st-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { wrap.classList.add('broken'); img.remove(); };
    img.src = src;
    const z = el('button', 'hintbtn st-zoom', '⤢');
    z.type = 'button';
    z.setAttribute('aria-label', 'Увеличить картинку');
    z.title = 'Увеличить';
    z.onclick = () => openMediaViewer(src, img.alt);
    wrap.append(img, z);
    return wrap;
  }

  function textCard(k) {
    const t = texts()[k], g = unitOf(t);
    const size = ['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm';
    const c = el('div', 'card st-card st-size-' + size + (data.imageFit === 'cover' ? ' st-fit-cover' : '') + (g && g.state === 'missing' ? ' missing' : ''));
    c.dataset.t = t.id;
    if (texts().length > 1 && listView()) c.append(el('p', 'st-tnum', `Текст ${k + 1}`)); // при показе всех текстов сразу каждый подписан номером
    const pic = picture(t.image), audio = mediaSrc(t.audio);
    if (pic) c.append(pic);
    if (audio) {
      const row = el('p', 'st-audio');
      row.append(audioButton(audio, 'stt' + t.id, 'audbtn', '🔊', 'Прослушать текст', 'Слушать'));
      c.append(row);
    }
    // Абзацы: пустая строка начинает новый, одиночный перенос строки сохраняется
    const body = el('div', 'st-body');
    String(t.text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).forEach(p => body.append(el('p', '', p)));
    c.append(body, el('p', 'st-ask', 'Выберите заголовок, который подходит лучше всего.'));
    const opts = el('div', 'st-opts');
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-label', 'Заголовки');
    const byId = Object.fromEntries((t.options || []).map(o => [o.id, o]));
    orderOf(t).forEach((id, pos) => {
      const o = byId[id];
      const on = g.value === id, right = id === g.answer;
      // ok — верный выбор (закреплён); bad — неверный выбор после проверки; right — в конце показан правильный, если ученик ошибся
      const cls = on && g.locked ? ' ok' : on && g.state === 'bad' ? ' bad' : on ? ' on' : finished && right ? ' right' : '';
      const b = el('button', 'st-opt' + cls);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.disabled = finished || g.locked;
      b.append(el('span', 'st-mark'), el('span', 'st-text', o.text));
      if (cls === ' ok') b.append(el('span', 'st-tick', '✓'));
      if (cls === ' bad') b.append(el('span', 'st-cross', '✗'));
      if (cls === ' right') b.append(el('span', 'st-tick', '✓'));
      if (cls) b.setAttribute('aria-label', o.text + { ' ok': ', верно', ' bad': ', неверно', ' on': ', выбран', ' right': ', правильный заголовок' }[cls]);
      b.onclick = () => choose(t, id, pos);
      opts.append(b);
    });
    c.append(opts);
    // Пояснение — после верного ответа или в конце упражнения
    const ex = String(t.explanation || '').trim();
    if (ex && (g.locked || finished)) c.append(el('p', 'st-expl', ex));
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Тексты');
    texts().forEach((t, i) => {
      const g = unitOf(t);
      const st = g.locked ? ' ok' : g.state === 'bad' ? ' bad' : g.state === 'missing' ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (g.value ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Текст ${i + 1}` + (i === idx ? ', текущий' : '') + (g.locked ? ', верно' : g.state === 'bad' ? ', неверно' : g.value ? ', заголовок выбран' : ''));
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
    const one = texts().length > 1 && !listView(); // переключатель нужен только при показе «по одному»
    if (one) nav(root);
    if (one || texts().length < 2) { if (texts().length) root.append(textCard(idx)); }
    else texts().forEach((_, k) => root.append(textCard(k)));
    if (one) pager(root);
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  // Неполный ответ: показать первый текст без выбора (при показе «по одному»)
  function goMissing() { const i = gaps.findIndex(g => g.state === 'missing'); if (i >= 0) idx = i; }
  const missingNote = n => (texts().length === 1 ? 'Выберите заголовок, потом нажмите «Проверить».' : n === 1 ? 'Выберите заголовок для текста, который остался без ответа.' : `Выберите заголовки для всех текстов: ещё ${n}.`);
  const instant = () => false;

  return { units, reset, goMissing, missingNote, instant, render: renderInto };
})();
