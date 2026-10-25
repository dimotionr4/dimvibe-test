// Редактор модуля Timeline: одна хронология событий; порядок событий в редакторе — это и есть правильный ответ.
// У события устойчивый ID (e1, e2…), подпись даты — любой текст («1914», «июль 1969», «XVIII век»): по ней ничего не сортируется.
// Перестановка (перетаскиванием за ручку или стрелками, core/reorder.js) меняет ответ.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const TimelineEditor = (() => {
  const MIN_EVENTS = 2, MAX_EVENTS = 12, START_EVENTS = 3, MAX_DATE = 40, MAX_TEXT = 300; // событий, символов в дате и в тексте
  const { nextId } = GapEngine;
  let d, root, save, msgTimer = null;
  let msg, counter, list, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="tl-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const low = s => clean(s).normalize('NFC').toLowerCase();

  const VIS = { after_check: 'После проверки', always_visible: 'Сразу' };
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const datesShown = draft => draft.dateVisibility === 'always_visible';
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const picKey = im => (hasPic(im) ? (safeMediaPath(im.media) || safeImageUrl(im.url)) : '');
  const hasFace = ev => !!clean(ev.text) || hasPic(ev.image); // у события есть содержимое: текст и (или) картинка
  const used = ev => !!(clean(ev.date) || hasFace(ev) || clean(ev.explanation) || ev.audio); // в событии что-то есть
  // Что ученик видит на карточке до проверки: по этому ключу ищутся одинаковые карточки (скрытая дата их не различает; звук не виден)
  const faceKey = (draft, ev) => (datesShown(draft) ? low(ev.date) + '|' : '') + low(ev.text) + '|' + picKey(ev.image);
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };

  const newEvent = id => ({ id, date: '', text: '', explanation: '', image: emptyImage(), audio: '' });
  function create() {
    const events = [];
    for (let k = 1; k <= START_EVENTS; k++) events.push(newEvent('e' + k));
    return { module: 'timeline', format: 1, dateVisibility: 'after_check', showCorrect: true, imageSize: 'm', events };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!VIS[d.dateVisibility]) d.dateVisibility = 'after_check';
    if (typeof d.showCorrect !== 'boolean') d.showCorrect = true;
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    d.events.forEach(ev => {
      if (!ev.image) ev.image = emptyImage();
      if (typeof ev.audio !== 'string') ev.audio = '';
    });
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    normalize();
    draw();
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 6000);
  }

  function draw() {
    root.innerHTML = '';
    root.className = 'tl-wrap';
    const tools = el('div', 'tl-tools');
    counter = el('span', 'tl-muted');
    const right = el('span', 'tl-right');
    right.append(help(`Напишите события сразу в правильном порядке: сверху — самое раннее. Этот порядок и есть ответ; если переставить события (за ручку ⋮⋮ или стрелками), ответ поменяется вместе с ними. Дата — любой текст («1914», «июль 1969», «44 до н. э.», «XVIII век»): по датам ничего не сортируется. Ученик получит события перемешанными; даты он увидит после проверки (или сразу — вкладка «Дизайн»). Проверка одна, балл — за каждое событие на своём месте. К событию можно добавить картинку (тогда текст — подпись, необязательно) и звук. Пояснение необязательно, ученик увидит его после проверки. Событий от ${MIN_EVENTS} до ${MAX_EVENTS}.`));
    tools.append(counter, right);
    msg = el('div', 'tl-msg');
    msg.hidden = true;
    list = el('ol', 'tl-events');
    // Перетаскивание за ручку: новое место события сразу становится правильным ответом
    Reorder.attach(list, { itemSel: '.tl-row', handleSel: '.tl-grip', dragClass: 'tl-dragging', listClass: 'tl-dragging-list', onDrop: (from, to) => {
      const [ev] = d.events.splice(from, 1);
      d.events.splice(to, 0, ev);
      save();
      drawList();
    } });
    addBtn = el('button', 'tl-add', '+ Событие');
    addBtn.type = 'button';
    addBtn.onclick = () => {
      if (d.events.length >= MAX_EVENTS) return say(`Событий не больше ${MAX_EVENTS}.`);
      d.events.push(newEvent(nextId('e', d.events.map(e => e.id))));
      save();
      drawList();
      const ins = list.querySelectorAll('.tl-date-in');
      if (ins.length) ins[ins.length - 1].focus();
    };
    root.append(tools, msg, el('p', 'tl-muted tl-hint', 'Сверху вниз — правильный порядок, от раннего к позднему.'), list, addBtn);
    drawList();
  }

  function drawList() {
    list.innerHTML = '';
    d.events.forEach((ev, j) => list.append(row(ev, j)));
    marks();
    counter.textContent = `Событий: ${d.events.length}/${MAX_EVENTS}`;
    addBtn.disabled = d.events.length >= MAX_EVENTS;
  }

  // Подсветка сразу, не дожидаясь публикации: одинаковые карточки (красная рамка) и одинаковые даты (жёлтая, только предупреждение)
  function marks() {
    const faces = {}, dates = {};
    d.events.forEach(ev => {
      if (hasFace(ev)) { const k = faceKey(d, ev); faces[k] = (faces[k] || 0) + 1; }
      if (clean(ev.date)) { const k = low(ev.date); dates[k] = (dates[k] || 0) + 1; }
    });
    list.querySelectorAll('.tl-row').forEach((r, j) => {
      const ev = d.events[j];
      if (!ev) return;
      r.classList.toggle('dup', hasFace(ev) && faces[faceKey(d, ev)] > 1);
      r.classList.toggle('samedate', !!clean(ev.date) && dates[low(ev.date)] > 1);
    });
  }

  function row(ev, j) {
    const r = el('li', 'tl-row');
    const grip = el('button', 'tl-grip');
    grip.type = 'button';
    grip.innerHTML = Reorder.GRIP;
    grip.title = 'Перетащить';
    grip.setAttribute('aria-label', `Перетащить событие ${j + 1}`);
    const num = el('span', 'tl-num', String(j + 1));
    const date = el('input', 'tl-in tl-date-in');
    date.type = 'text';
    date.maxLength = MAX_DATE;
    date.placeholder = 'Дата';
    date.value = ev.date;
    date.setAttribute('aria-label', `Дата события ${j + 1}`);
    date.oninput = () => { ev.date = date.value; save(); marks(); };
    const text = el('input', 'tl-in tl-text-in');
    text.type = 'text';
    text.maxLength = MAX_TEXT;
    const ph = () => (hasPic(ev.image) ? 'Подпись к картинке (необязательно)' : `Событие ${j + 1}`);
    text.placeholder = ph();
    text.value = ev.text;
    text.setAttribute('aria-label', `Событие ${j + 1}`);
    text.oninput = () => { ev.text = text.value; save(); marks(); };
    const b = (html, tip, fn, disabled) => { const x = el('button', 'tl-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, событие ${j + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const swap = dir => { const i = j + dir; [d.events[j], d.events[i]] = [d.events[i], d.events[j]]; save(); drawList(); };
    // Копия получает новый ID и встаёт сразу под оригиналом; правки копии не меняют оригинал
    const dup = () => {
      if (d.events.length >= MAX_EVENTS) return say(`Событий не больше ${MAX_EVENTS}.`);
      d.events.splice(j + 1, 0, { ...ev, id: nextId('e', d.events.map(e => e.id)) });
      save();
      drawList();
    };
    const tools = el('span', 'tl-tools2');
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => swap(-1), j === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => swap(1), j === d.events.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', dup, d.events.length >= MAX_EVENTS),
      b(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить', () => { d.events.splice(j, 1); save(); drawList(); }, d.events.length <= MIN_EVENTS),
    );
    tools.lastChild.classList.add('tl-del');
    const ex = el('input', 'tl-in tl-expl-in');
    ex.type = 'text';
    ex.maxLength = 400;
    ex.placeholder = 'Пояснение (необязательно): ученик увидит его после проверки';
    ex.value = ev.explanation;
    ex.setAttribute('aria-label', `Пояснение к событию ${j + 1}`);
    ex.oninput = () => { ev.explanation = ex.value; save(); };
    // Картинка и звук события: общие компактные значки (core/mediabar.js), строкой под полями
    const media = el('div', 'tl-media');
    const audio = MediaUI.picker('audio', () => ev.audio || '', v => { ev.audio = v; save(); }, 'Загрузить звук события');
    media.append(MediaUI.imageControl(ev.image, { save, after: audio, change: () => { text.placeholder = ph(); marks(); } }));
    const extra = el('div', 'tl-extra');
    extra.append(media, ex);
    r.append(grip, num, date, text, tools, extra);
    return r;
  }

  // ---- Файл упражнения ----
  // Порядок events в файле — правильный порядок. Пустые события в файл не попадают;
  // dateVisibility пишется только при «Сразу», showCorrect — только при выключенном; text, image, audio, explanation — только если есть;
  // imageSize — только если в упражнении есть картинка
  function exportData(draft) {
    const evs = draft.events.filter(used);
    return {
      module: 'timeline', format: 1,
      ...(datesShown(draft) ? { dateVisibility: 'always_visible' } : {}),
      ...(draft.showCorrect === false ? { showCorrect: false } : {}),
      ...(evs.some(ev => imageOut(ev.image)) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm' } : {}),
      events: evs.map(ev => ({
        id: ev.id, date: clean(ev.date),
        ...(clean(ev.text) ? { text: clean(ev.text) } : {}),
        ...(imageOut(ev.image) ? { image: imageOut(ev.image) } : {}),
        ...(audioOut(ev.audio) ? { audio: audioOut(ev.audio) } : {}),
        ...(clean(ev.explanation) ? { explanation: clean(ev.explanation) } : {}),
      })),
    };
  }

  // Балл — за каждое событие на своём месте
  const unitCount = draft => draft.events.filter(used).length;
  // Проверка у Timeline всегда одна, итоговая (решение архива D-083…D-086)
  const fixedChecks = () => 1;
  const fixedChecksNote = 'У Timeline проверка всегда одна, итоговая: до неё ученик переставляет события сколько угодно, после неё порядок не меняется и открываются все даты. «Начать заново» перемешивает события и даёт новую проверку.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const full = draft.events.filter(used);
    if (full.length < MIN_EVENTS) errors.push(`Нужно хотя бы ${MIN_EVENTS} события.`);
    if (draft.events.length > MAX_EVENTS) errors.push(`Событий больше ${MAX_EVENTS}.`);
    // Пустое событие посередине сбило бы правильный порядок; у заполненного нужны и дата, и текст
    const last = draft.events.map(used).lastIndexOf(true);
    draft.events.forEach((ev, j) => {
      if (!used(ev)) { if (j < last) errors.push(`Событие ${j + 1} пустое: заполните или удалите его.`); return; }
      if (!clean(ev.date)) errors.push(`Событие ${j + 1}: нет даты.`);
      if (!hasFace(ev)) errors.push(`Событие ${j + 1}: нет текста или картинки.`);
      const im = ev.image;
      if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) errors.push(`Событие ${j + 1}: ссылка на картинку должна быть полным адресом с https://.`);
    });
    const faces = new Map(), dates = new Map();
    draft.events.forEach((ev, j) => {
      if (hasFace(ev)) {
        const k = faceKey(draft, ev);
        if (faces.has(k)) errors.push(`События ${faces.get(k) + 1} и ${j + 1} выглядят для ученика одинаково${datesShown(draft) ? '' : ' (даты до проверки скрыты)'}: их нельзя различить.`);
        else faces.set(k, j);
      }
      if (clean(ev.date)) {
        const k = low(ev.date);
        if (dates.has(k)) warnings.push(`У событий ${dates.get(k) + 1} и ${j + 1} одинаковая дата «${clean(ev.date)}». Проверьте, что их порядок задан верно: ученик должен понять, какое из них раньше.`);
        else dates.set(k, j);
      }
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.events) || !file.events.length) throw new Error('В файле нет событий.');
    const ids = new Set();
    const events = file.events.slice(0, MAX_EVENTS).map(e => {
      let id = String((e && e.id) || '');
      if (!id || ids.has(id)) id = nextId('e', [...ids]);
      ids.add(id);
      const im = e && e.image;
      return { id, date: String((e && e.date) || ''), text: String((e && e.text) || ''), explanation: String((e && e.explanation) || ''),
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (e && e.audio && safeMediaPath(e.audio.media)) || '' };
    });
    while (events.length < MIN_EVENTS) { const id = nextId('e', [...ids]); ids.add(id); events.push(newEvent(id)); }
    return { ...create(), dateVisibility: file.dateVisibility === 'always_visible' ? 'always_visible' : 'after_check', showCorrect: file.showCorrect !== false,
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', events };
  }

  // Настройка во вкладке «Дизайн» (рисует ядро): когда ученик видит даты
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  // и размер картинок — только если в упражнении есть картинки
  function designOptions(draft) {
    const vis = { field: 'dateVisibility', label: 'Даты видны', value: datesShown(draft) ? 'always_visible' : 'after_check', names: VIS,
      icons: { after_check: sq('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M10 14l4 3M14 14l-4 3"/>'), always_visible: sq('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9 15l2 2 4-4"/>') } };
    if (!draft.events.some(ev => hasPic(ev.image))) return [vis];
    return [vis, { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } }];
  }
  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showCorrect', label: 'Показывать правильную хронологию', value: draft.showCorrect !== false,
      help: 'После проверки под ответом ученика появляется раздел «Правильная хронология»: все события по порядку, с датами и пояснениями. Верные места ученика в любом случае зелёные, неверные — красные. По умолчанию включено.' }];
  }

  return { create, render, load, exportData, validate, unitCount, fixedChecks, fixedChecksNote, designOptions, behaviorOptions };
})();
