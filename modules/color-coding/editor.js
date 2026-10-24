// Редактор модуля Color Coding: категории с названием и цветом (общие на всё упражнение) и тексты, в которых автор
// выбирает категорию и нажимает на слова. У категории, текста и отметки устойчивый ID (c1, t1, m1…).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
const ColorCodingEditor = (() => {
  const MAX_TEXTS = 5, MAX_WORDS = 150, MIN_CATS = 2, MAX_CATS = 6; // текстов в упражнении, слов в тексте, категорий
  const { nextId } = GapEngine;
  const { PALETTE, colorOf } = ColorTokens;
  let d, root, save, delAsk = null, catAsk = null, colorOpen = null, active = null, msgTimer = null;
  let msg, counter, catBox, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="cc-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const wordCount = t => ColorTokens.words(t.text).length;
  const allMarks = () => d.texts.flatMap(t => t.marks);
  const catById = id => d.categories.find(c => c.id === id);
  const catName = c => String(c.name || '').trim() || 'Без названия';
  const normName = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const usedBy = (draft, id) => draft.texts.reduce((n, t) => n + t.marks.filter(m => !m.broken && m.cat === id).length, 0);

  const VIEWS = { one: 'По одному тексту', list: 'Все тексты сразу' };
  const newText = (id, text) => ({ id, instruction: '', text: text || '', marks: [] });
  function create() {
    return { module: 'color_coding', format: 1, view: 'one',
      categories: [{ id: 'c1', name: '', color: 'yellow' }, { id: 'c2', name: '', color: 'blue' }], texts: [newText('t1')] };
  }

  function normalize() {
    if (!VIEWS[d.view]) d.view = 'one';
    if (!Array.isArray(d.categories)) d.categories = [];
    if (!catById(active)) active = d.categories.length ? d.categories[0].id : null;
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null; catAsk = null; colorOpen = null;
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
    root.className = 'cc-wrap';
    const tools = el('div', 'cc-tools');
    counter = el('span', 'cc-muted');
    const right = el('span', 'cc-right');
    right.append(help(`Сначала задайте категории: название и цвет, например «Существительное» — жёлтый, «Глагол» — синий. Потом вставьте текст, выберите категорию и нажимайте на слова: слово окрасится цветом категории. Ученик увидит обычный текст и сам раскрасит слова. Одно верно окрашенное слово — один балл. Категорий от ${MIN_CATS} до ${MAX_CATS}, в тексте до ${MAX_WORDS} слов, текстов до ${MAX_TEXTS}.`));
    tools.append(counter, right);
    msg = el('div', 'cc-msg');
    msg.hidden = true;
    catBox = el('section', 'cc-cats');
    listBox = el('div', 'cc-texts');
    addBtn = el('button', 'cc-add', '+ Текст');
    addBtn.type = 'button';
    addBtn.onclick = addText;
    root.append(tools, msg, catBox, listBox, addBtn);
    drawCats();
    drawList();
  }

  function updateCounter() {
    const n = allMarks().filter(m => !m.broken).length;
    counter.textContent = d.texts.length > 1 ? `Текстов: ${d.texts.length}/${MAX_TEXTS} · отмечено слов: ${n}` : `Отмечено слов: ${n}`;
    addBtn.disabled = d.texts.length >= MAX_TEXTS;
  }

  // ---- Категории ----
  const newCatId = () => nextId('c', d.categories.map(c => c.id));
  function drawCats() {
    catBox.innerHTML = '';
    catBox.append(el('b', 'cc-h', 'Категории'));
    d.categories.forEach((c, k) => catBox.append(catRow(c, k)));
    const add = el('button', 'cc-add cc-addcat', '+ Категория');
    add.type = 'button';
    add.disabled = d.categories.length >= MAX_CATS;
    add.onclick = addCat;
    catBox.append(add);
  }

  function catRow(c, k) {
    const wrap = el('div', 'cc-catwrap');
    const r = el('div', 'cc-cat');
    const dot = el('button', 'cc-dot');
    dot.type = 'button';
    dot.style.setProperty('--cc', colorOf(c.color));
    dot.title = 'Цвет: ' + (PALETTE[c.color] ? PALETTE[c.color].label : 'не выбран');
    dot.setAttribute('aria-label', `Цвет категории ${k + 1}: ` + (PALETTE[c.color] ? PALETTE[c.color].label : 'не выбран'));
    dot.setAttribute('aria-expanded', String(colorOpen === c.id));
    dot.onclick = () => { colorOpen = colorOpen === c.id ? null : c.id; drawCats(); };
    const name = el('input', 'cc-in cc-name');
    name.type = 'text';
    name.maxLength = 40;
    name.placeholder = `Название категории ${k + 1}, например: ${['Существительное', 'Глагол', 'Прилагательное', 'Наречие', 'Предлог', 'Местоимение'][k] || 'Категория'}`;
    name.value = c.name;
    name.setAttribute('aria-label', `Название категории ${k + 1}`);
    name.oninput = () => { c.name = name.value; save(); drawList(); };
    r.append(dot, name);
    const n = usedBy(d, c.id);
    if (catAsk === c.id) {
      const q = el('span', 'cc-ask');
      q.append(el('span', 'cc-muted', `Снимется отметок: ${n}.`));
      const yes = el('button', 'cc-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => removeCat(c);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { catAsk = null; drawCats(); };
      q.append(yes, no);
      r.append(q);
    } else {
      const del = el('button', 'cc-ib cc-del');
      del.type = 'button';
      del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
      del.title = 'Удалить категорию';
      del.setAttribute('aria-label', `Удалить категорию ${k + 1}`);
      del.disabled = d.categories.length <= 1;
      // Используемая категория удаляется только после подтверждения с числом отметок; текст не меняется
      del.onclick = () => { if (n) { catAsk = c.id; drawCats(); } else removeCat(c); };
      r.append(del);
    }
    wrap.append(r);
    if (colorOpen === c.id) {
      const sw = el('div', 'cc-swatches');
      sw.setAttribute('role', 'group');
      sw.setAttribute('aria-label', 'Цвет категории');
      Object.entries(PALETTE).forEach(([key, p]) => {
        const other = d.categories.find(o => o !== c && o.color === key);
        const b = el('button', 'cc-sw' + (c.color === key ? ' on' : ''));
        b.type = 'button';
        b.style.setProperty('--cc', p.hex);
        b.title = p.label + (other ? ` — уже у «${catName(other)}»` : '');
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', String(c.color === key));
        b.disabled = !!other; // цвета категорий не повторяются
        b.onclick = () => { c.color = key; colorOpen = null; save(); drawCats(); drawList(); };
        sw.append(b);
      });
      wrap.append(sw);
    }
    return wrap;
  }

  function addCat() {
    if (d.categories.length >= MAX_CATS) return say(`Категорий не больше ${MAX_CATS}.`);
    const free = Object.keys(PALETTE).find(key => !d.categories.some(c => c.color === key)) || '';
    const c = { id: newCatId(), name: '', color: free };
    d.categories.push(c);
    active = c.id;
    save();
    drawCats();
    drawList();
    const inp = catBox.querySelectorAll('.cc-name');
    if (inp.length) inp[inp.length - 1].focus();
  }
  function removeCat(c) {
    d.texts.forEach(t => { t.marks = t.marks.filter(m => m.cat !== c.id); });
    d.categories.splice(d.categories.indexOf(c), 1);
    catAsk = null;
    if (active === c.id) active = d.categories.length ? d.categories[0].id : null;
    save();
    drawCats();
    drawList();
  }

  // ---- Тексты ----
  function drawList() {
    listBox.innerHTML = '';
    d.texts.forEach((t, k) => listBox.append(card(t, k)));
    updateCounter();
  }

  const newTextId = () => nextId('t', d.texts.map(t => t.id));
  const newMarkId = () => nextId('m', allMarks().map(m => m.id));

  // Ряд категорий над текстом: какой категорией сейчас отмечаются слова (общий для всех текстов)
  function palette() {
    const row = el('div', 'cc-palette');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Категория для отметки слов');
    d.categories.forEach(c => {
      const b = el('button', 'cc-chip' + (c.id === active ? ' on' : ''));
      b.type = 'button';
      b.style.setProperty('--cc', colorOf(c.color));
      b.setAttribute('aria-pressed', String(c.id === active));
      b.append(el('i', 'cc-chipdot'), el('span', '', catName(c)));
      b.onclick = () => { active = c.id; drawList(); };
      row.append(b);
    });
    return row;
  }

  function card(t, k) {
    const many = d.texts.length > 1;
    const box = el('section', 'cc-text' + (many ? ' multi' : ''));
    box.dataset.id = t.id;
    if (many) box.append(head(t, k));

    const ta = el('textarea', 'cc-in cc-body');
    ta.rows = 4;
    ta.placeholder = 'Вставьте или напишите текст, например: The little cat sleeps on the warm sofa.';
    ta.value = t.text;
    ta.setAttribute('aria-label', `Текст ${k + 1}`);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 96) + 'px'; };
    const count = el('div', 'cc-muted cc-count');
    const pick = el('div', 'cc-pick');
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', 'Слова текста: нажмите на слово, чтобы окрасить его выбранной категорией');
    const lost = el('div', 'cc-lost');

    function refresh() {
      const n = wordCount(t);
      count.textContent = `Слов: ${n}/${MAX_WORDS}`;
      count.classList.toggle('cc-limit', n > MAX_WORDS);
      pick.innerHTML = '';
      if (!n) pick.append(el('span', 'cc-muted', 'Когда вы введёте текст, здесь можно будет нажимать на слова.'));
      ColorTokens.split(t.text).forEach(p => {
        if (!p.word) { pick.append(document.createTextNode(p.s)); return; }
        const m = t.marks.find(x => !x.broken && x.index === p.i), c = m && catById(m.cat);
        const w = el('span', 'cc-w' + (c ? ' on' : ''), p.s);
        if (c) { w.style.setProperty('--cc', colorOf(c.color)); w.title = catName(c); }
        w.tabIndex = 0;
        w.setAttribute('role', 'button');
        w.setAttribute('aria-pressed', String(!!c));
        if (c) w.setAttribute('aria-label', `${p.s}, ${catName(c)}`);
        const go = () => toggle(t, p.i, p.s, refresh);
        w.onclick = go;
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        pick.append(w);
      });
      // Отметки, потерянные после правки текста: автор отмечает слово заново или снимает отметку
      lost.innerHTML = '';
      t.marks.filter(m => m.broken).forEach(m => {
        const r = el('div', 'cc-lostrow');
        const c = catById(m.cat);
        r.append(el('b', '', `«${m.word}»`), el('span', 'cc-bad', `${c ? catName(c) + ': ' : ''}отметка потеряна после правки текста. Нажмите на это слово в тексте заново или снимите отметку.`));
        const del = el('button', 'cc-ib cc-del');
        del.type = 'button';
        del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
        del.title = 'Снять отметку';
        del.setAttribute('aria-label', `Снять отметку с «${m.word}»`);
        del.onclick = () => { t.marks.splice(t.marks.indexOf(m), 1); save(); refresh(); };
        r.append(del);
        lost.append(r);
      });
      updateCounter();
    }

    ta.oninput = () => {
      const old = ColorTokens.words(t.text);
      t.text = ta.value;
      ColorTokens.reanchor(old, ColorTokens.words(t.text), t.marks);
      fit();
      save();
      refresh();
    };
    setTimeout(fit, 0);
    box.append(ta, count, el('p', 'cc-muted cc-hint', 'Выберите категорию и нажимайте на слова. Повторное нажатие той же категорией снимает цвет, другой категорией — меняет его.'), palette(), pick, lost);
    refresh();
    return box;
  }

  // Нажатие на слово: та же категория — снять, другая — перекрасить, без отметки — окрасить
  function toggle(t, i, word, refresh) {
    if (!catById(active)) return say('Сначала добавьте категорию.');
    const have = t.marks.find(m => !m.broken && m.index === i);
    if (have && have.cat === active) t.marks.splice(t.marks.indexOf(have), 1);
    else if (have) have.cat = active;
    else {
      const lost = t.marks.find(m => m.broken && m.word === word); // потерянная отметка возвращается на это слово
      if (lost) { lost.index = i; lost.cat = active; delete lost.broken; }
      else t.marks.push({ id: newMarkId(), index: i, word, cat: active });
    }
    save();
    refresh();
  }

  function head(t, k) {
    const h = el('div', 'cc-texthead');
    const top = el('div', 'cc-texttop');
    top.append(el('b', '', `Текст ${k + 1}`));
    const tools = el('span', 'cc-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'cc-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', текст ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Текст выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Текст ниже', () => move(k, 1), k === d.texts.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать текст', () => duplicate(k), d.texts.length >= MAX_TEXTS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'cc-ask');
      const yes = el('button', 'cc-yes', 'Удалить текст');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить текст', () => { if (t.text.trim() || t.instruction.trim()) { delAsk = t.id; drawList(); } else remove(k); }));
    top.append(tools);
    const ins = el('textarea', 'cc-in cc-textins');
    ins.rows = 1;
    ins.placeholder = 'Инструкция к тексту (необязательно), например: Окрасьте все глаголы';
    ins.value = t.instruction;
    ins.setAttribute('aria-label', `Инструкция к тексту ${k + 1}`);
    const fit = () => { ins.style.height = 'auto'; ins.style.height = ins.scrollHeight + 2 + 'px'; };
    ins.oninput = () => { t.instruction = ins.value; fit(); save(); };
    setTimeout(fit, 0);
    h.append(top, ins);
    return h;
  }

  function addText() {
    if (d.texts.length >= MAX_TEXTS) return say(`Текстов не больше ${MAX_TEXTS}.`);
    d.texts.push(newText(newTextId()));
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const ta = last.querySelector('.cc-body'); if (ta) ta.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.texts.length) return;
    [d.texts[k], d.texts[j]] = [d.texts[j], d.texts[k]];
    save();
    drawList();
  }
  // Копия получает новые ID текста и отметок, категории остаются общими
  function duplicate(k) {
    if (d.texts.length >= MAX_TEXTS) return say(`Текстов не больше ${MAX_TEXTS}.`);
    const copy = JSON.parse(JSON.stringify(d.texts[k]));
    copy.id = newTextId();
    const ids = allMarks().map(m => m.id);
    copy.marks.forEach(m => { m.id = nextId('m', ids); ids.push(m.id); });
    d.texts.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function remove(k) {
    d.texts.splice(k, 1);
    delAsk = null;
    if (!d.texts.length) d.texts.push(newText('t1'));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  const textOut = t => ({
    id: t.id,
    ...(t.instruction.trim() ? { instruction: t.instruction.trim() } : {}),
    text: t.text.replace(/\r\n?/g, '\n').trim(),
    marks: t.marks.filter(m => !m.broken).slice().sort((a, b) => a.index - b.index).map(m => ({ id: m.id, index: m.index, word: m.word, cat: m.cat })),
  });
  function exportData(draft) {
    return {
      module: 'color_coding', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      categories: draft.categories.map(c => ({ id: c.id, name: String(c.name || '').trim().replace(/\s+/g, ' '), color: c.color })),
      texts: draft.texts.map(textOut),
    };
  }

  const unitCount = draft => draft.texts.reduce((n, t) => n + t.marks.filter(m => !m.broken).length, 0);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const cats = draft.categories || [];
    if (cats.length < MIN_CATS) errors.push(`Нужно хотя бы ${MIN_CATS} категории.`);
    if (cats.length > MAX_CATS) errors.push(`Категорий больше ${MAX_CATS}.`);
    const names = new Map(), colors = new Map();
    cats.forEach((c, k) => {
      const n = normName(c.name);
      if (!n) errors.push(`Категория ${k + 1}: нет названия.`);
      else if (names.has(n)) errors.push(`Категории ${names.get(n) + 1} и ${k + 1}: одинаковые названия «${String(c.name).trim()}».`);
      else names.set(n, k);
      if (!PALETTE[c.color]) errors.push(`Категория ${k + 1}: не выбран цвет.`);
      else if (colors.has(c.color)) errors.push(`Категории ${colors.get(c.color) + 1} и ${k + 1}: одинаковый цвет.`);
      else colors.set(c.color, k);
      if (n && !usedBy(draft, c.id)) warnings.push(`Категория «${String(c.name).trim()}» не отмечена ни в одном тексте.`);
    });
    const many = draft.texts.length > 1;
    if (!draft.texts.length) errors.push('Нет ни одного текста.');
    if (draft.texts.length > MAX_TEXTS) errors.push(`Текстов больше ${MAX_TEXTS}.`);
    draft.texts.forEach((t, k) => {
      const pre = many ? `Текст ${k + 1}: ` : '';
      const n = wordCount(t);
      if (!t.text.trim() || !n) { errors.push(`${pre}текст пустой.`); return; }
      if (n > MAX_WORDS) errors.push(`${pre}в тексте ${n} слов, а можно не больше ${MAX_WORDS}. Разделите его на два текста.`);
      if (t.marks.some(m => m.broken)) errors.push(`${pre}есть потерянные отметки после правки текста: отметьте слова заново или снимите отметки.`);
      if (t.marks.some(m => !m.broken && !cats.some(c => c.id === m.cat))) errors.push(`${pre}есть отметки несуществующей категории.`);
    });
    if (draft.texts.length && !unitCount(draft)) errors.push('Не окрашено ни одного слова.');
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; отметка, не совпавшая со словом текста, считается потерянной
  function load(file) {
    if (!Array.isArray(file.texts) || !file.texts.length) throw new Error('В файле нет текстов.');
    const seen = new Set();
    const categories = (Array.isArray(file.categories) ? file.categories : []).slice(0, MAX_CATS).map((c, k) => {
      let id = String((c && c.id) || 'c' + (k + 1));
      if (seen.has(id)) id = nextId('c', [...seen]);
      seen.add(id);
      return { id, name: String((c && c.name) || ''), color: PALETTE[c && c.color] ? c.color : '' };
    });
    let n = 0;
    const texts = file.texts.slice(0, MAX_TEXTS).map((s, k) => {
      const text = String((s && s.text) || '');
      const w = ColorTokens.words(text);
      return {
        id: String((s && s.id) || 't' + (k + 1)), instruction: String((s && s.instruction) || ''), text,
        marks: (Array.isArray(s && s.marks) ? s.marks : []).map(m => {
          const out = { id: String((m && m.id) || 'm' + (++n)), index: Number(m && m.index) || 0, word: String((m && m.word) || ''), cat: String((m && m.cat) || '') };
          if (w[out.index] !== out.word || !seen.has(out.cat)) out.broken = true;
          return out;
        }),
      };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', categories: categories.length ? categories : create().categories, texts };
  }

  // Настройка во вкладке «Дизайн» (рисует ядро): показ текстов
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [{ field: 'view', label: 'Показ текстов', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
      icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } }];
  }

  return { create, render, load, exportData, validate, unitCount, designOptions };
})();
