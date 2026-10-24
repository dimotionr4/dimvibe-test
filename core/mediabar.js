// Общие компактные элементы загрузки картинок и звука для редакторов всех модулей (решение владельца 2026-10-24):
// два значка — «загрузить файл» (сразу открывает выбор файла) и «из медиатеки»; убрать файл — крестик × на миниатюре
// (у звука — рядом с ▶), он есть, только когда файл выбран. Картинку по ссылке выбирают в медиатеке. Новые модули берут отсюда, а не рисуют свои кнопки.
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
  };
  // Значок действия: картинка или динамик (что) и маленький знак в углу (что сделать): стрелка — загрузить файл, стопка — из медиатеки
  const badge = inner => `<svg class="mb-badge" viewBox="0 0 12 12" aria-hidden="true">${inner}</svg>`;
  const ACT = {
    upload: badge('<path d="M6 10V2.5M3 5.5l3-3 3 3"/>'),
    library: badge('<rect x="1.5" y="4" width="7" height="6.5" rx="1"/><path d="M4 2h6.5v6.5"/>'),
  };
  const actIcon = (kind, act) => ICON[kind] + ACT[act];
  const signed = () => typeof mediaUserNow !== 'undefined' && !!mediaUserNow;
  // Подсказка значка загрузки: пока не вошли через Google, нажатие сначала запускает вход
  const uploadTip = t => (signed() ? t : t + ' (сначала вход Google)');

  // Значок-кнопка с подсказкой браузера при наведении (title: длинную подсказку data-tip обрезает край узкой колонки)
  function iconButton(icon, tip, fn) {
    const b = el('button', 'mb-btn');
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

  // Загрузка файла в хранилище: пока не вошли через Google, вместо диалога файла запускается вход. say(текст) показывает ход и ошибки
  function pickFile(kind, say, done) {
    if (!signed()) { mediaSignIn().catch(e => say(mediaErrorText(e))); return; }
    const f = document.createElement('input');
    f.type = 'file';
    f.accept = MEDIA_ACCEPT[kind];
    f.onchange = async () => {
      const file = f.files[0];
      if (!file) return;
      const bad = checkMediaFile(file, kind);
      if (bad) return say(bad);
      say('Загрузка…');
      try {
        const path = (await MediaLib.upload(file, {}, p => say(`Загрузка ${Math.round(p * 100)}%`))).path;
        say('');
        done(path);
      } catch (e) { say(e.userText || mediaErrorText(e)); }
    };
    f.click();
  }
  // onLink(адрес) — если передан, в медиатеке можно взять картинку по ссылке («По ссылке» → «Использовать ссылку»)
  const fromLibrary = (kind, done, onLink) => openMediaLibrary({ pick: true, multi: false, kind, link: !!onLink, onPick: items => (items[0].url ? onLink(items[0].url) : done(items[0].path)) });

  // Строка состояния рядом со значком: серая — ход загрузки, красная — ошибка
  function statusEl() {
    const s = el('span', 'mb-status');
    s.say = t => { s.textContent = t; s.classList.toggle('err', !!t && !/^Загрузка/.test(t)); };
    return s;
  }

  // Кнопка ▶ / ■ для прослушивания загруженного звука
  function playButton(path) {
    const b = el('button', 'mb-play', '▶');
    b.type = 'button';
    b.title = 'Прослушать';
    b.setAttribute('aria-label', 'Прослушать звук');
    let a = null;
    const end = () => { a = null; b.textContent = '▶'; };
    b.onclick = () => {
      const url = mediaUrl(path);
      if (!url) return;
      if (a) { a.pause(); end(); return; }
      a = new Audio(url);
      b.textContent = '■';
      a.onended = a.onerror = end;
      a.play().catch(end);
    };
    return b;
  }

  // Компактная замена mediaPicker: выбор файла, путь которого хранит get() / set(путь или ''). label — подсказка у значка загрузки.
  // opts.library === false убирает значок медиатеки (если у модуля своя кнопка выбора из медиатеки)
  function picker(kind, get, set, label, opts) {
    const box = el('div', 'media-pick mb-pick');
    box.refresh = () => {
      const path = get();
      box.textContent = '';
      const status = statusEl();
      const audio = kind === 'audio';
      const upload = uploadTip(path ? (audio ? 'Заменить звук' : 'Заменить картинку') : (label || 'Загрузить файл'));
      const after = v => { set(v); box.refresh(); };
      box.append(iconButton(actIcon(kind, 'upload'), upload, () => pickFile(kind, status.say, after)));
      if (!opts || opts.library !== false) box.append(iconButton(actIcon(kind, 'library'), audio ? 'Звук из медиатеки' : 'Картинка из медиатеки', () => fromLibrary(kind, after)));
      const remove = removeButton(audio ? 'Убрать звук' : 'Убрать картинку', () => after(''));
      if (path && !audio) {
        const th = el('span', 'mb-thumb');
        const src = mediaSrc({ media: path });
        if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
        th.append(remove);
        box.append(th);
      }
      if (path && audio) { const a = el('span', 'mb-aud'); a.append(playButton(path), remove); box.append(a); }
      box.append(status);
    };
    box.refresh();
    return box;
  }

  // Картинка вида {media, url, alt}: значки «загрузить» и «из медиатеки», миниатюра с крестиком «убрать».
  // Картинку по ссылке выбирают в самой медиатеке («По ссылке», решение владельца 2026-10-24); у такой миниатюры значок 🔗.
  // opts: save() — записать черновик, change() — картинка изменилась, after — элемент в конец строки значков (например, звук)
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  function imageControl(im, opts) {
    const o = opts || {};
    const box = el('div', 'mb-img');
    const draw = () => {
      box.textContent = '';
      const pic = hasPic(im);
      const status = statusEl();
      const done = fn => v => { fn(v); if (o.save) o.save(); if (o.change) o.change(); draw(); };
      const bar = el('div', 'mb-bar');
      const setPath = done(p => { im.url = ''; im.media = p; });
      bar.append(
        iconButton(actIcon('image', 'upload'), uploadTip(pic ? 'Заменить картинку' : 'Загрузить картинку'), () => pickFile('image', status.say, setPath)),
        iconButton(actIcon('image', 'library'), 'Картинка из медиатеки', () => fromLibrary('image', setPath, done(u => { im.media = ''; im.url = u; }))),
      );
      if (o.after) bar.append(o.after);
      bar.append(status);
      box.append(bar);
      const remove = () => removeButton('Убрать картинку', () => done(() => { im.media = ''; im.url = ''; })());
      if (pic) {
        const line = el('div', 'mb-line');
        const th = el('span', 'mb-thumb');
        const src = mediaSrc(safeMediaPath(im.media) ? { media: im.media } : { url: im.url });
        if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
        if (!safeMediaPath(im.media)) { th.classList.add('is-link'); th.title = 'Картинка по ссылке из интернета: ' + im.url; th.append(el('span', 'mb-linkmark', '🔗')); }
        th.append(remove());
        line.append(th); // поля «описание для незрячих» нет (решение владельца 2026-10-24: все ученики зрячие)
        box.append(line);
      } else if (String(im.url || '').trim() && !safeMediaPath(im.media)) {
        // Старая неправильная ссылка (без https): поля для правки больше нет — выбрать картинку заново или убрать крестиком
        const w = el('div', 'mb-warn', 'Ссылка на картинку неправильная. Выберите картинку заново или уберите её. ');
        w.append(remove());
        box.append(w);
      }
    };
    box.refresh = draw; // редактор перерисовывает после входа через Google
    draw();
    return box;
  }

  return { iconButton, removeButton, pickFile, fromLibrary, picker, imageControl, playButton, statusEl, ICON };
})();
