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

  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const VIEWS = { one: 'По одному тексту', list: 'Все тексты сразу' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = String(im.alt || '').trim().replace(/\s+/g, ' '), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };

  const newText = (id, text) => ({ id, instruction: '', text: text || '', image: emptyImage(), audio: '', errors: [] });
  function create() {
    return { module: 'mistake_mode', format: 1, view: 'one', imageSize: 'm', imageFit: 'contain', texts: [newText('t1')] };
  }

  // Демо-пример (демо-режим в «Настройках», core/demo.js): два текста — только найти ошибки и с исправлением, картинка и звук.
  // Ошибка привязана к номеру слова: номер ищется по тому же делению на слова, что у редактора и плеера
  function demo() {
    let n = 0;
    const text = (id, body, wrong, extra) => {
      const words = MistakeTokens.words(body);
      const errors = wrong.map(([word, explanation, correction]) => ({ id: 'e' + (++n), index: words.indexOf(word), word, explanation,
        requiresCorrection: !!correction, correction: correction || '', alts: '' }));
      return { ...newText(id, body), errors, ...(extra || {}) };
    };
    return { ...create(), instruction: DimDemo.instruction('Найдите и отметьте ошибки в тексте.'), texts: [
      text('t1', 'Yesterday I goed to the park with my freinds and we play football.',
        [['goed', 'Неправильный глагол: went'], ['freinds', 'Правильно: friends'], ['play', 'Прошедшее время: played']],
        { instruction: 'Найдите три ошибки.', image: { ...emptyImage(), media: DimDemo.IMG.house }, audio: DimDemo.AUD.a }),
      text('t2', 'She have two cats and a dog.', [['have', 'После she — has', 'has']],
        { instruction: 'Найдите ошибку и исправьте её.' }),
    ] };
  }

  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    if (!FITS[d.imageFit]) d.imageFit = 'contain';
    if (!VIEWS[d.view]) d.view = 'one';
    d.texts.forEach(t => {
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

    // Картинка текста — большая плитка слева от текста, звук — перед полем текста (наброски владельца 2026-10-27…28, core/mediabar.js)
    const audio = MediaUI.picker('audio', () => t.audio || '', v => { t.audio = v; save(); }, 'Загрузить звук');
    const pic = MediaUI.imageControl(t.image, { save, after: audio, audioOutside: true, big: true });

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
    box.append(MediaUI.side(pic, MediaUI.withAudio(audio, ta, true), count), el('p', 'mm-muted mm-hint', 'Нажмите на слово, чтобы пометить его как ошибку. Повторное нажатие снимает пометку.'), pick, errs);
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
      else t.errors.push({ id: newErrId(), index: i, word, explanation: '', requiresCorrection: false, correction: '', alts: '' });
    }
    save();
    refresh();
  }

  function errRow(t, e, refresh) {
    const r = el('div', 'mm-err' + (e.broken ? ' broken' : ''));
    r.dataset.id = e.id;
    const line = el('div', 'mm-errline');
    line.append(el('b', 'mm-errw', `«${e.word}»`));
    if (e.broken) line.append(el('span', 'mm-bad', 'Пометка потеряна после правки текста: нажмите на это слово в тексте заново или удалите пометку.'));
    else {
      const ta = el('input', 'mm-in mm-expl');
      ta.type = 'text';
      ta.placeholder = 'Пояснение (необязательно)';
      ta.value = e.explanation || '';
      ta.setAttribute('aria-label', `Пояснение к ошибке «${e.word}»`);
      ta.oninput = () => { e.explanation = ta.value; save(); };
      line.append(ta);
    }
    const del = el('button', 'mm-ib mm-del');
    del.type = 'button';
    del.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    del.title = 'Снять пометку';
    del.setAttribute('aria-label', `Снять пометку с «${e.word}»`);
    del.onclick = () => { t.errors.splice(t.errors.indexOf(e), 1); save(); refresh(); };
    line.append(del);
    r.append(line);
    if (!e.broken) r.append(fixBox(e));
    return r;
  }

  // Исправление: включатель и поля ответов. Выключение не стирает введённое (поля просто скрываются)
  function fixBox(e) {
    const box = el('div', 'mm-fix');
    const lab = el('label', 'mm-fixon');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!e.requiresCorrection;
    lab.append(cb, document.createTextNode(' Ученик должен ввести исправление'));
    box.append(lab);
    const fields = el('div', 'mm-fixfields');
    fields.hidden = !e.requiresCorrection;
    const main = el('input', 'mm-in');
    main.type = 'text';
    main.placeholder = 'Правильное исправление, например: goes';
    main.value = e.correction || '';
    main.setAttribute('aria-label', `Правильное исправление для «${e.word}»`);
    main.oninput = () => { e.correction = main.value; save(); };
    const alts = el('textarea', 'mm-in mm-alts');
    alts.rows = 1;
    alts.placeholder = 'Другие допустимые варианты, каждый с новой строки (необязательно)';
    alts.value = e.alts || '';
    alts.setAttribute('aria-label', `Допустимые варианты для «${e.word}»`);
    const fit = () => { alts.style.height = 'auto'; alts.style.height = alts.scrollHeight + 2 + 'px'; };
    alts.oninput = () => { e.alts = alts.value; fit(); save(); };
    fields.append(main, alts);
    cb.onchange = () => { e.requiresCorrection = cb.checked; fields.hidden = !cb.checked; save(); if (cb.checked) { fit(); main.focus(); } };
    box.append(fields);
    return box;
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
    ...(imageOut(t.image) ? { image: imageOut(t.image) } : {}),
    ...(audioOut(t.audio) ? { audio: audioOut(t.audio) } : {}),
    text: t.text.replace(/\r\n?/g, '\n').trim(),
    errors: t.errors.filter(e => !e.broken).slice().sort((a, b) => a.index - b.index)
      .map(errOut),
  });
  // Исправление пишется в файл, только пока оно включено; повторы основного ответа среди допустимых отбрасываются
  const altList = e => {
    const main = String(e.correction || '').trim().toLowerCase();
    const seen = new Set([main]);
    return String(e.alts || '').split(/\r?\n/).map(s => s.trim()).filter(s => { const k = s.toLowerCase(); if (!s || seen.has(k)) return false; seen.add(k); return true; });
  };
  const errOut = e => {
    const out = { id: e.id, index: e.index, word: e.word };
    if (String(e.explanation || '').trim()) out.explanation = String(e.explanation).trim();
    if (e.requiresCorrection) {
      out.requiresCorrection = true;
      out.correction = String(e.correction || '').trim();
      const alts = altList(e);
      if (alts.length) out.alternatives = alts;
    }
    return out;
  };
  function exportData(draft) {
    return {
      module: 'mistake_mode', format: 1,
      ...(draft.view === 'list' ? { view: 'list' } : {}),
      ...(draft.texts.some(t => imageOut(t.image)) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm', imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain' } : {}),
      texts: draft.texts.map(textOut),
    };
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
      const im = t.image;
      if (im && !safeMediaPath(im.media) && String(im.url || '').trim() && !safeImageUrl(im.url)) errors.push(`${pre}ссылка на картинку должна быть полным адресом с https://.`);
      if (good > MAX_ERRORS) errors.push(`${pre}ошибок больше ${MAX_ERRORS}.`);
      t.errors.filter(e => !e.broken && e.requiresCorrection && !String(e.correction || '').trim()).forEach(e => errors.push(`${pre}у ошибки «${e.word}» включено исправление, но не указан правильный вариант.`));
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
      const im = s && s.image;
      return {
        id: String((s && s.id) || 't' + (k + 1)), instruction: String((s && s.instruction) || ''), text,
        image: { media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') },
        audio: (s && s.audio && safeMediaPath(s.audio.media)) || '',
        errors: (Array.isArray(s && s.errors) ? s.errors : []).map(e => {
          const out = { id: String((e && e.id) || 'e' + (++n)), index: Number(e && e.index) || 0, word: String((e && e.word) || ''), explanation: String((e && e.explanation) || ''),
            requiresCorrection: !!(e && e.requiresCorrection), correction: String((e && e.correction) || ''), alts: Array.isArray(e && e.alternatives) ? e.alternatives.join('\n') : '' };
          if (w[out.index] !== out.word) out.broken = true;
          return out;
        }),
      };
    });
    return { ...create(), view: file.view === 'list' ? 'list' : 'one', imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain', texts };
  }

  // Настройки во вкладке «Дизайн» (рисует ядро): показ текстов; размер картинок и вписывание — только если в упражнении есть картинки
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    const view = { field: 'view', label: 'Показ текстов', value: VIEWS[draft.view] ? draft.view : 'one', names: VIEWS,
      icons: { one: sq('<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 12h6"/>'), list: sq('<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>') } };
    if (!draft.texts.some(t => hasPic(t.image))) return [view];
    return [view,
      { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }

  return { create, demo, render, load, exportData, validate, unitCount, designOptions };
})();
