// Плеер модуля Timeline: ученик расставляет перемешанные события по времени (за ручку ⋮⋮ или стрелками) на вертикальной линии.
// Общая часть прохождения — шапка, инструкция, результат, сброс — живёт в index.html.
// Каждое место на линии — единица общего хода (unit): answer — ID события, которое должно там стоять,
// value — ID поставленного (заполняется при проверке). Проверка одна, итоговая (решения архива D-083…D-086).
// Даты скрыты до проверки (или видны сразу — dateVisibility). После проверки: «Ваша хронология» с ✓ / ✗ и, если включено, «Правильная хронология».
const TimelinePlayer = (() => {
  let events = [];
  let order = []; // порядок ID событий на экране
  let moved = false; // ученик уже переставлял события (для вопроса «Начать заново?»)
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: порядок для предпросмотра

  const instant = () => false;
  const maxChecks = () => 1;
  const datesShown = () => data.dateVisibility === 'always_visible' || finished;

  function units() {
    events = Array.isArray(data.events) ? data.events : [];
    fresh = true;
    return events.map((ev, p) => ({
      id: 'p' + p, answer: ev.id, alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Новое прохождение — новое перемешивание (никогда не совпадает с правильным порядком, core/reorder.js).
  // В предпросмотре редактора каждая правка пересобирает упражнение: пока набор событий тот же, порядок не меняем
  function reset() {
    const sig = events.map(e => e.id).sort().join(' ');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    moved = false;
    if (reuse) { order = cache.order.slice(); return; }
    order = Reorder.mix(events.map(e => e.id), shuffle);
    cache = { sig, order: order.slice() };
  }

  // Одна проверка: каждое место сравнивается один раз, после неё порядок не меняется
  function check() {
    order.forEach((id, p) => {
      const g = gaps[p];
      if (!g) return;
      g.value = id;
      g.locked = id === g.answer;
      g.state = g.locked ? 'ok' : 'bad';
    });
    return { done: true };
  }

  const status = () => (finished || checksUsed ? null : 'Расставьте события по порядку. Проверка одна.');
  const started = () => moved;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="tl-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

  function place(from, to) {
    if (to < 0 || to >= order.length || from === to) return;
    const [id] = order.splice(from, 1);
    order.splice(to, 0, id);
    moved = true;
    note = '';
  }

  // Картинка события: высота по «Размеру картинок», лупа увеличения на углу (addZoom, core/mediaviewer.js).
  // Просмотр картинки и звук не тратят проверку и не двигают событие
  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('span', 'tl-pic');
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
  // Что видно на карточке: картинка, текст (подпись) и кнопка звука
  function face(ev) {
    const box = el('span', 'tl-face');
    const pic = picture(ev.image);
    if (pic) box.append(pic);
    if (String(ev.text || '').trim()) box.append(el('span', 'tl-text', ev.text));
    const audio = mediaSrc(ev.audio);
    if (audio) box.append(audioButton(audio, 'tla' + ev.id, 'audbtn tl-aud', '🔊', 'Прослушать событие'));
    return box;
  }
  const label = ev => String(ev.text || '').trim() || 'картинка';

  // Строка на линии: дата | точка | карточка события. На узком экране дата встаёт над карточкой.
  // Пока даты скрыты, колонки даты нет (nodate): точка и карточка
  function point(ev, st, dateText) {
    const li = el('li', 'tl-point' + (st ? ' ' + st : '') + (dateText ? '' : ' nodate'));
    if (dateText) li.append(el('span', 'tl-date', dateText));
    li.append(el('span', 'tl-rail'));
    const card = el('div', 'card tl-ev');
    li.append(card);
    return { li, card };
  }

  function yourTimeline() {
    const byId = Object.fromEntries(events.map(e => [e.id, e]));
    const list = el('ol', 'tl-line');
    order.forEach((id, p) => {
      const ev = byId[id];
      if (!ev) return;
      const g = gaps[p];
      const st = finished && g ? (g.state === 'ok' ? 'ok' : 'bad') : '';
      const { li, card } = point(ev, st, datesShown() ? ev.date : '');
      if (!finished) {
        const grip = el('button', 'tl-grip');
        grip.type = 'button';
        grip.innerHTML = Reorder.GRIP;
        grip.title = 'Перетащить';
        grip.setAttribute('aria-label', `Перетащить: ${label(ev)}`);
        const b = (html, tip, to, disabled) => { const x = el('button', 'tl-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}: ${label(ev)}`); x.disabled = disabled; x.onclick = () => { place(p, to); render(); }; return x; };
        const arrows = el('span', 'tl-arrows');
        arrows.append(b(svg('<path d="M6 15l6-6 6 6"/>'), 'Раньше', p - 1, p === 0), b(svg('<path d="M6 9l6 6 6-6"/>'), 'Позже', p + 1, p === order.length - 1));
        card.append(grip, face(ev), arrows);
      } else {
        card.append(face(ev), el('span', st === 'ok' ? 'tl-tick' : 'tl-cross', st === 'ok' ? '✓' : '✗'));
        li.setAttribute('aria-label', `${p + 1}. ${ev.date}, ${label(ev)}, ${st === 'ok' ? 'верно' : 'неверно'}`);
      }
      list.append(li);
    });
    if (!finished) Reorder.attach(list, { itemSel: '.tl-point', handleSel: '.tl-grip', dragClass: 'tl-dragging', listClass: 'tl-dragging-list', onDrop: (from, to) => { place(from, to); render(); } });
    return list;
  }

  // Правильная хронология: все события по порядку автора, с датами и пояснениями; только для чтения
  function correctTimeline() {
    const list = el('ol', 'tl-line tl-correct');
    events.forEach(ev => {
      const { li, card } = point(ev, '', ev.date);
      card.append(face(ev));
      const ex = String(ev.explanation || '').trim();
      if (ex) card.append(el('span', 'tl-expl', ex));
      list.append(li);
    });
    return list;
  }

  function renderInto(root) {
    const size = 'tl-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm'); // высота картинок из «Дизайна»
    const c = el('div', 'card tl-card ' + size);
    if (finished) c.append(el('h2', 'tl-h', 'Ваша хронология'));
    c.append(yourTimeline());
    root.append(c);
    if (finished && data.showCorrect !== false) {
      const k = el('div', 'card tl-card ' + size);
      k.append(el('h2', 'tl-h', 'Правильная хронология'), correctTimeline());
      root.append(k);
    }
  }

  // Проверка своя (check), «не заполнено» у Timeline не бывает: порядок есть всегда
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, status, started, instant, maxChecks, goMissing, missingNote, render: renderInto };
})();
