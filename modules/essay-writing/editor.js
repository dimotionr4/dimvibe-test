// Редактор модуля Essay Writing (написание эссе / развёрнутого ответа): задания, в каждом — условия, которые можно посчитать
// (слова, абзацы, обязательные и запрещённые слова и фразы), образец ответа и список «проверь себя».
// Решения владельца 2026-10-25 («все рекомендации», пункты 1А 2А 3А 4А 5А 6Б 7А 8А); этап 1 — текст, этап 2 — картинка и звук задания.
// Качество текста программа не оценивает: ученик видит только, какие условия выполнены. Баллов нет, проверок нет, сервера нет.
// У задания и каждого условия устойчивый ID (t1, r1, b1, c1…). Ядро (editor.html) передаёт сюда черновик и функцию сохранения.
const EssayWritingEditor = (() => {
  const MAX_TASKS = 5, MAX_TERMS = 10, MAX_BANNED = 10, MAX_CHECK = 8; // заданий, обязательных слов, запрещённых слов, пунктов «проверь себя»
  const TOPIC_LEN = 100, PROMPT_LEN = 1500, TERM_LEN = 60, FORMS_LEN = 200, SAMPLE_LEN = 5000, CHECK_LEN = 150, WORDS_CAP = 5000, PARAS_CAP = 30, TIMES_CAP = 20;
  const { nextId } = GapEngine;
  const T = EssayText;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="ew-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const level = v => (v === 'advisory' ? 'advisory' : 'required');
  const LEVELS = { required: 'Обязательно', advisory: 'Совет' };
  const VIEWS = { one: 'По одному заданию', list: 'Все задания сразу' };
  const intStr = (v, cap) => { const n = T.num(v); return n == null ? '' : String(Math.min(n, cap)); };

  const allIds = pre => d.tasks.flatMap(t => [t.id, ...t.terms.map(x => x.id), ...t.banned.map(x => x.id), ...t.checklist.map(x => x.id)]).filter(id => id.startsWith(pre));
  const newRange = () => ({ min: '', max: '', level: 'required' });
  const newTask = id => ({ id, topic: '', prompt: '', words: newRange(), paras: newRange(), terms: [], banned: [], sample: '', checklist: [] });
  function create() {
    return { module: 'essay_writing', format: 1, view: 'one', tasks: [newTask('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): два задания — с числом слов и абзацев, обязательными словами и фразой с формами,
  // запрещённым словом, образцом ответа и списком «проверь себя»; второе — письмо с «советами»
  function demo() {
    const term = (id, text, forms, min, lvl) => ({ id, text, forms, min, level: lvl || 'required' });
    const t1 = { ...newTask('t1'), topic: 'My weekend', prompt: 'Write about your last weekend: where you were, what you did and how you felt. Explain why you liked it (or did not).',
      words: { min: '50', max: '120', level: 'required' }, paras: { min: '2', max: '4', level: 'advisory' },
      terms: [term('r1', 'because', '', 2), term('r2', 'go', 'goes, going, went, gone', 1), term('r3', 'in the morning', '', 1, 'advisory')],
      banned: [{ id: 'b1', text: 'very', forms: '', level: 'advisory' }],
      sample: 'Last weekend I went to my grandmother\'s house in the village.\n\nIn the morning we walked to the river because the weather was lovely. I liked it a lot because I could rest and talk to my family. In the evening we cooked dinner together.\n\nIt was a wonderful weekend.',
      checklist: [{ id: 'c1', text: 'Я рассказал, где был и что делал' }, { id: 'c2', text: 'Я объяснил, почему мне понравилось' }, { id: 'c3', text: 'Я проверил орфографию и заглавные буквы' }] };
    const t2 = { ...newTask('t2'), topic: 'A letter to a friend', prompt: 'Write a short letter to a friend. Invite them to visit you and tell them what you can do together.',
      words: { min: '40', max: '', level: 'advisory' }, paras: newRange(),
      terms: [term('r4', 'Dear', '', 1), term('r5', 'I look forward to', '', 1)],
      banned: [], sample: 'Dear Anna,\n\nCome and visit me in July! We can swim in the lake and ride bikes. I look forward to seeing you.\n\nYour friend, Maria',
      checklist: [{ id: 'c4', text: 'Есть обращение и подпись' }] };
    return { ...create(), instruction: DimDemo.instruction('Прочитайте задание и напишите свой текст. Справа от текста видно, какие условия уже выполнены.'), tasks: [t1, t2] };
  }

  // Черновики с недостающими полями получают значения по умолчанию
  function normalize() {
    if (!VIEWS[d.view]) d.view = 'one';
    d.tasks.forEach(t => {
      ['words', 'paras'].forEach(k => { if (!t[k]) t[k] = newRange(); });
      ['terms', 'banned', 'checklist'].forEach(k => { if (!Array.isArray(t[k])) t[k] = []; });
      ['topic', 'prompt', 'sample'].forEach(k => { if (typeof t[k] !== 'string') t[k] = ''; });
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
    root.className = 'ew-wrap';
    const tools = el('div', 'ew-tools');
    counter = el('span', 'ew-muted');
    const right = el('span', 'ew-right');
    right.append(help(`Напишите задание для ученика. Ученик пишет свой текст, а рядом видит, какие условия выполнены: сколько слов и абзацев, использованы ли нужные слова и фразы, нет ли запрещённых. Качество текста программа не оценивает, баллов и проверок в этом модуле нет. Условие можно сделать «Обязательным» или «Советом»: ученик увидит их отдельно. Абзац — это блок текста, отделённый от другого пустой строкой. Слово или фразу программа ищет по целым словам и не угадывает формы: если нужны «go», «went» и «going», перечислите их в поле «Формы». Образец ответа и список «проверь себя» необязательны: ученик откроет образец сам, а пункты отметит галочками без баллов. Заданий до ${MAX_TASKS}. Текст ученика сохраняется только в его браузере; преподавателю он не отправляется — ученик может скопировать его кнопкой.`));
    tools.append(counter, right);
    msg = el('div', 'ew-msg');
    msg.hidden = true;
    listBox = el('div', 'ew-tasks');
    addBtn = el('button', 'ew-add', '+ Задание');
    addBtn.type = 'button';
    addBtn.onclick = addTask;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Заданий: ${d.tasks.length}/${MAX_TASKS}`;
    addBtn.disabled = d.tasks.length >= MAX_TASKS;
  }
  function drawList() {
    listBox.innerHTML = '';
    d.tasks.forEach((t, k) => listBox.append(card(t, k)));
    updateCounter();
  }
  const newTaskId = () => nextId('t', d.tasks.map(t => t.id));

  // Поле: input или textarea, которое растёт вместе с текстом
  function field(tag, cls, value, ph, max, label, onInput) {
    const e = el(tag, 'ew-in ' + cls);
    if (tag === 'input') e.type = 'text'; else e.rows = 1;
    e.maxLength = max;
    e.placeholder = ph;
    e.value = value;
    e.setAttribute('aria-label', label);
    const fit = () => { if (tag === 'textarea') { e.style.height = 'auto'; e.style.height = e.scrollHeight + 2 + 'px'; } };
    e.oninput = () => { onInput(e.value); fit(); save(); };
    if (tag === 'textarea') setTimeout(fit, 0);
    return e;
  }
  const iconBtn = (html, tip, fn, disabled, label) => { const x = el('button', 'ew-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', label || tip); x.disabled = !!disabled; x.onclick = fn; return x; };
  const X = '<path d="M6 6l12 12M18 6L6 18"/>';

  function levelSelect(obj, label) {
    const s = el('select', 'ew-lvl');
    Object.entries(LEVELS).forEach(([k, v]) => { const o = el('option', '', v); o.value = k; s.append(o); });
    s.value = level(obj.level);
    s.setAttribute('aria-label', label);
    s.onchange = () => { obj.level = s.value; save(); };
    return s;
  }
  function numField(obj, key, ph, cap, label) {
    const n = el('input', 'ew-in ew-num');
    n.type = 'number';
    n.min = '0';
    n.max = String(cap);
    n.step = '1';
    n.placeholder = ph;
    n.value = obj[key] === '' ? '' : String(obj[key]);
    n.setAttribute('aria-label', label);
    n.oninput = () => { obj[key] = n.value === '' ? '' : n.value; save(); };
    n.onchange = () => { obj[key] = intStr(n.value, cap); n.value = obj[key]; save(); };
    return n;
  }

  function card(t, k) {
    const box = el('section', 'ew-task');
    box.dataset.id = t.id;
    box.append(head(t, k));
    box.append(
      field('input', 'ew-topic', t.topic, 'Тема (необязательно), например «My weekend»', TOPIC_LEN, `Тема задания ${k + 1}`, v => { t.topic = v; }),
      field('textarea', 'ew-prompt', t.prompt, 'Задание для ученика: что нужно написать', PROMPT_LEN, `Задание ${k + 1}`, v => { t.prompt = v; }),
    );

    // Условия: слова и абзацы — «от» и «до»; слова и фразы — списками
    const cond = el('details', 'ew-sec');
    cond.open = true;
    cond.append(el('summary', '', 'Условия (необязательно)'));
    const rangeRow = (obj, name, cap) => {
      const r = el('div', 'ew-rrow');
      r.append(el('span', 'ew-rname', name), numField(obj, 'min', 'от', cap, `${name}: от`), el('span', 'ew-muted', '—'), numField(obj, 'max', 'до', cap, `${name}: до`), levelSelect(obj, `${name}: важность`));
      return r;
    };
    cond.append(rangeRow(t.words, 'Слов', WORDS_CAP), rangeRow(t.paras, 'Абзацев', PARAS_CAP));
    cond.append(termsBlock(t, 'terms', 'Нужно использовать', '+ Слово или фраза', MAX_TERMS, true), termsBlock(t, 'banned', 'Нельзя использовать', '+ Запрещённое', MAX_BANNED, false));

    const extra = el('details', 'ew-sec');
    extra.open = !!(t.sample || t.checklist.length);
    extra.append(el('summary', '', 'Образец и «проверь себя» (необязательно)'));
    extra.append(
      el('p', 'ew-muted ew-hint', 'Образец ответа ученик откроет сам, кнопкой.'),
      field('textarea', 'ew-sample', t.sample, 'Образец ответа', SAMPLE_LEN, `Образец ответа к заданию ${k + 1}`, v => { t.sample = v; }),
      checkBlock(t),
    );
    box.append(cond, extra);
    return box;
  }

  // Список слов и фраз: обязательные (с числом употреблений) или запрещённые
  function termsBlock(t, key, title, addLabel, cap, withMin) {
    const wrap = el('div', 'ew-terms');
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(el('p', 'ew-sub', title));
      t[key].forEach((it, j) => {
        const r = el('div', 'ew-trow');
        r.append(
          field('input', 'ew-term', it.text, 'Слово или фраза', TERM_LEN, `${title}: слово ${j + 1}`, v => { it.text = v; }),
          field('input', 'ew-forms', it.forms, 'Формы через запятую (необязательно)', FORMS_LEN, `${title}: формы слова ${j + 1}`, v => { it.forms = v; }),
        );
        const line = el('span', 'ew-tline');
        if (withMin) {
          line.append(el('span', 'ew-muted', 'раз:'));
          const n = numField(it, 'min', '1', TIMES_CAP, `${title}: сколько раз, слово ${j + 1}`);
          n.min = '1';
          line.append(n);
        }
        line.append(levelSelect(it, `${title}: важность, слово ${j + 1}`), iconBtn(svg(X), 'Удалить', () => { t[key].splice(j, 1); save(); draw(); }, false, `Удалить: ${title}, слово ${j + 1}`));
        line.lastChild.classList.add('ew-del');
        r.append(line);
        wrap.append(r);
      });
      const add = el('button', 'ew-add ew-additem', addLabel);
      add.type = 'button';
      add.disabled = t[key].length >= cap;
      add.onclick = () => {
        if (t[key].length >= cap) return say(`Не больше ${cap}.`);
        const pre = key === 'terms' ? 'r' : 'b';
        t[key].push(withMin ? { id: nextId(pre, allIds(pre)), text: '', forms: '', min: 1, level: 'required' } : { id: nextId(pre, allIds(pre)), text: '', forms: '', level: 'required' });
        save();
        draw();
        const ins = wrap.querySelectorAll('.ew-term');
        if (ins.length) ins[ins.length - 1].focus();
      };
      wrap.append(add);
    };
    draw();
    return wrap;
  }

  function checkBlock(t) {
    const wrap = el('div', 'ew-checks');
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(el('p', 'ew-sub', 'Список «проверь себя»'));
      t.checklist.forEach((c, j) => {
        const r = el('div', 'ew-crow');
        r.append(field('input', 'ew-citem', c.text, 'Например: «Я объяснил, почему…»', CHECK_LEN, `Пункт ${j + 1}`, v => { c.text = v; }), iconBtn(svg(X), 'Удалить', () => { t.checklist.splice(j, 1); save(); draw(); }, false, `Удалить пункт ${j + 1}`));
        r.lastChild.classList.add('ew-del');
        wrap.append(r);
      });
      const add = el('button', 'ew-add ew-additem', '+ Пункт');
      add.type = 'button';
      add.disabled = t.checklist.length >= MAX_CHECK;
      add.onclick = () => {
        t.checklist.push({ id: nextId('c', allIds('c')), text: '' });
        save();
        draw();
        const ins = wrap.querySelectorAll('.ew-citem');
        if (ins.length) ins[ins.length - 1].focus();
      };
      wrap.append(add);
    };
    draw();
    return wrap;
  }

  function head(t, k) {
    const top = el('div', 'ew-tasktop');
    top.append(el('b', '', `Задание ${k + 1}`));
    const tools = el('span', 'ew-tools2');
    const b = (html, tip, fn, disabled) => iconBtn(html, tip, fn, disabled, `${tip}, задание ${k + 1}`);
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Задание выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Задание ниже', () => move(k, 1), k === d.tasks.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать задание', () => duplicate(k), d.tasks.length >= MAX_TASKS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'ew-ask');
      const yes = el('button', 'ew-yes', 'Удалить задание');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const x = b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить задание', () => {
        if (clean(t.prompt) || clean(t.topic) || t.terms.length || t.banned.length || t.sample.trim() || t.checklist.length) { delAsk = t.id; drawList(); } else remove(k);
      });
      x.classList.add('ew-del');
      tools.append(x);
    }
    top.append(tools);
    return top;
  }

  function addTask() {
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    d.tasks.push(newTask(newTaskId()));
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = last.querySelector('.ew-prompt'); if (inp) inp.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.tasks.length) return;
    [d.tasks[k], d.tasks[j]] = [d.tasks[j], d.tasks[k]];
    save();
    drawList();
  }
  // Копия получает новые ID задания и всех его условий и пунктов
  function duplicate(k) {
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    const copy = JSON.parse(JSON.stringify(d.tasks[k]));
    copy.id = newTaskId();
    d.tasks.splice(k + 1, 0, copy); // копия уже в списке, чтобы новые ID не повторяли друг друга
    [['terms', 'r'], ['banned', 'b'], ['checklist', 'c']].forEach(([key, pre]) => copy[key].forEach(x => { x.id = ''; x.id = nextId(pre, allIds(pre)); }));
    save();
    drawList();
  }
  function remove(k) {
    d.tasks.splice(k, 1);
    delAsk = null;
    if (!d.tasks.length) d.tasks.push(newTask(newTaskId()));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // Условия без значений и пустые строки в файл не попадают. view — только при «list»; level — только «advisory»;
  // forms — только если есть; min у слова — только если больше 1
  const rangeOut = r => {
    const min = T.num(r && r.min), max = T.num(r && r.max);
    if (min == null && max == null) return null;
    return { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), ...(level(r.level) === 'advisory' ? { level: 'advisory' } : {}) };
  };
  const formsOut = s => [...new Set(T.list(s).map(clean))];
  const termOut = (x, withMin) => {
    const text = clean(x.text);
    if (!text) return null;
    const forms = formsOut(x.forms), min = Math.max(1, T.num(x.min) || 1);
    return { id: x.id, text, ...(forms.length ? { forms } : {}), ...(withMin && min > 1 ? { min } : {}), ...(level(x.level) === 'advisory' ? { level: 'advisory' } : {}) };
  };

  function exportData(draft) {
    return {
      module: 'essay_writing', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      tasks: draft.tasks.map(t => ({
        id: t.id,
        ...(clean(t.topic) ? { topic: clean(t.topic) } : {}),
        prompt: t.prompt.trim(),
        ...(rangeOut(t.words) ? { words: rangeOut(t.words) } : {}),
        ...(rangeOut(t.paras) ? { paras: rangeOut(t.paras) } : {}),
        ...(t.terms.map(x => termOut(x, true)).filter(Boolean).length ? { terms: t.terms.map(x => termOut(x, true)).filter(Boolean) } : {}),
        ...(t.banned.map(x => termOut(x, false)).filter(Boolean).length ? { banned: t.banned.map(x => termOut(x, false)).filter(Boolean) } : {}),
        ...(t.sample.trim() ? { sample: t.sample.trim() } : {}),
        ...(t.checklist.filter(c => clean(c.text)).length ? { checklist: t.checklist.filter(c => clean(c.text)).map(c => ({ id: c.id, text: clean(c.text) })) } : {}),
      })),
    };
  }

  // Условий нет, баллов нет
  const unitCount = draft => draft.tasks.length;
  const noChecks = true;
  const noChecksNote = 'В Essay Writing нет проверок и баллов: ученик пишет текст и сам видит, какие условия выполнены. Качество текста программа не оценивает.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.tasks.length > 1;
    if (!draft.tasks.length) errors.push('Нет ни одного задания.');
    if (draft.tasks.length > MAX_TASKS) errors.push(`Заданий больше ${MAX_TASKS}.`);
    draft.tasks.forEach((t, k) => {
      const pre = many ? `Задание ${k + 1}: ` : '';
      if (!clean(t.prompt)) errors.push(`${pre}не написано задание для ученика.`);
      const w = [T.num(t.words.min), T.num(t.words.max)], p = [T.num(t.paras.min), T.num(t.paras.max)];
      if (w[0] != null && w[1] != null && w[0] > w[1]) errors.push(`${pre}слов «от» больше, чем «до».`);
      if (p[0] != null && p[1] != null && p[0] > p[1]) errors.push(`${pre}абзацев «от» больше, чем «до».`);
      if (w[1] === 0) errors.push(`${pre}максимум слов должен быть больше нуля.`);
      if (p[1] === 0) errors.push(`${pre}максимум абзацев должен быть больше нуля.`);
      if (p[0] != null && w[1] != null && p[0] > w[1]) errors.push(`${pre}абзацев не меньше ${p[0]}, а слов не больше ${w[1]}: так не получится.`);
      const terms = t.terms.filter(x => clean(x.text)), banned = t.banned.filter(x => clean(x.text));
      [...terms.map(x => ['слово или фраза', x]), ...banned.map(x => ['запрещённое', x])].forEach(([kind, x]) => {
        if (!T.variants(x.text, x.forms).length) errors.push(`${pre}«${clean(x.text)}» (${kind}): в записи нет ни одного слова.`);
      });
      // Обязательное не может требовать больше слов, чем разрешено всего
      if (w[1] != null) terms.forEach(x => {
        const v = T.variants(x.text, x.forms), shortest = v.length ? Math.min(...v.map(a => a.length)) : 0, need = Math.max(1, T.num(x.min) || 1);
        if (shortest * need > w[1]) errors.push(`${pre}«${clean(x.text)}» нужно ${need} раз, а слов в тексте не больше ${w[1]}: так не получится.`);
      });
      // Одно и то же нельзя и требовать, и запрещать (в том числе запретить слово из обязательной фразы)
      terms.forEach(a => banned.forEach(b => {
        const va = T.variants(a.text, a.forms), vb = T.variants(b.text, b.forms);
        if (va.some(x => vb.some(y => T.contains(x, y)))) errors.push(`${pre}«${clean(a.text)}» нужно использовать, а «${clean(b.text)}» запрещено: так не получится.`);
      }));
      const seen = new Set();
      [...terms, ...banned].forEach(x => {
        const k2 = T.variants(x.text, '').map(a => a.join(' ')).join('|');
        if (k2 && seen.has(k2)) warnings.push(`${pre}«${clean(x.text)}» записано дважды.`);
        seen.add(k2);
      });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию, повторяющиеся ID — новые
  function load(file) {
    if (!Array.isArray(file.tasks) || !file.tasks.length) throw new Error('В файле нет заданий.');
    const used = new Set();
    const uid = (pre, src) => { let id = String(src || ''); if (!id || used.has(id)) id = nextId(pre, [...used].filter(x => x.startsWith(pre))); used.add(id); return id; };
    const rng = (r, cap) => (r && typeof r === 'object' ? { min: intStr(r.min, cap), max: intStr(r.max, cap), level: level(r.level) } : newRange());
    const str = (v, n) => String(v == null ? '' : v).slice(0, n);
    const tasks = file.tasks.slice(0, MAX_TASKS).map(s => {
      s = s || {};
      const id = uid('t', s.id);
      return {
        id, topic: str(s.topic, TOPIC_LEN), prompt: str(s.prompt, PROMPT_LEN),
        words: rng(s.words, WORDS_CAP), paras: rng(s.paras, PARAS_CAP),
        terms: (Array.isArray(s.terms) ? s.terms : []).slice(0, MAX_TERMS).map(x => ({ id: uid('r', x && x.id), text: str(x && x.text, TERM_LEN), forms: str(T.list(x && x.forms).join(', '), FORMS_LEN), min: Math.max(1, Math.min(TIMES_CAP, T.num(x && x.min) || 1)), level: level(x && x.level) })),
        banned: (Array.isArray(s.banned) ? s.banned : []).slice(0, MAX_BANNED).map(x => ({ id: uid('b', x && x.id), text: str(x && x.text, TERM_LEN), forms: str(T.list(x && x.forms).join(', '), FORMS_LEN), level: level(x && x.level) })),
        sample: str(s.sample, SAMPLE_LEN),
        checklist: (Array.isArray(s.checklist) ? s.checklist : []).slice(0, MAX_CHECK).map(x => ({ id: uid('c', x && x.id), text: str(x && x.text, CHECK_LEN) })),
      };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', tasks };
  }

  // Настройка во вкладке «Дизайн» (рисует ядро): показ заданий
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'view', label: 'Показ заданий', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
        icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } },
    ];
  }
  const behaviorOptions = () => [];

  return { create, demo, render, load, exportData, validate, unitCount, noChecks, noChecksNote, designOptions, behaviorOptions };
})();
