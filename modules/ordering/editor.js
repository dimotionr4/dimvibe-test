// Редактор модуля Ordering: последовательности элементов; порядок элементов в редакторе — это и есть правильный ответ.
// У последовательности и элемента устойчивый ID (q1, i1…). Перестановка (перетаскиванием за ручку или стрелками) меняет ответ.
// Элемент — текст, картинка или картинка с подписью; у последовательности может быть звук (этап 2, решение владельца 2026-10-25).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const OrderingEditor = (() => {
  const MAX_SEQS = 5, MIN_ITEMS = 2, MAX_ITEMS = 10, START_ITEMS = 3, MAX_LEN = 300; // последовательностей, элементов в каждой, символов в элементе
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="or-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const allItemIds = () => d.seqs.flatMap(s => s.items.map(i => i.id));

  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const filled = it => !!clean(it.text) || hasPic(it.image);
  // Что ученик видит на элементе: по этому ключу ищутся одинаковые (текст без учёта регистра и лишних пробелов + та же картинка)
  const faceKey = it => [clean(it.text).normalize('NFC').toLowerCase(), hasPic(it.image) ? (safeMediaPath(it.image.media) || safeImageUrl(it.image.url)) : ''].join('|');
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };

  function newItem(id) { return { id, text: '', image: emptyImage() }; }
  function newSeq(id, firstItem) {
    const items = [];
    for (let k = 0; k < START_ITEMS; k++) items.push(newItem('i' + (firstItem + k)));
    return { id, instruction: '', audio: '', items };
  }
  function create() {
    return { module: 'ordering', format: 1, showAnswers: false, imageSize: 'm', seqs: [newSeq('q1', 1)] };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    d.seqs.forEach(s => {
      if (typeof s.audio !== 'string') s.audio = '';
      s.items.forEach(it => { if (!it.image) it.image = emptyImage(); });
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
    root.className = 'or-wrap';
    const tools = el('div', 'or-tools');
    counter = el('span', 'or-muted');
    const right = el('span', 'or-right');
    right.append(help(`Напишите элементы сразу в правильном порядке: сверху — первый. Этот порядок и есть ответ; если переставить элементы (за ручку ⋮⋮ или стрелками), ответ поменяется вместе с ними. Ученик получит элементы перемешанными и расставит их по порядку. Элемент — текст, картинка или картинка с подписью; у последовательности может быть звук (например, «прослушайте и расставьте по порядку»). Проверка одна на всё упражнение, балл — за каждый элемент на своём месте. Элементов от ${MIN_ITEMS} до ${MAX_ITEMS}, последовательностей до ${MAX_SEQS}; одинаковые элементы внутри одной последовательности нельзя.`));
    tools.append(counter, right);
    msg = el('div', 'or-msg');
    msg.hidden = true;
    listBox = el('div', 'or-seqs');
    addBtn = el('button', 'or-add', '+ Последовательность');
    addBtn.type = 'button';
    addBtn.onclick = addSeq;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Последовательностей: ${d.seqs.length}/${MAX_SEQS}`;
    addBtn.disabled = d.seqs.length >= MAX_SEQS;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.seqs.forEach((s, k) => listBox.append(card(s, k)));
    updateCounter();
  }

  const newSeqId = () => nextId('q', d.seqs.map(s => s.id));
  const newItemId = () => nextId('i', allItemIds());

  function card(s, k) {
    const many = d.seqs.length > 1;
    const box = el('section', 'or-seq' + (many ? ' multi' : ''));
    box.dataset.id = s.id;
    if (many) {
      box.append(head(s, k));
      const ins = el('input', 'or-in or-instr');
      ins.type = 'text';
      ins.maxLength = 300;
      ins.placeholder = 'Своя инструкция к этой последовательности (необязательно)';
      ins.value = s.instruction;
      ins.setAttribute('aria-label', `Инструкция к последовательности ${k + 1}`);
      ins.oninput = () => { s.instruction = ins.value; save(); };
      box.append(ins);
    }
    // Звук последовательности: общие компактные значки (core/mediabar.js)
    const sound = el('div', 'or-sound');
    sound.append(el('span', 'or-muted', 'Звук:'), MediaUI.picker('audio', () => s.audio || '', v => { s.audio = v; save(); }, 'Загрузить звук последовательности'));
    box.append(sound);
    const items = el('ol', 'or-items');
    const drawItems = () => {
      items.innerHTML = '';
      s.items.forEach((it, j) => items.append(itemRow(s, it, j, drawItems)));
      markDups(s, items);
      add.disabled = s.items.length >= MAX_ITEMS;
    };
    // Перетаскивание за ручку: новое место элемента сразу становится правильным ответом
    Reorder.attach(items, { itemSel: '.or-row', handleSel: '.or-grip', dragClass: 'or-dragging', listClass: 'or-dragging-list', onDrop: (from, to) => {
      const [it] = s.items.splice(from, 1);
      s.items.splice(to, 0, it);
      save();
      drawItems();
    } });
    const add = el('button', 'or-add or-additem', '+ Элемент');
    add.type = 'button';
    add.onclick = () => {
      if (s.items.length >= MAX_ITEMS) return say(`Элементов не больше ${MAX_ITEMS}.`);
      s.items.push(newItem(newItemId()));
      save();
      drawItems();
      const ins = items.querySelectorAll('.or-item-in');
      if (ins.length) ins[ins.length - 1].focus();
    };
    box.append(el('p', 'or-muted or-hint', 'Сверху вниз — правильный порядок. Ученик увидит элементы перемешанными.'), items, add);
    drawItems();
    return box;
  }

  // Одинаковые элементы в одной последовательности подсвечиваются сразу, не дожидаясь публикации
  function markDups(s, items) {
    if (!items) return;
    const count = {};
    s.items.forEach(it => { if (filled(it)) { const k = faceKey(it); count[k] = (count[k] || 0) + 1; } });
    items.querySelectorAll('.or-row').forEach((r, j) => {
      const it = s.items[j];
      r.classList.toggle('dup', !!it && filled(it) && count[faceKey(it)] > 1);
    });
  }

  function itemRow(s, it, j, redraw) {
    const r = el('li', 'or-row');
    const grip = el('button', 'or-grip');
    grip.type = 'button';
    grip.innerHTML = Reorder.GRIP;
    grip.title = 'Перетащить';
    grip.setAttribute('aria-label', `Перетащить элемент ${j + 1}`);
    const num = el('span', 'or-num', String(j + 1));
    const inp = el('input', 'or-in or-item-in');
    inp.type = 'text';
    inp.maxLength = MAX_LEN;
    inp.placeholder = hasPic(it.image) ? `Подпись к картинке (необязательно)` : `Элемент ${j + 1}`;
    inp.value = it.text;
    inp.setAttribute('aria-label', `Элемент ${j + 1}`);
    inp.oninput = () => { it.text = inp.value; save(); markDups(s, r.parentElement); };
    const b = (html, tip, fn, disabled) => { const x = el('button', 'or-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}, элемент ${j + 1}`); x.disabled = !!disabled; x.onclick = fn; return x; };
    const swap = dir => { const i = j + dir; [s.items[j], s.items[i]] = [s.items[i], s.items[j]]; save(); redraw(); };
    const tools = el('span', 'or-tools2');
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => swap(-1), j === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => swap(1), j === s.items.length - 1),
      b(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить', () => { s.items.splice(j, 1); save(); redraw(); }, s.items.length <= MIN_ITEMS),
    );
    tools.lastChild.classList.add('or-del');
    // Картинка элемента: общие значки «загрузить» и «из медиатеки», миниатюра с крестиком (core/mediabar.js)
    const media = el('div', 'or-media');
    media.append(MediaUI.imageControl(it.image, { save, change: () => {
      inp.placeholder = hasPic(it.image) ? 'Подпись к картинке (необязательно)' : `Элемент ${j + 1}`;
      markDups(s, r.parentElement);
    } }));
    r.append(grip, num, inp, tools, media);
    return r;
  }

  function head(s, k) {
    const top = el('div', 'or-seqtop');
    top.append(el('b', '', `Последовательность ${k + 1}`));
    const tools = el('span', 'or-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'or-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', последовательность ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Последовательность выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Последовательность ниже', () => move(k, 1), k === d.seqs.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать последовательность', () => duplicate(k), d.seqs.length >= MAX_SEQS),
    );
    if (delAsk === s.id) {
      const q = el('span', 'or-ask');
      const yes = el('button', 'or-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить последовательность', () => { if (s.instruction.trim() || s.audio || s.items.some(filled)) { delAsk = s.id; drawList(); } else remove(k); }));
    top.append(tools);
    return top;
  }

  function addSeq() {
    if (d.seqs.length >= MAX_SEQS) return say(`Последовательностей не больше ${MAX_SEQS}.`);
    const s = newSeq(newSeqId(), 1);
    const ids = allItemIds();
    s.items.forEach(i => { i.id = nextId('i', ids); ids.push(i.id); });
    d.seqs.push(s);
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = last.querySelector('.or-item-in'); if (inp) inp.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.seqs.length) return;
    [d.seqs[k], d.seqs[j]] = [d.seqs[j], d.seqs[k]];
    save();
    drawList();
  }
  // Копия получает новые ID последовательности и элементов: данные копии не связаны с оригиналом
  function duplicate(k) {
    if (d.seqs.length >= MAX_SEQS) return say(`Последовательностей не больше ${MAX_SEQS}.`);
    const copy = JSON.parse(JSON.stringify(d.seqs[k]));
    copy.id = newSeqId();
    const ids = allItemIds();
    copy.items.forEach(i => { i.id = nextId('i', ids); ids.push(i.id); });
    d.seqs.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.seqs.splice(k, 1);
    delAsk = null;
    if (!d.seqs.length) d.seqs.push(newSeq('q1', 1));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // Порядок items в файле — правильный порядок. Пустые элементы в файл не попадают; инструкция — только при нескольких последовательностях;
  // text, image, audio — только если есть; imageSize — только если в упражнении есть картинка
  function exportData(draft) {
    const many = draft.seqs.length > 1;
    const anyPic = draft.seqs.some(s => s.items.some(i => filled(i) && imageOut(i.image)));
    return {
      module: 'ordering', format: 1,
      ...(draft.showAnswers === true ? { showAnswers: true } : {}),
      ...(anyPic ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm' } : {}),
      sequences: draft.seqs.map(s => ({
        id: s.id,
        ...(many && s.instruction.trim() ? { instruction: s.instruction.trim() } : {}),
        ...(audioOut(s.audio) ? { audio: audioOut(s.audio) } : {}),
        items: s.items.filter(filled).map(i => ({
          id: i.id,
          ...(clean(i.text) ? { text: clean(i.text) } : {}),
          ...(imageOut(i.image) ? { image: imageOut(i.image) } : {}),
        })),
      })),
    };
  }

  // Балл — за каждый элемент на своём месте
  const unitCount = draft => draft.seqs.reduce((n, s) => n + s.items.filter(filled).length, 0);
  // Проверка у Ordering всегда одна, итоговая (решение архива D-069)
  const fixedChecks = () => 1;
  const fixedChecksNote = 'У Ordering проверка всегда одна, итоговая: до неё ученик переставляет элементы сколько угодно, после неё порядок не меняется. «Начать заново» перемешивает элементы и даёт новую проверку.';

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.seqs.length > 1;
    if (!draft.seqs.length) errors.push('Нет ни одной последовательности.');
    if (draft.seqs.length > MAX_SEQS) errors.push(`Последовательностей больше ${MAX_SEQS}.`);
    draft.seqs.forEach((s, k) => {
      const pre = many ? `Последовательность ${k + 1}: ` : '';
      const err = m => errors.push(pre ? pre + m : m[0].toUpperCase() + m.slice(1)); // без номера — с заглавной буквы
      const full = s.items.filter(filled);
      if (full.length < MIN_ITEMS) err(`нужно хотя бы ${MIN_ITEMS} элемента.`);
      if (s.items.length > MAX_ITEMS) err(`элементов больше ${MAX_ITEMS}.`);
      // Пустой элемент посередине сбил бы правильный порядок: просим удалить его или заполнить
      const last = s.items.map(filled).lastIndexOf(true);
      s.items.forEach((i, j) => {
        if (!filled(i) && j < last) err(`элемент ${j + 1} пустой: напишите текст, добавьте картинку или удалите его.`);
        const im = i.image;
        if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) err(`элемент ${j + 1}: ссылка на картинку должна быть полным адресом с https://.`);
      });
      const seen = new Set();
      full.forEach(i => {
        const k2 = faceKey(i);
        const name = clean(i.text) ? `«${clean(i.text)}»` : `${s.items.indexOf(i) + 1} (картинка)`;
        if (seen.has(k2)) err(`элемент ${name} повторяется. Одинаковых элементов в одной последовательности быть не может: ученик не сможет их различить.`);
        seen.add(k2);
      });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.sequences) || !file.sequences.length) throw new Error('В файле нет последовательностей.');
    const used = new Set(), seqIds = new Set();
    const seqs = file.sequences.slice(0, MAX_SEQS).map(s => {
      const items = (Array.isArray(s && s.items) ? s.items : []).slice(0, MAX_ITEMS).map(i => {
        let id = String((i && i.id) || '');
        if (!id || used.has(id)) id = nextId('i', [...used]);
        used.add(id);
        const im = i && i.image;
        return { id, text: String((i && i.text) || ''),
          image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') } };
      });
      while (items.length < MIN_ITEMS) { const id = nextId('i', [...used]); used.add(id); items.push(newItem(id)); }
      let id = String((s && s.id) || '');
      if (!id || seqIds.has(id)) id = nextId('q', [...seqIds]);
      seqIds.add(id);
      return { id, instruction: String((s && s.instruction) || ''), audio: (s && s.audio && safeMediaPath(s.audio.media)) || '', items };
    });
    return { ...create(), showAnswers: file.showAnswers === true, imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', seqs };
  }

  // Настройка во вкладке «Дизайн» (рисует ядро): размер картинок — только если в упражнении есть картинки
  function designOptions(draft) {
    if (!draft.seqs.some(s => s.items.some(i => hasPic(i.image)))) return [];
    return [{ field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } }];
  }

  // Выключатель во вкладке «Поведение»
  function behaviorOptions(draft) {
    return [{ field: 'showAnswers', label: 'Показывать правильный ответ', value: draft.showAnswers === true,
      help: 'После проверки верные места всегда зелёные, неверные — красные. Если включено, у каждого неверного места ещё подписано, какой элемент должен там стоять («Правильно: …»). По умолчанию выключено.' }];
  }

  return { create, render, load, exportData, validate, unitCount, fixedChecks, fixedChecksNote, designOptions, behaviorOptions };
})();
