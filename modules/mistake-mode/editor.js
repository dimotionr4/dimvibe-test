// Редактор модуля Mistake Mode: тексты, в которых автор нажатием помечает слова-ошибки. У текста и у ошибки устойчивый ID (t1, e1…).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Всё, что видит автор, лежит в черновике (кроме удаляемого текста), поэтому отмена и повтор ядра работают сами.
const MistakeModeEditor = (() => {
  const MAX_TEXTS = 5, MAX_WORDS = 150, MAX_ERRORS = 15; // текстов в упражнении, слов в тексте, ошибок в тексте
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null;
  let msg, counter, listBox, addBtn;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="mm-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));
  const wordCount = t => MistakeTokens.words(t.text).length;
  const allErrors = () => d.texts.flatMap(t => t.errors);

  const newText = (id, text) => ({ id, instruction: '', text: text || '', errors: [] });
  function create() {
    return { module: 'mistake_mode', format: 1, texts: [newText('t1')] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
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
    root.className = 'mm-wrap';
    const tools = el('div', 'mm-tools');
    counter = el('span', 'mm-muted');
    const right = el('span', 'mm-right');
    right.append(help(`Вставьте текст, в котором есть неверные слова, и нажмите на каждое такое слово ниже: оно станет ошибкой. Ученик увидит обычный текст без подсказок и сам найдёт эти слова нажатием. Одна найденная ошибка — один балл. В тексте до ${MAX_WORDS} слов и до ${MAX_ERRORS} ошибок, текстов в упражнении до ${MAX_TEXTS}.`));
    tools.append(counter, right);
    msg = el('div', 'mm-msg');
    msg.hidden = true;
    listBox = el('div', 'mm-texts');
    addBtn = el('button', 'mm-add', '+ Текст');
    addBtn.type = 'button';
    addBtn.onclick = addText;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    const n = allErrors().length;
    counter.textContent = d.texts.length > 1 ? `Текстов: ${d.texts.length}/${MAX_TEXTS} · ошибок: ${n}` : `Ошибок: ${n}`;
    addBtn.disabled = d.texts.length >= MAX_TEXTS;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.texts.forEach((t, k) => listBox.append(card(t, k)));
    updateCounter();
  }

  const newTextId = () => nextId('t', d.texts.map(t => t.id));
  const newErrId = () => nextId('e', allErrors().map(e => e.id));

  function card(t, k) {
    const many = d.texts.length > 1;
    const box = el('section', 'mm-text' + (many ? ' multi' : ''));
    box.dataset.id = t.id;
    if (many) box.append(head(t, k));

    const ta = el('textarea', 'mm-in mm-body');
    ta.rows = 4;
    ta.placeholder = 'Вставьте или напишите текст с ошибками, например: She go to school every day.';
    ta.value = t.text;
    ta.setAttribute('aria-label', `Текст ${k + 1}`);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 96) + 'px'; };
    const count = el('div', 'mm-muted mm-count');
    const pick = el('div', 'mm-pick');
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', 'Слова текста: нажмите на слово, чтобы пометить его как ошибку');
    const errs = el('div', 'mm-errs');

    function refresh() {
      const n = wordCount(t);
      count.textContent = `Слов: ${n}/${MAX_WORDS}`;
      count.classList.toggle('mm-limit', n > MAX_WORDS);
      pick.innerHTML = '';
      const parts = MistakeTokens.split(t.text);
      if (!n) pick.append(el('span', 'mm-muted', 'Когда вы введёте текст, здесь можно будет нажимать на слова.'));
      parts.forEach(p => {
        if (!p.word) { pick.append(document.createTextNode(p.s)); return; }
        const on = t.errors.some(e => !e.broken && e.index === p.i);
        const w = el('span', 'mm-w' + (on ? ' on' : ''), p.s);
        w.tabIndex = 0;
        w.setAttribute('role', 'button');
        w.setAttribute('aria-pressed', String(on));
        const go = () => toggle(t, p.i, p.s, refresh);
        w.onclick = go;
        w.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        pick.append(w);
      });
      errs.innerHTML = '';
      t.errors.slice().sort((a, b) => a.index - b.index).forEach(e => errs.append(errRow(t, e, refresh)));
      updateCounter();
    }

    ta.oninput = () => {
      const old = MistakeTokens.words(t.text);
      t.text = ta.value;
      MistakeTokens.reanchor(old, MistakeTokens.words(t.text), t.errors);
      fit();
      save();
      refresh();
    };
    setTimeout(fit, 0);
    box.append(ta, count, el('p', 'mm-muted mm-hint', 'Нажмите на слово, чтобы пометить его как ошибку. Повторное нажатие снимает пометку.'), pick, errs);
    refresh();
    return box;
  }

  function toggle(t, i, word, refresh) {
    const have = t.errors.findIndex(e => !e.broken && e.index === i);
    if (have >= 0) t.errors.splice(have, 1);
    else {
      if (t.errors.filter(e => !e.broken).length >= MAX_ERRORS) return say(`В тексте не больше ${MAX_ERRORS} ошибок.`);
      const lost = t.errors.find(e => e.broken && e.word === word); // потерянная пометка возвращается на это слово вместе с пояснением
      if (lost) { lost.index = i; delete lost.broken; }
      else t.errors.push({ id: newErrId(), index: i, word, explanation: '' });
    }
    save();
    refresh();
  }

  function errRow(t, e, refresh) {
    const r = el('div', 'mm-err' + (e.broken ? ' broken' : ''));
    r.dataset.id = e.id;
    r.append(el('b', 'mm-errw', `«${e.word}»`));
    if (e.broken) r.append(el('span', 'mm-bad', 'Пометка потеряна после правки текста: нажмите на это слово в тексте заново или удалите пометку.'));
    else {
      const ta = el('input', 'mm-in mm-expl');
      ta.type = 'text';
      ta.placeholder = 'Пояснение (необязательно)';
      ta.value = e.explanation || '';
      ta.setAttribute('aria-label', `Пояснение к ошибке «${e.word}»`);
      ta.oninput = () => { e.explanation = ta.value; save(); };
      r.append(ta);
    }
    const del = el('button', 'mm-ib mm-del');
    del.type = 'button';
    del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    del.title = 'Снять пометку';
    del.setAttribute('aria-label', `Снять пометку с «${e.word}»`);
    del.onclick = () => { t.errors.splice(t.errors.indexOf(e), 1); save(); refresh(); };
    r.append(del);
    return r;
  }

  function head(t, k) {
    const h = el('div', 'mm-texthead');
    const top = el('div', 'mm-texttop');
    top.append(el('b', '', `Текст ${k + 1}`));
    const tools = el('span', 'mm-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'mm-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', текст ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Текст выше', () => move(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Текст ниже', () => move(k, 1), k === d.texts.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать текст', () => duplicate(k), d.texts.length >= MAX_TEXTS),
    );
    if (delAsk === t.id) {
      const q = el('span', 'mm-ask');
      const yes = el('button', 'mm-yes', 'Удалить текст');
      yes.type = 'button';
      yes.onclick = () => remove(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить текст', () => { if (t.text.trim() || t.instruction.trim()) { delAsk = t.id; drawList(); } else remove(k); }));
    top.append(tools);
    const ins = el('textarea', 'mm-in mm-textins');
    ins.rows = 1;
    ins.placeholder = 'Инструкция к тексту (необязательно), например: Найдите три ошибки в предложениях';
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
    if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const ta = last.querySelector('.mm-body'); if (ta) ta.focus({ preventScroll: true }); }
  }
  function move(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.texts.length) return;
    [d.texts[k], d.texts[j]] = [d.texts[j], d.texts[k]];
    save();
    drawList();
  }
  // Копия получает новые ID текста и ошибок
  function duplicate(k) {
    if (d.texts.length >= MAX_TEXTS) return say(`Текстов не больше ${MAX_TEXTS}.`);
    const copy = JSON.parse(JSON.stringify(d.texts[k]));
    copy.id = newTextId();
    const ids = allErrors().map(e => e.id);
    copy.errors.forEach(e => { e.id = nextId('e', ids); ids.push(e.id); });
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
    errors: t.errors.filter(e => !e.broken).slice().sort((a, b) => a.index - b.index)
      .map(e => ({ id: e.id, index: e.index, word: e.word, ...(String(e.explanation || '').trim() ? { explanation: String(e.explanation).trim() } : {}) })),
  });
  function exportData(draft) {
    return { module: 'mistake_mode', format: 1, texts: draft.texts.map(textOut) };
  }

  const unitCount = draft => draft.texts.reduce((n, t) => n + t.errors.length, 0);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const many = draft.texts.length > 1;
    if (!draft.texts.length) errors.push('Нет ни одного текста.');
    if (draft.texts.length > MAX_TEXTS) errors.push(`Текстов больше ${MAX_TEXTS}.`);
    draft.texts.forEach((t, k) => {
      const pre = many ? `Текст ${k + 1}: ` : '';
      const n = wordCount(t), good = t.errors.filter(e => !e.broken).length;
      if (!t.text.trim() || !n) { errors.push(`${pre}текст пустой.`); return; }
      if (n > MAX_WORDS) errors.push(`${pre}в тексте ${n} слов, а можно не больше ${MAX_WORDS}. Разделите его на два текста.`);
      if (t.errors.some(e => e.broken)) errors.push(`${pre}есть потерянные пометки после правки текста: пометьте слова заново или снимите пометки.`);
      if (!good) errors.push(`${pre}не помечено ни одной ошибки.`);
      if (good > MAX_ERRORS) errors.push(`${pre}ошибок больше ${MAX_ERRORS}.`);
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика; пометка, не совпавшая со словом текста, считается потерянной
  function load(file) {
    if (!Array.isArray(file.texts) || !file.texts.length) throw new Error('В файле нет текстов.');
    let n = 0;
    const texts = file.texts.slice(0, MAX_TEXTS).map((s, k) => {
      const text = String((s && s.text) || '');
      const w = MistakeTokens.words(text);
      return {
        id: String((s && s.id) || 't' + (k + 1)), instruction: String((s && s.instruction) || ''), text,
        errors: (Array.isArray(s && s.errors) ? s.errors : []).map(e => {
          const out = { id: String((e && e.id) || 'e' + (++n)), index: Number(e && e.index) || 0, word: String((e && e.word) || ''), explanation: String((e && e.explanation) || '') };
          if (w[out.index] !== out.word) out.broken = true;
          return out;
        }),
      };
    });
    return { ...create(), texts };
  }

  return { create, render, load, exportData, validate, unitCount };
})();
