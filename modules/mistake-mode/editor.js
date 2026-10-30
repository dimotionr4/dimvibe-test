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

  // Состояние карточки (не в файле): режим «Текст / Ошибки», выбранное слово, открытые поля
  const ui = {};
  const state = t => ui[t.id] || (ui[t.id] = { mode: t.text.trim() ? 'errors' : 'text', sel: null, instr: !!t.instruction.trim(), open: {}, edited: false });
  const plural = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ошибка' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ошибки' : 'ошибок')}`;
  const iconBtn = (html, tip, fn, cls, disabled) => { const x = el('button', 'mm-ib' + (cls ? ' ' + cls : '')); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip); x.disabled = !!disabled; x.onclick = fn; return x; };
  const autoFit = (ta, min) => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, min || 0) + 'px'; };
  const CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';
  const COMMENT = '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>';

  function card(t, k) {
    const st = state(t);
    const box = el('section', 'mm-text mm-card');
    box.dataset.id = t.id;
    const headBox = el('div', 'mm-texthead');
    const mediaRow = el('div', 'mm-mediarow');
    const instr = el('textarea', 'mm-in mm-textins');
    instr.rows = 1;
    instr.placeholder = 'Инструкция к тексту (необязательно), например: Найдите три ошибки в предложениях';
    instr.value = t.instruction;
    instr.setAttribute('aria-label', `Инструкция к тексту ${k + 1}`);
    instr.oninput = () => { t.instruction = instr.value; autoFit(instr, 38); save(); };
    const body = el('div', 'mm-cbody');

    const ta = el('textarea', 'mm-in mm-body');
    ta.rows = 4;
    ta.placeholder = 'Вставьте или напишите текст с ошибками, например: She go to school every day.';
    ta.value = t.text;
    ta.setAttribute('aria-label', `Текст ${k + 1}`);
    const count = el('div', 'mm-muted mm-count');
    const showCount = () => { const n = wordCount(t); count.textContent = `Слов: ${n}/${MAX_WORDS}`; count.classList.toggle('mm-limit', n > MAX_WORDS); };
    ta.oninput = () => {
      const old = MistakeTokens.words(t.text);
      t.text = ta.value;
      MistakeTokens.reanchor(old, MistakeTokens.words(t.text), t.errors);
      st.edited = true;
      autoFit(ta, 96);
      showCount();
      save();
      updateCounter();
    };

    // ---- Шапка ----
    function drawHead() {
      headBox.innerHTML = '';
      const top = el('div', 'mm-texttop');
      top.append(el('b', '', `Текст ${k + 1}`));
      // Ползунок: влево режим «Текст», вправо «Ошибки»
      const seg = el('div', 'mm-sw');
      const swText = el('span', st.mode === 'text' ? 'on' : '', 'Текст');
      const swErr = el('span', st.mode === 'errors' ? 'on' : '', 'Ошибки');
      const swBtn = el('button', 'mm-switch' + (st.mode === 'errors' ? ' on' : ''));
      swBtn.type = 'button';
      swBtn.setAttribute('role', 'switch');
      swBtn.setAttribute('aria-checked', String(st.mode === 'errors'));
      swBtn.setAttribute('aria-label', 'Режим: текст или ошибки');
      swBtn.append(el('i'));
      swBtn.onclick = () => setMode(st.mode === 'errors' ? 'text' : 'errors');
      swText.onclick = () => setMode('text');
      swErr.onclick = () => setMode('errors');
      seg.append(swText, swBtn, swErr);
      top.append(seg);
      const media = el('span', 'mm-tools2');
      const tools = el('span', 'mm-tools2');
      const many = d.texts.length;
      media.append(
        iconBtn(svg(COMMENT), 'Инструкция к тексту', () => { st.instr = !st.instr; drawHead(); showInstr(); if (st.instr) instr.focus(); }, st.instr ? 'on' : ''),
        iconBtn(MediaUI.ICON.image, hasPic(t.image) ? 'Заменить картинку' : 'Добавить картинку', () => MediaUI.dialog('image', {
          replace: hasPic(t.image),
          done: p => { t.image.url = ''; t.image.media = p; mediaChanged(); },
          onLink: u => { t.image.media = ''; t.image.url = u; mediaChanged(); },
        }), hasPic(t.image) ? 'on' : ''),
        iconBtn(MediaUI.ICON.audio, t.audio ? 'Заменить звук' : 'Добавить звук', () => MediaUI.dialog('audio', { replace: !!t.audio, done: p => { t.audio = p; mediaChanged(); } }), t.audio ? 'on' : ''),
      );
      tools.append(
        iconBtn(svg('<path d="M6 15l6-6 6 6"/>'), 'Текст выше', () => move(k, -1), '', k === 0),
        iconBtn(svg('<path d="M6 9l6 6 6-6"/>'), 'Текст ниже', () => move(k, 1), '', k === many - 1),
        iconBtn(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать текст', () => duplicate(k), '', many >= MAX_TEXTS),
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
      } else tools.append(iconBtn(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить текст', () => { if (t.text.trim() || t.instruction.trim()) { delAsk = t.id; drawList(); } else remove(k); }, 'mm-del'));
      top.append(media, tools);
      headBox.append(top);
    }
    function showInstr() { instr.hidden = !st.instr; if (st.instr) autoFit(instr, 38); }
    function mediaChanged() { save(); drawMedia(); drawHead(); }
    function drawMedia() {
      mediaRow.innerHTML = '';
      if (hasPic(t.image)) mediaRow.append(MediaUI.imageControl(t.image, { save, change: () => { drawMedia(); drawHead(); } }));
      if (t.audio) mediaRow.append(MediaUI.picker('audio', () => t.audio || '', v => { t.audio = v; save(); if (!v) { drawMedia(); drawHead(); } }, 'Загрузить звук'));
      mediaRow.hidden = !mediaRow.childNodes.length;
    }
    function setMode(m) {
      if (st.mode === m) return;
      st.mode = m;
      if (m === 'errors' && st.edited) {
        st.edited = false;
        if (t.errors.some(e => e.broken)) say('Текст обновлён. Часть пометок потеряна: нажмите эти слова заново или удалите пометки.');
        else if (t.errors.length) say('Текст обновлён. Разметка неизменённых слов сохранена.');
      }
      drawHead();
      drawBody();
    }

    // ---- Тело: текст или ошибки ----
    function drawBody() {
      body.innerHTML = '';
      if (st.mode === 'text') {
        body.append(ta, count);
        showCount();
        setTimeout(() => autoFit(ta, 96), 0);
        return;
      }
      const pick = el('div', 'mm-pick');
      pick.setAttribute('role', 'group');
      pick.setAttribute('aria-label', 'Слова текста: нажмите на слово, чтобы настроить ошибку');
      const foot = el('div', 'mm-foot');
      const info = el('span', 'mm-muted');
      foot.append(el('span', 'mm-muted', 'Нажмите слово → настройте ошибку'), info);
      const lost = el('div', 'mm-lost');
      const table = el('div', 'mm-table');
      body.append(pick, foot, lost, table);

      const good = () => t.errors.filter(e => !e.broken).sort((a, b) => a.index - b.index);

      function refresh() {
        const n = wordCount(t);
        pick.innerHTML = '';
        if (!n) pick.append(el('span', 'mm-muted', 'Когда вы введёте текст, здесь можно будет нажимать на слова.'));
        MistakeTokens.split(t.text).forEach(p => {
          if (!p.word) { pick.append(document.createTextNode(p.s)); return; }
          const e = t.errors.find(x => !x.broken && x.index === p.i);
          const w = el('span', 'mm-w' + (e ? ' on' : '') + (e && e.id === st.sel ? ' cur' : ''), p.s);
          w.tabIndex = 0;
          w.setAttribute('role', 'button');
          w.setAttribute('aria-pressed', String(!!e));
          const go = () => choose(p.i, p.s);
          w.onclick = go;
          w.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } };
          pick.append(w);
        });
        info.textContent = `${n}/${MAX_WORDS} слов`;
        info.classList.toggle('mm-limit', n > MAX_WORDS);
        lost.innerHTML = '';
        t.errors.filter(e => e.broken).forEach(e => {
          const r = el('div', 'mm-lostrow');
          r.append(el('b', '', `«${e.word}»`), el('span', 'mm-bad', 'Пометка потеряна после правки текста: нажмите это слово в тексте заново или удалите пометку.'),
            iconBtn(svg(CLOSE), `Удалить пометку «${e.word}»`, () => { t.errors.splice(t.errors.indexOf(e), 1); save(); refresh(); }, 'mm-del'));
          lost.append(r);
        });
        lost.hidden = !lost.childNodes.length;
        drawTable();
        updateCounter();
      }

      // Нажатие на слово ставит пометку, повторное снимает; в таблице пометку снимает ластик
      function choose(i, word) {
        const have = t.errors.find(e => !e.broken && e.index === i);
        if (have) { // повторное нажатие снимает ошибку (вместе с введённым исправлением и пояснением)
          t.errors.splice(t.errors.indexOf(have), 1);
          if (st.sel === have.id) st.sel = null;
        } else {
          if (good().length >= MAX_ERRORS) return say(`В тексте не больше ${MAX_ERRORS} ошибок.`);
          const back = t.errors.find(e => e.broken && e.word === word); // потерянная пометка возвращается на это слово вместе с пояснением
          if (back) { back.index = i; delete back.broken; st.sel = back.id; }
          else {
            const e = { id: newErrId(), index: i, word, explanation: '', requiresCorrection: false, correction: '', alts: '' };
            t.errors.push(e);
            st.sel = e.id;
          }
        }
        save();
        refresh();
      }

      // Таблица «Исправления»: строка на ошибку; под строкой по желанию пояснение и допустимые варианты
      function drawTable() {
        const list = good();
        table.innerHTML = '';
        table.hidden = !list.length;
        if (!list.length) return;
        table.append(el('div', 'mm-ttitle', `Исправления · ${list.length}`));
        const cols = el('div', 'mm-row mm-cols');
        ['Ошибка', 'Действие ученика', 'Исправление'].forEach(c => cols.append(el('span', '', c)));
        cols.append(el('span'));
        table.append(cols);
        list.forEach(e => table.append(errBlock(e)));
      }

      function errBlock(e) {
        const blk = el('div', 'mm-eb' + (e.id === st.sel ? ' cur' : ''));
        const row = el('div', 'mm-row');
        const open = st.open[e.id] || (st.open[e.id] = {});
        row.append(el('b', 'mm-ew', e.word));
        // Ползунок «Найти / Исправить»: выключен — ученик только находит ошибку, включён — ещё вводит исправление
        const mode = el('label', 'mm-swrow');
        const sw = el('button', 'mm-switch' + (e.requiresCorrection ? ' on' : ''));
        sw.type = 'button';
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', String(!!e.requiresCorrection));
        sw.setAttribute('aria-label', `Ученик вводит исправление для «${e.word}»`);
        sw.append(el('i'));
        sw.onclick = () => { e.requiresCorrection = !e.requiresCorrection; save(); drawTable(); };
        mode.append(sw, el('span', e.requiresCorrection ? 'on' : '', e.requiresCorrection ? 'Исправить' : 'Найти'));
        mode.title = 'Найти — ученик только находит ошибку; Исправить — ещё вводит исправление';
        row.append(mode);
        const cell = el('div', 'mm-cell');
        if (e.requiresCorrection) {
          const main = el('input', 'mm-in');
          main.type = 'text';
          main.value = e.correction || '';
          main.setAttribute('aria-label', `Правильное исправление для «${e.word}»`);
          main.oninput = () => { e.correction = main.value; save(); };
          cell.append(main);
        } else cell.append(el('span', 'mm-muted', '—'));
        row.append(cell);
        const hasExpl = !!String(e.explanation || '').trim();
        const hasAlts = String(e.alts || '').trim() !== '';
        const tools = el('span', 'mm-tools2');
        tools.append(iconBtn(svg(COMMENT), 'Пояснение после ответа', () => { open.expl = !open.expl; drawTable(); }, (open.expl ? 'on' : '') + (hasExpl ? ' dot' : '')));
        if (e.requiresCorrection) tools.append(iconBtn(svg('<path d="M4 7h10M4 12h10M4 17h6M17 14v6M14 17h6"/>'), 'Также засчитывать', () => { open.alts = !open.alts; drawTable(); }, (open.alts ? 'on' : '') + (hasAlts ? ' dot' : '')));
        else tools.append(el('span', 'mm-ibgap'));
        tools.append(iconBtn(svg('<path d="M4 17l9-11 7 6-7 8H8z"/><path d="M9 20h11"/>'), 'Снять отметку', () => {
          t.errors.splice(t.errors.indexOf(e), 1);
          if (st.sel === e.id) st.sel = null;
          save();
          refresh();
        }));
        row.append(tools);
        blk.append(row);

        if (open.expl) {
          const x = el('div', 'mm-sub');
          x.append(el('div', 'mm-lab', 'Пояснение после ответа'));
          const ex = el('textarea', 'mm-in mm-expl');
          ex.rows = 2;
          ex.value = e.explanation || '';
          ex.setAttribute('aria-label', `Пояснение к ошибке «${e.word}»`);
          ex.oninput = () => { e.explanation = ex.value; autoFit(ex, 60); save(); };
          x.append(ex);
          blk.append(x);
          setTimeout(() => autoFit(ex, 60), 0);
        }
        if (open.alts && e.requiresCorrection) {
          // Допустимые ответы — плашки с крестиком; «+» открывает поле для нового (Enter или выход из поля — добавить)
          const alts = String(e.alts || '').split(/\r?\n/).filter(s => s.trim());
          const sync = () => { e.alts = alts.join('\n'); save(); };
          const x = el('div', 'mm-sub');
          const chips = el('div', 'mm-chips');
          const drawChips = adding => {
            chips.innerHTML = '';
            alts.forEach((s, j) => {
              const c = el('span', 'mm-chip');
              c.append(el('span', '', s), iconBtn(svg(CLOSE), `Убрать вариант «${s}»`, () => { alts.splice(j, 1); sync(); drawChips(); }, 'mm-chipx'));
              chips.append(c);
            });
            if (adding) {
              const inp = el('input', 'mm-in mm-chipin');
              inp.type = 'text';
              inp.placeholder = 'Допустимый ответ';
              inp.setAttribute('aria-label', 'Новый допустимый ответ');
              let done = false;
              const commit = () => { if (done) return; done = true; const v = inp.value.trim(); if (v) { alts.push(v); sync(); } drawChips(); };
              inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } else if (ev.key === 'Escape') { inp.value = ''; commit(); } };
              inp.onblur = commit;
              chips.append(inp);
              setTimeout(() => inp.focus(), 0);
            }
          };
          const head = el('div', 'mm-altrow');
          head.append(el('span', 'mm-lab', 'Также засчитывать'), iconBtn(svg('<path d="M12 5v14M5 12h14"/>'), 'Добавить допустимый вариант', () => drawChips(true)));
          drawChips();
          x.append(head, chips);
          blk.append(x);
        }
        return blk;
      }
      refresh();
    }

    drawHead();
    drawMedia();
    showInstr();
    drawBody();
    box.append(headBox, mediaRow, instr, body);
    return box;
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
