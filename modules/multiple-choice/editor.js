// Редактор модуля Multiple Choice: вопросы с вариантами; у каждого вопроса Single Choice (один верный) или Multiple Select (один и больше).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Правильные ответы хранятся по ID вариантов, поэтому перестановка и правка текста их не сбивают.
const MultipleChoiceEditor = (() => {
  const MAX_Q = 10, MAX_OPT = 8, DEFAULT_OPT = 4;
  const VIEWS = { one: 'По одному вопросу', list: 'Все списком' };
  const LABELS = { letters: 'Буквы A, B, C', numbers: 'Цифры 1, 2, 3', none: 'Без маркеров' };
  const labelsOf = () => (d.labels === 'numbers' || d.labels === 'none' ? d.labels : 'letters');
  const { nextId } = GapEngine;
  let d, root, save, openId = null, delAsk = null, msgTimer = null, drag = null;
  let msg, counter, listBox, addBtn;
  const optOpen = new Set(); // раскрытые панели картинки и звука вариантов: «ID вопроса:ID варианта»

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="mc-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));

  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const newOption = id => ({ id, text: '', image: emptyImage(), audio: '' });
  const newOptions = n => Array.from({ length: n }, (_, k) => newOption('o' + (k + 1)));
  const newItem = id => ({ id, text: '', mode: '', options: newOptions(DEFAULT_OPT), correct: [], image: { ...emptyImage(), align: 'top' }, audio: '' });
  const ALIGNS = { top: 'Сверху', bottom: 'Снизу', left: 'Слева', right: 'Справа' };
  const ALIGN_ICONS = {
    top: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 11h18" /><rect x="5" y="5" width="14" height="4" fill="currentColor" stroke="none"/>',
    bottom: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 13h18"/><rect x="5" y="15" width="14" height="4" fill="currentColor" stroke="none"/>',
    left: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M11 3v18"/><rect x="5" y="5" width="4" height="14" fill="currentColor" stroke="none"/>',
    right: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M13 3v18"/><rect x="15" y="5" width="4" height="14" fill="currentColor" stroke="none"/>',
  };
  const MODE_NAMES = { single: 'Одна верная', multiple: 'Несколько верных' };
  const MODE_ICONS = [ // порядок: слева «одна верная», справа «несколько»
    ['single', 'Single Choice: один верный', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'],
    ['multiple', 'Multiple Select: несколько верных', '<path d="M4 6l2 2 3-3M4 14l2 2 3-3M12 7h8M12 15h8"/>'],
  ];
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const hasOptContent = o => !!clean(o.text) || hasPic(o.image);
  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    d.items.forEach(it => {
      if (!it.image) it.image = { ...emptyImage(), align: 'top' };
      if (!ALIGNS[it.image.align]) it.image.align = 'top';
      if (typeof it.audio !== 'string') it.audio = '';
      it.options.forEach(o => { if (!o.image) o.image = emptyImage(); if (typeof o.audio !== 'string') o.audio = ''; });
    });
  }
  // Файл упражнения: {media | url, alt} или null; звук — {media} или null
  const imageOut = (im, extra) => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt, ...extra };
    const url = safeImageUrl(im.url);
    return url ? { url, alt, ...extra } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };
  // '' в вопросе — «как в общих настройках»
  const modeOf = it => (it.mode === 'single' || it.mode === 'multiple' ? it.mode : d.mode === 'multiple' ? 'multiple' : 'single');

  function create() {
    return { module: 'multiple_choice', format: 1, mode: 'single', labels: 'letters', shuffle: true, showCount: false, showCorrect: false, view: 'one', items: [newItem('q1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): вопрос с картинкой и звуком, варианты-картинки, Multiple Select
  function demo() {
    const I = DimDemo.IMG, A = DimDemo.AUD;
    const opt = (id, text, media, audio) => ({ ...newOption(id), text, image: { ...emptyImage(), media: media || '' }, audio: audio || '' });
    const q1 = { ...newItem('q1'), text: 'Which number is the biggest?', image: { ...emptyImage(), media: I.question, align: 'top' }, audio: A.a,
      options: [opt('o1', 'One', I.one, A.b), opt('o2', 'Two', I.two), opt('o3', 'Four', I.four)], correct: ['o3'] };
    const q2 = { ...newItem('q2'), text: 'Which of these are fruits?', mode: 'multiple',
      options: [opt('o4', 'Apple'), opt('o5', 'Carrot'), opt('o6', 'Banana'), opt('o7', 'Potato')], correct: ['o4', 'o6'] };
    const q3 = { ...newItem('q3'), text: 'What is the capital of France?',
      options: [opt('o8', 'Paris'), opt('o9', 'Rome'), opt('o10', 'Madrid')], correct: ['o8'] };
    return { ...create(), showCount: true, instruction: DimDemo.instruction('Выберите правильный ответ.'), items: [q1, q2, q3] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    normalize();
    if (!d.items.some(i => i.id === openId)) openId = d.items.length ? d.items[0].id : null;
    delAsk = null;
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
    root.className = 'mc-wrap';
    const tools = el('div', 'mc-tools');
    counter = el('span', 'mc-muted');
    const right = el('span', 'mc-right');
    right.append(help(`Напишите вопросы и варианты. Нажмите на кружок или квадрат слева от варианта, чтобы отметить его верным. Single Choice — один верный ответ, Multiple Select — один и больше. Балл за вопрос ставится только за точный набор верных вариантов, частичных баллов нет. Для публикации в вопросе нужно минимум два варианта. Не больше ${MAX_Q} вопросов и ${MAX_OPT} вариантов в вопросе. Метки, показ, перемешивание — во вкладках «Дизайн» и «Поведение».`));
    tools.append(counter, right);
    msg = el('div', 'mc-msg');
    msg.hidden = true;
    listBox = el('div', 'mc-list');
    addBtn = el('button', 'mc-add', '+ Вопрос');
    addBtn.onclick = () => addItem(d.items.length);
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    const n = d.items.length;
    counter.textContent = `Вопросов: ${n}/${MAX_Q}`;
    counter.classList.toggle('mc-limit', n >= MAX_Q);
    addBtn.disabled = n >= MAX_Q;
  }

  // ---- Список вопросов ----
  function drawList() {
    listBox.innerHTML = '';
    d.items.forEach((it, i) => listBox.append(row(it, i)));
    updateCounter();
  }
  const clearDrop = () => listBox.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));

  function summary(it) {
    const filled = it.options.filter(hasOptContent).length, n = it.correct.length;
    return `вариантов: ${filled} · верных: ${n}`;
  }

  function row(it, i) {
    const open = it.id === openId;
    const r = el('div', 'mc-row' + (open ? ' open' : ''));
    r.dataset.id = it.id;
    const head = el('div', 'mc-head');
    const grip = el('span', 'mc-grip', '⠿');
    grip.title = 'Перетащить';
    grip.onpointerdown = () => { r.draggable = true; };
    r.ondragend = () => { r.draggable = false; r.classList.remove('dragging'); clearDrop(); drag = null; };
    r.ondragstart = e => { drag = it.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); };
    r.ondragover = e => {
      if (!drag || drag === it.id) return;
      e.preventDefault();
      const b = r.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
      clearDrop();
      r.classList.add(after ? 'drop-after' : 'drop-before');
    };
    r.ondrop = e => {
      if (!drag) return;
      e.preventDefault();
      const b = r.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
      const from = d.items.findIndex(x => x.id === drag);
      let to = i + (after ? 1 : 0);
      if (from < 0) return;
      const [m] = d.items.splice(from, 1);
      if (from < to) to--;
      d.items.splice(to, 0, m);
      drag = null;
      save();
      drawList();
    };
    const sum = el('button', 'mc-sum');
    sum.type = 'button';
    sum.setAttribute('aria-expanded', String(open));
    const txt = el('span', 'mc-txt' + (clean(it.text) ? '' : ' empty'), clean(it.text) || 'Пустой вопрос');
    sum.append(el('span', 'mc-n', `${i + 1}.`), txt);
    sum.onclick = () => { openId = open ? null : it.id; delAsk = null; drawList(); };
    const tools = el('span', 'mc-tools2');
    const btn = (cls, html, tip, fn, disabled) => {
      const b = el('button', 'mc-ib ' + cls);
      b.type = 'button';
      b.innerHTML = html;
      b.title = tip;
      b.setAttribute('aria-label', tip);
      b.disabled = !!disabled;
      b.onclick = e => { e.stopPropagation(); fn(); };
      return b;
    };
    // Тип вопроса значками: как в общих / один верный / несколько верных
    const modes = el('span', 'mc-modes');
    // Переключатель-триггер: нажатие меняет тип вопроса на другой, активный значок подсвечен
    const cur = modeOf(it), next = cur === 'multiple' ? 'single' : 'multiple';
    const trig = el('button', 'mc-trigger ' + cur);
    trig.type = 'button';
    trig.innerHTML = MODE_ICONS.map(([v, , ico]) => `<span class="mc-tg${v === cur ? ' on' : ''}">${svg(ico)}</span>`).join('');
    trig.title = `${MODE_NAMES[cur]}. Нажмите, чтобы переключить на «${MODE_NAMES[next].toLowerCase()}»`;
    trig.setAttribute('role', 'switch');
    trig.setAttribute('aria-checked', String(cur === 'multiple'));
    trig.setAttribute('aria-label', 'Несколько верных ответов');
    trig.onclick = e => { e.stopPropagation(); it.mode = next; save(); drawList(); };
    modes.append(trig);
    modes.append(el('span', 'mc-modename', MODE_NAMES[modeOf(it)]));
    tools.append(
      btn('', svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => move(i, -1), i === 0),
      btn('', svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => move(i, 1), i === d.items.length - 1),
      btn('', svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(i), d.items.length >= MAX_Q),
      btn('mc-eye' + (it.hidden ? ' on' : ''), it.hidden
        ? svg('<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6a15 15 0 0 1-2.6 3M6.7 7.5A15 15 0 0 0 2.5 12C3.5 13.5 7 18 12 18c1.3 0 2.5-.3 3.6-.8"/>')
        : svg('<path d="M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6z"/><circle cx="12" cy="12" r="3"/>'),
        it.hidden ? 'Скрыт: ученик не увидит этот вопрос. Нажмите, чтобы показать' : 'Временно скрыть вопрос от ученика', () => { it.hidden = !it.hidden; save(); drawList(); }),
    );
    if (delAsk === it.id) {
      const q = el('span', 'mc-ask');
      const yes = el('button', 'mc-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => removeItem(i);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(btn('mc-del', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', () => askDelete(i)));
    r.classList.toggle('hidden-q', !!it.hidden);
    head.append(grip, sum, modes, tools);
    r.append(head);
    if (open) r.append(body(it, txt));
    return r;
  }

  // Выбор картинки: загрузка и медиатека (mediaPicker из ядра), ссылка https, описание, «Убрать»; для картинки вопроса ещё положение.
  // im — объект {media, url, alt[, align]}, меняется на месте; redraw вызывается, когда картинка появилась или исчезла
  function imageField(im, withAlign, redraw, after) {
    const box = el('div', 'mc-imgf');
    // Загрузка, медиатека, ссылка, описание и «Убрать» — общий компактный элемент (core/mediabar.js)
    box.append(MediaUI.imageControl(im, { save, change: redraw, after }));
    if (hasPic(im) && withAlign) {
      const seg = el('span', 'mc-seg');
      Object.entries(ALIGNS).forEach(([v, label]) => {
        const bt = el('button', im.align === v ? 'active' : '', label);
        bt.type = 'button';
        bt.setAttribute('aria-pressed', String(im.align === v));
        bt.onclick = () => { im.align = v; save(); redraw(); };
        seg.append(bt);
      });
      const al = el('div', 'mc-label mc-labelrow', 'Положение картинки');
      box.append(al, seg);
    }
    return box;
  }  const audioField = (get, set, label) => (window.mediaPicker ? window.mediaPicker('audio', get, set, label) : el('span'));

  // Раскрытый вопрос: текст, тип, варианты (слева отметка верного, справа поле текста)
  function body(it, headTxt) {
    const b = el('div', 'mc-body');
    const ta = el('textarea');
    ta.rows = 2;
    ta.placeholder = 'Вопрос, например: Which of these are fruits?';
    ta.value = it.text;
    ta.setAttribute('aria-label', 'Текст вопроса');
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { it.text = ta.value; fit(); headTxt.textContent = clean(it.text) || 'Пустой вопрос'; headTxt.classList.toggle('empty', !clean(it.text)); save(); };
    setTimeout(fit, 0);

    // Картинка вопроса — большая плитка слева от текста, звук — перед полем вопроса (наброски владельца 2026-10-27…28, core/mediabar.js);
    // положение картинки выбирается под ними, когда картинка есть
    const qAudio = audioField(() => it.audio || '', v => { it.audio = v; save(); }, 'Загрузить звук вопроса');
    const qbox = el('div', 'mc-media');
    const drawQ = () => {
      qbox.innerHTML = '';
      if (!hasPic(it.image)) return;
      const al = el('div', 'mc-label mc-labelrow', 'Положение картинки');
      al.append(help('Картинка стоит сверху, снизу, слева или справа от текста вопроса. У ученика на ней значок увеличения. Размер и вписывание картинок — во вкладке «Дизайн». Звук ученик включает значком динамика у вопроса, он не влияет на выбор и баллы.'));
      const seg = el('span', 'mc-seg mc-iconseg');
      Object.entries(ALIGNS).forEach(([v, label]) => {
        const bt = el('button', it.image.align === v ? 'active' : '');
        bt.innerHTML = svg(ALIGN_ICONS[v]);
        bt.type = 'button';
        bt.title = label;
        bt.setAttribute('aria-label', 'Картинка: ' + label.toLowerCase());
        bt.setAttribute('aria-pressed', String(it.image.align === v));
        bt.onclick = () => { it.image.align = v; save(); drawQ(); };
        seg.append(bt);
      });
      qbox.append(al, seg);
    };
    const qpic = MediaUI.imageControl(it.image, { save, change: drawQ, after: qAudio, audioOutside: true, big: true });
    drawQ();
    b.append(MediaUI.side(qpic, MediaUI.withAudio(qAudio, ta, true)), qbox);

    const multi = modeOf(it) === 'multiple';
    const ol = el('div', 'mc-label mc-labelrow', 'Варианты');
    ol.append(help(multi ? 'Отметьте квадратом все верные варианты (можно один или все). Ученик должен выбрать точный набор.' : 'Отметьте кружком один верный вариант.'));
    // Метки вариантов (одни на всё упражнение): буквы или цифры; бледно видны в отметке каждого варианта
    const ls = el('span', 'mc-seg mc-lseg');
    [['letters', 'ABC'], ['numbers', '123'], ['none', '—']].forEach(([v, label]) => {
      const bt = el('button', labelsOf() === v ? 'active' : '', label);
      bt.type = 'button';
      bt.title = LABELS[v];
      bt.setAttribute('aria-pressed', String(labelsOf() === v));
      bt.onclick = () => { d.labels = v; save(); drawList(); };
      ls.append(bt);
    });
    ls.title = 'Метки A, B, C или 1, 2, 3 одинаковы для всего упражнения; ученик видит их по порядку на экране (при перемешивании тоже)';
    ol.append(ls);
    b.append(ol);
    const opts = el('div', 'mc-opts-ed');
    it.options.forEach((o, k) => {
      const line = el('div', 'mc-optline');
      const on = it.correct.includes(o.id);
      const mark = el('button', 'mc-mark' + (multi ? ' multi' : '') + (on ? ' on' : ''));
      mark.type = 'button';
      mark.setAttribute('role', multi ? 'checkbox' : 'radio');
      mark.setAttribute('aria-checked', String(on));
      mark.textContent = labelsOf() === 'none' ? '' : labelsOf() === 'numbers' ? String(k + 1) : String.fromCharCode(65 + k);
      mark.title = on ? 'Верный вариант (нажмите, чтобы снять)' : 'Отметить верным';
      mark.setAttribute('aria-label', `${mark.title}: вариант ${k + 1}`);
      mark.onclick = () => {
        if (multi) it.correct = on ? it.correct.filter(x => x !== o.id) : [...it.correct, o.id];
        else it.correct = on && it.correct.length === 1 ? [] : [o.id]; // в Single выбор заменяет прежний
        save();
        drawList();
      };
      const inp = el('input');
      inp.value = o.text;
      inp.placeholder = `Вариант ${k + 1}`;
      inp.setAttribute('aria-label', `Текст варианта ${k + 1}`);
      inp.oninput = () => { o.text = inp.value; save(); headSummary(it); };
      const del = el('button', 'mc-ib mc-del', '×');
      del.type = 'button';
      del.title = 'Убрать вариант';
      del.setAttribute('aria-label', `Убрать вариант ${k + 1}`);
      del.disabled = it.options.length <= 1;
      del.onclick = () => { it.options.splice(k, 1); it.correct = it.correct.filter(x => x !== o.id); save(); drawList(); };
      // Картинка и звук варианта: значки открывают панель под строкой (светятся, если что-то задано)
      const key = it.id + ':' + o.id, isOpen = optOpen.has(key);
      const more = el('button', 'mc-ib mc-more' + (isOpen ? ' on' : '') + (hasPic(o.image) || o.audio ? ' has' : ''));
      more.type = 'button';
      more.innerHTML = svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>');
      more.title = 'Картинка и звук варианта';
      more.setAttribute('aria-label', `Картинка и звук варианта ${k + 1}`);
      more.setAttribute('aria-expanded', String(isOpen));
      more.onclick = () => { if (optOpen.has(key)) optOpen.delete(key); else optOpen.add(key); drawList(); };
      line.append(mark, inp, more, del);
      const wrap = el('div', 'mc-optwrap');
      wrap.append(line);
      if (isOpen) {
        const panel = el('div', 'mc-optpanel');
        const drawO = () => { panel.innerHTML = ''; panel.append(imageField(o.image, false, drawO, audioField(() => o.audio || '', v => { o.audio = v; save(); }, 'Загрузить звук варианта'))); };
        drawO();
        wrap.append(panel);
      }
      opts.append(wrap);
    });
    b.append(opts);
    if (!multi && it.correct.length > 1) b.append(el('div', 'mc-warn', `В Single Choice нужен один верный вариант, а отмечено ${it.correct.length}. Отметки сохранены: выберите один, иначе публикация заблокируется. Если переключить на Multiple Select, они снова заработают.`));
    const add = el('button', 'mc-addopt', '+ Вариант');
    add.type = 'button';
    add.disabled = it.options.length >= MAX_OPT;
    add.onclick = () => {
      it.options.push(newOption(nextId('o', it.options.map(x => x.id))));
      save();
      drawList();
      const inputs = listBox.querySelectorAll(`.mc-row[data-id="${it.id}"] .mc-optline input`);
      if (inputs.length) inputs[inputs.length - 1].focus();
    };
    const foot = el('div', 'mc-foot');
    foot.append(add, el('span', 'mc-meta', summary(it)));
    b.append(foot);
    return b;
  }
  const headSummary = it => {
    const m = listBox.querySelector(`.mc-row[data-id="${it.id}"] .mc-meta`);
    if (m) m.textContent = summary(it);
  };

  function addItem(index) {
    if (d.items.length >= MAX_Q) return say(`Вопросов не больше ${MAX_Q}. Разделите задание на два.`);
    const id = nextId('q', d.items.map(i => i.id));
    d.items.splice(index, 0, newItem(id));
    openId = id;
    save();
    drawList();
    const ta = listBox.querySelector(`.mc-row[data-id="${id}"] textarea`);
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function duplicate(i) {
    if (d.items.length >= MAX_Q) return say(`Вопросов не больше ${MAX_Q}.`);
    const copy = JSON.parse(JSON.stringify(d.items[i]));
    copy.id = nextId('q', d.items.map(x => x.id));
    d.items.splice(i + 1, 0, copy);
    openId = copy.id;
    save();
    drawList();
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    save();
    drawList();
    const b = listBox.querySelector(`.mc-row[data-id="${d.items[j].id}"] .mc-ib:not(:disabled)`);
    if (b) b.focus();
  }

  // Заполненный вопрос удаляется после подтверждения прямо в строке, пустой — сразу
  function askDelete(i) {
    const it = d.items[i];
    if (!clean(it.text) && !it.correct.length && !it.options.some(o => clean(o.text))) return removeItem(i);
    delAsk = it.id;
    drawList();
  }
  function removeItem(i) {
    const [it] = d.items.splice(i, 1);
    if (openId === it.id) openId = null;
    delAsk = null;
    if (!d.items.length) { d.items.push(newItem('q1')); openId = 'q1'; }
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  function exportData(draft) {
    d = draft;
    return {
      module: 'multiple_choice', format: 1,
      view: draft.view === 'list' ? 'list' : 'one',
      mode: draft.mode === 'multiple' ? 'multiple' : 'single',
      labels: labelsOf(),
      shuffle: draft.shuffle !== false,
      ...(draft.showCount ? { showCount: true } : {}),
      ...(draft.showCorrect ? { showCorrect: true } : {}),
      imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm',
      imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain',
      items: draft.items.filter(it => !it.hidden).map(it => {
        const qi = imageOut(it.image, { align: it.image && ALIGNS[it.image.align] ? it.image.align : 'top' }), qa = audioOut(it.audio);
        return {
          id: it.id,
          text: clean(it.text),
          mode: modeOf(it),
          ...(qi ? { image: qi } : {}),
          ...(qa ? { audio: qa } : {}),
          options: it.options.map(o => {
            const oi = imageOut(o.image), oa = audioOut(o.audio);
            return { id: o.id, text: clean(o.text), ...(oi ? { image: oi } : {}), ...(oa ? { audio: oa } : {}) };
          }),
          correct: it.options.map(o => o.id).filter(id => it.correct.includes(id)),
        };
      }),
    };
  }

  const unitCount = draft => draft.items.filter(it => !it.hidden).length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    d = draft;
    const items = draft.items;
    if (!items.length) errors.push('Нет ни одного вопроса.');
    else if (items.every(it => it.hidden)) errors.push('Все вопросы скрыты (значок глаза). Покажите хотя бы один.');
    if (items.length > MAX_Q) errors.push(`Вопросов больше ${MAX_Q}. Разделите задание на два.`);
    const nHidden = items.filter(it => it.hidden).length;
    if (nHidden && nHidden < items.length) warnings.push(`Скрыто вопросов: ${nHidden}. В файл упражнения они не попадут.`);
    items.forEach((it, n) => {
      if (it.hidden) return;
      const who = `Вопрос ${n + 1}`;
      if (!clean(it.text)) errors.push(`${who}: нет текста вопроса.`);
      if (it.options.length < 2) errors.push(`${who}: нужно минимум два варианта.`);
      it.options.forEach((o, k) => { if (!hasOptContent(o)) errors.push(`${who}, вариант ${k + 1}: пустой (нет ни текста, ни картинки). Заполните его или уберите.`); });
      const badLink = (im, what) => { if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) errors.push(`${what}: ссылка на картинку должна быть полным адресом с https://.`); };
      badLink(it.image, `${who}, картинка вопроса`);
      it.options.forEach((o, k) => badLink(o.image, `${who}, вариант ${k + 1}`));
      const have = it.correct.filter(id => it.options.some(o => o.id === id));
      if (!have.length) errors.push(`${who}: не отмечен верный вариант.`);
      else if (modeOf(it) === 'single' && have.length > 1) errors.push(`${who}: в Single Choice нужен один верный вариант, а отмечено ${have.length}. Выберите один или переключите вопрос на Multiple Select.`);
      const texts = it.options.filter(o => !hasPic(o.image)).map(o => clean(o.text).toLowerCase()).filter(Boolean);
      if (new Set(texts).size < texts.length) warnings.push(`${who}: есть одинаковые варианты.`);
      if (modeOf(it) === 'multiple' && have.length === 1) warnings.push(`${who}: в Multiple Select отмечен один верный вариант; ученик не узнает, что их может быть несколько, если не включить подсказку «Выберите N».`);
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика. Недостающее заполняется
  function load(file) {
    if (!Array.isArray(file.items)) throw new Error('В файле нет вопросов.');
    const general = file.mode === 'multiple' ? 'multiple' : 'single';
    const items = file.items.map((i, k) => {
      const imageIn = im => ({ media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') });
      const audioIn = a => (a && safeMediaPath(a.media)) || '';
      const options = (Array.isArray(i.options) ? i.options : []).map((o, n) => ({ id: String((o && o.id) || 'o' + (n + 1)), text: String((o && o.text) || ''), image: imageIn(o && o.image), audio: audioIn(o && o.audio) }));
      const mode = i.mode === 'multiple' ? 'multiple' : 'single';
      return {
        image: { ...imageIn(i.image), align: i.image && ALIGNS[i.image.align] ? i.image.align : 'top' }, audio: audioIn(i.audio),
        id: String(i.id || 'q' + (k + 1)), text: String(i.text || ''),
        mode: mode === general ? '' : mode,
        options: options.length ? options : newOptions(DEFAULT_OPT),
        correct: (Array.isArray(i.correct) ? i.correct : []).map(String).filter(id => options.some(o => o.id === id)),
      };
    });
    return {
      ...create(), mode: general, view: file.view === 'list' ? 'list' : 'one', labels: file.labels === 'numbers' || file.labels === 'none' ? file.labels : 'letters',
      shuffle: file.shuffle !== false, showCount: file.showCount === true, showCorrect: file.showCorrect === true,
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain',
      items: items.length ? items : create().items,
    };
  }

  // Настройки модуля во вкладке «Дизайн»: показ вопросов и вид меток (рисует ядро, поля лежат в черновике)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'view', label: 'Показ вопросов', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
        icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } },
      { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ]; // метки вариантов переключаются в самом «Содержимом», над вариантами
  }

  // Настройки модуля во вкладке «Поведение»: переключатели «Вкл / Выкл»
  function behaviorOptions(draft) {
    return [
      { field: 'shuffle', label: 'Перемешивать варианты', value: draft.shuffle !== false,
        help: 'Порядок вариантов выбирается один раз при открытии упражнения и не меняется до обновления страницы; «Начать заново» его не перемешивает. Метки A, B, C идут по текущему порядку, верность — по самому варианту. По умолчанию включено.' },
      { field: 'showCount', label: 'Подсказка «Выберите N правильных ответов»', value: !!draft.showCount,
        help: 'У вопросов Multiple Select ученик видит, сколько вариантов нужно выбрать. Это не подсказка из общего хода и баллы не меняет. По умолчанию выключено.' },
      { field: 'showCorrect', label: 'Показать верные ответы в конце', value: !!draft.showCorrect,
        help: 'После завершения у ученика появится переключатель: в неверно отвеченных вопросах отметятся верные варианты. Баллы и проверки не меняются. По умолчанию выключено.' },
    ];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions, behaviorOptions };
})();
