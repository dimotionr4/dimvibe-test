// Общие компактные элементы загрузки картинок и звука для редакторов всех модулей (решение владельца 2026-10-24):
// вместо длинных панелей с кнопками — значок со стрелкой и выпадающим списком действий
// (загрузить файл, выбрать из медиатеки, ссылка на изображение, убрать). Новые модули берут отсюда, а не рисуют свои кнопки.
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
  const signed = () => typeof mediaUserNow !== 'undefined' && !!mediaUserNow;

  // Выпадающие списки закрываются нажатием мимо и клавишей Esc (обработчики ставятся один раз)
  let wired = false;
  function closeAll(except) {
    document.querySelectorAll('.mb-menu:not([hidden])').forEach(m => {
      if (m === except) return;
      m.hidden = true;
      const b = m.previousElementSibling;
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.mb-mw')) closeAll(null); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(null); });
  }

  // Список раскрывается от правого края значка влево; если там не хватает места (левый край окна или прокручиваемого блока), — вправо
  function place(m, b) {
    m.style.left = ''; m.style.right = '';
    let box = { left: 0, right: innerWidth };
    for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o !== 'visible') { const r = p.getBoundingClientRect(); box = { left: Math.max(box.left, r.left), right: Math.min(box.right, r.right) }; }
    }
    const r = m.getBoundingClientRect();
    if (r.left < box.left + 4) { m.style.left = '0'; m.style.right = 'auto'; }
  }

  // Значок со списком действий. items — [{label, fn, danger}], пустые пункты пропускаются. has — подсветка «файл уже есть»
  function iconMenu(icon, title, has, items) {
    wire();
    const w = el('span', 'mb-mw');
    const b = el('button', 'mb-btn' + (has ? ' has' : ''));
    b.type = 'button';
    b.innerHTML = icon + '<span class="mb-caret" aria-hidden="true">▾</span>';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    const m = el('div', 'mb-menu');
    m.hidden = true;
    m.setAttribute('role', 'menu');
    items.filter(Boolean).forEach(({ label, fn, danger }) => {
      const i = el('button', 'mb-mi' + (danger ? ' danger' : ''), label);
      i.type = 'button';
      i.setAttribute('role', 'menuitem');
      i.onclick = () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); fn(); };
      m.append(i);
    });
    b.onclick = () => {
      const open = m.hidden;
      closeAll(m);
      m.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      if (open) place(m, b);
    };
    w.append(b, m);
    return w;
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
  const fromLibrary = (kind, done) => openMediaLibrary({ pick: true, multi: false, kind, onPick: items => done(items[0].path) });

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

  // Компактная замена mediaPicker: выбор файла, путь которого хранит get() / set(путь или ''). label — подпись пункта загрузки.
  // opts.library === false убирает пункт медиатеки (если у модуля своя кнопка выбора из медиатеки)
  function picker(kind, get, set, label, opts) {
    const box = el('div', 'media-pick mb-pick');
    box.refresh = () => {
      const path = get();
      box.textContent = '';
      const status = statusEl();
      const upload = signed() ? (path ? 'Заменить файл' : (label || 'Загрузить файл')) : 'Войти для загрузки';
      const after = v => { set(v); box.refresh(); };
      box.append(
        iconMenu(ICON[kind], (kind === 'audio' ? 'Звук' : 'Картинка') + (path ? ': файл загружен' : ': ' + MEDIA_NAMES[kind]), !!path, [
          { label: upload, fn: () => pickFile(kind, status.say, after) },
          !opts || opts.library !== false ? { label: 'Выбрать из медиатеки', fn: () => fromLibrary(kind, after) } : null,
          path ? { label: 'Убрать из упражнения', danger: true, fn: () => after('') } : null,
        ]),
      );
      if (path && kind === 'image') {
        const th = el('span', 'mb-thumb');
        const src = mediaSrc({ media: path });
        if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
        box.append(th);
      }
      if (path && kind === 'audio') box.append(playButton(path));
      box.append(status);
    };
    box.refresh();
    return box;
  }

  // Картинка вида {media, url, alt}: значок со списком (загрузить, из медиатеки, ссылка, убрать), миниатюра с описанием, поле ссылки.
  // opts: save() — записать черновик, change() — картинка изменилась, after — элемент в конец строки значков (например, звук)
  const linkOpen = new WeakSet();
  const hasPic = im => !!(im && (safeMediaPath(im.media) || safeImageUrl(im.url)));
  function imageControl(im, opts) {
    const o = opts || {};
    const box = el('div', 'mb-img');
    if (im.url && !im.media) linkOpen.add(im);
    const draw = () => {
      box.textContent = '';
      const pic = hasPic(im);
      const status = statusEl();
      const done = fn => v => { fn(v); if (o.save) o.save(); if (o.change) o.change(); draw(); };
      const bar = el('div', 'mb-bar');
      bar.append(iconMenu(ICON.image, 'Изображение', pic, [
        { label: signed() ? 'Загрузить изображение' : 'Войти для загрузки', fn: () => pickFile('image', status.say, done(p => { im.url = ''; im.media = p; })) },
        { label: 'Выбрать из медиатеки', fn: () => fromLibrary('image', done(p => { im.url = ''; im.media = p; })) },
        { label: 'Ссылка на изображение', fn: () => { linkOpen.add(im); draw(); } },
        pic || im.url || im.media ? { label: 'Убрать изображение', danger: true, fn: () => { linkOpen.delete(im); done(() => { im.media = ''; im.url = ''; })(); } } : null,
      ]));
      if (o.after) bar.append(o.after);
      bar.append(status);
      box.append(bar);
      if (pic) {
        const line = el('div', 'mb-line');
        const th = el('span', 'mb-thumb');
        const src = mediaSrc(safeMediaPath(im.media) ? { media: im.media } : { url: im.url });
        if (src) { const img = el('img'); img.src = src; img.alt = ''; img.onerror = () => { th.classList.add('broken'); img.remove(); }; th.append(img); }
        const alt = el('input');
        alt.placeholder = 'Описание для незрячих учеников';
        alt.value = im.alt || '';
        alt.setAttribute('aria-label', 'Описание картинки');
        alt.oninput = () => { im.alt = alt.value; if (o.save) o.save(); };
        line.append(th, alt);
        box.append(line);
      }
      if (linkOpen.has(im)) {
        const link = el('input', 'mb-link');
        link.placeholder = 'Ссылка на картинку (https://…)';
        link.value = im.url || '';
        link.setAttribute('aria-label', 'Ссылка на картинку');
        const bad = el('div', 'mb-warn');
        bad.hidden = true;
        link.oninput = () => { im.url = link.value; if (link.value.trim()) im.media = ''; bad.hidden = !link.value.trim() || !!safeImageUrl(link.value); bad.textContent = 'Нужен полный адрес с https://.'; if (o.save) o.save(); };
        link.onchange = () => { if (o.change) o.change(); draw(); };
        box.append(link, bad);
      }
    };
    draw();
    return box;
  }

  return { iconMenu, pickFile, fromLibrary, picker, imageControl, playButton, statusEl, ICON };
})();
