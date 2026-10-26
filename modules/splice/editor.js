// Редактор модуля Splice: слова, которые ученик собирает из частей (слогов, морфем, кусочков слова).
// Преподаватель пишет слово, разделяя части косой чертой («mo/dern/ize») или нажимает «Авто 2 / 3 / 4».
// Два режима на всё упражнение: «Одно слово» (по одному слову или списком) и «Мозаика» (все слова сразу, общий банк частей);
// у мозаики три уровня: Easy / Medium / Hard. У слова устойчивый ID (t1, t2…). Ядро (editor.html) передаёт сюда черновик и функцию сохранения.
const SpliceEditor = (() => {
  const MAX_TASKS = 10, MIN_PIECES = 2, MAX_PIECES = 8, MAX_TOTAL = 40, MAX_LEN = 60; // слов, частей в слове, частей в мозаике, символов
  const T = SpliceTokens;
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  const MODES = { single: 'Одно слово', mosaic: 'Мозаика' };
  const LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const LEVEL_HELP = {
    easy: 'Названия слов и число частей видны; каждое слово нужно собрать в своём окошке.',
    medium: 'Названий нет, число частей в окошках видно; слово можно собрать в любом подходящем по числу частей окошке.',
    hard: 'Ни названий, ни числа частей; слова можно собирать в любом окошке, но в каждом не меньше двух частей.',
  };
  const VIEWS = { one: 'По одному слову', list: 'Все слова сразу' };
  const STYLES = { tiles: 'Плитки', paper: 'Бумажные кусочки' };

  const newTask = id => ({ id, answer: '', label: '', hint: '', explanation: '' });
  function create() {
    return { module: 'splice', format: 1, mode: 'single', level: 'medium', view: 'one', tokenStyle: 'tiles', showAnswers: true, tasks: [newTask('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): мозаика Medium с названиями для Easy, подсказками и пояснениями
  function demo() {
    const t = (id, answer, extra) => ({ ...newTask(id), answer, ...(extra || {}) });
    return { ...create(), mode: 'mosaic', level: 'medium', instruction: DimDemo.instruction('Соберите слова из частей: части всех слов лежат вместе.'), tasks: [
      t('t1', 'mo/dern/ize', { label: 'сделать современным', explanation: 'modern + -ize: суффикс -ize делает глагол.' }),
      t('t2', 'un/happi/ness', { label: 'грусть', explanation: 'un- (приставка) + happy + -ness (суффикс).' }),
      t('t3', 'tele/phone', { label: 'аппарат для разговора на расстоянии' }),
    ] };
  }

  function normalize() {
    if (!MODES[d.mode]) d.mode = 'single';
    if (!LEVELS[d.level]) d.level = 'medium';
    if (!VIEWS[d.view]) d.view = 'one';
    if (!STYLES[d.tokenStyle]) d.tokenStyle = 'tiles';
    if (typeof d.showAnswers !== 'boolean') d.showAnswers = true;
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

  // Кнопки выбора в ряд (режим, уровень): активная подсвечена
  function seg(names, value, label, set) {
    const g = el('div', 'sp-modes');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    Object.entries(names).forEach(([k, name]) => {
      const b = el('button', 'sp-mode' + (value === k ? ' on' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(value === k));
      b.onclick = () => { set(k); save(); draw(); };
      g.append(b);
    });
    return g;
  }

  function draw() {
    root.innerHTML = '';
    root.className = 'sp-wrap';
    const mosaic = d.mode === 'mosaic';
    const tools = el('div', 'sp-tools');
    counter = el('span', 'sp-muted');
    const right = el('span', 'sp-right');
    right.append(help(`Напишите слово, разделяя части косой чертой: «mo/dern/ize». Кнопки «Авто» расставляют черты примерно поровну — это не слоговое деление, поправьте его вручную. «Одно слово» — ученик собирает слова по очереди (можно показывать списком). «Мозаика» — части всех слов лежат в общем банке, ученик собирает все слова сразу: Easy — названия слов и число частей видны, каждое слово в своём окошке; Medium — названий нет, число частей видно, слово можно собрать в любом окошке с таким числом частей; Hard — ни названий, ни числа частей, в каждом окошке не меньше двух частей. Проверка одна на всё упражнение, балл — за каждое верно собранное слово. Слов до ${MAX_TASKS}, частей в слове от ${MIN_PIECES} до ${MAX_PIECES}.`));
    tools.append(seg(MODES, d.mode, 'Режим упражнения', v => { d.mode = v; }));
    if (mosaic) tools.append(seg(LEVELS, d.level, 'Уровень мозаики', v => { d.level = v; }));
    tools.append(counter, right);
    msg = el('div', 'sp-msg');
    msg.hidden = true;
    listBox = el('div', 'sp-tasks');
    addBtn = el('button', 'sp-add', '+ Слово');
    addBtn.type = 'button';
    addBtn.onclick = addTask;
    root.append(tools);
    if (mosaic) root.append(el('p', 'sp-muted sp-lvl', LEVEL_HELP[d.level] + ' Нужно хотя бы 2 слова.'));
    root.append(msg, listBox, addBtn);
    drawList();
  }

  function drawList() {
    listBox.innerHTML = '';
    d.tasks.forEach((t, k) => listBox.append(card(t, k)));
    counter.textContent = `Слов: ${d.tasks.length}/${MAX_TASKS}`;
    addBtn.disabled = d.tasks.length >= MAX_TASKS;
  }

  const newTaskId = () => nextId('t', d.tasks.map(t => t.id));

  // Части, которые получит ученик (в правильном порядке), и замечание, если слово пока не годится
  function preview(t, box) {
    box.innerHTML = '';
    const pieces = T.split(t.answer);
    if (!pieces.length) { box.append(el('span', 'sp-muted', 'Части появятся здесь.')); return; }
    pieces.forEach(p => box.append(el('span', 'sp-chip', p)));
    const problem = taskProblem(t);
    if (problem) box.append(el('span', 'sp-warn', problem));
  }

  function card(t, k) {
    const many = d.tasks.length > 1;
    const mosaic = d.mode === 'mosaic';
    const box = el('section', 'sp-task' + (many ? ' multi' : ''));
    box.dataset.id = t.id;
    if (many) box.append(head(t, k));
    const prev = el('div', 'sp-prev');
    const ans = el('input', 'sp-in sp-answer');
    ans.type = 'text';
    ans.maxLength = MAX_LEN;
    ans.placeholder = 'Слово с чертами, например: mo/dern/ize';
    ans.value = t.answer;
    ans.setAttribute('aria-label', `Слово, задание ${k + 1}`);
    ans.oninput = () => { t.answer = ans.value; save(); preview(t, prev); };
    preview(t, prev);
    // «Авто»: расставить черты примерно поровну; «Склеить» убирает черты
    const auto = el('div', 'sp-auto');
    auto.append(el('span', 'sp-muted', 'Авто:'));
    [2, 3, 4].forEach(n => {
      const b = el('button', 'sp-autob', String(n));
      b.type = 'button';
      b.title = `Поделить на ${n} части примерно поровну`;
      b.setAttribute('aria-label', `Поделить на ${n}, задание ${k + 1}`);
      b.onclick = () => {
        if (!T.text(t.answer)) return say('Сначала напишите слово.');
        t.answer = T.auto(t.answer, n);
        ans.value = t.answer;
        save();
        preview(t, prev);
      };
      auto.append(b);
    });
    const join = el('button', 'sp-autob', 'Склеить');
    join.type = 'button';
    join.onclick = () => { t.answer = T.text(t.answer); ans.value = t.answer; save(); preview(t, prev); };
    auto.append(join);
    // Необязательное поле с подписью слева
    const field = (cls, val, ph, label, set) => {
      const row = el('label', 'sp-field');
      const i = el('input', 'sp-in ' + cls);
      i.type = 'text';
      i.maxLength = 300;
      i.placeholder = ph;
      i.value = val;
      i.setAttribute('aria-label', `${label}, задание ${k + 1}`);
      i.oninput = () => { set(i.value); save(); };
      row.append(el('span', 'sp-flabel', label), i);
      return row;
    };
    box.append(ans, auto, prev);
    if (mosaic) box.append(field('sp-labelin', t.label, 'Видно на уровне Easy, например: сделать современным', 'Название', v => { t.label = v; }));
    else box.append(field('sp-hintin', t.hint, 'Необязательно: ученик откроет её сам', 'Подсказка', v => { t.hint = v; }));
    box.append(field('sp-expl', t.explanation, 'Необязательно: ученик увидит его после проверки', 'Пояснение', v => { t.explanation = v; }));
    return box;
  }

  function head(t, k) {
    const top = el('div', 'sp-tasktop');
    top.append(el('b', '', `Слово ${k + 1}`));
    const tools = el('span', 'sp-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'sp-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', слово ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Слово выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Слово ниже', () => move(k, 1), k === d.tasks.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать слово', () => duplicate(k), d.tasks.length >= MAX_TASKS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'sp-ask');
      const yes = el('button', 'sp-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить слово', () => { if ([t.answer, t.label, t.hint, t.explanation].some(clean)) { delAsk = t.id; drawList(); } else remove(k); }));
    top.append(tools);
    return top;
  }

  function addTask() {
    if (d.tasks.length >= MAX_TASKS) return say(`Слов не больше ${MAX_TASKS}.`);
    d.tasks.push(newTask(newTaskId()));
    save();
    drawList();
    const box = listBox.lastElementChild;
    if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); const a = box.querySelector('.sp-answer'); if (a) a.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.tasks.length) return;
    [d.tasks[k], d.tasks[j]] = [d.tasks[j], d.tasks[k]];
    save();
    drawList();
  }
  // Копия получает новый ID; правки копии не меняют оригинал
  function duplicate(k) {
    if (d.tasks.length >= MAX_TASKS) return say(`Слов не больше ${MAX_TASKS}.`);
    d.tasks.splice(k + 1, 0, { ...d.tasks[k], id: newTaskId() });
    save();
    drawList();
  }
  function remove(k) {
    d.tasks.splice(k, 1);
    delAsk = null;
    if (!d.tasks.length) d.tasks.push(newTask('t1'));
    save();
    drawList();
  }

  // ---- Проверка слова ----
  // Почему слово нельзя опубликовать (пусто — значит можно)
  function taskProblem(t) {
    const a = clean(t.answer);
    if (!a.replace(/\//g, '').trim()) return 'Нет слова.';
    if (/\s/.test(a.replace(/\s*\/\s*/g, ''))) return 'В слове не должно быть пробелов: части пишутся слитно, их разделяет «/».';
    const p = T.split(t.answer);
    if (p.length < MIN_PIECES) return 'Поделите слово на части: поставьте «/» или нажмите «Авто».';
    if (p.length > MAX_PIECES) return `Частей ${p.length}, а можно не больше ${MAX_PIECES}.`;
    if (p.every(x => T.same(x, p[0]))) return 'Все части одинаковые: их нельзя перемешать.';
    return '';
  }

  // ---- Файл упражнения ----
  // Порядок слов — порядок показа. view пишется только у «Одного слова» при «Все сразу», level — только у мозаики при не-Medium,
  // tokenStyle — только при «Бумажных кусочках», showAnswers — только при выключенном. label — только у мозаики, hint — только у одного слова;
  // explanation — если есть. Части в файл не пишутся отдельно: они в answer, между чертами
  function exportData(draft) {
    const mosaic = draft.mode === 'mosaic';
    return {
      module: 'splice', format: 1,
      ...(mosaic ? { mode: 'mosaic', ...(draft.level !== 'medium' ? { level: draft.level } : {}) } : (draft.view === 'list' ? { view: 'list' } : {})),
      ...(draft.tokenStyle === 'paper' ? { tokenStyle: 'paper' } : {}),
      ...(draft.showAnswers === false ? { showAnswers: false } : {}),
      tasks: draft.tasks.map(t => ({
        id: t.id, answer: T.split(t.answer).join('/'),
        ...(mosaic && clean(t.label) ? { label: clean(t.label) } : {}),
        ...(!mosaic && clean(t.hint) ? { hint: clean(t.hint) } : {}),
        ...(clean(t.explanation) ? { explanation: clean(t.explanation) } : {}),
      })),
    };
  }

  // Балл — за каждое верно собранное слово
  const unitCount = draft => draft.tasks.length;
  // Проверка у Splice всегда одна, итоговая (решение архива SP-01 / SP-03)
  const fixedChecks = () => 1;
  const fixedChecksNote = 'У Splice проверка всегда одна, итоговая, на всё упражнение сразу: она доступна, когда все части использованы (в мозаике — разложены по окошкам). После неё ответы не меняются. «Начать заново» перемешивает части и даёт новую проверку.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.tasks.length > 1;
    if (!draft.tasks.length) errors.push('Нет ни одного слова.');
    if (draft.tasks.length > MAX_TASKS) errors.push(`Слов больше ${MAX_TASKS}.`);
    draft.tasks.forEach((t, k) => {
      const p = taskProblem(t);
      if (p) errors.push(many ? `Слово ${k + 1}: ${p[0].toLowerCase() + p.slice(1)}` : p);
    });
    if (draft.mode === 'mosaic') {
      if (draft.tasks.length < 2) errors.push('В мозаике нужно хотя бы 2 слова.');
      const total = draft.tasks.reduce((n, t) => n + T.split(t.answer).length, 0);
      if (total > MAX_TOTAL) errors.push(`В мозаике частей ${total}, а можно не больше ${MAX_TOTAL}.`);
      if (draft.level === 'easy' && draft.tasks.some(t => !clean(t.label))) warnings.push('На уровне Easy у слов без названия ученик увидит «Слово 1», «Слово 2»…');
    }
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.tasks) || !file.tasks.length) throw new Error('В файле нет слов.');
    const ids = new Set();
    const tasks = file.tasks.slice(0, MAX_TASKS).map(t => {
      let id = String((t && t.id) || '');
      if (!id || ids.has(id)) id = nextId('t', [...ids]);
      ids.add(id);
      return { id, answer: String((t && t.answer) || ''), label: String((t && t.label) || ''), hint: String((t && t.hint) || ''), explanation: String((t && t.explanation) || '') };
    });
    return { ...create(), mode: file.mode === 'mosaic' ? 'mosaic' : 'single', level: LEVELS[file.level] ? file.level : 'medium', view: file.view === 'list' ? 'list' : 'one',
      tokenStyle: file.tokenStyle === 'paper' ? 'paper' : 'tiles', showAnswers: file.showAnswers !== false, tasks };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): вид частей; показ слов — только у «Одного слова»
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const view = draft.mode === 'mosaic' ? [] : [{ field: 'view', label: 'Показ слов', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
      icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } }];
    return [...view,
      { field: 'tokenStyle', label: 'Вид частей', value: STYLES[draft.tokenStyle] ? draft.tokenStyle : 'tiles', names: STYLES,
        icons: { tiles: sq('<rect x="3" y="8" width="8" height="8" rx="1.5"/><rect x="13" y="8" width="8" height="8" rx="1.5"/>'), paper: sq('<path d="M3 8l2-1 3 1 3-1 2 1v8l-2 1-3-1-3 1-2-1z"/><path d="M14 7l3 1 3-1v9l-3 1-3-1z"/>') } },
    ];
  }
  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers !== false,
      help: 'После проверки показываются правильные слова, разделённые на части. Верные слова зелёные, неверные — красные в любом случае; пояснение показывается всегда. По умолчанию включено.' }];
  }

  return { create, demo, render, load, exportData, validate, unitCount, fixedChecks, fixedChecksNote, designOptions, behaviorOptions };
})();
