// Редактор модуля Vocabulary: словарь из слов и фраз. У слова — транскрипция, картинка и одно или несколько значений
// (часть речи, перевод, пояснение, примеры с переводом). Баллов и проверок нет: ученик просто смотрит словарь.
// У слова, значения и примера устойчивый ID (w1, m1, e1…); он не зависит от текста и места в списке.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const VocabularyEditor = (() => {
  const MAX_WORDS = 60, MAX_MEANINGS = 5, MAX_EXAMPLES = 4; // слов в словаре, значений у слова, примеров у значения
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="vc-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

  // Части речи: ключ хранится в файле, ученик видит название
  const POS = { noun: 'Существительное', verb: 'Глагол', adj: 'Прилагательное', adv: 'Наречие', pron: 'Местоимение', prep: 'Предлог',
    conj: 'Союз', interj: 'Междометие', phrase: 'Фраза', other: 'Другое' };
  const VIEWS = { dictionary: 'Словарь', cards: 'Карточки', reveal: 'Показать' };
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  // Звук слова и примера: {media} или нет
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };
  const imageOut = im => {
    if (!im) return null;
    const alt = String(im.alt || '').trim().replace(/\s+/g, ' '), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };

  const allIds = (prefix) => {
    const ids = [];
    d.words.forEach(w => {
      if (prefix === 'w') ids.push(w.id);
      w.meanings.forEach(m => { if (prefix === 'm') ids.push(m.id); m.examples.forEach(x => { if (prefix === 'e') ids.push(x.id); }); });
    });
    return ids;
  };
  const newMeaning = () => ({ id: nextId('m', allIds('m')), pos: '', translation: '', note: '', examples: [] });
  const newExample = () => ({ id: nextId('e', allIds('e')), text: '', translation: '', audio: '' });
  const newWord = () => { const id = nextId('w', allIds('w')); return { id, text: '', ipa: '', image: emptyImage(), audio: '', meanings: [newMeaning()] }; };

  function create() {
    const w = { id: 'w1', text: '', ipa: '', image: emptyImage(), audio: '', meanings: [{ id: 'm1', pos: '', translation: '', note: '', examples: [] }] };
    return { module: 'vocabulary', format: 1, view: 'dictionary', imageSize: 'm', imageFit: 'contain', words: [w] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): три слова, у одного два значения, картинка, примеры
  function demo() {
    const ex = (id, text, translation, audio) => ({ id, text, translation, audio: audio || '' });
    return { ...create(), instruction: DimDemo.instruction('Изучите слова: найдите нужное в списке, листайте карточки или проверьте себя в режиме «Показать».'), words: [
      { id: 'w1', text: 'house', ipa: '/haʊs/', image: { ...emptyImage(), media: DimDemo.IMG.house }, audio: DimDemo.AUD.a, meanings: [
        { id: 'm1', pos: 'noun', translation: 'дом', note: 'Здание, где живут люди.', examples: [ex('e1', 'Tom lives in a small house.', 'Том живёт в маленьком доме.', DimDemo.AUD.a), ex('e2', 'Our house is near the river.', 'Наш дом недалеко от реки.')] },
        { id: 'm2', pos: 'verb', translation: 'размещать', note: '', examples: [ex('e3', 'The museum houses a huge collection.', 'В музее хранится огромная коллекция.')] },
      ] },
      { id: 'w2', text: 'quickly', ipa: '/ˈkwɪkli/', image: emptyImage(), meanings: [
        { id: 'm3', pos: 'adv', translation: 'быстро', note: '', examples: [ex('e4', 'She ran quickly to school.', 'Она быстро побежала в школу.')] },
      ] },
      { id: 'w3', text: 'look forward to', ipa: '', image: emptyImage(), meanings: [
        { id: 'm4', pos: 'phrase', translation: 'ждать с нетерпением', note: 'После to идёт существительное или -ing.', examples: [ex('e5', 'I look forward to seeing you.', 'Жду не дождусь встречи с тобой.')] },
      ] },
    ] };
  }

  // Черновики, сделанные раньше, получают пустые поля
  function normalize() {
    if (!VIEWS[d.view]) d.view = 'dictionary';
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    if (!FITS[d.imageFit]) d.imageFit = 'contain';
    d.words.forEach(w => {
      if (!w.image) w.image = emptyImage();
      if (typeof w.ipa !== 'string') w.ipa = '';
      if (typeof w.audio !== 'string') w.audio = '';
      if (!Array.isArray(w.meanings) || !w.meanings.length) w.meanings = [newMeaning()];
      w.meanings.forEach(m => {
        if (!Array.isArray(m.examples)) m.examples = [];
        m.examples.forEach(x => { if (typeof x.audio !== 'string') x.audio = ''; });
      });
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
    root.className = 'vc-wrap';
    const tools = el('div', 'vc-tools');
    counter = el('span', 'vc-muted');
    const right = el('span', 'vc-right');
    right.append(help(`Здесь собирается словарь. У каждого слова — одно или несколько значений: часть речи и перевод обязательны, пояснение и примеры по желанию. Примеры можно переводить. Ученик ищет слова в списке или листает карточки; баллов и проверок нет. Слов до ${MAX_WORDS}, значений у слова до ${MAX_MEANINGS}, примеров у значения до ${MAX_EXAMPLES}.`));
    tools.append(counter, right);
    msg = el('div', 'vc-msg');
    msg.hidden = true;
    listBox = el('div', 'vc-words');
    addBtn = el('button', 'vc-add', '+ Слово');
    addBtn.type = 'button';
    addBtn.onclick = addWord;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    counter.textContent = `Слов: ${d.words.length}/${MAX_WORDS}`;
    addBtn.disabled = d.words.length >= MAX_WORDS;
  }
  function drawList() {
    listBox.innerHTML = '';
    d.words.forEach((w, k) => listBox.append(card(w, k)));
    updateCounter();
  }

  const input = (value, placeholder, label, onInput, max) => {
    const i = el('input', 'vc-in');
    i.type = 'text';
    i.maxLength = max || 200;
    i.placeholder = placeholder;
    i.value = value;
    i.setAttribute('aria-label', label);
    i.oninput = () => onInput(i.value);
    return i;
  };
  const iconBtn = (html, tip, label, fn, disabled) => {
    const x = el('button', 'vc-ib');
    x.type = 'button';
    x.innerHTML = html;
    x.title = tip;
    x.setAttribute('aria-label', label);
    x.disabled = !!disabled;
    x.onclick = fn;
    return x;
  };

  function card(w, k) {
    const box = el('section', 'vc-word');
    box.dataset.id = w.id;
    const top = el('div', 'vc-wtop');
    top.append(el('b', '', `Слово ${k + 1}`));
    const tools = el('span', 'vc-tools2');
    const n = ` ${k + 1}`;
    tools.append(
      iconBtn(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', 'Слово выше,' + n, () => move(k, -1), k === 0),
      iconBtn(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', 'Слово ниже,' + n, () => move(k, 1), k === d.words.length - 1),
      iconBtn(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', 'Дублировать слово,' + n, () => duplicate(k), d.words.length >= MAX_WORDS),
    );
    if (delAsk === w.id) {
      const q = el('span', 'vc-ask');
      const yes = el('button', 'vc-yes', 'Удалить слово');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else {
      const del = iconBtn(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', 'Удалить слово,' + n, () => {
        const used = w.text.trim() || w.ipa.trim() || hasPic(w.image) || w.audio || w.meanings.some(m => m.translation.trim() || m.note.trim() || m.examples.length);
        if (used) { delAsk = w.id; drawList(); } else remove(k);
      });
      del.classList.add('vc-del');
      tools.append(del);
    }
    top.append(tools);

    const head = el('div', 'vc-head');
    const text = input(w.text, 'Слово или фраза', `Слово ${k + 1}`, v => { w.text = v; save(); });
    text.classList.add('vc-text');
    const ipa = input(w.ipa, 'Транскрипция (необязательно)', `Транскрипция слова ${k + 1}`, v => { w.ipa = v; save(); }, 80);
    ipa.classList.add('vc-ipa');
    // Картинка и звук слова: общие компактные значки (core/mediabar.js); звук — перед полем слова (набросок владельца 2026-10-27)
    const media = el('div', 'vc-media');
    const audio = MediaUI.picker('audio', () => w.audio || '', v => { w.audio = v; save(); }, 'Загрузить звук слова');
    media.append(MediaUI.imageControl(w.image, { save, after: audio, audioOutside: true }));
    head.append(audio, text, ipa);

    const meanings = el('div', 'vc-means');
    const drawMeans = () => {
      meanings.innerHTML = '';
      w.meanings.forEach((m, j) => meanings.append(meaningBox(w, m, j, k, drawMeans)));
      const add = el('button', 'vc-add vc-addmean', '+ Значение');
      add.type = 'button';
      add.disabled = w.meanings.length >= MAX_MEANINGS;
      add.onclick = () => {
        if (w.meanings.length >= MAX_MEANINGS) return say(`Значений у слова не больше ${MAX_MEANINGS}.`);
        w.meanings.push(newMeaning());
        save();
        drawMeans();
        const ins = meanings.querySelectorAll('.vc-tr');
        if (ins.length) ins[ins.length - 1].focus();
      };
      meanings.append(add);
    };
    drawMeans();

    box.append(top, head, media, meanings);
    return box;
  }

  function meaningBox(w, m, j, k, redraw) {
    const many = w.meanings.length > 1;
    const box = el('div', 'vc-mean' + (many ? ' multi' : ''));
    const lab = many ? ` (значение ${j + 1})` : '';
    const row = el('div', 'vc-row');
    const sel = el('select', 'vc-in vc-pos');
    sel.setAttribute('aria-label', `Часть речи слова ${k + 1}${lab}`);
    const first = el('option', '', 'Часть речи');
    first.value = '';
    sel.append(first);
    Object.keys(POS).forEach(key => { const o = el('option', '', POS[key]); o.value = key; sel.append(o); });
    sel.value = POS[m.pos] ? m.pos : '';
    sel.onchange = () => { m.pos = sel.value; save(); };
    const tr = input(m.translation, 'Перевод', `Перевод слова ${k + 1}${lab}`, v => { m.translation = v; save(); });
    tr.classList.add('vc-tr');
    row.append(sel, tr);
    if (many) row.append(iconBtn(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить значение', `Удалить значение ${j + 1}, слово ${k + 1}`, () => { w.meanings.splice(j, 1); save(); redraw(); }));
    const note = input(m.note, 'Пояснение (необязательно)', `Пояснение к значению слова ${k + 1}${lab}`, v => { m.note = v; save(); }, 300);
    note.classList.add('vc-note');

    const exBox = el('div', 'vc-exs');
    const drawEx = () => {
      exBox.innerHTML = '';
      m.examples.forEach((x, i) => {
        const r = el('div', 'vc-ex');
        const t = input(x.text, 'Пример', `Пример ${i + 1}${lab}, слово ${k + 1}`, v => { x.text = v; save(); }, 300);
        const tt = input(x.translation, 'Перевод примера (необязательно)', `Перевод примера ${i + 1}${lab}, слово ${k + 1}`, v => { x.translation = v; save(); }, 300);
        const au = MediaUI.picker('audio', () => x.audio || '', v => { x.audio = v; save(); }, 'Загрузить звук примера');
        r.append(t, tt, au, iconBtn(svg('<path d="M6 6l12 12M18 6L6 18"/>'), 'Удалить пример', `Удалить пример ${i + 1}${lab}, слово ${k + 1}`, () => { m.examples.splice(i, 1); save(); drawEx(); }));
        exBox.append(r);
      });
      const add = el('button', 'vc-add vc-addex', '+ Пример');
      add.type = 'button';
      add.disabled = m.examples.length >= MAX_EXAMPLES;
      add.onclick = () => {
        if (m.examples.length >= MAX_EXAMPLES) return say(`Примеров у значения не больше ${MAX_EXAMPLES}.`);
        m.examples.push(newExample());
        save();
        drawEx();
        const ins = exBox.querySelectorAll('.vc-ex');
        if (ins.length) ins[ins.length - 1].querySelector('input').focus();
      };
      exBox.append(add);
    };
    drawEx();
    box.append(row, note, exBox);
    return box;
  }

  function addWord() {
    if (d.words.length >= MAX_WORDS) return say(`Слов не больше ${MAX_WORDS}.`);
    d.words.push(newWord());
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const t = last.querySelector('.vc-text'); if (t) t.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.words.length) return;
    [d.words[k], d.words[j]] = [d.words[j], d.words[k]];
    save();
    drawList();
  }
  // Копия получает новые ID слова, значений и примеров
  function duplicate(k) {
    if (d.words.length >= MAX_WORDS) return say(`Слов не больше ${MAX_WORDS}.`);
    const copy = JSON.parse(JSON.stringify(d.words[k]));
    const wids = allIds('w'), mids = allIds('m'), eids = allIds('e');
    copy.id = nextId('w', wids);
    copy.meanings.forEach(m => {
      m.id = nextId('m', mids); mids.push(m.id);
      m.examples.forEach(x => { x.id = nextId('e', eids); eids.push(x.id); });
    });
    d.words.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.words.splice(k, 1);
    delAsk = null;
    if (!d.words.length) d.words.push(newWord());
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  // Значение попадает в файл, если в нём есть перевод, пояснение или пример; пустые примеры отбрасываются
  const exampleOut = x => ({ id: x.id, text: clean(x.text), ...(clean(x.translation) ? { translation: clean(x.translation) } : {}), ...(audioOut(x.audio) ? { audio: audioOut(x.audio) } : {}) });
  const meaningOut = m => ({
    id: m.id, pos: POS[m.pos] ? m.pos : 'other', translation: clean(m.translation),
    ...(clean(m.note) ? { note: clean(m.note) } : {}),
    ...(m.examples.some(x => clean(x.text)) ? { examples: m.examples.filter(x => clean(x.text)).map(exampleOut) } : {}),
  });
  const meaningFilled = m => clean(m.translation) || clean(m.note) || m.examples.some(x => clean(x.text));
  const wordOut = w => ({
    id: w.id, text: clean(w.text),
    ...(clean(w.ipa) ? { ipa: clean(w.ipa) } : {}),
    ...(imageOut(w.image) ? { image: imageOut(w.image) } : {}),
    ...(audioOut(w.audio) ? { audio: audioOut(w.audio) } : {}),
    meanings: w.meanings.filter(meaningFilled).map(meaningOut),
  });
  function exportData(draft) {
    return {
      module: 'vocabulary', format: 1,
      ...(draft.view === 'cards' || draft.view === 'reveal' ? { view: draft.view } : {}),
      ...(draft.words.some(w => imageOut(w.image)) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm', imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain' } : {}),
      words: draft.words.filter(w => clean(w.text) || w.meanings.some(meaningFilled)).map(wordOut),
    };
  }

  const unitCount = draft => draft.words.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    if (!draft.words.length) errors.push('Нет ни одного слова.');
    if (draft.words.length > MAX_WORDS) errors.push(`Слов больше ${MAX_WORDS}.`);
    const seen = new Map(), noExample = [];
    draft.words.forEach((w, k) => {
      const pre = `Слово ${k + 1}: `;
      const text = clean(w.text);
      if (!text) errors.push(`${pre}не написано слово.`);
      const im = w.image;
      if (im && !safeMediaPath(im.media) && String(im.url || '').trim() && !safeImageUrl(im.url)) errors.push(`${pre}ссылка на картинку должна быть полным адресом с https://.`);
      const filled = w.meanings.filter(meaningFilled);
      if (!filled.length) errors.push(`${pre}нет ни одного значения с переводом.`);
      if (w.meanings.length > MAX_MEANINGS) errors.push(`${pre}значений больше ${MAX_MEANINGS}.`);
      filled.forEach((m, j) => {
        const mp = filled.length > 1 ? `${pre}значение ${j + 1}: ` : pre;
        if (!clean(m.translation)) errors.push(`${mp}не написан перевод.`);
        if (!POS[m.pos]) errors.push(`${mp}не выбрана часть речи.`);
        if (m.examples.length > MAX_EXAMPLES) errors.push(`${mp}примеров больше ${MAX_EXAMPLES}.`);
        m.examples.forEach((x, i) => { if (!clean(x.text) && clean(x.translation)) errors.push(`${mp}у перевода примера ${i + 1} нет самого примера.`); });
      });
      if (text) {
        const key = text.normalize('NFC').toLowerCase();
        seen.set(key, [...(seen.get(key) || []), k + 1]);
      }
      if (filled.length && !filled.some(m => m.examples.some(x => clean(x.text)))) noExample.push(k + 1);
    });
    seen.forEach((nums, key) => { if (nums.length > 1) warnings.push(`Слово «${key}» повторяется: слова ${nums.join(', ')}. Если это разные значения, лучше объединить их в одном слове.`); });
    if (noExample.length) warnings.push(`Нет примеров у слов: ${noExample.join(', ')}.`);
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; неверные поля получают значения по умолчанию
  function load(file) {
    if (!Array.isArray(file.words) || !file.words.length) throw new Error('В файле нет слов.');
    const wids = new Set(), mids = new Set(), eids = new Set();
    const uid = (raw, set, prefix) => { let id = String(raw || ''); if (!id || set.has(id)) id = nextId(prefix, [...set]); set.add(id); return id; };
    const words = file.words.slice(0, MAX_WORDS).map(s => {
      const im = s && s.image;
      const meanings = (Array.isArray(s && s.meanings) ? s.meanings : []).slice(0, MAX_MEANINGS).map(m => ({
        id: uid(m && m.id, mids, 'm'), pos: POS[m && m.pos] ? m.pos : '', translation: String((m && m.translation) || ''), note: String((m && m.note) || ''),
        examples: (Array.isArray(m && m.examples) ? m.examples : []).slice(0, MAX_EXAMPLES).map(x => ({ id: uid(x && x.id, eids, 'e'), text: String((x && x.text) || ''), translation: String((x && x.translation) || ''), audio: (x && x.audio && safeMediaPath(x.audio.media)) || '' })),
      }));
      return { id: uid(s && s.id, wids, 'w'), text: String((s && s.text) || ''), ipa: String((s && s.ipa) || ''),
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (s && s.audio && safeMediaPath(s.audio.media)) || '',
        meanings: meanings.length ? meanings : [{ id: uid('', mids, 'm'), pos: '', translation: '', note: '', examples: [] }] };
    });
    return { ...create(), view: file.view === 'cards' || file.view === 'reveal' ? file.view : 'dictionary',
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain', words };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): с какого вида начинать; размер картинок и вписывание — только если есть картинки
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const view = { field: 'view', label: 'Начальный вид', value: VIEWS[draft.view] ? draft.view : 'dictionary', names: VIEWS,
      icons: { dictionary: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>'), cards: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'),
        reveal: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 10h8M8 14h4"/>') } };
    if (!draft.words.some(w => hasPic(w.image))) return [view];
    return [view,
      { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }

  // У словаря нет проверок и баллов: вкладка «Поведение» объясняет это
  const noChecks = true;
  const noChecksNote = 'В Vocabulary нет проверок и баллов: это справочник. Ученик ищет слова, листает карточки и ничего не сдаёт.';

  return { create, demo, render, load, exportData, validate, unitCount, noChecks, noChecksNote, designOptions };
})();
