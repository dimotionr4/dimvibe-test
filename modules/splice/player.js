// Плеер модуля Splice: ученик собирает слова из частей нажатием.
// Режим «Одно слово»: слова по очереди (или списком), у каждого свой банк частей; нажатие на часть в банке ставит её в конец слова,
// нажатие на часть в слове возвращает её в банк.
// Режим «Мозаика»: все слова сразу — окошки и один общий банк частей. Нажатие на окошко делает его активным, нажатие на часть в банке
// кладёт её в активное окошко (в Easy и Medium заполненное окошко передаёт ход следующему свободному), нажатие на часть в окошке возвращает её в банк.
// Уровни мозаики: Easy — названия и число частей видны, слово собирается в своём окошке; Medium — названий нет, число частей видно,
// слово засчитывается в любом окошке с тем же числом частей; Hard — ни названий, ни числа частей, в каждом окошке не меньше двух частей.
// Общая часть прохождения — шапка, инструкция, результат, сброс — живёт в index.html. Каждое слово — единица общего хода (unit):
// answer — правильное слово, value — собранное (только когда окошко/слово собрано). Проверка одна, итоговая (решение архива SP-01 / SP-03);
// 1 балл за полностью верное слово; одинаковые части взаимозаменяемы.
const SplicePlayer = (() => {
  const T = SpliceTokens;
  let tasks = [], pieces = {}; // слова и их части в правильном порядке (по ID слова)
  let banks = {}, picked = {}; // одно слово: ID слова → порядок номеров частей в банке / номера частей в слове ученика
  let all = [], areas = [], mixed = [], active = 0; // мозаика: все части (с номером слова), окошки (номера частей), общий банк, активное окошко
  let hints = {}; // открытые подсказки
  let idx = 0, refocus = null; // какое слово показано (одно слово, «по одному»); куда вернуть фокус после перерисовки
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: перемешивание для предпросмотра

  const instant = () => false;
  const maxChecks = () => 1;
  const mosaic = () => data.mode === 'mosaic';
  const level = () => (['easy', 'hard'].includes(data.level) ? data.level : 'medium');
  const listView = () => data.view === 'list';
  const unitOf = t => gaps.find(g => g.id === t.id);
  const complete = t => (picked[t.id] || []).length === pieces[t.id].length;
  const wordName = k => `Слово ${k + 1}`;

  function units() {
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    pieces = {};
    tasks.forEach(t => { pieces[t.id] = T.split(t.answer); });
    fresh = true;
    return tasks.map(t => ({
      id: t.id, answer: T.join(pieces[t.id]), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Банк перемешан так, чтобы части не стояли в правильном порядке (по значению: перестановка одинаковых частей — не перемешивание)
  function mix(p) {
    const ids = p.map((_, i) => i);
    for (let k = 0; k < 30; k++) {
      const r = shuffle(ids);
      if (!r.every((v, i) => T.same(p[v], p[i]))) return r;
    }
    return ids.slice(1).concat(ids[0]);
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока части те же, банк не перемешиваем заново, чтобы он не «прыгал»
  function reset() {
    const sig = (mosaic() ? 'm' : 's') + tasks.map(t => t.id + ':' + pieces[t.id].join('\u0001')).join('\u0002');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    idx = 0; refocus = null; hints = {}; picked = {}; active = 0;
    all = []; tasks.forEach((t, k) => pieces[t.id].forEach(text => all.push({ text, w: k })));
    areas = tasks.map(() => []);
    if (reuse) { banks = JSON.parse(JSON.stringify(cache.banks)); mixed = cache.mixed.slice(); }
    else {
      banks = {};
      tasks.forEach(t => { banks[t.id] = mix(pieces[t.id]); });
      mixed = mix(all.map(a => a.text));
      cache = { sig, banks: JSON.parse(JSON.stringify(banks)), mixed: mixed.slice() };
    }
    tasks.forEach(t => { picked[t.id] = []; });
  }

  // ---- Общее ----
  const areaText = k => areas[k].map(i => all[i].text).join('');
  const cap = k => (level() === 'hard' ? Infinity : pieces[tasks[k].id].length);
  const areaDone = k => (level() === 'hard' ? areas[k].length >= 2 : areas[k].length === cap(k));
  const placed = () => areas.reduce((n, a) => n + a.length, 0);
  const allPlaced = () => placed() === all.length;
  const mosaicComplete = () => allPlaced() && tasks.every((_, k) => areaDone(k));

  // Собранный текст попадает в value только когда слово собрано: так общая строка «Заполнено: N из M» считает готовые слова
  function sync(t) {
    const g = unitOf(t);
    if (!g) return;
    if (mosaic()) {
      const k = tasks.indexOf(t);
      g.value = areaDone(k) ? areaText(k) : '';
    } else g.value = complete(t) ? T.join(picked[t.id].map(i => pieces[t.id][i])) : '';
    g.state = null;
    note = '';
  }

  function take(t, i) {
    if (finished) return;
    picked[t.id].push(i);
    sync(t);
    refocus = `.sp-card[data-t="${t.id}"] .sp-bank .sp-tok`;
    render();
  }
  function give(t, pos) {
    if (finished) return;
    picked[t.id].splice(pos, 1);
    sync(t);
    refocus = `.sp-card[data-t="${t.id}"] .sp-zone .sp-tok`;
    render();
  }

  // Мозаика: часть из банка — в активное окошко; если оно заполнено (Easy, Medium), — в ближайшее следующее со свободным местом
  function takeM(i) {
    if (finished) return;
    let k = active;
    for (let n = 0; n < tasks.length && areas[k].length >= cap(k); n++) k = (k + 1) % tasks.length;
    if (areas[k].length >= cap(k)) return;
    areas[k].push(i);
    active = k;
    tasks.forEach(sync);
    refocus = '.sp-bank .sp-tok';
    render();
  }
  function giveM(k, pos) {
    if (finished) return;
    areas[k].splice(pos, 1);
    active = k;
    tasks.forEach(sync);
    refocus = `.sp-area[data-k="${k}"] .sp-tok`;
    render();
  }
  function pick(k) {
    if (finished) return;
    active = k;
    refocus = `.sp-area[data-k="${k}"]`;
    render();
  }

  // Верно ли слово: сравниваются значения частей по порядку (Unicode NFC, регистр и знаки важны)
  function checkSingle() {
    tasks.forEach(t => {
      const g = unitOf(t);
      if (!g) return;
      g.locked = T.same(T.join(picked[t.id].map(i => pieces[t.id][i])), g.answer);
      g.state = g.locked ? 'ok' : 'bad';
    });
  }
  // Мозаика: Easy — окошко должно содержать «своё» слово; Medium — ключ «число частей + слово», Hard — ключ «слово»;
  // слово каждого ключа засчитывается столько раз, сколько таких слов задано (мультимножество)
  function checkMosaic() {
    const lv = level();
    const key = (len, text) => (lv === 'hard' ? text : len + '\u0001' + text).normalize('NFC');
    const left = {};
    tasks.forEach(t => { const k = key(pieces[t.id].length, T.join(pieces[t.id])); left[k] = (left[k] || 0) + 1; });
    tasks.forEach((t, k) => {
      const g = unitOf(t);
      if (!g) return;
      let ok;
      if (lv === 'easy') ok = T.same(areaText(k), g.answer);
      else {
        const kk = key(areas[k].length, areaText(k));
        ok = left[kk] > 0;
        if (ok) left[kk]--;
      }
      g.locked = ok;
      g.state = ok ? 'ok' : 'bad';
    });
  }

  // Одна проверка на всё упражнение: пока не всё собрано, проверка не тратится и показывается первое несобранное
  function check() {
    if (mosaic()) {
      if (!mosaicComplete()) {
        tasks.forEach((t, k) => { const g = unitOf(t); if (g) g.state = areaDone(k) ? null : 'missing'; });
        const rest = all.length - placed();
        return { note: rest ? `Используйте все части: в банке осталось ${rest}.` : level() === 'hard' ? 'В каждом окошке должно быть не меньше двух частей.' : 'Заполните все окошки.' };
      }
      checkMosaic();
      return { done: true };
    }
    const left = tasks.filter(t => !complete(t));
    if (left.length) {
      tasks.forEach(t => { const g = unitOf(t); if (g) g.state = complete(t) ? null : 'missing'; });
      const i = tasks.indexOf(left[0]);
      if (i >= 0) idx = i;
      return { note: tasks.length === 1 ? 'Используйте все части, потом нажмите «Проверить».' : left.length === 1 ? 'Соберите слово, которое ещё не готово: в нём остались части.' : `Соберите все слова: не готово ещё ${left.length}.` };
    }
    checkSingle();
    return { done: true };
  }

  const started = () => (mosaic() ? placed() > 0 : tasks.some(t => (picked[t.id] || []).length));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // src — откуда часть берётся при перетаскивании мышью: { w: слово/окошко, piece: номер части, pos: место в нём (нет — из банка) }.
  // Перетаскивание работает мышью; пальцем — нажатие (HTML5-перенос на телефоне не срабатывает)
  let drag = null;
  function token(text, label, fn, src) {
    const b = el('button', 'sp-tok', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = finished;
    b.onclick = e => { e.stopPropagation(); fn(); };
    if (src && !finished) {
      b.draggable = true;
      b.ondragstart = e => { drag = src; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', text); b.classList.add('sp-drag'); };
      b.ondragend = () => { drag = null; b.classList.remove('sp-drag'); document.querySelectorAll('.sp-over').forEach(x => x.classList.remove('sp-over')); };
    }
    return b;
  }

  // Место вставки в зоне: перед первой частью, которая правее курсора в его строке (или ниже него)
  function slotAt(zone, e) {
    const toks = [...zone.querySelectorAll('.sp-tok')];
    for (let i = 0; i < toks.length; i++) {
      const r = toks[i].getBoundingClientRect();
      if (e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2)) return i;
    }
    return toks.length;
  }
  // Принимающий элемент: ok(drag) — годится ли перетаскиваемое, onDrop(drag, event) — что делать
  function target(box, ok, onDrop) {
    if (finished) return;
    box.ondragover = e => {
      if (!drag || !ok(drag)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      box.classList.add('sp-over');
    };
    box.ondragleave = e => { if (!box.contains(e.relatedTarget)) box.classList.remove('sp-over'); };
    box.ondrop = e => {
      e.preventDefault(); e.stopPropagation();
      box.classList.remove('sp-over');
      const d = drag;
      drag = null;
      if (d && ok(d)) onDrop(d, e);
    };
  }

  // Одно слово: часть из банка или из слова — в выбранное место слова; бросить вне слова — вернуть в банк
  function dropWord(t, d, pos) {
    const list = picked[t.id];
    if (d.pos != null) { list.splice(d.pos, 1); if (d.pos < pos) pos--; }
    list.splice(pos, 0, d.piece);
    sync(t);
    refocus = null;
    render();
  }
  function dropWordBack(t, d) {
    if (d.pos == null) return;
    picked[t.id].splice(d.pos, 1);
    sync(t);
    render();
  }
  // Мозаика: часть — в выбранное окошко и место (в Easy и Medium только если там есть свободное место); бросить вне окошек — вернуть в банк
  function dropArea(k, d, pos) {
    const src = d.pos != null ? areas[d.w] : null;
    if (src) { src.splice(d.pos, 1); if (d.w === k && d.pos < pos) pos--; }
    if (areas[k].length >= cap(k)) { if (src) src.splice(d.pos, 0, d.piece); return; }
    areas[k].splice(pos, 0, d.piece);
    active = k;
    tasks.forEach(sync);
    refocus = null;
    render();
  }
  function dropAreaBack(d) {
    if (d.pos == null) return;
    areas[d.w].splice(d.pos, 1);
    tasks.forEach(sync);
    render();
  }

  const styleCls = () => 'sp-' + (data.tokenStyle === 'paper' ? 'paper' : 'tiles');
  const mark = st => el('span', st === 'ok' ? 'sp-tick' : 'sp-cross', st === 'ok' ? '✓' : '✗');

  // Картинка слова: высота по «Размеру картинок», лупа увеличения на углу (addZoom, core/mediaviewer.js).
  // Просмотр картинки и прослушивание звука не тратят проверку и не трогают части
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('div', 'sp-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { wrap.classList.add('broken'); img.remove(); };
    img.src = src;
    wrap.append(img);
    addZoom(wrap, wrap, src, img.alt);
    return wrap;
  }
  // Картинка и кнопка «Слушать» слова (если есть)
  function mediaOf(t, parent) {
    const pic = picture(t.image), audio = mediaSrc(t.audio);
    const stop = e => e.stopPropagation(); // нажатие на картинку и звук не должно выбирать окошко мозаики
    if (pic) { pic.addEventListener('click', stop); parent.append(pic); }
    if (audio) {
      const row = el('p', 'sp-audio');
      row.addEventListener('click', stop);
      row.append(audioButton(audio, 'spa' + t.id, 'audbtn', '🔊', 'Прослушать задание', 'Слушать'));
      parent.append(row);
    }
  }
  const sizeCls = () => ' sp-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm');

  // ---- Одно слово ----
  function wordCard(k) {
    const t = tasks[k], g = unitOf(t), p = pieces[t.id];
    const st = finished && g ? g.state : g && g.state === 'missing' ? 'missing' : '';
    const c = el('div', 'card sp-card ' + styleCls() + sizeCls() + (st ? ' ' + st : ''));
    c.dataset.t = t.id;
    if (tasks.length > 1 && listView()) c.append(el('p', 'sp-tnum', wordName(k)));
    mediaOf(t, c);
    // Слово ученика: части в выбранном порядке; нажатие возвращает часть в банк
    const zone = el('div', 'sp-zone');
    zone.setAttribute('role', 'group');
    zone.setAttribute('aria-label', 'Ваше слово');
    picked[t.id].forEach((i, pos) => zone.append(token(p[i], `${p[i]}: убрать из слова`, () => give(t, pos), { w: t.id, piece: i, pos })));
    target(zone, d => d.w === t.id, (d, e) => dropWord(t, d, slotAt(zone, e)));
    target(c, d => d.w === t.id && d.pos != null, d => dropWordBack(t, d));
    if (!picked[t.id].length) zone.append(el('span', 'sp-empty', 'Нажимайте на части ниже, чтобы собрать слово.'));
    if (finished) zone.append(mark(st));
    c.append(zone);
    // Банк: оставшиеся части в перемешанном порядке; нажатие ставит часть в конец слова
    const used = new Set(picked[t.id]);
    const left = banks[t.id].filter(i => !used.has(i));
    if (left.length) {
      const bank = el('div', 'sp-bank');
      bank.setAttribute('role', 'group');
      bank.setAttribute('aria-label', 'Части');
      left.forEach(i => bank.append(token(p[i], `${p[i]}: добавить в слово`, () => take(t, i), { w: t.id, piece: i })));
      c.append(bank);
    }
    // Подсказка: ученик открывает сам, баллов и проверок она не трогает
    const hint = String(t.hint || '').trim();
    if (hint && !finished) {
      const hb = el('button', 'sp-hintbtn');
      if (hints[t.id]) hb.textContent = 'Скрыть подсказку';
      else setIcon(hb, '💡', 'Подсказка'); // одноцветный значок плеера (index.html)
      hb.type = 'button';
      hb.setAttribute('aria-expanded', String(!!hints[t.id]));
      hb.onclick = () => { hints[t.id] = !hints[t.id]; refocus = `.sp-card[data-t="${t.id}"] .sp-hintbtn`; render(); };
      c.append(hb);
      if (hints[t.id]) c.append(el('p', 'sp-hinttext', hint));
    }
    // После проверки: правильное слово по частям у неверного (если включено) и пояснение
    if (finished && st === 'bad' && data.showAnswers !== false) {
      const r = el('p', 'sp-right');
      r.append(el('span', 'sp-right-l', 'Правильно: '), document.createTextNode(T.show(t.answer)));
      c.append(r);
    }
    const ex = String(t.explanation || '').trim();
    if (finished && ex) c.append(el('p', 'sp-expl', ex));
    return c;
  }

  // Номера слов и «Предыдущее / Следующее» при показе по одному (классы tf-* из modules/true-false/player.css)
  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Слова');
    tasks.forEach((t, i) => {
      const g = unitOf(t);
      const st = finished && g ? (g.state === 'ok' ? ' ok' : ' bad') : g && g.state === 'missing' ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (complete(t) ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', wordName(i) + (i === idx ? ', текущее' : '') + (st === ' ok' ? ', верно' : st === ' bad' ? ', неверно' : complete(t) ? ', собрано' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; refocus = `.tf-dot:nth-child(${i + 1})`; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущее'), next = el('button', '', 'Следующее ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= tasks.length - 1;
    prev.onclick = () => { idx--; refocus = '.tf-pager button:first-child'; render(); };
    next.onclick = () => { idx++; refocus = '.tf-pager button:last-child'; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${tasks.length}`), next);
    root.append(bar);
  }

  // ---- Мозаика ----
  function areaBox(k) {
    const t = tasks[k], g = unitOf(t), lv = level();
    const st = finished && g ? g.state : g && g.state === 'missing' ? 'missing' : '';
    const box = el('div', 'sp-area' + (k === active && !finished ? ' active' : '') + (st ? ' ' + st : ''));
    box.dataset.k = k;
    const title = lv === 'easy' && String(t.label || '').trim() ? `${wordName(k)}: ${String(t.label).trim()}` : wordName(k);
    const head = el('p', 'sp-atitle');
    head.append(document.createTextNode(title));
    if (lv !== 'hard') head.append(el('span', 'sp-acount', ` · частей: ${pieces[t.id].length}`));
    box.append(head);
    if (lv === 'easy' || data.mediaAlways === true) mediaOf(t, box); // на Medium и Hard — только если автор включил: иначе выдали бы, какое слово где собирать
    if (!finished) {
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-label', `${title}: выбрать окошко`);
      box.onclick = () => pick(k);
      box.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === box) { e.preventDefault(); pick(k); } };
    }
    const zone = el('div', 'sp-zone');
    zone.setAttribute('role', 'group');
    zone.setAttribute('aria-label', title);
    areas[k].forEach((i, pos) => zone.append(token(all[i].text, `${all[i].text}: вернуть в банк`, () => giveM(k, pos), { w: k, piece: i, pos })));
    target(box, () => true, (d, e) => dropArea(k, d, slotAt(zone, e)));
    if (lv !== 'hard') for (let n = areas[k].length; n < cap(k); n++) zone.append(el('span', 'sp-slot'));
    else if (!areas[k].length) zone.append(el('span', 'sp-empty', 'Нажмите сюда, потом на части ниже.'));
    if (finished) zone.append(mark(st));
    box.append(zone);
    return box;
  }

  function mosaicCard() {
    const c = el('div', 'card sp-card sp-mosaic ' + styleCls() + sizeCls());
    const list = el('div', 'sp-areas');
    tasks.forEach((_, k) => list.append(areaBox(k)));
    c.append(list);
    // Общий банк: части всех слов вперемешку
    const left = mixed.filter(i => !areas.some(a => a.includes(i)));
    if (left.length) {
      const bank = el('div', 'sp-bank');
      bank.setAttribute('role', 'group');
      bank.setAttribute('aria-label', 'Части');
      left.forEach(i => bank.append(token(all[i].text, `${all[i].text}: добавить в окошко`, () => takeM(i), { w: -1, piece: i })));
      c.append(bank);
    }
    target(c, d => d.pos != null, d => dropAreaBack(d));
    // После проверки: правильные слова по частям (если включено) с пояснениями
    if (finished && data.showAnswers !== false) {
      const r = el('div', 'sp-answers');
      r.append(el('p', 'sp-right-l', 'Правильные слова:'));
      tasks.forEach(t => {
        const row = el('p', 'sp-arow', T.show(t.answer));
        const ex = String(t.explanation || '').trim();
        if (ex) row.append(el('span', 'sp-aexpl', ' — ' + ex));
        r.append(row);
      });
      c.append(r);
    }
    return c;
  }

  function renderInto(root) {
    if (idx >= tasks.length) idx = Math.max(0, tasks.length - 1);
    if (mosaic()) root.append(mosaicCard());
    else {
      const one = tasks.length > 1 && !listView();
      if (one) nav(root);
      if (one || tasks.length < 2) { if (tasks.length) root.append(wordCard(idx)); }
      else tasks.forEach((_, k) => root.append(wordCard(k)));
      if (one) pager(root);
    }
    if (refocus) {
      const f = document.querySelector(refocus);
      refocus = null;
      if (f && !f.disabled) f.focus({ preventScroll: true });
    }
  }

  // Проверка своя (check): несобранные слова помечаются там же; эти две нужны общему ходу формально
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, started, instant, maxChecks, goMissing, missingNote, render: renderInto };
})();
