// Редактор модуля True / False: утверждения, у каждого один верный ответ из двух категорий (необязательно трёх).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Всё, что видит автор, лежит в черновике (кроме открытой строки и пометок «проверьте ответ»), поэтому отмена и повтор ядра работают сами.
const TrueFalseEditor = (() => {
  const MAX = 10;
  const DEFAULT_C = 'Not stated';
  const PRESETS = { tf: ['True', 'False'], fo: ['Fact', 'Opinion'], fi: ['Formal', 'Informal'], sd: ['Safe', 'Dangerous'], hu: ['Healthy', 'Unhealthy'], pp: ['Past', 'Present'] };
  const VIEWS = { one: 'По одному утверждению', list: 'Все списком' };
  const { nextId } = GapEngine;
  let d, root, save, openId = null, delAsk = null, msgTimer = null, drag = null;
  let msg, counter, listBox, addBtn;
  const recheck = new Set(); // утверждения, у которых изменился формат ответов: автору напоминаем проверить верный ответ

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const same = (x, y) => clean(x).toLowerCase() === clean(y).toLowerCase();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="tf-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const audioOut = path => { const m = window.safeMediaPath && safeMediaPath(path); return m ? { media: m } : null; };

  const newFmt = () => ({ preset: 'tf', a: '', b: '', c: DEFAULT_C, third: false });
  const newItem = id => ({ id, text: '', correct: '', explanation: '', audio: '', override: false, fmt: newFmt() });

  // Подписи включённых категорий: id (a, b, c) не зависят от текста
  function labelsOf(f) {
    const base = PRESETS[f.preset] || [f.a, f.b];
    const out = [{ id: 'a', text: base[0] }, { id: 'b', text: base[1] }];
    if (f.third) out.push({ id: 'c', text: f.c });
    return out;
  }
  const fmtOf = it => (it.override ? it.fmt : d.answers);
  const labelText = (it, k) => { const l = labelsOf(fmtOf(it)).find(x => x.id === k); return l ? clean(l.text) : ''; };

  function create() {
    return { module: 'true_false', format: 1, answers: newFmt(), view: 'one', items: [newItem('q1')] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    if (!d.items.some(i => i.id === openId)) openId = null;
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
    root.className = 'tf-wrap';
    const tools = el('div', 'tf-tools');
    counter = el('span', 'tf-muted');
    const right = el('span', 'tf-right');
    right.append(help(`Напишите утверждения. У каждого выберите один верный ответ из двух вариантов (при желании — из трёх). Пояснение ученик видит только после проверки, если ответил верно, и в конце. Название пары (True / False, Fact / Opinion и другие) общее для всех утверждений, но у любого утверждения можно включить «Другой формат ответов». Не больше ${MAX} утверждений. Показ «по одному» или «списком» — во вкладке «Дизайн».`));
    tools.append(counter, right);
    msg = el('div', 'tf-msg');
    msg.hidden = true;
    listBox = el('div', 'tf-list');
    addBtn = el('button', 'tf-add', '+ Утверждение');
    addBtn.onclick = () => addItem(d.items.length);
    root.append(tools, msg, answersBlock(), listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    const n = d.items.length;
    counter.textContent = `Утверждений: ${n}/${MAX}`;
    counter.classList.toggle('tf-limit', n >= MAX);
    addBtn.disabled = n >= MAX;
  }

  // ---- Формат ответов: общий для упражнения и индивидуальный (один и тот же редактор) ----
  function formatEditor(fmt, onChange) {
    const box = el('div', 'tf-fmt');
    const sel = el('select');
    sel.setAttribute('aria-label', 'Пара ответов');
    Object.entries(PRESETS).forEach(([k, [a, b]]) => { const o = el('option', '', `${a} / ${b}`); o.value = k; sel.append(o); });
    const oc = el('option', '', 'Custom: свои названия');
    oc.value = 'custom';
    sel.append(oc);
    sel.value = fmt.preset;
    sel.onchange = () => {
      if (sel.value === 'custom' && !clean(fmt.a) && !clean(fmt.b)) { const l = labelsOf(fmt); fmt.a = l[0].text; fmt.b = l[1].text; } // свои названия начинаются с прежних
      fmt.preset = sel.value;
      onChange('structure');
    };
    box.append(sel);
    const input = (field, ph, label) => {
      const i = el('input');
      i.value = fmt[field];
      i.placeholder = ph;
      i.setAttribute('aria-label', label);
      i.oninput = () => { fmt[field] = i.value; onChange('label'); };
      return i;
    };
    if (fmt.preset === 'custom') {
      const row = el('div', 'tf-pair');
      row.append(input('a', 'Первая кнопка', 'Название первой кнопки'), input('b', 'Вторая кнопка', 'Название второй кнопки'));
      box.append(row);
    }
    const thirdRow = el('label', 'tf-check');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = fmt.third;
    cb.onchange = () => { fmt.third = cb.checked; onChange('structure'); };
    thirdRow.append(cb, document.createTextNode(' Третий вариант ответа'));
    box.append(thirdRow);
    if (fmt.third) box.append(input('c', DEFAULT_C, 'Название третьего варианта'));
    return box;
  }

  // Изменился формат: у утверждений с уже выбранным ответом просим проверить, не поменялся ли смысл
  function formatChanged(kind, items) {
    items.forEach(it => { if (it.correct) recheck.add(it.id); });
    save();
    if (kind === 'structure') { draw(); } else { syncLabels(); markTags(); }
    if (items.some(it => it.correct)) say('Проверьте правильный ответ: названия изменились, смысл мог поменяться. Это напоминание, оно не мешает публикации.');
  }

  function answersBlock() {
    const box = el('section', 'tf-block');
    const head = el('div', 'tf-labelrow');
    head.append(el('h3', '', 'Варианты ответов'), help('Общие для всех утверждений. Если нужен другой формат для одного утверждения, включите «Другой формат ответов» в его строке. Правильный ответ запоминается по месту кнопки, а не по тексту, поэтому при смене названий он остаётся на своём месте.'));
    box.append(head, formatEditor(d.answers, kind => formatChanged(kind, d.items.filter(i => !i.override))));
    const rc = el('label', 'tf-check tf-soon');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.disabled = true;
    const soon = el('span', 'tf-badge', 'Coming soon');
    rc.append(cb, document.createTextNode(' Require correction if False '), soon);
    rc.title = 'Пока не работает';
    box.append(rc);
    return box;
  }

  // ---- Список утверждений ----
  const statusIcon = it => {
    const f = fmtOf(it);
    if (!it.correct) return { cls: 'none', html: svg('<circle cx="12" cy="12" r="7" stroke-dasharray="3 3"/>'), tip: 'Правильный ответ не выбран' };
    if (it.correct === 'c' && !f.third) return { cls: 'conflict', html: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'), tip: 'Правильный ответ привязан к отключённому третьему варианту' };
    const t = labelText(it, it.correct);
    if (it.correct === 'a') return { cls: 'a', html: svg('<path d="M5 12l5 5L20 7"/>'), tip: `Верно: ${t}` };
    if (it.correct === 'b') return { cls: 'b', html: svg('<path d="M6 6l12 12M18 6L6 18"/>'), tip: `Верно: ${t}` };
    return { cls: 'c', html: svg('<path d="M6 12h12"/>'), tip: `Верно: ${t}` };
  };

  function drawList() {
    listBox.innerHTML = '';
    d.items.forEach((it, i) => listBox.append(row(it, i)));
    updateCounter();
  }

  function row(it, i) {
    const r = el('div', 'tf-row' + (it.id === openId ? ' open' : ''));
    r.dataset.id = it.id;
    const head = el('div', 'tf-head');
    const grip = el('span', 'tf-grip', '⠿');
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
    // Слева кнопки правильного ответа, справа поле утверждения
    const main = el('div', 'tf-main');
    const picks = el('div', 'tf-picks');
    picks.setAttribute('role', 'radiogroup');
    picks.setAttribute('aria-label', `Правильный ответ, утверждение ${i + 1}`);
    labelsOf(fmtOf(it)).forEach(l => {
      const b = el('button', 'tf-pick' + (it.correct === l.id ? ' on ' + l.id : ''));
      b.type = 'button';
      b.dataset.k = l.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(it.correct === l.id));
      b.title = 'Правильный ответ: ' + (clean(l.text) || '…');
      b.append(el('span', 'tf-pl', clean(l.text) || '…'));
      b.onclick = () => { it.correct = it.correct === l.id ? '' : l.id; recheck.delete(it.id); save(); drawList(); };
      picks.append(b);
    });
    const field = el('div', 'tf-field');
    const ta = el('textarea');
    ta.rows = 2;
    ta.placeholder = 'Утверждение, например: The sun rises in the east.';
    ta.value = it.text;
    ta.setAttribute('aria-label', `Текст утверждения ${i + 1}`);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { it.text = ta.value; fit(); save(); };
    setTimeout(fit, 0);
    const tag = el('span', 'tf-tag', 'Проверьте правильный ответ');
    tag.hidden = !(recheck.has(it.id) && it.correct);
    field.append(ta, tag);
    if (it.correct === 'c' && !fmtOf(it).third) field.append(el('div', 'tf-warn', 'Ответ привязан к третьему варианту, а он отключён: включите его или выберите другой ответ.'));
    main.append(picks, field);
    const tools = el('span', 'tf-tools2');
    const more = el('button', 'tf-ib tf-more' + (it.id === openId ? ' on' : ''));
    more.type = 'button';
    more.innerHTML = svg('<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>');
    more.title = 'Пояснение, озвучка, другой формат ответов';
    more.setAttribute('aria-label', more.title);
    more.setAttribute('aria-expanded', String(it.id === openId));
    more.onclick = () => { openId = openId === it.id ? null : it.id; delAsk = null; drawList(); };
    tools.append(more);
    const btn = (cls, html, tip, fn, disabled) => {
      const b = el('button', 'tf-ib ' + cls);
      b.type = 'button';
      b.innerHTML = html;
      b.title = tip;
      b.setAttribute('aria-label', tip);
      b.disabled = !!disabled;
      b.onclick = e => { e.stopPropagation(); fn(); };
      return b;
    };
    tools.append(
      btn('', svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => move(i, -1), i === 0),
      btn('', svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => move(i, 1), i === d.items.length - 1),
      btn('', svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(i), d.items.length >= MAX),
    );
    if (delAsk === it.id) {
      const q = el('span', 'tf-ask');
      const yes = el('button', 'tf-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => removeItem(i);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(btn('tf-del', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', () => askDelete(i)));
    head.append(grip, el('span', 'tf-n', `${i + 1}.`), main, tools);
    r.append(head);
    if (it.id === openId) r.append(body(it, r));
    return r;
  }

  // Названия на кнопках ответа и метки «проверьте» без полной перерисовки (чтобы не терять фокус в поле названия)
  const markTags = () => listBox.querySelectorAll('.tf-row').forEach(r => {
    const it = d.items.find(x => x.id === r.dataset.id);
    if (it) r.querySelector('.tf-tag').hidden = !(recheck.has(it.id) && it.correct);
  });
  const syncLabels = () => listBox.querySelectorAll('.tf-row').forEach(r => {
    const it = d.items.find(x => x.id === r.dataset.id);
    if (it) r.querySelectorAll('.tf-pl').forEach((s, k) => { const l = labelsOf(fmtOf(it))[k]; if (l) s.textContent = clean(l.text) || '…'; });
  });
  const clearDrop = () => listBox.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));

  function body(it, r) {
    const b = el('div', 'tf-body');
    const el2 = el('div', 'tf-label tf-labelrow', 'Пояснение (необязательно)');
    el2.append(help('Ученик увидит пояснение после проверки, если ответил на это утверждение верно, и в конце упражнения. Пока ответ неверный, пояснение скрыто, чтобы не выдать ответ. Баллы оно не меняет.'));
    const ex = el('textarea');
    ex.rows = 2;
    ex.placeholder = 'Почему это верно или неверно';
    ex.value = it.explanation || '';
    ex.setAttribute('aria-label', 'Пояснение');
    const fit2 = () => { ex.style.height = 'auto'; ex.style.height = ex.scrollHeight + 2 + 'px'; };
    ex.oninput = () => { it.explanation = ex.value; fit2(); save(); };
    b.append(el2, ex);
    setTimeout(fit2, 0);

    const al = el('div', 'tf-label tf-labelrow', 'Озвучка утверждения (необязательно)');
    al.append(help('Ученик нажимает значок динамика рядом с утверждением и слышит этот звук. Можно слушать сколько угодно раз.'));
    b.append(al);
    if (window.mediaPicker) b.append(window.mediaPicker('audio', () => it.audio || '', v => { it.audio = v; save(); }, 'Загрузить озвучку'));

    // Индивидуальный формат: настройки сохраняются, даже если галочку снять
    const ov = el('label', 'tf-check');
    const ocb = el('input');
    ocb.type = 'checkbox';
    ocb.checked = !!it.override;
    ocb.onchange = () => {
      it.override = ocb.checked;
      if (it.correct) recheck.add(it.id);
      save();
      drawList();
      if (it.correct) say('Проверьте правильный ответ: формат ответов этого утверждения изменился.');
    };
    ov.append(ocb, document.createTextNode(' Другой формат ответов'));
    b.append(ov);
    if (it.override) b.append(formatEditor(it.fmt, kind => formatChanged(kind, [it])));
    return b;
  }

  function addItem(index) {
    if (d.items.length >= MAX) return say(`Утверждений не больше ${MAX}. Разделите задание на два.`);
    const id = nextId('q', d.items.map(i => i.id));
    d.items.splice(index, 0, newItem(id));
    openId = id;
    save();
    drawList();
    const ta = listBox.querySelector(`.tf-row[data-id="${id}"] textarea`);
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function duplicate(i) {
    if (d.items.length >= MAX) return say(`Утверждений не больше ${MAX}.`);
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
    const b = listBox.querySelector(`.tf-row[data-id="${d.items[j].id}"] .tf-ib:not(:disabled)`);
    if (b) b.focus();
  }

  // Заполненное утверждение удаляется после подтверждения прямо в строке, пустое — сразу
  function askDelete(i) {
    const it = d.items[i];
    if (!clean(it.text) && !it.correct && !clean(it.explanation) && !it.audio) return removeItem(i);
    delAsk = it.id;
    drawList();
  }
  function removeItem(i) {
    const [it] = d.items.splice(i, 1);
    recheck.delete(it.id);
    if (openId === it.id) openId = null;
    delAsk = null;
    if (!d.items.length) d.items.push(newItem('q1'));
    save();
    drawList();
  }

  // ---- Файл упражнения ----
  function answersOut(f) {
    const l = labelsOf(f);
    return { preset: PRESETS[f.preset] ? f.preset : 'custom', a: clean(l[0].text), b: clean(l[1].text), ...(f.third ? { c: clean(f.c) } : {}) };
  }
  function exportData(draft) {
    return {
      module: 'true_false', format: 1,
      view: draft.view === 'list' ? 'list' : 'one',
      answers: answersOut(draft.answers),
      items: draft.items.map(it => ({
        id: it.id,
        text: clean(it.text),
        correct: it.correct || '',
        ...(clean(it.explanation) ? { explanation: String(it.explanation).trim() } : {}),
        ...(audioOut(it.audio) ? { audio: audioOut(it.audio) } : {}),
        ...(it.override ? { answers: answersOut(it.fmt) } : {}),
      })),
    };
  }

  const unitCount = draft => draft.items.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    d = draft; // fmtOf читает общий формат из черновика
    const items = draft.items;
    if (!items.length) errors.push('Нет ни одного утверждения.');
    if (items.length > MAX) errors.push(`Утверждений больше ${MAX}. Разделите задание на два.`);
    const checkFmt = (f, who) => {
      const l = labelsOf(f), seen = [];
      l.forEach((x, k) => {
        if (!clean(x.text)) errors.push(`${who}: не заполнено название ${['первой', 'второй', 'третьей'][k]} кнопки.`);
        else if (seen.some(s => same(s, x.text))) errors.push(`${who}: названия кнопок не должны совпадать (${clean(x.text)}).`);
        seen.push(x.text);
      });
    };
    if (items.some(i => !i.override)) checkFmt(draft.answers, 'Общие варианты ответов');
    items.forEach((it, n) => {
      const who = `Утверждение ${n + 1}`;
      if (!clean(it.text)) errors.push(`${who}: нет текста.`);
      if (it.override) checkFmt(it.fmt, `${who}, другой формат`);
      const f = it.override ? it.fmt : draft.answers;
      if (!it.correct) errors.push(`${who}: не выбран правильный ответ.`);
      else if (it.correct === 'c' && !f.third) errors.push(`${who}: правильный ответ привязан к отключённому третьему варианту. Включите его или выберите другой ответ.`);
      if (it.correct && recheck.has(it.id)) warnings.push(`${who}: формат ответов менялся, проверьте правильный ответ.`);
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика. Недостающее заполняется
  function load(file) {
    if (!Array.isArray(file.items)) throw new Error('В файле нет утверждений.');
    const fmtIn = a => {
      const f = newFmt();
      if (!a || typeof a !== 'object') return f;
      f.preset = PRESETS[a.preset] ? a.preset : 'custom';
      if (f.preset === 'custom') { f.a = String(a.a || ''); f.b = String(a.b || ''); }
      if (typeof a.c === 'string') { f.c = a.c; f.third = true; }
      return f;
    };
    const items = file.items.map((i, k) => ({
      id: String(i.id || 'q' + (k + 1)),
      text: String(i.text || ''),
      correct: ['a', 'b', 'c'].includes(i.correct) ? i.correct : '',
      explanation: String(i.explanation || ''),
      audio: (i.audio && safeMediaPath(i.audio.media)) || '',
      override: !!i.answers,
      fmt: fmtIn(i.answers),
    }));
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', answers: fmtIn(file.answers), items: items.length ? items : create().items };
  }

  // Настройки модуля во вкладке «Дизайн»: показ по одному или списком (рисует ядро, поле лежит в черновике)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'view', label: 'Показ утверждений', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
        icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } },
    ];
  }

  return { create, render, load, exportData, validate, unitCount, designOptions };
})();
