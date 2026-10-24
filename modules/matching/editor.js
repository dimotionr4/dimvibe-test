// Редактор модуля Matching: пары «слева — справа», у каждой пары устойчивый ID (p1, p2…).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Всё, что видит автор, лежит в черновике (кроме удаляемой строки), поэтому отмена и повтор ядра работают сами.
const MatchingEditor = (() => {
  const MAX = 10;
  const MODES = { standard: 'Стандартный: верные пары уходят вниз', lines_pair_colors: 'Линии: все карточки на месте, одна проверка' };
  const ALIGNS = { auto: 'Авто: короткие по центру, длинные слева', center: 'По центру', left: 'По левому краю' };
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, msgTimer = null, drag = null, openId = null; // openId — пара с раскрытой панелью картинок и звука
  let msg, counter, listBox, addBtn;

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  const same = (x, y) => clean(x).toLowerCase() === clean(y).toLowerCase();
  const SIZES = { s: 'Малый (S)', m: 'Средний (M)', l: 'Большой (L)' };
  const FITS = { contain: 'Вписать целиком', cover: 'Заполнить рамку' };
  const emptyImage = () => ({ media: '', url: '', alt: '' });
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  const hasMedia = it => ['left', 'right'].some(s => hasPic(it[s + 'Image']) || it[s + 'Audio']);
  const filled = it => clean(it.left) || clean(it.right) || hasMedia(it);
  // Что ученик видит и слышит на карточке: по этому ключу ищутся повторы внутри столбца (текст, картинка, звук)
  const faceKey = (it, s) => {
    const im = it[s + 'Image'];
    return [clean(it[s]).toLowerCase(), hasPic(im) ? (safeMediaPath(im.media) || safeImageUrl(im.url)) : '', safeMediaPath(it[s + 'Audio']) || ''].join('|');
  };
  const hasFace = (it, s) => !!clean(it[s]) || hasPic(it[s + 'Image']);
  // Файл упражнения: картинка {media | url, alt} или нет; звук {media} или нет
  const imageOut = im => {
    if (!im) return null;
    const alt = clean(im.alt), media = safeMediaPath(im.media);
    if (media) return { media, alt };
    const url = safeImageUrl(im.url);
    return url ? { url, alt } : null;
  };
  const audioOut = p => { const m = safeMediaPath(p); return m ? { media: m } : null; };
  // Черновики, сделанные до картинок и звука, получают пустые поля
  function normalize() {
    if (!SIZES[d.imageSize]) d.imageSize = 'm';
    if (!FITS[d.imageFit]) d.imageFit = 'contain';
    d.items.forEach(it => {
      ['left', 'right'].forEach(s => {
        if (!it[s + 'Image']) it[s + 'Image'] = emptyImage();
        if (typeof it[s + 'Audio'] !== 'string') it[s + 'Audio'] = '';
      });
    });
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="mt-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const help = text => (window.helpIcon ? window.helpIcon(text) : document.createTextNode(''));

  const newItem = id => ({ id, left: '', right: '', leftImage: emptyImage(), rightImage: emptyImage(), leftAudio: '', rightAudio: '' });

  function create() {
    return { module: 'matching', format: 1, mode: 'standard', align: 'auto', imageSize: 'm', imageFit: 'contain', showCorrect: false, items: [newItem('p1'), newItem('p2'), newItem('p3')] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null;
    normalize();
    if (!d.items.some(i => i.id === openId)) openId = null;
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
    root.className = 'mt-wrap';
    const tools = el('div', 'mt-tools');
    counter = el('span', 'mt-muted');
    const right = el('span', 'mt-right');
    right.append(help(`Напишите пары: слева слово или фраза, справа её пара. Ученик увидит оба столбца перемешанными и будет соединять карточки сам. В одном столбце не должно быть одинаковых карточек. Пар от 2 до ${MAX}. Одна пара — один балл.`));
    tools.append(counter, right);
    msg = el('div', 'mt-msg');
    msg.hidden = true;
    listBox = el('div', 'mt-list');
    addBtn = el('button', 'mt-add', '+ Пара');
    addBtn.type = 'button';
    addBtn.onclick = () => addItem(d.items.length);
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    const n = d.items.length;
    counter.textContent = `Пар: ${n}/${MAX}`;
    counter.classList.toggle('mt-limit', n >= MAX);
    addBtn.disabled = n >= MAX;
  }

  function drawList() {
    listBox.innerHTML = '';
    d.items.forEach((it, i) => listBox.append(row(it, i)));
    updateCounter();
    markDupes();
  }

  // Подсвечиваем повторы внутри столбца сразу, без перерисовки (чтобы не терять фокус в поле)
  function markDupes() {
    ['left', 'right'].forEach(side => {
      const rows = [...listBox.querySelectorAll('.mt-row')];
      rows.forEach(r => {
        const it = d.items.find(x => x.id === r.dataset.id);
        const f = r.querySelector(`.mt-in[data-side="${side}"]`);
        const dup = it && hasFace(it, side) && d.items.some(o => o !== it && faceKey(o, side) === faceKey(it, side));
        f.classList.toggle('dup', !!dup);
        f.title = dup ? 'Такая карточка уже есть в этом столбце' : '';
      });
    });
  }

  function field(it, side, i) {
    const ta = el('textarea', 'mt-in');
    ta.dataset.side = side;
    ta.rows = 1;
    ta.placeholder = side === 'left' ? 'Слева, например: dog' : 'Справа, например: собака';
    ta.value = it[side];
    ta.setAttribute('aria-label', `${side === 'left' ? 'Левая' : 'Правая'} карточка, пара ${i + 1}`);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { it[side] = ta.value; fit(); save(); markDupes(); };
    setTimeout(fit, 0);
    return ta;
  }

  function row(it, i) {
    const r = el('div', 'mt-row');
    r.dataset.id = it.id;
    const grip = el('span', 'mt-grip', '⠿');
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
    const fields = el('div', 'mt-fields');
    fields.append(field(it, 'left', i), el('span', 'mt-link', '↔'), field(it, 'right', i));
    const tools = el('span', 'mt-tools2');
    const btn = (cls, html, tip, fn, disabled) => {
      const b = el('button', 'mt-ib ' + cls);
      b.type = 'button';
      b.innerHTML = html;
      b.title = tip;
      b.setAttribute('aria-label', tip);
      b.disabled = !!disabled;
      b.onclick = e => { e.stopPropagation(); fn(); };
      return b;
    };
    const more = btn('mt-more' + (it.id === openId ? ' on' : '') + (hasMedia(it) ? ' has' : ''), svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>'), 'Картинки и звук карточек', () => { openId = openId === it.id ? null : it.id; drawList(); });
    more.setAttribute('aria-expanded', String(it.id === openId));
    tools.append(
      more,
      btn('', svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => move(i, -1), i === 0),
      btn('', svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => move(i, 1), i === d.items.length - 1),
      btn('', svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(i), d.items.length >= MAX),
    );
    if (delAsk === it.id) {
      const q = el('span', 'mt-ask');
      const yes = el('button', 'mt-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => removeItem(i);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(btn('mt-del', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', () => askDelete(i)));
    r.append(grip, el('span', 'mt-n', `${i + 1}.`), fields, tools);
    if (it.id === openId) r.append(mediaPanel(it));
    return r;
  }

  // Выбор картинки: загрузка и медиатека (mediaPicker из ядра), ссылка https, описание, «Убрать». im меняется на месте
  function imageField(im, redraw) {
    const box = el('div', 'mt-imgf');
    const pic = hasPic(im);
    if (pic) {
      const th = el('span', 'mt-thumb');
      const src = mediaSrc(safeMediaPath(im.media) ? { media: im.media } : { url: im.url });
      if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
      box.append(th);
    }
    const rowEl = el('div', 'mt-imgrow');
    if (window.mediaPicker) rowEl.append(window.mediaPicker('image', () => im.media || '', v => { im.media = v; if (v) im.url = ''; save(); redraw(); }, 'Загрузить картинку'));
    const linkBtn = el('button', '', 'Ссылка');
    linkBtn.type = 'button';
    rowEl.append(linkBtn);
    if (pic || im.url || im.media) {
      const rm = el('button', '', 'Убрать');
      rm.type = 'button';
      rm.onclick = () => { im.media = ''; im.url = ''; save(); redraw(); };
      rowEl.append(rm);
    }
    box.append(rowEl);
    const link = el('input');
    link.placeholder = 'Ссылка на картинку (https://…)';
    link.value = im.url || '';
    link.hidden = !im.url;
    link.setAttribute('aria-label', 'Ссылка на картинку');
    const bad = el('div', 'mt-warn');
    bad.hidden = true;
    link.oninput = () => { im.url = link.value; if (link.value.trim()) im.media = ''; bad.hidden = !link.value.trim() || !!safeImageUrl(link.value); bad.textContent = 'Нужен полный адрес с https://.'; save(); };
    link.onchange = redraw;
    linkBtn.onclick = () => { link.hidden = !link.hidden; if (!link.hidden) link.focus(); };
    box.append(link, bad);
    if (pic) {
      const alt = el('input');
      alt.placeholder = 'Описание картинки для незрячих учеников';
      alt.value = im.alt || '';
      alt.setAttribute('aria-label', 'Описание картинки');
      alt.oninput = () => { im.alt = alt.value; save(); };
      box.append(alt);
    }
    return box;
  }
  const audioField = (get, set, label) => (window.mediaPicker ? window.mediaPicker('audio', get, set, label) : el('span'));

  // Панель пары: картинка и звук для левой и правой карточки (текст остаётся в строке)
  function mediaPanel(it) {
    const panel = el('div', 'mt-panel');
    const draw = () => {
      panel.innerHTML = '';
      [['left', 'Левая карточка'], ['right', 'Правая карточка']].forEach(([s, title]) => {
        const col = el('div', 'mt-pcol');
        col.append(el('div', 'mt-label', title), imageField(it[s + 'Image'], () => { draw(); markDupes(); updateDot(); }), el('div', 'mt-label', 'Звук'), audioField(() => it[s + 'Audio'] || '', v => { it[s + 'Audio'] = v; save(); markDupes(); updateDot(); }, 'Загрузить звук'));
        panel.append(col);
      });
    };
    const updateDot = () => { const b = listBox.querySelector(`.mt-row[data-id="${it.id}"] .mt-more`); if (b) b.classList.toggle('has', hasMedia(it)); };
    draw();
    return panel;
  }

  const clearDrop = () => listBox.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));

  function addItem(index) {
    if (d.items.length >= MAX) return say(`Пар не больше ${MAX}. Разделите задание на два.`);
    const id = nextId('p', d.items.map(i => i.id));
    d.items.splice(index, 0, newItem(id));
    save();
    drawList();
    const ta = listBox.querySelector(`.mt-row[data-id="${id}"] textarea`);
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function duplicate(i) {
    if (d.items.length >= MAX) return say(`Пар не больше ${MAX}.`);
    const copy = { ...JSON.parse(JSON.stringify(d.items[i])), id: nextId('p', d.items.map(x => x.id)) };
    d.items.splice(i + 1, 0, copy);
    save();
    drawList();
    markDupes();
    say('Копия пары создана. Повторы в одном столбце не дадут опубликовать упражнение, пока их не исправить.');
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    save();
    drawList();
    markDupes();
    const b = listBox.querySelector(`.mt-row[data-id="${d.items[j].id}"] .mt-ib:not(:disabled)`);
    if (b) b.focus();
  }

  // Заполненная пара удаляется после подтверждения прямо в строке, пустая — сразу
  function askDelete(i) {
    if (!filled(d.items[i])) return removeItem(i);
    delAsk = d.items[i].id;
    drawList();
    markDupes();
  }
  function removeItem(i) {
    d.items.splice(i, 1);
    delAsk = null;
    while (d.items.length < 2) d.items.push(newItem(nextId('p', d.items.map(x => x.id))));
    save();
    drawList();
    markDupes();
  }

  // ---- Файл упражнения ----
  function exportData(draft) {
    return {
      module: 'matching', format: 1,
      mode: MODES[draft.mode] ? draft.mode : 'standard',
      ...(ALIGNS[draft.align] && draft.align !== 'auto' ? { align: draft.align } : {}),
      ...(draft.showCorrect ? { showCorrect: true } : {}),
      ...(draft.items.some(hasMedia) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm', imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain' } : {}),
      items: draft.items.map(it => {
        const out = { id: it.id, left: clean(it.left), right: clean(it.right) };
        ['left', 'right'].forEach(s => {
          const im = imageOut(it[s + 'Image']), au = audioOut(it[s + 'Audio']);
          if (im) out[s + 'Image'] = im;
          if (au) out[s + 'Audio'] = au;
        });
        return out;
      }),
    };
  }

  const unitCount = draft => draft.items.length;

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const items = draft.items;
    if (items.length < 2) errors.push('Нужно минимум две пары.');
    if (items.length > MAX) errors.push(`Пар больше ${MAX}. Разделите задание на два.`);
    items.forEach((it, n) => {
      const who = `Пара ${n + 1}`;
      [['left', 'левая'], ['right', 'правая']].forEach(([s, name]) => {
        const im = it[s + 'Image'];
        if (!hasFace(it, s)) errors.push(`${who}: пустая ${name} карточка (нужен текст или картинка).`);
        if (im && !safeMediaPath(im.media) && clean(im.url) && !safeImageUrl(im.url)) errors.push(`${who}, ${name} карточка: ссылка на картинку должна быть полным адресом с https://.`);
        if (hasPic(im) && !clean(it[s]) && !clean(im.alt)) warnings.push(`${who}, ${name} карточка: картинка без текста и без описания, незрячий ученик её не поймёт.`);
      });
    });
    [['left', 'левом'], ['right', 'правом']].forEach(([side, name]) => {
      const seen = [];
      items.forEach((it, n) => {
        if (!hasFace(it, side)) return;
        const k = faceKey(it, side);
        const first = seen.find(s => s.k === k);
        if (first) errors.push(`В ${name} столбце повтор: пары ${first.n + 1} и ${n + 1} (${clean(it[side]) || 'картинка'}).`);
        else seen.push({ k, n });
      });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика
  function load(file) {
    if (!Array.isArray(file.items)) throw new Error('В файле нет пар.');
    const imageIn = im => ({ media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') });
    const audioIn = a => (a && safeMediaPath(a.media)) || '';
    const items = file.items.map((i, k) => ({
      id: String(i.id || 'p' + (k + 1)), left: String(i.left || ''), right: String(i.right || ''),
      leftImage: imageIn(i.leftImage), rightImage: imageIn(i.rightImage), leftAudio: audioIn(i.leftAudio), rightAudio: audioIn(i.rightAudio),
    }));
    return { ...create(), imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain', mode: MODES[file.mode] ? file.mode : 'standard', align: ALIGNS[file.align] ? file.align : 'auto', showCorrect: file.showCorrect === true, items: items.length ? items : create().items };
  }

  // Настройки во вкладке «Поведение»: показ верных пар в конце (рисует ядро, поле лежит в черновике)
  function behaviorOptions(draft) {
    return [
      { field: 'showCorrect', label: 'Показать верные пары в конце', value: !!draft.showCorrect,
        help: 'Если у ученика остались несоединённые или неверные пары, после конца упражнения появится кнопка, которая показывает верные пары. Баллы она не меняет.' },
    ];
  }

  // Настройка во вкладке «Дизайн»: как показываются пары (рисует ядро, поле лежит в черновике)
  const sq = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  function designOptions(draft) {
    return [
      { field: 'mode', label: 'Показ пар', value: MODES[draft.mode] ? draft.mode : 'standard', names: MODES,
        icons: { standard: sq('<rect x="4" y="5" width="6" height="5" rx="1"/><rect x="14" y="5" width="6" height="5" rx="1"/><path d="M4 16h16M4 20h16"/>'), lines_pair_colors: sq('<rect x="3" y="5" width="6" height="5" rx="1"/><rect x="15" y="14" width="6" height="5" rx="1"/><path d="M9 8l6 8"/>') } },
      { field: 'align', label: 'Текст в карточках', value: ALIGNS[draft.align] ? draft.align : 'auto', names: ALIGNS,
        icons: { auto: sq('<path d="M7 7h10M5 12h14M7 17h6"/>'), center: sq('<path d="M6 7h12M8 12h8M6 17h12"/>'), left: sq('<path d="M5 7h14M5 12h9M5 17h12"/>') } },
      { field: 'imageSize', label: 'Размер картинок', value: SIZES[draft.imageSize] ? draft.imageSize : 'm', names: SIZES, icons: { s: '<b class="sz">S</b>', m: '<b class="sz">M</b>', l: '<b class="sz">L</b>' } },
      { field: 'imageFit', label: 'Картинка в рамке', value: FITS[draft.imageFit] ? draft.imageFit : 'contain', names: FITS,
        icons: { contain: sq('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'), cover: sq('<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>') } },
    ];
  }

  // Сколько проверок задаёт сам режим (0 — выбирает автор во вкладке «Поведение»)
  const fixedChecks = draft => (draft.mode === 'lines_pair_colors' ? 1 : 0);

  return { create, render, load, exportData, validate, unitCount, behaviorOptions, designOptions, fixedChecks };
})();
