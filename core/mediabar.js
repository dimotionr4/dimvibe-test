// Общие элементы загрузки картинок и звука для редакторов всех модулей (решение владельца 2026-10-27, по наброску владельца):
// пусто — плитка «+»; если можно и картинку, и звук, «+» сначала раскрывается в два значка (картинка / звук).
// Выбор открывает окно «Добавить изображение / аудио»: «Загрузить своё» (нажать, перетащить файл или вставить из буфера),
// кнопка «Медиатека», у картинки — поле «вставьте ссылку»; «Поиск» и «Сгенерировать» помечены «скоро».
// Выбранная картинка — миниатюра с крестиком × в углу и значком ↻ «заменить» при наведении; звук — чёрная кнопка ▶ / ❚❚ и ×.
// Новые модули берут элементы отсюда, а не рисуют свои кнопки.
// Использует общие функции редактора: mediaSignIn, MediaLib.upload, openMediaLibrary, checkMediaFile, mediaSrc, mediaUrl, mediaErrorText;
// вошёл ли владелец в Google, берёт из переменной mediaUserNow (editor.html).
const MediaUI = (() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const svg = inner => `<svg class="mb-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>'),
    audio: svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    replace: svg('<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8"/><path d="M20 20v-4.5h-4.5"/>'),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    library: svg('<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/>'),
    search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
    spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  };
  if (window.DVIcons) { ICON.image = svg(DVIcons.ui.image); ICON.audio = svg(DVIcons.ui.sound); }
  const PLAY = '<svg class="mb-ico fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE = '<svg class="mb-ico fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const NAME = { image: 'картинку', audio: 'звук' };
  const signed = () => typeof mediaUserNow !== 'undefined' && !!mediaUserNow;

  // Значок-кнопка с подсказкой браузера при наведении
  function iconButton(icon, tip, fn, cls) {
    const b = el('button', cls || 'mb-btn');
    b.type = 'button';
    b.innerHTML = icon;
    b.title = tip;
    b.setAttribute('aria-label', tip);
    b.onclick = fn;
    return b;
  }
  // Крестик «убрать из упражнения»: сам файл остаётся в медиатеке
  function removeButton(tip, fn) {
    const b = el('button', 'mb-x', '×');
    b.type = 'button';
    b.title = tip;
    b.setAttribute('aria-label', tip);
    b.onclick = fn;
    return b;
  }

  // Загрузка файла в хранилище; say(текст) показывает ход и ошибки. Возвращает путь или null
  async function uploadFile(file, kind, say) {
    const bad = checkMediaFile(file, kind);
    if (bad) { say(bad); return null; }
    say('Загрузка…');
    try {
      const path = (await MediaLib.upload(file, {}, p => say(`Загрузка ${Math.round(p * 100)}%`))).path;
      say('');
      return path;
    } catch (e) { say(e.userText || mediaErrorText(e)); return null; }
  }
  // Сразу выбор файла (без окна): пока не вошли через Google, вместо диалога файла запускается вход
  function pickFile(kind, say, done) {
    if (!signed()) { mediaSignIn().catch(e => say(mediaErrorText(e))); return; }
    const f = document.createElement('input');
    f.type = 'file';
    f.accept = MEDIA_ACCEPT[kind];
    f.onchange = async () => { const file = f.files[0]; if (!file) return; const p = await uploadFile(file, kind, say); if (p) done(p); };
    f.click();
  }
  // onLink(адрес) — если передан, в медиатеке можно взять картинку по ссылке («По ссылке» → «Использовать ссылку»)
  const fromLibrary = (kind, done, onLink) => openMediaLibrary({ pick: true, multi: false, kind, link: !!onLink, onPick: items => (items[0].url ? onLink(items[0].url) : done(items[0].path)) });

  // Окно «Добавить изображение / аудио». o: done(путь), onLink(адрес) — поле ссылки (только картинка), replace — заголовок «Заменить…»,
  // library === false — без кнопки «Медиатека» (у модуля своя)
  let openBox = null;
  function dialog(kind, o) {
    if (openBox) openBox.close();
    const image = kind === 'image';
    let authed = false;
    const back = el('div', 'mbd');
    const box = el('div', 'mbd-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const title = (o.replace ? 'Заменить ' : 'Добавить ') + (image ? 'изображение' : 'аудио');
    box.setAttribute('aria-label', title);

    const head = el('div', 'mbd-head');
    head.append(el('h3', 'mbd-title', title));
    if (o.library !== false) {
      const lib = el('button', 'mbd-lib');
      lib.type = 'button';
      lib.innerHTML = ICON.library + '<span>Медиатека</span>';
      lib.title = (image ? 'Выбрать картинку' : 'Выбрать звук') + ' из уже загруженных';
      lib.onclick = () => { close(); fromLibrary(kind, o.done, o.onLink); };
      head.append(lib);
    }
    const x = el('button', 'mbd-close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Закрыть');
    x.onclick = () => close();
    head.append(x);

    // Способы: пока работает только «Загрузить своё»; «Поиск» и «Сгенерировать» — позже (решение владельца 2026-10-27)
    const tabs = el('div', 'mbd-tabs');
    const tab = (icon, text, soon) => {
      const t = el('button', 'mbd-tab' + (soon ? ' soon' : ' on'));
      t.type = 'button';
      t.innerHTML = icon + `<span>${text}</span>` + (soon ? '<small>скоро</small>' : '');
      if (soon) { t.disabled = true; t.title = 'Появится позже'; }
      return t;
    };
    tabs.append(tab(ICON.upload, 'Загрузить своё'));
    if (image) tabs.append(tab(ICON.search, 'Поиск', true));
    tabs.append(tab(ICON.spark, 'Сгенерировать', true));

    const zone = el('div', 'mbd-zone');
    zone.setAttribute('role', 'button');
    zone.tabIndex = 0;
    const status = el('p', 'mbd-status');
    const say = t => { status.textContent = t; status.classList.toggle('err', !!t && !/^Загрузка/.test(t)); zone.classList.toggle('busy', /^Загрузка/.test(t)); };
    const drawZone = () => {
      zone.textContent = '';
      zone.append(el('span', 'mbd-zico'));
      zone.firstChild.innerHTML = image ? ICON.image : ICON.audio;
      if (signed() || authed) {
        zone.append(el('span', '', image ? 'Перетащите изображение, вставьте из буфера или нажмите для загрузки' : 'Выберите аудиофайл или перетащите его сюда'));
        zone.append(el('small', '', image ? 'JPEG, PNG или WebP, до 2 МБ' : 'MP3, M4A, OGG или WAV, до 10 МБ'));
      } else {
        zone.append(el('span', '', 'Чтобы загружать свои файлы, войдите через Google'));
        zone.append(el('small', '', 'Нажмите здесь, откроется окно входа'));
      }
    };
    drawZone();
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = MEDIA_ACCEPT[kind];
    file.hidden = true;
    const take = async f => {
      if (!f || zone.classList.contains('busy')) return;
      if (!signed() && !authed) return say('Сначала войдите через Google: нажмите на поле выше.');
      const p = await uploadFile(f, kind, say);
      if (p) { close(); o.done(p); }
    };
    const choose = () => {
      if (zone.classList.contains('busy')) return;
      if (signed() || authed) { file.click(); return; }
      mediaSignIn().then(() => { authed = true; say(''); drawZone(); }).catch(e => say(mediaErrorText(e)));
    };
    zone.onclick = choose;
    zone.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
    file.onchange = () => { const f = file.files[0]; file.value = ''; take(f); };
    zone.ondragover = e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); zone.classList.add('over'); } };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = e => { zone.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); take(e.dataTransfer.files[0]); } };
    // Вставка из буфера (Ctrl+V) в любом месте окна, кроме поля ссылки с текстом
    const onPaste = e => {
      const f = e.clipboardData && [...e.clipboardData.files][0];
      if (!f) return;
      e.preventDefault();
      take(f);
    };

    box.append(head, tabs, zone, file, status);

    // Картинка по ссылке из интернета: в медиатеку не попадает (как «Использовать ссылку» в медиатеке)
    if (image && o.onLink) {
      box.append(el('p', 'mbd-or', 'или вставьте ссылку на изображение'));
      const row = el('div', 'mbd-linkrow');
      const inp = el('input', 'mbd-link');
      inp.type = 'url';
      inp.placeholder = 'https://…';
      inp.setAttribute('aria-label', 'Адрес картинки');
      const add = el('button', 'primary mbd-add', 'Добавить');
      add.type = 'button';
      let seq = 0;
      const use = () => {
        const n = ++seq, raw = inp.value.trim(), url = safeImageUrl(raw);
        if (!raw) return say('Вставьте адрес картинки.');
        if (!url) return say('Нужен полный адрес, который начинается с https://');
        say('Проверяю картинку…');
        const img = new Image();
        img.onload = () => { if (n === seq) { close(); o.onLink(url); } };
        img.onerror = () => { if (n === seq) say('По этому адресу картинка не открылась. Нужна прямая ссылка на изображение (правой кнопкой по картинке → «Копировать адрес изображения»).'); };
        img.src = url;
      };
      add.onclick = use;
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); use(); } };
      row.append(inp, add);
      box.append(row, el('p', 'mbd-hint', 'Картинка останется на чужом сайте; если её там уберут, она пропадёт и у ученика. Загрузить файл надёжнее.'));
    }

    function close() {
      removeEventListener('keydown', onKey, true);
      document.removeEventListener('paste', onPaste);
      back.remove();
      if (openBox && openBox.box === box) openBox = null;
    }
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    back.onmousedown = e => { if (e.target === back) close(); };
    addEventListener('keydown', onKey, true);
    document.addEventListener('paste', onPaste);
    back.append(box);
    document.body.append(back);
    openBox = { box, close };
    x.focus();
    return openBox;
  }

  // Строка состояния (ход загрузки и ошибки вне окна)
  function statusEl() {
    const s = el('span', 'mb-status');
    s.say = t => { s.textContent = t; s.classList.toggle('err', !!t && !/^Загрузка/.test(t)); };
    return s;
  }

  // Плитка «+». kinds — что можно добавить: ['image'], ['audio'] или оба; при двух «+» раскрывается в два значка
  function addTile(kinds, add, tip) {
    const wrap = el('span', 'mb-addwrap');
    const plus = iconButton(ICON.plus, tip || (kinds.length > 1 ? 'Добавить картинку или звук' : 'Добавить ' + NAME[kinds[0]]), () => {
      if (kinds.length === 1) return add(kinds[0]);
      open(true);
    }, 'mb-tile mb-add');
    const choice = el('span', 'mb-tile mb-choice');
    kinds.forEach(k => choice.append(iconButton(ICON[k], 'Добавить ' + NAME[k], () => { open(false); add(k); }, 'mb-pickk')));
    const outside = e => { if (!wrap.contains(e.target)) open(false); };
    function open(on) {
      plus.hidden = on;
      choice.hidden = !on;
      if (on) setTimeout(() => document.addEventListener('mousedown', outside), 0);
      else document.removeEventListener('mousedown', outside);
    }
    choice.hidden = true;
    wrap.append(plus, choice);
    return wrap;
  }

  // Миниатюра картинки: × в углу (убрать), ↻ при наведении (заменить — открывает окно)
  function thumb(src, onReplace, onRemove, link) {
    const th = el('span', 'mb-tile mb-thumb');
    if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
    if (link) { th.classList.add('is-link'); th.title = 'Картинка по ссылке из интернета: ' + link; th.append(el('span', 'mb-linkmark', '🔗')); }
    th.append(iconButton(ICON.replace, 'Заменить картинку', onReplace, 'mb-rep'), removeButton('Убрать картинку', onRemove));
    return th;
  }

  // Кнопка ▶ / ❚❚ для прослушивания загруженного звука
  function playButton(path) {
    const b = iconButton(PLAY, 'Прослушать', null, 'mb-play');
    b.setAttribute('aria-label', 'Прослушать звук');
    let a = null;
    const end = () => { a = null; b.innerHTML = PLAY; };
    b.onclick = () => {
      const url = mediaUrl(path);
      if (!url) return;
      if (a) { a.pause(); end(); return; }
      a = new Audio(url);
      b.innerHTML = PAUSE;
      a.onended = a.onerror = end;
      a.play().catch(end);
    };
    return b;
  }

  // Один файл, путь которого хранит get() / set(путь или ''). label — подсказка у «+».
  // opts.library === false убирает кнопку «Медиатека» в окне (если у модуля своя кнопка выбора из медиатеки).
  // Если этот элемент передан в imageControl как after (звук рядом с картинкой), пустым он не рисуется: общий «+» у картинки
  function picker(kind, get, set, label, opts) {
    const box = el('div', 'media-pick mb-pick');
    const audio = kind === 'audio';
    const lib = !opts || opts.library !== false;
    const after = v => { set(v); box.refresh(); if (box.mbChange) box.mbChange(); };
    const add = replace => dialog(kind, { done: after, replace, library: lib });
    box.mbKind = kind;
    box.mbHas = () => !!get();
    box.mbAdd = () => add(false);
    box.refresh = () => {
      const path = get();
      box.textContent = '';
      if (path && audio) {
        const a = el('span', 'mb-aud');
        a.append(playButton(path), removeButton('Убрать звук', () => after('')));
        box.append(a);
      } else if (path) {
        box.append(thumb(mediaSrc({ media: path }), () => add(true), () => after('')));
      } else if (!box.mbPaired) {
        box.append(addTile([kind], () => add(false), label));
      } else if (box.mbSmallAdd) {
        // Картинка уже занимает плитку: звук добавляют серым значком «динамик +» на месте будущей ▶ (решение владельца 2026-10-28)
        box.append(iconButton(ICON.audio + '<span class="mb-addplus">+</span>', label || 'Добавить звук', () => add(false), 'mb-addaud'));
      }
    };
    box.refresh();
    return box;
  }

  // Картинка вида {media, url, alt}: «+» (или миниатюра с × и ↻), окно добавления с медиатекой и ссылкой.
  // У миниатюры картинки по ссылке значок 🔗.
  // opts: save() — записать черновик, change() — картинка изменилась, after — элемент в конец строки
  // (если это MediaUI.picker('audio'), «+» предлагает на выбор картинку или звук);
  // audioOutside — звук (after) модуль ставит сам перед полем со словом (решение владельца 2026-10-27), «+» остаётся здесь;
  // когда картинка выбрана, звук добавляют значком «динамик +» перед полем.
  // big — большая плитка высотой в два поля слева от полей задания (решение владельца 2026-10-28), раскладка — MediaUI.side
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  function imageControl(im, opts) {
    const o = opts || {};
    const box = el('div', 'mb-img' + (o.big ? ' mb-big' : ''));
    const aud = o.after && o.after.mbKind === 'audio' ? o.after : null;
    const outside = !!(aud && o.audioOutside);
    if (aud) { aud.mbPaired = true; if (outside) aud.classList.add('mb-out'); aud.refresh(); }
    const draw = () => {
      box.textContent = '';
      const pic = hasPic(im);
      const done = fn => v => { fn(v); if (o.save) o.save(); if (o.change) o.change(); draw(); };
      const setPath = done(p => { im.url = ''; im.media = p; });
      const setLink = done(u => { im.media = ''; im.url = u; });
      const removePic = done(() => { im.media = ''; im.url = ''; });
      const addPic = replace => dialog('image', { done: setPath, onLink: setLink, replace });
      const bar = el('div', 'mb-bar');
      if (pic) {
        const link = safeMediaPath(im.media) ? '' : im.url;
        bar.append(thumb(mediaSrc(link ? { url: im.url } : { media: im.media }), () => addPic(true), removePic, link));
      }
      if (o.after && !outside) bar.append(o.after);
      const kinds = [];
      if (!pic) kinds.push('image');
      if (aud && !aud.mbHas() && !(outside && pic)) kinds.push('audio');
      if (kinds.length) bar.append(addTile(kinds, k => (k === 'image' ? addPic(false) : aud.mbAdd())));
      if (outside && aud.mbSmallAdd !== pic) { aud.mbSmallAdd = pic; aud.refresh(); }
      box.append(bar);
      if (!pic && String(im.url || '').trim() && !safeMediaPath(im.media)) {
        // Старая неправильная ссылка (без https): выбрать картинку заново или убрать крестиком
        const w = el('div', 'mb-warn', 'Ссылка на картинку неправильная. Выберите картинку заново или уберите её. ');
        w.append(removeButton('Убрать картинку', removePic));
        box.append(w);
      }
    };
    if (aud) aud.mbChange = draw; // звук добавили или убрали — «+» меняет набор значков
    box.refresh = () => { if (aud) aud.refresh(); draw(); }; // редактор перерисовывает после входа через Google
    draw();
    return box;
  }

  // Звук перед полем со словом (как на наброске владельца): строка [▶ ×][поле]; пока звука нет, видно только поле.
  // top — кнопки у верхнего края (для многострочного поля)
  function withAudio(audio, field, top) {
    const w = el('div', 'mb-withaud' + (top ? ' top' : ''));
    w.append(audio, field);
    return w;
  }
  // Раскладка по наброску владельца 2026-10-28: большая плитка (imageControl {big}) слева, поля задания справа столбцом
  function side(media, ...content) {
    const w = el('div', 'mb-side');
    const body = el('div', 'mb-sidebody');
    body.append(...content.filter(Boolean));
    w.append(media, body);
    return w;
  }

  return { iconButton, removeButton, pickFile, fromLibrary, dialog, picker, imageControl, withAudio, side, playButton, statusEl, ICON };
})();
