// Редактор модуля Image to Gaps: текст с пропусками, в которые ученик ставит картинки; банк картинок с ловушками.
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Разметка пропусков в тексте — общий движок core/gap-engine.js; картинки — core/media.js (загрузка, заглушки, ссылки).
const ImageToGapsEditor = (() => {
  const MAX_GAPS = 10;
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const { isGap, nextId } = GapEngine;
  let d, root, save, openGap = null, msgTimer = null, filter = 'all', trapOpen = false;
  let counter, msg, panelBox, gridBox, gapBar;

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const hasGap = id => !!d.gaps[id];
  const readDom = ed => GapEngine.readDom(ed, hasGap, 'ig-chip');
  const gapOrder = () => GapEngine.gapOrder(d.items);
  const isText = () => d.layout === 'text';
  const LAYOUT_NAME = { sentences: 'Отдельные предложения', text: 'Связный текст' };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="ig-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));

  const emptyImage = () => ({ media: '', url: '', stub: '', alt: '' });
  // Черновик картинки → то, что попадёт в файл ({media | stub | url, alt}); null, если картинки нет или она неправильная
  function imageOut(im, fallbackAlt) {
    if (!im) return null;
    const alt = clean(im.alt) || clean(fallbackAlt);
    const media = window.safeMediaPath && safeMediaPath(im.media);
    if (media) return { media, alt };
    if (im.stub && MEDIA_STUBS[im.stub]) return { stub: im.stub, alt };
    const url = typeof safeImageUrl === 'function' && safeImageUrl(im.url);
    return url ? { url, alt } : null;
  }
  // Звук попадает в файл только с правильным путём в хранилище
  const audioOut = path => { const m = window.safeMediaPath && safeMediaPath(path); return m ? { media: m } : null; };
  const imageKey = im => (im ? mediaKey(imageOut(im)) : '');

  function create(layout) {
    return { module: 'image_to_gaps', format: 1, layout: layout === 'text' ? 'text' : 'sentences', items: [{ id: 's1', parts: [''] }], gaps: {}, distractors: [], imageSize: 'm', imageFit: 'contain', showCorrect: false };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    openGap = null;
    trapOpen = false;
    if (typeof selBarHooks !== 'undefined') selBarHooks.add(updateGapBar);
    draw();
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.hidden = true; }, 6000);
  }

  function thumb(im, cls) {
    const src = im && mediaSrc(imageOut(im) || im);
    const box = el('span', 'ig-thumb' + (cls ? ' ' + cls : ''));
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = '';
      img.onerror = () => { box.classList.add('broken'); img.remove(); };
      box.append(img);
    }
    return box;
  }

  function draw() {
    root.innerHTML = '';
    root.className = 'ig-wrap';
    const tools = el('div', 'ig-tools');
    counter = el('span', 'ig-muted');
    const kind = el('span', 'ig-kindtag', LAYOUT_NAME[d.layout]);
    kind.title = 'Вид текста выбирается при создании упражнения и не меняется';
    const right = el('span', 'ig-right');
    right.append(kind, help((isText() ? 'Вставьте или наберите текст, Enter начинает новый абзац. ' : '')
      + `Выделите слово или фразу ${isText() ? 'в тексте' : 'в предложении'}: над ним появится кнопка «Пропуск». Нажмите на пропуск и выберите картинку: она станет правильным ответом. Неверные картинки (ловушки) добавляются в банк внизу. Размер картинки и вписывание — во вкладке «Дизайн», показ верных картинок в конце — в «Поведении».`));
    tools.append(counter, right);

    msg = el('div', 'ig-msg');
    msg.hidden = true;

    const left = el('div', 'ig-left');
    d.items.forEach((item, i) => left.append(sentence(item, i)));
    left.classList.toggle('ig-textmode', isText());
    const add = el('button', 'ig-add', isText() ? '+ Абзац' : '+ Предложение');
    add.onclick = () => addSentence(d.items.length);
    left.append(add, bankSection());
    panelBox = el('div', 'ig-panel-box');
    gapBar = el('div', 'selbar');
    gapBar.hidden = true;
    const gb = el('button', '');
    gb.innerHTML = svg('<rect x="3" y="8" width="18" height="8" rx="3.5"/>') + ' Пропуск';
    gb.onmousedown = e => e.preventDefault(); // иначе нажатие на кнопку сбросит выделение в тексте
    gb.onclick = () => { gapBar.hidden = true; makeGap(); };
    gapBar.append(gb);
    root.append(tools, msg, left, panelBox, gapBar);
    updateCounter();
    drawGrid();
    drawPanel();
  }

  function sentence(item, i) {
    const card = el('div', 'ig-sentence');
    if (!isText()) card.append(el('span', 'ig-num', `${i + 1}.`));
    const ed = el('div', 'ig-edit');
    ed.contentEditable = 'true';
    ed.dataset.item = item.id;
    ed.dataset.placeholder = isText() ? 'Введите или вставьте текст…' : 'Введите предложение…';
    fillDom(ed, item.parts);
    ed.oninput = () => {
      item.parts = readDom(ed);
      markEmpty(ed, item.parts);
      placePanel();
      updateCounter();
      drawGrid();
      if (openGap && !gapOrder().includes(openGap)) { openGap = null; drawPanel(); }
      save();
    };
    ed.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); addSentence(d.items.indexOf(item) + 1); }
      if ((e.ctrlKey || e.metaKey) && ['KeyB', 'KeyI', 'KeyU'].includes(e.code)) e.preventDefault();
    };
    ed.onpaste = e => {
      e.preventDefault();
      const raw = e.clipboardData.getData('text/plain');
      const paras = isText() ? raw.split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
      if (paras.length < 2) { document.execCommand('insertText', false, raw.replace(/\s+/g, ' ')); return; }
      document.execCommand('insertText', false, paras[0]);
      item.parts = readDom(ed);
      let at = d.items.indexOf(item) + 1;
      const ids = d.items.map(i => i.id);
      paras.slice(1).forEach(p => {
        const id = nextId('s', ids);
        ids.push(id);
        d.items.splice(at++, 0, { id, parts: [p] });
      });
      save();
      draw();
    };
    ed.ondrop = e => e.preventDefault();
    ed.onclick = e => {
      const c = e.target.closest('.ig-chip');
      if (!c) return;
      openGap = c.dataset.gap;
      markChips();
      drawPanel();
    };
    card.append(ed);
    // Озвучка предложения целиком: значок динамика открывает загрузку звука под предложением (серый — звука нет, цветной — есть)
    const aud = el('div', 'ig-aud');
    aud.hidden = !item.audio;
    const sound = el('button', 'ig-icon ig-sound', '🔊');
    sound.title = isText() ? 'Озвучка абзаца' : 'Озвучка предложения';
    sound.setAttribute('aria-label', sound.title);
    sound.classList.toggle('has', !!item.audio);
    sound.onclick = () => { aud.hidden = !aud.hidden; };
    if (window.mediaPicker) aud.append(window.mediaPicker('audio', () => item.audio || '', v => { item.audio = v; sound.classList.toggle('has', !!v); save(); }, isText() ? 'Загрузить озвучку абзаца' : 'Загрузить озвучку предложения'));
    card.append(sound);
    if (d.items.length > 1) {
      const del = el('button', 'ig-icon', '×');
      del.title = isText() ? 'Удалить абзац' : 'Удалить предложение';
      del.onclick = () => removeSentence(item);
      card.append(del);
    }
    card.append(aud);
    return card;
  }

  function fillDom(ed, parts) {
    ed.innerHTML = '';
    parts.forEach(p => ed.append(isGap(p) ? chip(p.gap) : document.createTextNode(p)));
    markEmpty(ed, parts);
  }
  const markEmpty = (ed, parts) => ed.classList.toggle('empty', !parts.some(p => isGap(p) || p.trim()));

  // Значок пропуска в тексте: миниатюра картинки или, пока картинки нет, выделенное слово
  function chip(id) {
    const g = d.gaps[id];
    const c = el('span', 'ig-chip' + (id === openGap ? ' open' : ''));
    c.contentEditable = 'false';
    c.dataset.gap = id;
    fillChip(c, g);
    return c;
  }
  function fillChip(c, g) {
    c.innerHTML = '';
    c.classList.toggle('empty', !imageKey(g.image));
    if (imageKey(g.image)) c.append(thumb(g.image, 'ig-chip-img'));
    else c.append(document.createTextNode(g.word || '?'));
  }
  const markChips = () => root.querySelectorAll('.ig-chip').forEach(c => c.classList.toggle('open', c.dataset.gap === openGap));
  const refreshChip = id => { const c = root.querySelector(`.ig-chip[data-gap="${id}"]`); if (c) fillChip(c, d.gaps[id]); };

  function updateCounter() {
    const n = gapOrder().length;
    counter.textContent = `Пропусков: ${n}/${MAX_GAPS}`;
    counter.classList.toggle('ig-limit', n >= MAX_GAPS);
  }

  function makeGap() {
    const r = GapEngine.fromSelection({ items: d.items, hasGap, editClass: 'ig-edit', chipClass: 'ig-chip', count: gapOrder().length, max: MAX_GAPS, newId: () => nextId('g', Object.keys(d.gaps)) });
    if (r.error) return say(r.error);
    d.gaps[r.id] = { word: r.text, image: emptyImage(), hint: '', audio: '', hintAudio: '' };
    openGap = r.id;
    save();
    draw();
  }

  // Пропуск снова становится обычным текстом (выделенное слово возвращается)
  function removeGap(id) {
    GapEngine.restoreText(d.items, id, d.gaps[id].word);
    delete d.gaps[id];
    openGap = null;
    save();
    draw();
  }

  function addSentence(index) {
    const id = nextId('s', d.items.map(i => i.id));
    d.items.splice(index, 0, { id, parts: [''] });
    save();
    draw();
    root.querySelector(`[data-item="${id}"]`).focus();
  }

  function removeSentence(item) {
    const ids = item.parts.filter(isGap).map(p => p.gap);
    if (ids.length && !confirm(`Удалить ${isText() ? 'абзац' : 'предложение'} вместе с пропусками (${ids.length})?`)) return;
    d.items.splice(d.items.indexOf(item), 1);
    ids.forEach(id => delete d.gaps[id]);
    if (ids.includes(openGap)) openGap = null;
    save();
    draw();
  }

  // Выбор картинки: заглушки, загрузка файла или медиатека (там же картинка по ссылке). onPick получает {media | stub | url}
  // multi — можно отметить несколько картинок из медиатеки сразу (onPick вызывается для каждой)
  function imagePicker(onPick, multi) {
    const box = el('div', 'ig-picker');
    const stubs = el('div', 'ig-stubs');
    Object.entries(MEDIA_STUBS).forEach(([k, label]) => {
      const b = el('button', 'ig-stub');
      b.type = 'button';
      b.title = 'Заглушка: ' + label;
      b.setAttribute('aria-label', 'Заглушка: ' + label);
      b.append(thumb({ stub: k }));
      b.onclick = () => onPick({ stub: k });
      stubs.append(b);
    });
    const stubHead = el('div', 'ig-label ig-labelrow', 'Заглушки');
    stubHead.append(help('Временные картинки проекта, пока нет общей медиатеки. Подойдут для пробы.'));
    box.append(stubHead, stubs);
    if (window.openMediaLibrary) {
      const lib = el('button', 'ig-lib', 'Из медиатеки');
      lib.type = 'button';
      // Картинка по ссылке выбирается в самой медиатеке («По ссылке», решение владельца 2026-10-24)
      lib.onclick = () => openMediaLibrary({ pick: true, multi: !!multi, kind: 'image', link: true, onPick: items => items.forEach(it => onPick(it.url ? { url: it.url } : { media: it.path, alt: it.name })) });
      box.append(lib);
    }
    if (window.mediaPicker) box.append(window.mediaPicker('image', () => '', path => onPick({ media: path }), 'Загрузить картинку', { library: false })); // медиатека — своя кнопка выше (с выбором нескольких картинок)
    return box;
  }

  // Панель пропуска стоит под самим пропуском и закрывается щелчком мимо
  function placePanel() {
    if (!openGap || !panelBox.firstChild) return;
    const c = root.querySelector(`.ig-chip[data-gap="${openGap}"]`);
    if (!c) return;
    const r = root.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const w = Math.min(340, r.width);
    panelBox.style.width = w + 'px';
    panelBox.style.left = Math.max(0, Math.min(cr.left - r.left, r.width - w)) + 'px';
    panelBox.style.top = (cr.bottom - r.top + 6) + 'px';
  }

  function closePanel() {
    if (!openGap) return;
    openGap = null;
    markChips();
    drawPanel();
  }

  function drawPanel() {
    panelBox.innerHTML = '';
    panelBox.hidden = !openGap;
    if (!openGap) return;
    const id = openGap, g = d.gaps[id];
    const p = el('div', 'ig-panel');
    const head = el('div', 'ig-panel-head');
    const del = el('button', 'ig-icon ig-trash');
    del.innerHTML = svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>');
    del.dataset.tip = 'Удалить пропуск: слово вернётся в текст';
    del.setAttribute('aria-label', 'Удалить пропуск');
    del.onclick = () => removeGap(id);
    const close = el('button', 'ig-icon', '×');
    close.title = 'Закрыть';
    close.onclick = closePanel;
    const tl = el('span', 'ig-panel-tools');
    tl.append(del, close);
    head.append(el('strong', '', `Пропуск ${gapOrder().indexOf(id) + 1}`), tl);

    const cur = el('div', 'ig-current');
    const noPic = el('div', 'ig-warn', 'Без картинки пропуск нельзя будет опубликовать.');
    const alt = el('input');
    alt.placeholder = g.word ? `Описание картинки (по умолчанию «${g.word}»)` : 'Описание картинки для незрячих учеников';
    alt.value = g.image.alt || '';
    alt.oninput = () => { g.image.alt = alt.value; save(); };
    const showCurrent = () => {
      cur.innerHTML = '';
      const has = !!imageKey(g.image);
      noPic.hidden = has;
      if (has) {
        cur.append(thumb(g.image, 'ig-cur-img'));
        const rm = el('button', '', 'Убрать картинку');
        rm.onclick = () => { g.image = emptyImage(); save(); refreshChip(id); drawGrid(); drawPanel(); };
        cur.append(rm);
      }
    };
    showCurrent();
    // «Заменить во всех связанных пропусках»: по умолчанию меняется только этот пропуск; другие пропуски с той же картинкой — по явному выбору
    const oldKey = imageKey(g.image);
    const others = oldKey ? gapOrder().filter(x => x !== id && imageKey(d.gaps[x].image) === oldKey) : [];
    let replaceAll = false;
    const allRow = el('label', 'ig-check');
    const allBox = el('input');
    allBox.type = 'checkbox';
    allBox.onchange = () => { replaceAll = allBox.checked; };
    allRow.append(allBox, document.createTextNode(` Заменить и в других пропусках с этой картинкой (${others.length})`));
    allRow.hidden = !others.length;
    const picker = imagePicker(im => {
      const apply = x => { x.image = { ...emptyImage(), ...im, alt: x.image.alt || im.alt || '' }; };
      apply(g);
      const changed = [id, ...(replaceAll ? others : [])];
      if (replaceAll) changed.slice(1).forEach(o => apply(d.gaps[o]));
      save(); // одно действие: Undo вернёт все пропуски сразу
      changed.forEach(refreshChip);
      drawGrid();
      if (replaceAll) { drawPanel(); return; }
      showCurrent();
      placePanel();
    });
    const pickHead = el('div', 'ig-label ig-labelrow', 'Правильная картинка');
    pickHead.append(help('Эта картинка — верный ответ пропуска. Она сама попадёт в банк картинок для ученика. Одну и ту же картинку можно поставить в несколько пропусков.'));

    // Подсказка и звуки (как в Fill Blanks): подсказка открывается после второй проверки; озвучка пропуска — значок динамика у ученика
    const hint = el('input');
    hint.placeholder = 'Подсказка (необязательно)';
    hint.value = g.hint || '';
    hint.oninput = () => { g.hint = hint.value; save(); };
    const hintHead = el('div', 'ig-label ig-labelrow', 'Подсказка для ученика');
    hintHead.append(help('Значок подсказки откроется у ученика после второй проверки, если пропуск останется неверным или пустым. Баллы и проверки подсказка не тратит. Не покажется, если проверка всего одна.'));
    const pickAudio = (field, label) => (window.mediaPicker ? window.mediaPicker('audio', () => g[field] || '', v => { g[field] = v; save(); placePanel(); }, label) : document.createTextNode(''));
    const hintAudioHead = el('div', 'ig-label ig-labelrow', 'Звук подсказки');
    hintAudioHead.append(help('Звучит в окне подсказки (после второй проверки), вместе с текстом подсказки или вместо него.'));
    const voiceHead = el('div', 'ig-label ig-labelrow', 'Озвучка пропуска');
    voiceHead.append(help('Ученик нажимает значок динамика в правом верхнем углу пропуска и слышит этот звук. Он не зависит от проверок и подсказок.'));
    p.append(head, cur, noPic, alt, pickHead, allRow, picker, hintHead, hint, hintAudioHead, pickAudio('hintAudio', 'Загрузить звук подсказки'), voiceHead, pickAudio('audio', 'Загрузить озвучку'));
    panelBox.append(p);
    placePanel();
  }

  function updateGapBar() {
    if (!root || !root.isConnected || !gapBar) return;
    const s = getSelection();
    const inEd = n => n && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n).closest('.ig-edit');
    if (!s.rangeCount || s.isCollapsed || !inEd(s.anchorNode) || !root.contains(s.anchorNode) || !s.toString().trim()) { gapBar.hidden = true; return; }
    placeSelBar(gapBar, root, s.getRangeAt(0));
  }
  if (!window.__igOutside) {
    window.__igOutside = true;
    addEventListener('pointerdown', e => {
      if (openGap && root && root.isConnected && !e.target.closest('.ig-panel-box, .ig-chip, .help, .helpbub, .media-pick, .ml')) closePanel();
    });
    addEventListener('resize', () => placePanel());
  }

  // Банк картинок: ответы пропусков (серые, добавляются сами) и ловушки; фильтры «Все / Ответы / Ловушки» (метки видит только автор)
  function bankSection() {
    const box = el('div', 'ig-bank');
    const head = el('div', 'ig-labelrow');
    head.append(el('h3', '', 'Банк картинок'),
      help('Правильные картинки пропусков попадают в банк сами (с пунктирной рамкой). Ловушки — неверные картинки: добавьте их кнопкой «+ Ловушка». Ученик видит все картинки вперемешку, без пометок.'));
    const fl = el('span', 'ig-seg ig-filter');
    [['all', 'Все'], ['answers', 'Ответы'], ['traps', 'Ловушки']].forEach(([v, label]) => {
      const b = el('button', filter === v ? 'active' : '', label);
      b.setAttribute('aria-pressed', String(filter === v));
      b.onclick = () => { filter = v; fl.querySelectorAll('button').forEach((x, i) => { const on = ['all', 'answers', 'traps'][i] === v; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); drawGrid(); };
      fl.append(b);
    });
    head.append(fl);
    gridBox = el('div', 'ig-grid');
    const open = el('button', 'ig-add', '+ Ловушка');
    const trapBox = el('div', 'ig-trapbox');
    trapBox.hidden = !trapOpen;
    open.hidden = trapOpen;
    trapBox.append(imagePicker(im => {
      d.distractors.push({ id: nextId('t', d.distractors.map(t => t.id)), image: { ...emptyImage(), ...im } });
      trapOpen = false;
      save();
      drawGrid();
      trapBox.hidden = true;
      open.hidden = false;
    }, true));
    const cancel = el('button', '', 'Отмена');
    cancel.onclick = () => { trapOpen = false; trapBox.hidden = true; open.hidden = false; };
    trapBox.append(cancel);
    open.onclick = () => { trapOpen = true; trapBox.hidden = false; open.hidden = true; };
    box.append(head, gridBox, open, trapBox);
    return box;
  }

  function drawGrid() {
    gridBox.innerHTML = '';
    if (filter !== 'traps') {
      gapOrder().forEach(id => {
        const g = d.gaps[id];
        const c = el('button', 'ig-card ig-auto');
        c.type = 'button';
        c.title = imageKey(g.image) ? 'Ответ пропуска: меняется в самом пропуске' : 'У пропуска ещё нет картинки';
        c.append(thumb(g.image));
        c.onclick = () => { openGap = id; markChips(); drawPanel(); const ch = root.querySelector(`.ig-chip[data-gap="${id}"]`); if (ch) ch.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
        gridBox.append(c);
      });
    }
    if (filter !== 'answers') {
      d.distractors.forEach((t, i) => {
        const c = el('span', 'ig-card ig-trap');
        c.append(thumb(t.image));
        const x = el('button', 'ig-card-x', '×');
        x.title = 'Убрать ловушку';
        x.setAttribute('aria-label', 'Убрать ловушку');
        x.onclick = () => { d.distractors.splice(i, 1); save(); drawGrid(); };
        c.append(x);
        gridBox.append(c);
      });
    }
    if (!gridBox.firstChild) gridBox.append(el('span', 'ig-muted', filter === 'traps' ? 'Ловушек пока нет.' : 'Пока пусто: сделайте пропуск и выберите для него картинку.'));
  }

  // Данные для файла упражнения: без пустых предложений и стёртых из текста пропусков
  function exportData(draft) {
    const items = draft.items
      .filter(i => i.parts.some(p => isGap(p) || p.trim()))
      .map(i => ({
        id: i.id,
        parts: i.parts.map((p, k) => {
          if (isGap(p)) return p;
          let s = p.replace(/\s+/g, ' ');
          if (k === 0) s = s.trimStart();
          if (k === i.parts.length - 1) s = s.trimEnd();
          return s;
        }).filter(p => p !== ''),
        ...(audioOut(i.audio) ? { audio: audioOut(i.audio) } : {}),
      }));
    const gaps = {};
    items.forEach(i => i.parts.filter(isGap).forEach(p => {
      const g = draft.gaps[p.gap];
      const image = imageOut(g.image, g.word);
      gaps[p.gap] = { ...(image ? { image } : {}), ...(clean(g.hint) ? { hint: clean(g.hint) } : {}), ...(audioOut(g.audio) ? { audio: audioOut(g.audio) } : {}), ...(audioOut(g.hintAudio) ? { hintAudio: audioOut(g.hintAudio) } : {}) };
    }));
    const distractors = draft.distractors.map(t => imageOut(t.image)).filter(Boolean);
    return {
      module: 'image_to_gaps', format: 1, layout: draft.layout, items, gaps, distractors,
      imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm',
      imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain',
      ...(draft.showCorrect ? { showCorrect: true } : {}),
    };
  }

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const ex = exportData(draft), errors = [], warnings = [];
    const order = ex.items.flatMap(i => i.parts.filter(isGap).map(p => p.gap));
    if (!order.length) errors.push('Нет ни одного пропуска.');
    if (order.length > MAX_GAPS) errors.push(`Пропусков больше ${MAX_GAPS}. Разделите задание на два.`);
    order.forEach((id, n) => {
      if (ex.gaps[id].image) return;
      const im = draft.gaps[id].image || {};
      if (!im.media && !im.stub && im.url && im.url.trim()) errors.push(`Пропуск ${n + 1}: ссылка на картинку должна быть полным адресом с https://.`);
      else errors.push(`Пропуск ${n + 1}: не выбрана правильная картинка.`);
    });
    const keys = order.map(id => (ex.gaps[id].image ? mediaKey(ex.gaps[id].image) : ''));
    ex.distractors.forEach((t, k) => {
      const at = keys.indexOf(mediaKey(t));
      if (at >= 0) warnings.push(`Ловушка ${k + 1} — та же картинка, что верная в пропуске ${at + 1}. В этом пропуске её засчитают как верную, в остальных — нет.`);
    });
    if (order.length && !ex.distractors.length) warnings.push('Нет ловушек: выбор будет слишком лёгким.');
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика. Недостающее заполняется, пропуски без данных выбрасываются
  function load(file) {
    if (!Array.isArray(file.items)) throw new Error('В файле нет предложений.');
    const imageIn = im => {
      const r = emptyImage();
      if (im && typeof im === 'object') {
        r.media = safeMediaPath(im.media) || '';
        r.stub = MEDIA_STUBS[im.stub] ? im.stub : '';
        r.url = typeof im.url === 'string' ? im.url : '';
        r.alt = String(im.alt || '');
      }
      return r;
    };
    const gaps = {};
    Object.entries(file.gaps || {}).forEach(([id, g]) => {
      const image = imageIn(g && g.image);
      gaps[id] = { word: image.alt, image, hint: String((g && g.hint) || ''), audio: (g && g.audio && g.audio.media) || '', hintAudio: (g && g.hintAudio && g.hintAudio.media) || '' };
    });
    const items = file.items.map((i, k) => {
      const parts = (Array.isArray(i.parts) ? i.parts : []).filter(p => typeof p === 'string' || (p && gaps[p.gap]));
      return { id: String(i.id || 's' + (k + 1)), parts: parts.length ? parts : [''], audio: (i.audio && i.audio.media) || '' };
    });
    return {
      ...create(),
      layout: file.layout === 'text' ? 'text' : 'sentences',
      items: items.length ? items : create().items,
      gaps,
      distractors: (Array.isArray(file.distractors) ? file.distractors : []).map((im, k) => ({ id: 't' + (k + 1), image: imageIn(im) })),
      imageSize: SIZES[file.imageSize] ? file.imageSize : 'm',
      imageFit: FITS[file.imageFit] ? file.imageFit : 'contain',
      showCorrect: file.showCorrect === true,
    };
  }

  // Настройки модуля во вкладке «Дизайн»: значки размера и вписывания картинки (рисует ядро, поля лежат в черновике)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'imageSize', label: 'Размер картинки', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }

  // Настройки модуля во вкладке «Поведение»: переключатель «Вкл / Выкл»
  function behaviorOptions(draft) {
    return [{ field: 'showCorrect', label: 'Показать верные картинки в конце', value: !!draft.showCorrect,
      help: 'После завершения у ученика появится переключатель: для неверных пропусков он увидит рядом верную картинку. Баллы и число проверок не меняются. По умолчанию выключено.' }];
  }

  return { create, render, load, exportData, validate, designOptions, behaviorOptions };
})();
