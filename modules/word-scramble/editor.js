// Редактор модуля Word Scramble: задания «собрать слово / фразу / предложение» из перемешанных кусочков.
// Преподаватель пишет правильный ответ; кусочки получаются из него (WordScrambleTokens, tokens.js): своя нарезка — косой чертой.
// У задания устойчивый ID (t1, t2…). Ядро (editor.html) передаёт сюда черновик и функцию сохранения.
const WordScrambleEditor = (() => {
  const MAX_TASKS = 10, MIN_TOKENS = 2, MAX_TOKENS = 20, MAX_LEN = 300; // заданий, кусочков в задании, символов в ответе
  const T = WordScrambleTokens;
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="ws-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  const VIEWS = { one: 'По одному заданию', list: 'Все задания сразу' };
  const STYLES = { tiles: 'Плитки', chips: 'Чипсы' };
  const PLACEHOLDER = { word: 'Слово, например: apple', phrase: 'Фраза, например: a cup of tea', sentence: 'Предложение, например: I have been to London.' };

  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };

  const newTask = (id, mode) => ({ id, mode: mode || 'sentence', answer: '', instruction: '', hint: '', explanation: '', image: emptyImage(), audio: '' });
  function create() {
    return { module: 'word_scramble', format: 1, view: 'one', tokenStyle: 'tiles', showAnswers: true, imageSize: 'm', tasks: [newTask('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): все три вида заданий, своя нарезка, повтор букв, подсказка, пояснения,
  // картинка и звук у второго задания
  function demo() {
    const t = (id, mode, answer, extra) => ({ ...newTask(id, mode), answer, ...(extra || {}) });
    return { ...create(), instruction: DimDemo.instruction('Соберите слово, фразу или предложение из кусочков.'), tasks: [
      t('t1', 'word', 'apple', { hint: 'A red or green fruit.', explanation: 'Две буквы P можно ставить в любом порядке.' }),
      t('t2', 'phrase', 'a big old house', { instruction: 'Посмотрите на картинку и соберите фразу.', image: DimDemo.img('house'), audio: DimDemo.AUD.a }),
      t('t3', 'sentence', 'I have / been to / London.', { hint: 'Present Perfect.', explanation: 'have been — Present Perfect от be.' }),
    ] };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!VIEWS[d.view]) d.view = 'one';
    if (!STYLES[d.tokenStyle]) d.tokenStyle = 'tiles';
    if (typeof d.showAnswers !== 'boolean') d.showAnswers = true;
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    d.tasks.forEach(t => {
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
    root.className = 'ws-wrap';
    const tools = el('div', 'ws-tools');
    counter = el('span', 'ws-muted');
    const right = el('span', 'ws-right');
    right.append(help(`Выберите вид задания и напишите правильный ответ. Программа сама разрежет его на кусочки: слово — на буквы, фразу и предложение — на слова (знаки препинания остаются у слова). Свои кусочки задаются косой чертой: «I have / been to / London.» или «app / le». Под ответом видно, какие кусочки получит ученик (перемешанными). К заданию можно добавить картинку и звук (например, «послушайте и соберите предложение»). Проверка одна на всё упражнение, балл — за полностью верно собранное задание. Одинаковые кусочки взаимозаменяемы. Заданий до ${MAX_TASKS}, кусочков в задании от ${MIN_TOKENS} до ${MAX_TOKENS}.`));
    tools.append(counter, right);
    msg = el('div', 'ws-msg');
    msg.hidden = true;
    listBox = el('div', 'ws-tasks');
    addBtn = el('button', 'ws-add', '+ Задание');
    addBtn.type = 'button';
    addBtn.onclick = addTask;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function drawList() {
    listBox.innerHTML = '';
    d.tasks.forEach((t, k) => listBox.append(card(t, k)));
    counter.textContent = `Заданий: ${d.tasks.length}/${MAX_TASKS}`;
    addBtn.disabled = d.tasks.length >= MAX_TASKS;
  }

  const newTaskId = () => nextId('t', d.tasks.map(t => t.id));

  // Кусочки, которые получит ученик (в правильном порядке), и замечание, если ответ пока не годится
  function preview(t, box) {
    box.innerHTML = '';
    const pieces = T.split(t.mode, t.answer);
    if (!pieces.length) { box.append(el('span', 'ws-muted', 'Кусочки появятся здесь.')); return; }
    pieces.forEach(p => box.append(el('span', 'ws-chip', p)));
    const problem = taskProblem(t);
    if (problem) box.append(el('span', 'ws-warn', problem));
  }

  function card(t, k) {
    const many = d.tasks.length > 1;
    const box = el('section', 'ws-task' + (many ? ' multi' : ''));
    box.dataset.id = t.id;
    if (many) box.append(head(t, k));
    // Вид задания: слово / фраза / предложение
    const modes = el('div', 'ws-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Вид задания');
    const prev = el('div', 'ws-prev');
    const ans = el('input', 'ws-in ws-answer');
    Object.entries(T.MODES).forEach(([m, name]) => {
      const b = el('button', 'ws-mode' + (t.mode === m ? ' on' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(t.mode === m));
      b.onclick = () => { t.mode = m; save(); drawList(); };
      modes.append(b);
    });
    ans.type = 'text';
    ans.maxLength = MAX_LEN;
    ans.placeholder = PLACEHOLDER[t.mode];
    ans.value = t.answer;
    ans.setAttribute('aria-label', `Правильный ответ, задание ${k + 1}`);
    ans.oninput = () => { t.answer = ans.value; save(); preview(t, prev); };
    preview(t, prev);
    // Необязательное поле с подписью слева: подпись видна и тогда, когда поле заполнено
    const field = (cls, val, ph, label, set) => {
      const row = el('label', 'ws-field');
      const i = el('input', 'ws-in ' + cls);
      i.type = 'text';
      i.maxLength = 300;
      i.placeholder = ph;
      i.value = val;
      i.setAttribute('aria-label', `${label}, задание ${k + 1}`);
      i.oninput = () => { set(i.value); save(); };
      row.append(el('span', 'ws-flabel', label), i);
      return row;
    };
    // Картинка задания — большая плитка слева, справа звук перед полем ответа и подсказка о кусочках (наброски владельца 2026-10-27…28)
    const audio = MediaUI.picker('audio', () => t.audio || '', v => { t.audio = v; save(); }, 'Загрузить звук задания');
    const pic = MediaUI.imageControl(t.image, { save, after: audio, audioOutside: true, big: true });
    box.append(modes, MediaUI.side(pic, MediaUI.withAudio(audio, ans), el('p', 'ws-muted ws-hint', 'Свои кусочки — через косую черту: I have / been to / London.')), prev,
      field('ws-instr', t.instruction, 'Своя инструкция к заданию (необязательно)', 'Инструкция', v => { t.instruction = v; }),
      field('ws-hintin', t.hint, 'Необязательно: ученик откроет её сам', 'Подсказка', v => { t.hint = v; }),
      field('ws-expl', t.explanation, 'Необязательно: ученик увидит его после проверки', 'Пояснение', v => { t.explanation = v; }));
    return box;
  }

  function head(t, k) {
    const top = el('div', 'ws-tasktop');
    top.append(el('b', '', `Задание ${k + 1}`));
    const tools = el('span', 'ws-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'ws-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', задание ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Задание выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Задание ниже', () => move(k, 1), k === d.tasks.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать задание', () => duplicate(k), d.tasks.length >= MAX_TASKS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'ws-ask');
      const yes = el('button', 'ws-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить задание', () => { if ([t.answer, t.instruction, t.hint, t.explanation].some(clean) || hasPic(t.image) || t.audio) { delAsk = t.id; drawList(); } else remove(k); }));
    top.append(tools);
    return top;
  }

  function addTask() {
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    const last = d.tasks[d.tasks.length - 1];
    d.tasks.push(newTask(newTaskId(), last ? last.mode : 'sentence')); // новое задание — того же вида, что последнее
    save();
    drawList();
    const box = listBox.lastElementChild;
    if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); const a = box.querySelector('.ws-answer'); if (a) a.focus({ preventScroll: true }); }
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
    if (d.tasks.length >= MAX_TASKS) return say(`Заданий не больше ${MAX_TASKS}.`);
    d.tasks.splice(k + 1, 0, { ...JSON.parse(JSON.stringify(d.tasks[k])), id: newTaskId() }); // глубокая копия: картинка копии — свой объект
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

  // ---- Проверка задания ----
  // Почему ответ нельзя опубликовать (пусто — значит можно)
  function taskProblem(t) {
    const a = clean(t.answer);
    if (!a) return 'Нет правильного ответа.';
    if (t.mode === 'word' && /\s/.test(a.replace(/\s*\/\s*/g, ''))) return 'В слове не должно быть пробелов. Для нескольких слов выберите «Фраза».';
    const p = T.split(t.mode, t.answer);
    if (p.length < MIN_TOKENS) return `Нужно хотя бы ${MIN_TOKENS} кусочка.`;
    if (p.length > MAX_TOKENS) return `Кусочков ${p.length}, а можно не больше ${MAX_TOKENS}.`;
    if (p.every(x => x === p[0])) return 'Все кусочки одинаковые: их нельзя перемешать.';
    const im = t.image;
    if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) return 'Ссылка на картинку должна быть полным адресом с https://.';
    return '';
  }

  // ---- Файл упражнения ----
  // Порядок заданий — порядок показа. view пишется только при «Все сразу», tokenStyle — только при «Чипсы», showAnswers — только при выключенном;
  // instruction, hint, explanation, image, audio — только если есть; imageSize — только если в упражнении есть картинка.
  // Кусочки в файл не пишутся: их режет плеер из answer тем же правилом
  function exportData(draft) {
    return {
      module: 'word_scramble', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      ...(draft.tokenStyle === 'chips' ? { tokenStyle: 'chips' } : {}),
      ...(draft.showAnswers === false ? { showAnswers: false } : {}),
      ...(draft.tasks.some(t => imageOut(t.image)) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm' } : {}),
      tasks: draft.tasks.map(t => ({
        id: t.id, mode: T.MODES[t.mode] ? t.mode : 'sentence', answer: clean(t.answer),
        ...(imageOut(t.image) ? { image: imageOut(t.image) } : {}),
        ...(audioOut(t.audio) ? { audio: audioOut(t.audio) } : {}),
        ...(clean(t.instruction) ? { instruction: clean(t.instruction) } : {}),
        ...(clean(t.hint) ? { hint: clean(t.hint) } : {}),
        ...(clean(t.explanation) ? { explanation: clean(t.explanation) } : {}),
      })),
    };
  }

  // Балл — за полностью верное задание
  const unitCount = draft => draft.tasks.length;
  // Проверка у Word Scramble всегда одна, итоговая (решение архива D-095)
  const fixedChecks = () => 1;
  const fixedChecksNote = 'У Word Scramble проверка всегда одна, итоговая, на все задания сразу: она доступна, когда во всех заданиях использованы все кусочки. После неё ответы не меняются. «Начать заново» перемешивает кусочки и даёт новую проверку.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.tasks.length > 1;
    if (!draft.tasks.length) errors.push('Нет ни одного задания.');
    if (draft.tasks.length > MAX_TASKS) errors.push(`Заданий больше ${MAX_TASKS}.`);
    draft.tasks.forEach((t, k) => {
      const p = taskProblem(t);
      if (p) errors.push(many ? `Задание ${k + 1}: ${p[0].toLowerCase() + p.slice(1)}` : p);
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.tasks) || !file.tasks.length) throw new Error('В файле нет заданий.');
    const ids = new Set();
    const tasks = file.tasks.slice(0, MAX_TASKS).map(t => {
      let id = String((t && t.id) || '');
      if (!id || ids.has(id)) id = nextId('t', [...ids]);
      ids.add(id);
      const im = t && t.image;
      return { id, mode: T.MODES[t && t.mode] ? t.mode : 'sentence', answer: String((t && t.answer) || ''),
        instruction: String((t && t.instruction) || ''), hint: String((t && t.hint) || ''), explanation: String((t && t.explanation) || ''),
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (t && t.audio && safeMediaPath(t.audio.media)) || '' };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', tokenStyle: file.tokenStyle === 'chips' ? 'chips' : 'tiles', showAnswers: file.showAnswers !== false,
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', tasks };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): показ заданий и вид кусочков; размер картинок — только если в упражнении есть картинки
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const size = draft.tasks.some(t => hasPic(t.image))
      ? [{ field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } }] : [];
    return [...size,
      { field: 'view', label: 'Показ заданий', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
        icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } },
      { field: 'tokenStyle', label: 'Вид кусочков', value: STYLES[draft.tokenStyle] ? draft.tokenStyle : 'tiles', names: STYLES,
        icons: { tiles: sq('<rect x="3" y="8" width="8" height="8" rx="1.5"/><rect x="13" y="8" width="8" height="8" rx="1.5"/>'), chips: sq('<rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>') } },
    ];
  }
  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers !== false,
      help: 'После проверки у неверно собранного задания показывается правильный ответ целиком. Верные задания зелёные, неверные — красные в любом случае; пояснение показывается всегда. По умолчанию включено.' }];
  }

  return { create, demo, render, load, exportData, validate, unitCount, fixedChecks, fixedChecksNote, designOptions, behaviorOptions };
})();
