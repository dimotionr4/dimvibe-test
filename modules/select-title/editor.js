// Редактор модуля Select Title: тексты, у каждого свой список заголовков и ровно один правильный.
// У текста и заголовка устойчивый ID (t1, o1…); правильный заголовок хранится по ID, а не по месту в списке.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const SelectTitleEditor = (() => {
  const MAX_TEXTS = 5, MAX_WORDS = 400, MIN_OPTS = 2, MAX_OPTS = 6, START_OPTS = 4; // текстов, слов в тексте, заголовков у текста
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const WORD = /[\p{L}\p{N}\p{M}]+(?:['’‐-][\p{L}\p{N}\p{M}]+)*/gu;
  const wordCount = s => (String(s || '').match(WORD) || []).length;
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const allOptIds = () => d.texts.flatMap(t => t.options.map(o => o.id));

  const VIEWS = { one: 'По одному тексту', list: 'Все тексты сразу' };
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = String(im.alt || '').trim().replace(/\s+/g, ' '), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };

  function newText(id, firstOpt) {
    const options = [];
    for (let k = 0; k < START_OPTS; k++) options.push({ id: 'o' + (firstOpt + k), text: '' });
    return { id, text: '', image: emptyImage(), audio: '', options, correct: '', explanation: '' };
  }
  function create() {
    return { module: 'select_title', format: 1, view: 'one', shuffle: true, imageSize: 'm', imageFit: 'contain', texts: [newText('t1', 1)] };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!VIEWS[d.view]) d.view = 'one';
    if (typeof d.shuffle !== 'boolean') d.shuffle = true;
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    if (!FITS[d.imageFit]) d.imageFit = 'contain';
    d.texts.forEach(t => {
      if (!t.image) t.image = emptyImage();
      if (typeof t.audio !== 'string') t.audio = '';
    });
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null;
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
    root.className = 'st-wrap';
    const tools = el('div', 'st-tools');
    counter = el('span', 'st-muted');
    const right = el('span', 'st-right');
    right.append(help(`Вставьте текст и напишите к нему варианты заголовка. Отметьте кружком слева правильный заголовок — он один. Ученик прочитает текст и выберет заголовок, который подходит лучше всего. Один верный ответ — один балл за текст. В тексте до ${MAX_WORDS} слов, заголовков от ${MIN_OPTS} до ${MAX_OPTS}, текстов до ${MAX_TEXTS}. Пустая строка в тексте начинает новый абзац.`));
    tools.append(counter, right);
    msg = el('div', 'st-msg');
    msg.hidden = true;
    listBox = el('div', 'st-texts');
    addBtn = el('button', 'st-add', '+ Текст');
    addBtn.type = 'button';
    addBtn.onclick = addText;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Текстов: ${d.texts.length}/${MAX_TEXTS}`;
    addBtn.disabled = d.texts.length >= MAX_TEXTS;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.texts.forEach((t, k) => listBox.append(card(t, k)));
    updateCounter();
  }

  const newTextId = () => nextId('t', d.texts.map(t => t.id));
  const newOptId = () => nextId('o', allOptIds());

  function card(t, k) {
    const many = d.texts.length > 1;
    const box = el('section', 'st-text' + (many ? ' multi' : ''));
    box.dataset.id = t.id;
    if (many) box.append(head(t, k));

    // Картинка и звук текста: общие компактные значки (core/mediabar.js)
    const media = el('div', 'st-media');
    const audio = MediaUI.picker('audio', () => t.audio || '', v => { t.audio = v; save(); }, 'Загрузить звук');
    media.append(MediaUI.imageControl(t.image, { save, after: audio }));
    box.append(media);

    const ta = el('textarea', 'st-in st-body');
    ta.rows = 6;
    ta.placeholder = 'Вставьте или напишите текст. Пустая строка начинает новый абзац.';
    ta.value = t.text;
    ta.setAttribute('aria-label', `Текст ${k + 1}`);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 140) + 'px'; };
    const count = el('div', 'st-muted st-count');
    const recount = () => {
      const n = wordCount(t.text);
      count.textContent = `Слов: ${n}/${MAX_WORDS}`;
      count.classList.toggle('st-limit', n > MAX_WORDS);
    };
    ta.oninput = () => { t.text = ta.value; fit(); recount(); save(); };
    setTimeout(fit, 0);
    recount();

    const opts = el('div', 'st-opts');
    const drawOpts = () => {
      opts.innerHTML = '';
      opts.append(el('b', 'st-h', 'Заголовки'), el('p', 'st-muted st-hint', 'Кружком слева отметьте правильный заголовок.'));
      t.options.forEach((o, j) => opts.append(optRow(t, o, j, drawOpts)));
      const add = el('button', 'st-add st-addopt', '+ Заголовок');
      add.type = 'button';
      add.disabled = t.options.length >= MAX_OPTS;
      add.onclick = () => {
        if (t.options.length >= MAX_OPTS) return say(`Заголовков не больше ${MAX_OPTS}.`);
        t.options.push({ id: newOptId(), text: '' });
        save();
        drawOpts();
        const ins = opts.querySelectorAll('.st-opt-in');
        if (ins.length) ins[ins.length - 1].focus();
      };
      opts.append(add);
    };
    drawOpts();

    const ex = el('textarea', 'st-in st-expl');
    ex.rows = 1;
    ex.placeholder = 'Пояснение к правильному ответу (необязательно): ученик увидит его после верного ответа или в конце';
    ex.value = t.explanation;
    ex.setAttribute('aria-label', `Пояснение к тексту ${k + 1}`);
    const fitEx = () => { ex.style.height = 'auto'; ex.style.height = ex.scrollHeight + 2 + 'px'; };
    ex.oninput = () => { t.explanation = ex.value; fitEx(); save(); };
    setTimeout(fitEx, 0);

    box.append(ta, count, opts, ex);
    return box;
  }

  function optRow(t, o, j, redraw) {
    const r = el('div', 'st-opt' + (t.correct === o.id ? ' right' : ''));
    const mark = el('button', 'st-mark');
    mark.type = 'button';
    mark.setAttribute('role', 'radio');
    mark.setAttribute('aria-checked', String(t.correct === o.id));
    mark.setAttribute('aria-label', `Правильный заголовок: вариант ${j + 1}`);
    mark.title = t.correct === o.id ? 'Правильный заголовок' : 'Сделать правильным';
    mark.onclick = () => { t.correct = o.id; save(); redraw(); };
    const inp = el('input', 'st-in st-opt-in');
    inp.type = 'text';
    inp.maxLength = 200;
    inp.placeholder = `Заголовок ${j + 1}`;
    inp.value = o.text;
    inp.setAttribute('aria-label', `Заголовок ${j + 1}`);
    inp.oninput = () => { o.text = inp.value; save(); };
    const b = (html, tip, fn, disabled) => { const x = el('button', 'st-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, заголовок ${j + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const swap = dir => { const i = j + dir; [t.options[j], t.options[i]] = [t.options[i], t.options[j]]; save(); redraw(); };
    const tools = el('span', 'st-tools2');
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => swap(-1), j === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => swap(1), j === t.options.length - 1),
      // Удаление правильного заголовка снимает отметку: автор должен выбрать правильный заново
      b(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить', () => { t.options.splice(j, 1); if (t.correct === o.id) t.correct = ''; save(); redraw(); }, t.options.length <= MIN_OPTS),
    );
    tools.lastChild.classList.add('st-del');
    r.append(mark, inp, tools);
    return r;
  }

  function head(t, k) {
    const top = el('div', 'st-texttop');
    top.append(el('b', '', `Текст ${k + 1}`));
    const tools = el('span', 'st-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'st-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', текст ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Текст выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Текст ниже', () => move(k, 1), k === d.texts.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать текст', () => duplicate(k), d.texts.length >= MAX_TEXTS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'st-ask');
      const yes = el('button', 'st-yes', 'Удалить текст');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить текст', () => { if (t.text.trim() || t.options.some(o => o.text.trim()) || hasPic(t.image) || t.audio) { delAsk = t.id; drawList(); } else remove(k); }));
    top.append(tools);
    return top;
  }

  function addText() {
    if (d.texts.length >= MAX_TEXTS) return say(`Текстов не больше ${MAX_TEXTS}.`);
    const t = newText(newTextId(), 1);
    const ids = allOptIds();
    t.options.forEach(o => { o.id = nextId('o', ids); ids.push(o.id); });
    d.texts.push(t);
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const ta = last.querySelector('.st-body'); if (ta) ta.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.texts.length) return;
    [d.texts[k], d.texts[j]] = [d.texts[j], d.texts[k]];
    save();
    drawList();
  }
  // Копия получает новые ID текста и заголовков; отметка правильного переходит на новый ID того же заголовка
  function duplicate(k) {
    if (d.texts.length >= MAX_TEXTS) return say(`Текстов не больше ${MAX_TEXTS}.`);
    const copy = JSON.parse(JSON.stringify(d.texts[k]));
    copy.id = newTextId();
    const ids = allOptIds();
    copy.options.forEach(o => { const id = nextId('o', ids); ids.push(id); if (copy.correct === o.id) copy.correct = id; o.id = id; });
    d.texts.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.texts.splice(k, 1);
    delAsk = null;
    if (!d.texts.length) d.texts.push(newText('t1', 1));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // Пустые поля заголовков в файл не попадают (по умолчанию у текста четыре поля, заполнять все не обязательно)
  const textOut = t => ({
    id: t.id,
    ...(imageOut(t.image) ? { image: imageOut(t.image) } : {}),
    ...(audioOut(t.audio) ? { audio: audioOut(t.audio) } : {}),
    text: t.text.replace(/\r\n?/g, '\n').trim(),
    options: t.options.filter(o => clean(o.text)).map(o => ({ id: o.id, text: clean(o.text) })),
    correct: t.correct,
    ...(t.explanation.trim() ? { explanation: t.explanation.trim() } : {}),
  });
  function exportData(draft) {
    return {
      module: 'select_title', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      ...(draft.shuffle === false ? { shuffle: false } : {}),
      ...(draft.texts.some(t => imageOut(t.image)) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm', imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain' } : {}),
      texts: draft.texts.map(textOut),
    };
  }

  const unitCount = draft => draft.texts.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.texts.length > 1;
    if (!draft.texts.length) errors.push('Нет ни одного текста.');
    if (draft.texts.length > MAX_TEXTS) errors.push(`Текстов больше ${MAX_TEXTS}.`);
    draft.texts.forEach((t, k) => {
      const pre = many ? `Текст ${k + 1}: ` : '';
      const n = wordCount(t.text);
      if (!t.text.trim() || !n) errors.push(`${pre}текст пустой.`);
      if (n > MAX_WORDS) errors.push(`${pre}в тексте ${n} слов, а можно не больше ${MAX_WORDS}. Разделите его на два текста.`);
      const im = t.image;
      if (im && !safeMediaPath(im.media) && String(im.url || '').trim() && !safeImageUrl(im.url)) errors.push(`${pre}ссылка на картинку должна быть полным адресом с https://.`);
      const filled = t.options.filter(o => clean(o.text));
      if (filled.length < MIN_OPTS) errors.push(`${pre}нужно хотя бы ${MIN_OPTS} заголовка.`);
      if (t.options.length > MAX_OPTS) errors.push(`${pre}заголовков больше ${MAX_OPTS}.`);
      const right = t.options.find(o => o.id === t.correct);
      if (!right) errors.push(`${pre}не отмечен правильный заголовок.`);
      else if (!clean(right.text)) errors.push(`${pre}правильный заголовок пустой.`);
      const seen = new Set();
      filled.forEach(o => {
        const key = clean(o.text).toLowerCase();
        if (seen.has(key)) errors.push(`${pre}заголовок «${clean(o.text)}» повторяется.`);
        seen.add(key);
      });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.texts) || !file.texts.length) throw new Error('В файле нет текстов.');
    const used = new Set();
    const texts = file.texts.slice(0, MAX_TEXTS).map((s, k) => {
      const options = (Array.isArray(s && s.options) ? s.options : []).slice(0, MAX_OPTS).map(o => {
        let id = String((o && o.id) || '');
        if (!id || used.has(id)) id = nextId('o', [...used]);
        used.add(id);
        return { id, text: String((o && o.text) || '') };
      });
      while (options.length < MIN_OPTS) { const id = nextId('o', [...used]); used.add(id); options.push({ id, text: '' }); }
      const correct = options.some(o => o.id === (s && s.correct)) ? s.correct : '';
      const im = s && s.image;
      return { id: String((s && s.id) || 't' + (k + 1)), text: String((s && s.text) || ''),
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (s && s.audio && safeMediaPath(s.audio.media)) || '',
        options, correct, explanation: String((s && s.explanation) || '') };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', shuffle: file.shuffle !== false,
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain', texts };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): показ текстов; размер картинок и вписывание — только если в упражнении есть картинки
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const view = { field: 'view', label: 'Показ текстов', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
      icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } };
    if (!draft.texts.some(t => hasPic(t.image))) return [view];
    return [view,
      { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }
  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'shuffle', label: 'Перемешивать заголовки', value: draft.shuffle !== false,
      help: 'Порядок заголовков выбирается один раз при открытии упражнения и не меняется до обновления страницы; «Начать заново» его не перемешивает. Правильный ответ привязан к самому заголовку, а не к месту. По умолчанию включено.' }];
  }

  return { create, render, load, exportData, validate, unitCount, designOptions, behaviorOptions };
})();
