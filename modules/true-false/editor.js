// Редактор модуля True / False: утверждения, у каждого один верный ответ из двух категорий (необязательно трёх).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Всё, что видит автор, лежит в черновике (кроме открытой строки и пометок «проверьте ответ»), поэтому отмена и повтор ядра работают сами.
const TrueFalseEditor = (() => {
  const MAX = 10;
  const DEFAULT_C = 'Not stated';
  const PRESETS = { tf: ['True', 'False'], fo: ['Fact', 'Opinion'], fi: ['Formal', 'Informal'], sd: ['Safe', 'Dangerous'], hu: ['Healthy', 'Unhealthy'], pp: ['Past', 'Present'] };
  const VIEWS = { one: 'По одному утверждению', list: 'Все списком' };
  const { nextId } = GapEngine;
  let d, root, save, openId = null, openSec = 'exp', undo = null, undoTimer = null, msgTimer = null, drag = null;
  let msg, counter, listBox, addBtn, undoBar;
  const recheck = new Set(); // утверждения, у которых изменился формат ответов: автору напоминаем проверить верный ответ

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const same = (x, y) => clean(x).toLowerCase() === clean(y).toLowerCase();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="tf-ico" viewBox="0 0 24 24" aria-hidden="true">${window.DVIcons ? DVIcons.swap(inner) : inner}</svg>`;
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

  // Демо-пример (демо-режим в «Настройках», core/demo.js): верные и неверные утверждения, пояснения, озвучка
  function demo() {
    const it = (id, text, correct, explanation, audio) => ({ ...newItem(id), text, correct, explanation, audio: audio || '' });
    return { ...create(), instruction: DimDemo.instruction('Прочитайте утверждения и выберите True или False.'),
      items: [
        it('q1', 'The sun rises in the east.', 'a', 'Солнце встаёт на востоке.', DimDemo.AUD.a),
        it('q2', 'Cats can fly.', 'b', 'Кошки не летают.'),
        it('q3', 'Water boils at 100 °C at sea level.', 'a', ''),
        it('q4', 'A week has eight days.', 'b', 'В неделе семь дней.'),
      ] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    if (!d.items.some(i => i.id === openId)) openId = null;
    undo = null;
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
    msg = el('div', 'tf-msg');
    msg.hidden = true;
    const table = el('div', 'tf-table');
    const top = topBar();
    const head = el('div', 'tf-thead');
    head.append(el('span', 'tf-th-n', '№'), el('span', 'tf-th-t', 'Утверждение'), el('span', 'tf-th-a', 'Верный ответ'));
    listBox = el('div', 'tf-list');
    addBtn = el('button', 'tf-add');
    addBtn.type = 'button';
    addBtn.innerHTML = svg('<path d="M12 6v12M6 12h12"/>');
    addBtn.title = 'Добавить утверждение';
    addBtn.setAttribute('aria-label', 'Добавить утверждение');
    addBtn.onclick = () => addItem(d.items.length);
    undoBar = el('div', 'tf-undo');
    table.append(top.bar, ...(top.extra ? [top.extra] : []), head, listBox, addBtn, undoBar);
    root.append(msg, table);
    drawList();
    drawUndo();
  }

  // Верхняя строка таблицы: счётчик, общий формат ответов и «+3» (третий вариант); для Custom под строкой поля названий
  function topBar() {
    const bar = el('div', 'tf-top');
    counter = el('span', 'tf-muted');
    const right = el('span', 'tf-right');
    const parts = formatEditor(d.answers, kind => formatChanged(kind, d.items.filter(i => !i.override)), true);
    const more = el('button', 'tf-third' + (d.answers.third ? ' on' : ''), '+3');
    more.type = 'button';
    more.title = 'Третий вариант ответа';
    more.setAttribute('aria-pressed', String(!!d.answers.third));
    more.onclick = () => { d.answers.third = !d.answers.third; formatChanged('structure', d.items.filter(i => !i.override)); };
    right.append(el('span', 'tf-muted', 'Общий формат'), parts.sel, more, help(`Напишите утверждения. У каждого выберите один верный ответ из двух вариантов (при желании — из трёх). Пояснение ученик видит только после проверки, если ответил верно, и в конце. Название пары (True / False, Fact / Opinion и другие) общее для всех утверждений, но у любого утверждения можно включить «Другой формат ответов». Правильный ответ запоминается по месту кнопки, а не по тексту. Не больше ${MAX} утверждений. Показ «по одному» или «списком» — во вкладке «Дизайн».`));
    bar.append(counter, right);
    let extra = null;
    if (parts.box) { extra = el('div', 'tf-extra'); extra.append(parts.box); }
    return { bar, extra };
  }

  function updateCounter() {
    const n = d.items.length;
    counter.textContent = `Утверждений: ${n}/${MAX}`;
    counter.classList.toggle('tf-limit', n >= MAX);
    addBtn.disabled = n >= MAX;
  }

  // ---- Формат ответов: общий для упражнения и индивидуальный (один и тот же редактор) ----
  function formatEditor(fmt, onChange, split) {
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
    if (!split) box.append(sel);
    const input = (field, ph, label) => {
      const i = el('input');
      i.value = fmt[field];
      i.placeholder = ph;
      i.setAttribute('aria-label', label);
      i.oninput = () => { fmt[field] = i.value; onChange('label'); };
      return i;
    };
    if (split) {
      // Общий формат: поля с подписями в одну строку; третий вариант включает кнопка «+3» в верхней строке
      const row = el('div', 'tf-fields');
      const lab = (text, field, ph) => { const l = el('label', 'tf-fld'); l.append(el('span', 'tf-muted', text), input(field, ph, text)); row.append(l); };
      if (fmt.preset === 'custom') { lab('Название 1', 'a', 'Первая кнопка'); lab('Название 2', 'b', 'Вторая кнопка'); }
      if (fmt.third) lab('Третий вариант', 'c', DEFAULT_C);
      return { sel, box: row.children.length ? row : null };
    }
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
    // Слева номер и поле утверждения, справа ряд кнопок правильного ответа и под ним значки действий
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
    ta.rows = 1;
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
    const tools = el('span', 'tf-tools2');
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
    const sec = (name, html, tip, filled) => {
      const on = it.id === openId && openSec === name;
      const b = btn((on ? 'on' : '') + (filled ? ' has' : ''), html, tip, () => {
        if (on) openId = null; else { openId = it.id; openSec = name; }
        drawList();
      });
      b.setAttribute('aria-expanded', String(on));
      return b;
    };
    tools.append(
      sec('exp', svg('<path d="M5 5h14v11H10l-5 4z"/><path d="M9 9h6M9 12h4"/>'), 'Пояснение ученику', clean(it.explanation)),
      sec('aud', svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'), 'Озвучка утверждения', it.audio),
      sec('fmt', svg('<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'), 'Другой формат ответов', it.override),
      btn('', svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(i), d.items.length >= MAX),
      btn('tf-del', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', () => removeItem(i)),
    );
    const side = el('div', 'tf-side');
    side.append(picks, tools);
    const lead = el('div', 'tf-lead');
    lead.append(grip, el('span', 'tf-n', `${i + 1}.`));
    head.append(lead, field, side);
    r.append(head);
    if (it.id === openId) r.append(body(it, i));
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

  function body(it, i) {
    const b = el('div', 'tf-body');
    if (openSec === 'exp') {
      const lab = el('div', 'tf-label tf-labelrow', 'Пояснение ученику');
      lab.append(help('Ученик увидит пояснение после проверки, если ответил на это утверждение верно, и в конце упражнения. Пока ответ неверный, пояснение скрыто, чтобы не выдать ответ. Баллы оно не меняет.'));
      const ex = el('textarea');
      ex.rows = 2;
      ex.placeholder = 'Почему это верно или неверно';
      ex.value = it.explanation || '';
      ex.setAttribute('aria-label', 'Пояснение');
      const fit2 = () => { ex.style.height = 'auto'; ex.style.height = ex.scrollHeight + 2 + 'px'; };
      ex.oninput = () => { it.explanation = ex.value; fit2(); save(); };
      b.append(lab, ex);
      setTimeout(fit2, 0);
    } else if (openSec === 'aud') {
      const al = el('div', 'tf-label tf-labelrow', 'Озвучка утверждения');
      al.append(help('Ученик нажимает значок динамика рядом с утверждением и слышит этот звук. Можно слушать сколько угодно раз.'));
      b.append(al);
      if (window.mediaPicker) b.append(window.mediaPicker('audio', () => it.audio || '', v => { it.audio = v; save(); }, 'Загрузить озвучку'));
    } else {
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
    }
    const nav = el('div', 'tf-nav');
    const arrow = (html, tip, dir, disabled) => {
      const x = el('button', 'tf-ib');
      x.type = 'button';
      x.innerHTML = html;
      x.title = tip;
      x.setAttribute('aria-label', tip);
      x.disabled = disabled;
      x.onclick = () => move(i, dir);
      return x;
    };
    nav.append(
      arrow(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', -1, i === 0),
      arrow(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', 1, i === d.items.length - 1),
    );
    b.append(nav);
    return b;
  }

  function addItem(index) {
    if (d.items.length >= MAX) return say(`Утверждений не больше ${MAX}. Разделите задание на два.`);
    const id = nextId('q', d.items.map(i => i.id));
    d.items.splice(index, 0, newItem(id));
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
    save();
    drawList();
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    save();
    drawList();
    const b = listBox.querySelector(`.tf-row[data-id="${d.items[j].id}"] .tf-nav .tf-ib:not(:disabled)`) || listBox.querySelector(`.tf-row[data-id="${d.items[j].id}"] .tf-ib:not(:disabled)`);
    if (b) b.focus();
  }

  // Удаление сразу; внизу таблицы плашка «Отменить»
  function removeItem(i) {
    const [it] = d.items.splice(i, 1);
    recheck.delete(it.id);
    const wasLast = !d.items.length;
    if (openId === it.id) openId = null;
    if (wasLast) d.items.push(newItem('q1'));
    undo = { it, i, wasLast };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { undo = null; if (undoBar && undoBar.isConnected) drawUndo(); }, 10000);
    save();
    drawList();
    drawUndo();
  }
  function undoRemove() {
    if (!undo) return;
    const { it, i, wasLast } = undo;
    undo = null;
    clearTimeout(undoTimer);
    if (wasLast) d.items.length = 0;
    d.items.splice(Math.min(i, d.items.length), 0, it);
    save();
    drawList();
    drawUndo();
  }
  function drawUndo() {
    undoBar.innerHTML = '';
    undoBar.hidden = !undo;
    if (!undo) return;
    const b = el('button', '', 'Отменить');
    b.type = 'button';
    b.onclick = undoRemove;
    undoBar.append(el('span', 'tf-muted', 'Утверждение удалено.'), b);
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

  return { create, demo, render, load, exportData, validate, unitCount, designOptions };
})();
