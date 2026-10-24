// Редактор модуля Matching: пары «слева — справа», у каждой пары устойчивый ID (p1, p2…).
// Ядро (editor.html) передаёт сюда черновик и функцию сохранения; список черновиков, название и вкладки — не здесь.
// Всё, что видит автор, лежит в черновике (кроме удаляемой строки), поэтому отмена и повтор ядра работают сами.
const MatchingEditor = (() => {
  const MAX = 10, MAX_SETS = 5; // пар в наборе и наборов в упражнении
  const MODES = { standard: 'Стандартный: верные пары уходят вниз', lines_pair_colors: 'Линии: все карточки на месте, одна проверка' };
  const ALIGNS = { auto: 'Авто: короткие по центру, длинные слева', center: 'По центру', left: 'По левому краю' };
  const { nextId } = GapEngine;
  let d, root, save, delAsk = null, delSetAsk = null, msgTimer = null, drag = null, openId = null; // openId — пара с раскрытой панелью картинок и звука
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
    // Черновики, сделанные до наборов, имели один плоский список пар
    if (!Array.isArray(d.sets)) { d.sets = [{ id: 's1', instruction: '', items: Array.isArray(d.items) ? d.items : [] }]; delete d.items; }
    allItems().forEach(it => {
      ['left', 'right'].forEach(s => {
        if (!it[s + 'Image']) it[s + 'Image'] = emptyImage();
        if (typeof it[s + 'Audio'] !== 'string') it[s + 'Audio'] = '';
      });
    });
    d.sets.forEach(s => { if (typeof s.instruction !== 'string') s.instruction = ''; });
  }
  const allItems = () => d.sets.flatMap(s => s.items);
  const setOf = it => d.sets.find(s => s.items.includes(it));
  const newSet = (id, ids) => ({ id, instruction: '', items: ids.map(newItem) });

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
    return { module: 'matching', format: 1, mode: 'standard', align: 'auto', imageSize: 'm', imageFit: 'contain', showCorrect: false, sets: [newSet('s1', ['p1', 'p2', 'p3'])] };
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    delAsk = null;
    normalize();
    if (!allItems().some(i => i.id === openId)) openId = null;
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
    listBox = el('div', 'mt-sets');
    addBtn = el('button', 'mt-add mt-addset', '+ Набор пар');
    addBtn.type = 'button';
    addBtn.onclick = addSet;
    root.append(tools, msg, listBox, addBtn);
    drawList();
  }

  function updateCounter() {
    const n = allItems().length;
    counter.textContent = d.sets.length > 1 ? `Наборов: ${d.sets.length}/${MAX_SETS} · пар: ${n}` : `Пар: ${n}/${MAX}`;
    counter.classList.toggle('mt-limit', d.sets.length === 1 && n >= MAX);
    addBtn.disabled = d.sets.length >= MAX_SETS;
  }

  // Набор пар: заголовок с инструкцией (если наборов больше одного), строки пар и кнопка «+ Пара»
  function drawList() {
    listBox.innerHTML = '';
    const many = d.sets.length > 1;
    d.sets.forEach((set, k) => {
      const box = el('section', 'mt-set' + (many ? ' multi' : ''));
      box.dataset.id = set.id;
      if (many) box.append(setHead(set, k));
      const list = el('div', 'mt-list');
      set.items.forEach((it, i) => list.append(row(it, i, set)));
      const add = el('button', 'mt-add', '+ Пара');
      add.type = 'button';
      add.disabled = set.items.length >= MAX;
      add.onclick = () => addItem(set, set.items.length);
      box.append(list, add);
      listBox.append(box);
    });
    listBox.dataset.n = d.sets.length;
    updateCounter();
    markDupes();
  }

  function setHead(set, k) {
    const head = el('div', 'mt-sethead');
    const top = el('div', 'mt-settop');
    top.append(el('b', '', `Набор ${k + 1}`), el('span', 'mt-muted', `пар: ${set.items.length}/${MAX}`));
    const tools = el('span', 'mt-tools2');
    const b = (html, tip, fn, disabled) => { const x = el('button', 'mt-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', tip + ', набор ' + (k + 1)); x.disabled = !!disabled; x.onclick = fn; return x; };
    tools.append(
      b(svg('<path d="M6 15l6-6 6 6"/>'), 'Набор выше', () => moveSet(k, -1), k === 0),
      b(svg('<path d="M6 9l6 6 6-6"/>'), 'Набор ниже', () => moveSet(k, 1), k === d.sets.length - 1),
      b(svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать набор', () => duplicateSet(k), d.sets.length >= MAX_SETS),
    );
    if (delSetAsk === set.id) {
      const q = el('span', 'mt-ask');
      const yes = el('button', 'mt-yes', 'Удалить набор');
      yes.type = 'button';
      yes.onclick = () => removeSet(k);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delSetAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(b(svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить набор', () => { if (set.items.some(filled) || clean(set.instruction)) { delSetAsk = set.id; drawList(); } else removeSet(k); }));
    top.append(tools);
    const ins = el('textarea', 'mt-in mt-setins');
    ins.rows = 1;
    ins.placeholder = 'Инструкция к набору (необязательно), например: Соедините животных с их названиями';
    ins.value = set.instruction;
    ins.setAttribute('aria-label', `Инструкция к набору ${k + 1}`);
    const fit = () => { ins.style.height = 'auto'; ins.style.height = ins.scrollHeight + 2 + 'px'; };
    ins.oninput = () => { set.instruction = ins.value; fit(); save(); };
    setTimeout(fit, 0);
    head.append(top, ins);
    return head;
  }

  const newSetId = () => nextId('s', d.sets.map(s => s.id));
  const newPairId = () => nextId('p', allItems().map(i => i.id));
  function addSet() {
    if (d.sets.length >= MAX_SETS) return say(`Наборов не больше ${MAX_SETS}.`);
    d.sets.push(newSet(newSetId(), [newPairId()]));
    d.sets[d.sets.length - 1].items.push(newItem(nextId('p', allItems().map(i => i.id))));
    save();
    drawList();
    const last = listBox.lastElementChild;
    if (last) last.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function moveSet(k, dir) {
    const j = k + dir;
    if (j < 0 || j >= d.sets.length) return;
    [d.sets[k], d.sets[j]] = [d.sets[j], d.sets[k]];
    save();
    drawList();
  }
  // Копия набора получает новые ID набора и пар
  function duplicateSet(k) {
    if (d.sets.length >= MAX_SETS) return say(`Наборов не больше ${MAX_SETS}.`);
    const copy = JSON.parse(JSON.stringify(d.sets[k]));
    copy.id = newSetId();
    const ids = allItems().map(i => i.id);
    copy.items.forEach(it => { it.id = nextId('p', ids); ids.push(it.id); });
    d.sets.splice(k + 1, 0, copy);
    save();
    drawList();
  }
  function removeSet(k) {
    d.sets.splice(k, 1);
    delSetAsk = null;
    if (!d.sets.length) d.sets.push(newSet('s1', ['p1', 'p2']));
    save();
    drawList();
  }

  // Подсвечиваем повторы внутри столбца набора сразу, без перерисовки (чтобы не терять фокус в поле)
  function markDupes() {
    ['left', 'right'].forEach(side => {
      const rows = [...listBox.querySelectorAll('.mt-row')];
      rows.forEach(r => {
        const it = allItems().find(x => x.id === r.dataset.id);
        const f = r.querySelector(`.mt-in[data-side="${side}"]`);
        const dup = it && hasFace(it, side) && setOf(it).items.some(o => o !== it && faceKey(o, side) === faceKey(it, side));
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

  function row(it, i, set) {
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
      const from = set.items.findIndex(x => x.id === drag);
      let to = i + (after ? 1 : 0);
      if (from < 0) return;
      if (from < 0) return; // перетаскивать можно только внутри набора
      const [m] = set.items.splice(from, 1);
      if (from < to) to--;
      set.items.splice(to, 0, m);
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
      btn('', svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', () => move(set, i, -1), i === 0),
      btn('', svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', () => move(set, i, 1), i === set.items.length - 1),
      btn('', svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'), 'Дублировать', () => duplicate(set, i), set.items.length >= MAX),
    );
    if (delAsk === it.id) {
      const q = el('span', 'mt-ask');
      const yes = el('button', 'mt-yes', 'Удалить');
      yes.type = 'button';
      yes.onclick = () => removeItem(set, i);
      const no = el('button', '', 'Нет');
      no.type = 'button';
      no.onclick = () => { delAsk = null; drawList(); };
      q.append(yes, no);
      tools.append(q);
    } else tools.append(btn('mt-del', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'), 'Удалить', () => askDelete(set, i)));
    r.append(grip, el('span', 'mt-n', `${i + 1}.`), fields, tools);
    if (it.id === openId) r.append(mediaPanel(it));
    return r;
  }

  // ---- Картинка и звук карточки: компактно, значками с выпадающим списком ----
  const ICON_IMG = svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>');
  const ICON_SND = svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>');
  let menuWired = false;
  // Закрываем выпадающие списки нажатием мимо и клавишей Esc (обработчики ставятся один раз)
  function wireMenus() {
    if (menuWired) return;
    menuWired = true;
    const closeAll = except => document.querySelectorAll('.mt-menu:not([hidden])').forEach(m => { if (m !== except) { m.hidden = true; const b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.mt-mw')) closeAll(null); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(null); });
    wireMenus.closeAll = closeAll;
  }
  // Значок-кнопка со списком действий; items — [{label, fn}] (пустые пункты пропускаются)
  function iconMenu(icon, title, has, items) {
    wireMenus();
    const w = el('span', 'mt-mw');
    const b = el('button', 'mt-mb' + (has ? ' has' : ''));
    b.type = 'button';
    b.innerHTML = icon + '<span class="mt-caret" aria-hidden="true">▾</span>';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    const m = el('div', 'mt-menu');
    m.hidden = true;
    m.setAttribute('role', 'menu');
    items.filter(Boolean).forEach(({ label, fn, danger }) => {
      const i = el('button', 'mt-mi' + (danger ? ' danger' : ''), label);
      i.type = 'button';
      i.setAttribute('role', 'menuitem');
      i.onclick = () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); fn(); };
      m.append(i);
    });
    b.onclick = () => { const open = m.hidden; wireMenus.closeAll(m); m.hidden = !open; b.setAttribute('aria-expanded', String(open)); };
    w.append(b, m);
    return w;
  }

  // Загрузка файла в хранилище (общие функции редактора: вход через Google, проверка файла, медиатека)
  function pickFile(kind, say2, done) {
    if (typeof mediaUserNow !== 'undefined' && !mediaUserNow) { // не вошли через Google: пункт меню ведёт ко входу
      mediaSignIn().catch(e => say2(mediaErrorText(e)));
      return;
    }
    const f = document.createElement('input');
    f.type = 'file';
    f.accept = MEDIA_ACCEPT[kind];
    f.onchange = async () => {
      const file = f.files[0];
      if (!file) return;
      const bad = checkMediaFile(file, kind);
      if (bad) return say2(bad);
      say2('Загрузка…');
      try {
        const path = (await MediaLib.upload(file, {}, p => say2(`Загрузка ${Math.round(p * 100)}%`))).path;
        say2('');
        done(path);
      } catch (e) { say2(e.userText || mediaErrorText(e)); }
    };
    f.click();
  }
  const fromLibrary = (kind, done) => openMediaLibrary({ pick: true, multi: false, kind, onPick: items => done(items[0].path) });

  // Панель пары: у каждой карточки (левой и правой) два значка — картинка и звук — и, если есть, миниатюра, описание и значок воспроизведения
  function mediaPanel(it) {
    const panel = el('div', 'mt-panel');
    const refresh = () => { markDupes(); const b = listBox.querySelector(`.mt-row[data-id="${it.id}"] .mt-more`); if (b) b.classList.toggle('has', hasMedia(it)); };
    const draw = () => {
      panel.innerHTML = '';
      [['left', 'Левая карточка'], ['right', 'Правая карточка']].forEach(([s, title]) => {
        const im = it[s + 'Image'], pic = hasPic(im), snd = it[s + 'Audio'];
        const col = el('div', 'mt-pcol');
        const status = el('span', 'mt-status');
        const say2 = t => { status.textContent = t; status.classList.toggle('err', !!t && !/^Загрузка/.test(t)); };
        const set = (obj, key, v) => { obj[key] = v; save(); draw(); refresh(); };
        const head = el('div', 'mt-phead');
        head.append(el('span', 'mt-ptitle', title));
        const signed = typeof mediaUserNow !== 'undefined' && mediaUserNow;
        head.append(
          iconMenu(ICON_IMG, 'Изображение карточки', pic, [
            { label: signed ? 'Загрузить изображение' : 'Войти для загрузки', fn: () => pickFile('image', say2, p => { im.url = ''; set(im, 'media', p); }) },
            { label: 'Выбрать из медиатеки', fn: () => fromLibrary('image', p => { im.url = ''; set(im, 'media', p); }) },
            { label: 'Ссылка на изображение', fn: () => { linkOpen[s] = true; draw(); } },
            pic || im.url || im.media ? { label: 'Убрать изображение', danger: true, fn: () => { im.media = ''; im.url = ''; linkOpen[s] = false; save(); draw(); refresh(); } } : null,
          ]),
          iconMenu(ICON_SND, 'Звук карточки', !!snd, [
            { label: signed ? 'Загрузить звук' : 'Войти для загрузки', fn: () => pickFile('audio', say2, p => set(it, s + 'Audio', p)) },
            { label: 'Выбрать из медиатеки', fn: () => fromLibrary('audio', p => set(it, s + 'Audio', p)) },
            snd ? { label: 'Убрать звук', danger: true, fn: () => set(it, s + 'Audio', '') } : null,
          ]),
        );
        if (snd) {
          const play = el('button', 'mt-play', '▶');
          play.type = 'button';
          play.title = 'Прослушать';
          play.setAttribute('aria-label', 'Прослушать звук карточки');
          play.onclick = () => {
            const url = mediaUrl(snd);
            if (!url) return;
            if (panel._a) { panel._a.pause(); panel._a = null; document.querySelectorAll('.mt-play').forEach(x => { x.textContent = '▶'; }); return; }
            const a = new Audio(url);
            panel._a = a;
            play.textContent = '■';
            const end = () => { panel._a = null; play.textContent = '▶'; };
            a.onended = a.onerror = end;
            a.play().catch(end);
          };
          head.append(play);
        }
        head.append(status);
        col.append(head);
        if (pic) {
          const line = el('div', 'mt-pline');
          const th = el('span', 'mt-thumb');
          const src = mediaSrc(safeMediaPath(im.media) ? { media: im.media } : { url: im.url });
          if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
          const alt = el('input');
          alt.placeholder = 'Описание для незрячих учеников';
          alt.value = im.alt || '';
          alt.setAttribute('aria-label', 'Описание картинки');
          alt.oninput = () => { im.alt = alt.value; save(); };
          line.append(th, alt);
          col.append(line);
        }
        if (linkOpen[s]) {
          const link = el('input');
          link.placeholder = 'Ссылка на картинку (https://…)';
          link.value = im.url || '';
          link.setAttribute('aria-label', 'Ссылка на картинку');
          const bad = el('div', 'mt-warn');
          bad.hidden = true;
          link.oninput = () => { im.url = link.value; if (link.value.trim()) im.media = ''; bad.hidden = !link.value.trim() || !!safeImageUrl(link.value); bad.textContent = 'Нужен полный адрес с https://.'; save(); };
          link.onchange = () => { draw(); refresh(); };
          col.append(link, bad);
          setTimeout(() => link.focus(), 0);
        }
        panel.append(col);
      });
    };
    const linkOpen = { left: !!(it.leftImage.url && !it.leftImage.media), right: !!(it.rightImage.url && !it.rightImage.media) };
    draw();
    return panel;
  }
  const clearDrop = () => listBox.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));

  function addItem(set, index) {
    if (set.items.length >= MAX) return say(`В наборе пар не больше ${MAX}. Добавьте ещё один набор.`);
    const id = newPairId();
    set.items.splice(index, 0, newItem(id));
    save();
    drawList();
    const ta = listBox.querySelector(`.mt-row[data-id="${id}"] textarea`);
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function duplicate(set, i) {
    if (set.items.length >= MAX) return say(`В наборе пар не больше ${MAX}.`);
    const copy = { ...JSON.parse(JSON.stringify(set.items[i])), id: newPairId() };
    set.items.splice(i + 1, 0, copy);
    save();
    drawList();
    markDupes();
    say('Копия пары создана. Повторы в одном столбце не дадут опубликовать упражнение, пока их не исправить.');
  }

  function move(set, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= set.items.length) return;
    [set.items[i], set.items[j]] = [set.items[j], set.items[i]];
    save();
    drawList();
    markDupes();
    const b = listBox.querySelector(`.mt-row[data-id="${set.items[j].id}"] .mt-ib:not(:disabled)`);
    if (b) b.focus();
  }

  // Заполненная пара удаляется после подтверждения прямо в строке, пустая — сразу
  function askDelete(set, i) {
    if (!filled(set.items[i])) return removeItem(set, i);
    delAsk = set.items[i].id;
    drawList();
    markDupes();
  }
  function removeItem(set, i) {
    set.items.splice(i, 1);
    delAsk = null;
    while (set.items.length < 2) set.items.push(newItem(newPairId()));
    save();
    drawList();
    markDupes();
  }

  // ---- Файл упражнения ----
  // Черновик, сделанный до наборов, хранит пары плоским списком draft.items
  const setsOf = draft => (Array.isArray(draft.sets) ? draft.sets : [{ id: 's1', instruction: '', items: draft.items || [] }]);
  const itemOut = it => {
    const out = { id: it.id, left: clean(it.left), right: clean(it.right) };
    ['left', 'right'].forEach(s => {
      const im = imageOut(it[s + 'Image']), au = audioOut(it[s + 'Audio']);
      if (im) out[s + 'Image'] = im;
      if (au) out[s + 'Audio'] = au;
    });
    return out;
  };
  function exportData(draft) {
    const sets = setsOf(draft);
    const flat = sets.flatMap(s => s.items);
    return {
      module: 'matching', format: 1,
      mode: MODES[draft.mode] ? draft.mode : 'standard',
      ...(ALIGNS[draft.align] && draft.align !== 'auto' ? { align: draft.align } : {}),
      ...(draft.showCorrect ? { showCorrect: true } : {}),
      ...(flat.some(hasMedia) ? { imageSize: SIZES[draft.imageSize] ? draft.imageSize : 'm', imageFit: FITS[draft.imageFit] ? draft.imageFit : 'contain' } : {}),
      // Один набор — прежний плоский список пар (старые файлы остаются верными); несколько — sets с инструкцией у каждого
      ...(sets.length === 1 ? { items: sets[0].items.map(itemOut) }
        : { sets: sets.map(s => ({ id: s.id, ...(clean(s.instruction) ? { instruction: String(s.instruction).trim() } : {}), items: s.items.map(itemOut) })) }),
    };
  }

  const unitCount = draft => setsOf(draft).reduce((n, s) => n + s.items.length, 0);

  // errors не дают опубликовать, warnings — только предупреждают
  function validate(draft) {
    const errors = [], warnings = [];
    const sets = setsOf(draft), many = sets.length > 1;
    if (!sets.length) errors.push('Нет ни одного набора пар.');
    if (sets.length > MAX_SETS) errors.push(`Наборов больше ${MAX_SETS}.`);
    sets.forEach((set, k) => {
      const items = set.items, pre = many ? `Набор ${k + 1}: ` : '';
      if (items.length < 2) errors.push(`${pre}нужно минимум две пары.`);
      if (items.length > MAX) errors.push(`${pre}пар больше ${MAX}. Разделите набор на два.`);
      items.forEach((it, n) => {
        const who = `${pre}пара ${n + 1}`;
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
          const key = faceKey(it, side);
          const first = seen.find(x => x.key === key);
          if (first) errors.push(`${pre}в ${name} столбце повтор: пары ${first.n + 1} и ${n + 1} (${clean(it[side]) || 'картинка'}).`);
          else seen.push({ key, n });
        });
      });
    });
    return { errors, warnings };
  }

  // Файл упражнения → поля черновика (и плоский список items, и sets)
  function load(file) {
    const raw = Array.isArray(file.sets) ? file.sets : Array.isArray(file.items) ? [{ id: 's1', items: file.items }] : null;
    if (!raw) throw new Error('В файле нет пар.');
    const imageIn = im => ({ media: (im && safeMediaPath(im.media)) || '', url: (im && typeof im.url === 'string' && im.url) || '', alt: String((im && im.alt) || '') });
    const audioIn = a => (a && safeMediaPath(a.media)) || '';
    let n = 0;
    const sets = raw.slice(0, MAX_SETS).map((s, k) => ({
      id: String((s && s.id) || 's' + (k + 1)),
      instruction: String((s && s.instruction) || ''),
      items: (Array.isArray(s && s.items) ? s.items : []).map(i => ({
        id: String(i.id || 'p' + (++n)), left: String(i.left || ''), right: String(i.right || ''),
        leftImage: imageIn(i.leftImage), rightImage: imageIn(i.rightImage), leftAudio: audioIn(i.leftAudio), rightAudio: audioIn(i.rightAudio),
      })),
    }));
    return { ...create(), imageSize: SIZES[file.imageSize] ? file.imageSize : 'm', imageFit: FITS[file.imageFit] ? file.imageFit : 'contain', mode: MODES[file.mode] ? file.mode : 'standard', align: ALIGNS[file.align] ? file.align : 'auto', showCorrect: file.showCorrect === true, sets: sets.length ? sets : create().sets };
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
