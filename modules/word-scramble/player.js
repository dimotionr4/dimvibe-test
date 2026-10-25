// Плеер модуля Word Scramble: ученик собирает слово, фразу или предложение из перемешанных кусочков нажатием.
// Нажатие на кусочек в банке ставит его в конец ответа, нажатие на кусочек в ответе возвращает его в банк.
// Общая часть прохождения — шапка, инструкция, результат, сброс — живёт в index.html.
// Каждое задание — единица общего хода (unit): answer — правильный текст, value — собранный текст (пока собрано не всё — пусто).
// Проверка одна, итоговая, на все задания (решение архива D-095); 1 балл за полностью верное задание; одинаковые кусочки взаимозаменяемы.
const WordScramblePlayer = (() => {
  const T = WordScrambleTokens;
  let tasks = [], pieces = {}; // задания и их кусочки в правильном порядке (по ID задания)
  let banks = {}, picked = {}; // ID задания → порядок номеров кусочков в банке / номера кусочков в ответе ученика
  let hints = {}; // открытые подсказки
  let idx = 0, refocus = null; // какое задание показано (при показе «по одному»); куда вернуть фокус после перерисовки
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: перемешивание для предпросмотра

  const instant = () => false;
  const maxChecks = () => 1;
  const listView = () => data.view === 'list';
  const unitOf = t => gaps.find(g => g.id === t.id);
  const complete = t => (picked[t.id] || []).length === pieces[t.id].length;

  function units() {
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    pieces = {};
    tasks.forEach(t => { pieces[t.id] = T.split(t.mode, t.answer); });
    fresh = true;
    return tasks.map(t => ({
      id: t.id, answer: T.join(t.mode, pieces[t.id]), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Банк перемешан так, чтобы кусочки не стояли в правильном порядке (по значению: в «apple» перестановка двух P — не перемешивание)
  function mix(t) {
    const p = pieces[t.id], ids = p.map((_, i) => i);
    for (let k = 0; k < 30; k++) {
      const r = shuffle(ids);
      if (!T.same(r.map(i => p[i]), p)) return r;
    }
    return ids.slice(1).concat(ids[0]);
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока кусочки те же, банк не перемешиваем заново, чтобы он не «прыгал»
  function reset() {
    const sig = tasks.map(t => t.id + ':' + pieces[t.id].join('\u0001')).join('\u0002');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    idx = 0; refocus = null; hints = {}; picked = {};
    if (reuse) banks = JSON.parse(JSON.stringify(cache.banks));
    else {
      banks = {};
      tasks.forEach(t => { banks[t.id] = mix(t); });
      cache = { sig, banks: JSON.parse(JSON.stringify(banks)) };
    }
    tasks.forEach(t => { picked[t.id] = []; });
  }

  // Собранный текст попадает в value только когда использованы все кусочки: так общая строка «Заполнено: N из M» считает готовые задания
  function sync(t) {
    const g = unitOf(t);
    if (!g) return;
    g.value = complete(t) ? T.join(t.mode, picked[t.id].map(i => pieces[t.id][i])) : '';
    g.state = null;
    note = '';
  }

  function take(t, i) {
    if (finished) return;
    picked[t.id].push(i);
    sync(t);
    refocus = `.ws-card[data-t="${t.id}"] .ws-bank .ws-tok`;
    render();
  }
  function give(t, pos) {
    if (finished) return;
    picked[t.id].splice(pos, 1);
    sync(t);
    refocus = `.ws-card[data-t="${t.id}"] .ws-zone .ws-tok`;
    render();
  }

  // Одна проверка на всё упражнение: пока не все задания собраны, проверка не тратится и показывается первое несобранное
  function check() {
    const left = tasks.filter(t => !complete(t));
    if (left.length) {
      tasks.forEach(t => { const g = unitOf(t); if (g) g.state = complete(t) ? null : 'missing'; });
      const i = tasks.indexOf(left[0]);
      if (i >= 0) idx = i;
      return { note: tasks.length === 1 ? 'Используйте все кусочки, потом нажмите «Проверить».' : left.length === 1 ? 'Соберите задание, которое ещё не готово: в нём остались кусочки.' : `Соберите все задания: не готово ещё ${left.length}.` };
    }
    tasks.forEach(t => {
      const g = unitOf(t);
      if (!g) return;
      g.locked = T.same(picked[t.id].map(i => pieces[t.id][i]), pieces[t.id]);
      g.state = g.locked ? 'ok' : 'bad';
    });
    return { done: true };
  }

  const started = () => tasks.some(t => (picked[t.id] || []).length);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function token(text, label, fn) {
    const b = el('button', 'ws-tok', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = finished;
    b.onclick = fn;
    return b;
  }

  // Картинка задания: высота по «Размеру картинок», лупа увеличения на углу (addZoom, core/mediaviewer.js).
  // Просмотр картинки и прослушивание звука не тратят проверку и не трогают кусочки
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('div', 'ws-pic');
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

  function taskCard(k) {
    const t = tasks[k], g = unitOf(t), p = pieces[t.id];
    const st = finished && g ? g.state : g && g.state === 'missing' ? 'missing' : '';
    const size = ['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm';
    const c = el('div', 'card ws-card ws-' + (data.tokenStyle === 'chips' ? 'chips' : 'tiles') + ' ws-size-' + size + (st ? ' ' + st : ''));
    c.dataset.t = t.id;
    if (tasks.length > 1 && listView()) c.append(el('p', 'ws-tnum', `Задание ${k + 1}`));
    const ins = String(t.instruction || '').trim();
    if (ins) c.append(el('p', 'ws-tinstr', ins));
    const pic = picture(t.image), audio = mediaSrc(t.audio);
    if (pic) c.append(pic);
    if (audio) {
      const row = el('p', 'ws-audio');
      row.append(audioButton(audio, 'wsa' + t.id, 'audbtn', '🔊', 'Прослушать задание', 'Слушать'));
      c.append(row);
    }
    // Ответ ученика: кусочки в выбранном порядке; нажатие возвращает кусочек в банк
    const zone = el('div', 'ws-zone');
    zone.setAttribute('role', 'group');
    zone.setAttribute('aria-label', 'Ваш ответ');
    picked[t.id].forEach((i, pos) => zone.append(token(p[i], `${p[i]}: убрать из ответа`, () => give(t, pos))));
    if (!picked[t.id].length) zone.append(el('span', 'ws-empty', 'Нажимайте на кусочки ниже, чтобы собрать ответ.'));
    if (finished) zone.append(el('span', st === 'ok' ? 'ws-tick' : 'ws-cross', st === 'ok' ? '✓' : '✗'));
    c.append(zone);
    // Банк: оставшиеся кусочки в перемешанном порядке; нажатие ставит кусочек в конец ответа
    const used = new Set(picked[t.id]);
    const left = banks[t.id].filter(i => !used.has(i));
    if (left.length) {
      const bank = el('div', 'ws-bank');
      bank.setAttribute('role', 'group');
      bank.setAttribute('aria-label', 'Кусочки');
      left.forEach(i => bank.append(token(p[i], `${p[i]}: добавить в ответ`, () => take(t, i))));
      c.append(bank);
    }
    // Подсказка: ученик открывает сама, баллов и проверок она не трогает
    const hint = String(t.hint || '').trim();
    if (hint && !finished) {
      const hb = el('button', 'ws-hintbtn', hints[t.id] ? 'Скрыть подсказку' : '💡 Подсказка');
      hb.type = 'button';
      hb.setAttribute('aria-expanded', String(!!hints[t.id]));
      hb.onclick = () => { hints[t.id] = !hints[t.id]; refocus = `.ws-card[data-t="${t.id}"] .ws-hintbtn`; render(); };
      c.append(hb);
      if (hints[t.id]) c.append(el('p', 'ws-hinttext', hint));
    }
    // После проверки: правильный ответ у неверного задания (если включено) и пояснение
    if (finished && st === 'bad' && data.showAnswers !== false) {
      const r = el('p', 'ws-right');
      r.append(el('span', 'ws-right-l', 'Правильно: '), document.createTextNode(g.answer));
      c.append(r);
    }
    const ex = String(t.explanation || '').trim();
    if (finished && ex) c.append(el('p', 'ws-expl', ex));
    return c;
  }

  // Номера заданий и «Предыдущее / Следующее» при показе по одному (классы tf-* из modules/true-false/player.css)
  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Задания');
    tasks.forEach((t, i) => {
      const g = unitOf(t);
      const st = finished && g ? (g.state === 'ok' ? ' ok' : ' bad') : g && g.state === 'missing' ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (complete(t) ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Задание ${i + 1}` + (i === idx ? ', текущее' : '') + (st === ' ok' ? ', верно' : st === ' bad' ? ', неверно' : complete(t) ? ', собрано' : ''));
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

  function renderInto(root) {
    if (idx >= tasks.length) idx = Math.max(0, tasks.length - 1);
    const one = tasks.length > 1 && !listView();
    if (one) nav(root);
    if (one || tasks.length < 2) { if (tasks.length) root.append(taskCard(idx)); }
    else tasks.forEach((_, k) => root.append(taskCard(k)));
    if (one) pager(root);
    if (refocus) {
      const f = document.querySelector(refocus);
      refocus = null;
      if (f && !f.disabled) f.focus({ preventScroll: true });
    }
  }

  // Проверка своя (check): несобранные задания помечаются там же; эти две нужны общему ходу формально
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, started, instant, maxChecks, goMissing, missingNote, render: renderInto };
})();
