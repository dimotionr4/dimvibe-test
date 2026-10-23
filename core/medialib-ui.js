// Окно «Медиатека»: сетка картинок, поиск, теги, загрузка, свойства файла. Данные — core/medialib.js.
// openMediaLibrary({pick, multi, onPick(items)}): pick=true — окно выбора (кнопка «Выбрать»), иначе просто просмотр и правка.
// Номер версии `?v=` у подключения этого файла (и medialib.css) поднимайте при любом изменении.
const MediaLibUI = (() => {
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  let user = null, cache = null, loading = null, cur = null, uid = 0;
  mediaOnAuth(u => { user = u; if (cur) cur.auth(); });

  const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ');
  const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const ORIENT = { all: 'Любая форма', landscape: 'Горизонтальная', portrait: 'Вертикальная', square: 'Квадратная' };
  const SORTS = { new: 'Сначала новые', old: 'Сначала старые', name: 'По названию', size: 'По размеру' };
  const titleOf = it => it.name || 'Без названия';
  const orientOf = it => (!it.w || !it.h ? '' : Math.abs(it.w / it.h - 1) < 0.08 ? 'square' : it.w > it.h ? 'landscape' : 'portrait');

  function open(opts) {
    if (cur) cur.close();
    opts = opts || {};
    const pick = !!opts.pick, multi = !!opts.multi;
    let items = cache || [], q = '', tagsOn = new Set(), orient = 'all', sort = 'new', showHidden = false;
    let sel = [], active = null, busy = '', msg = '';
    const id = ++uid;

    const back = h('div', 'ml');
    const box = h('div', 'ml-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Медиатека');
    back.append(box);

    // Верх: название, поиск, закрыть
    const head = h('div', 'ml-head');
    const title = h('b', '', 'Медиатека');
    const count = h('span', 'ml-count');
    const search = h('input', 'ml-search');
    search.type = 'search';
    search.placeholder = 'Поиск по названию и тегам';
    search.setAttribute('aria-label', 'Поиск');
    search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
    const closeBtn = h('button', 'ml-x', '×');
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.title = 'Закрыть (Esc)';
    head.append(title, count, search, closeBtn);

    // Панель: форма, сортировка, скрытые, обновить, загрузка
    const bar = h('div', 'ml-bar');
    const mkSelect = (values, get, set, label) => {
      const s = h('select');
      s.setAttribute('aria-label', label);
      Object.entries(values).forEach(([v, t]) => s.append(new Option(t, v)));
      s.value = get();
      s.onchange = () => { set(s.value); draw(); };
      return s;
    };
    const orientSel = mkSelect(ORIENT, () => orient, v => { orient = v; }, 'Форма картинки');
    const sortSel = mkSelect(SORTS, () => sort, v => { sort = v; }, 'Сортировка');
    const hid = h('label', 'ml-check');
    const hidBox = h('input');
    hidBox.type = 'checkbox';
    hidBox.onchange = () => { showHidden = hidBox.checked; draw(); };
    hid.append(hidBox, document.createTextNode(' Скрытые'));
    const refresh = h('button', '', 'Обновить');
    const file = h('input');
    file.type = 'file'; file.multiple = true; file.accept = MEDIA_ACCEPT.image; file.hidden = true;
    const up = h('button', 'ml-up primary');
    bar.append(orientSel, sortSel, hid, refresh, up, file);

    const tagRow = h('div', 'ml-tags');
    const note = h('div', 'ml-note');
    note.hidden = true;

    // Середина: сетка и свойства
    const mid = h('div', 'ml-mid');
    const grid = h('div', 'ml-grid');
    const side = h('aside', 'ml-side');
    mid.append(grid, side);

    const foot = h('div', 'ml-foot');
    const picked = h('span', 'ml-picked');
    const okBtn = h('button', 'primary', 'Выбрать');
    const cancel = h('button', '', 'Отмена');
    if (pick) foot.append(picked, cancel, okBtn); else foot.hidden = true;
    box.append(head, bar, tagRow, note, mid, foot);

    const say = (t, bad) => { msg = t; note.textContent = t; note.hidden = !t; note.classList.toggle('bad', !!bad); };
    const errText = e => e.userText || mediaErrorText(e);

    function visible() {
      const words = q.split(/\s+/).filter(Boolean);
      const r = items.filter(it => {
        if (it.hidden && !showHidden) return false;
        if ([...tagsOn].some(t => !it.tags.includes(t))) return false;
        if (orient !== 'all' && orientOf(it) && orientOf(it) !== orient) return false;
        const hay = (it.name + ' ' + it.tags.join(' ') + ' ' + it.path.split('/').pop()).toLowerCase();
        return words.every(w => hay.includes(w));
      });
      const cmp = { new: (a, b) => (b.created || '').localeCompare(a.created || ''), old: (a, b) => (a.created || '').localeCompare(b.created || ''), name: (a, b) => titleOf(a).localeCompare(titleOf(b), 'ru'), size: (a, b) => b.size - a.size }[sort];
      return r.sort(cmp);
    }

    function drawTags() {
      tagRow.innerHTML = '';
      const counts = {};
      items.forEach(it => { if (!it.hidden || showHidden) it.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }); });
      Object.keys(counts).sort((a, b) => a.localeCompare(b, 'ru')).forEach(t => {
        const b = h('button', 'ml-tag' + (tagsOn.has(t) ? ' on' : ''), `${t} · ${counts[t]}`);
        b.setAttribute('aria-pressed', String(tagsOn.has(t)));
        b.onclick = () => { if (tagsOn.has(t)) tagsOn.delete(t); else tagsOn.add(t); draw(); };
        tagRow.append(b);
      });
      tagRow.hidden = !tagRow.firstChild;
    }

    function thumbImg(it, big) {
      const img = h('img');
      img.alt = '';
      img.loading = 'lazy';
      const full = mediaUrl(it.path), th = it.thumb && !big ? mediaUrl(it.thumb) : null;
      img.src = th || full;
      img.onerror = () => { if (img.src !== full && full) img.src = full; else img.classList.add('broken'); };
      // Старым файлам размеры неизвестны: берём из загруженной картинки (для фильтра по форме и свойств)
      img.onload = () => { if (!it.w && img.naturalWidth && img.src === full) { it.w = img.naturalWidth; it.h = img.naturalHeight; } };
      return img;
    }

    function draw() {
      drawTags();
      const list = visible();
      count.textContent = items.length ? `${list.length} из ${items.length}` : '';
      grid.innerHTML = '';
      if (busy === 'list') grid.append(h('p', 'ml-empty', 'Загрузка списка…'));
      else if (!list.length) grid.append(h('p', 'ml-empty', items.length ? 'Ничего не найдено. Измените поиск или фильтры.' : 'В медиатеке пока нет картинок. Нажмите «Загрузить».'));
      list.forEach(it => {
        const c = h('button', 'ml-card' + (sel.includes(it.path) ? ' sel' : '') + (active === it.path ? ' act' : '') + (it.hidden ? ' hid' : ''));
        c.type = 'button';
        c.title = titleOf(it);
        const th = h('span', 'ml-th');
        th.append(thumbImg(it));
        c.append(th, h('span', 'ml-name', titleOf(it)));
        if (pick) c.append(h('span', 'ml-mark', '✓'));
        c.onclick = () => {
          active = it.path;
          if (pick) {
            if (multi) sel = sel.includes(it.path) ? sel.filter(p => p !== it.path) : [...sel, it.path];
            else sel = [it.path];
          }
          draw();
        };
        c.ondblclick = () => { if (pick && !multi) choose(); };
        grid.append(c);
      });
      drawSide();
      drawFoot();
      upBtn();
    }

    function drawFoot() {
      picked.textContent = sel.length ? `Выбрано: ${sel.length}` : multi ? 'Отметьте одну или несколько картинок' : 'Выберите картинку';
      okBtn.disabled = !sel.length;
    }

    function upBtn() {
      up.disabled = busy !== '' && busy !== 'list';
      up.textContent = busy.startsWith('up') ? busy.slice(2) : user ? 'Загрузить' : 'Войти для загрузки';
      up.title = user ? 'Новые файлы получают теги, выбранные в фильтре' : 'Загружать и менять файлы может только вошедший через Google';
    }

    function drawSide() {
      side.innerHTML = '';
      const it = items.find(x => x.path === active);
      if (!it) { side.append(h('p', 'ml-empty', 'Нажмите на картинку, чтобы увидеть и изменить её свойства.')); return; }
      const big = h('div', 'ml-big');
      big.append(thumbImg(it, true));
      const edit = !!user;
      const name = h('input');
      name.value = it.name;
      name.placeholder = 'Название';
      name.disabled = !edit;
      name.setAttribute('aria-label', 'Название');
      name.onchange = () => save(it, { name: name.value }, () => { it.name = MediaLib.cleanName(name.value); });
      // Теги: чипы, поле добавления и подсказки из уже существующих
      const tags = h('div', 'ml-chips');
      it.tags.forEach(t => {
        const c = h('span', 'ml-chip', t);
        if (edit) {
          const x = h('button', '', '×');
          x.setAttribute('aria-label', 'Убрать тег ' + t);
          x.onclick = () => save(it, { tags: it.tags.filter(z => z !== t) }, () => { it.tags = it.tags.filter(z => z !== t); });
          c.append(x);
        }
        tags.append(c);
      });
      const listId = 'mltags' + id;
      const tagIn = h('input');
      tagIn.placeholder = 'Добавить тег';
      tagIn.setAttribute('list', listId);
      tagIn.disabled = !edit;
      const dl = h('datalist');
      dl.id = listId;
      [...new Set(items.flatMap(x => x.tags))].forEach(t => dl.append(new Option(t)));
      const addTag = () => {
        const t = MediaLib.cleanTag(tagIn.value);
        tagIn.value = '';
        if (!t || it.tags.includes(t)) return;
        save(it, { tags: [...it.tags, t] }, () => { it.tags = [...it.tags, t]; });
      };
      tagIn.onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } };
      tagIn.onchange = addTag;
      const info = h('dl', 'ml-info');
      [['Формат', (it.type.split('/')[1] || '—').toUpperCase()], ['Размеры', it.w ? `${it.w} × ${it.h} px` : '—'], ['Размер файла', it.size ? fmtSize(it.size) : '—'], ['Загружено', fmtDate(it.created)], ['Откуда', it.origin === 'library' ? 'медиатека' : 'упражнение ' + it.origin]]
        .forEach(([k, v]) => info.append(h('dt', '', k), h('dd', '', v)));
      const hideBtn = h('button', '', it.hidden ? 'Вернуть в список' : 'Скрыть из списка');
      hideBtn.disabled = !edit;
      hideBtn.title = 'Файл не удаляется из хранилища: упражнения, где он уже есть, продолжают работать';
      hideBtn.onclick = () => save(it, { hidden: !it.hidden }, () => { it.hidden = !it.hidden; if (it.hidden && !showHidden) { sel = sel.filter(p => p !== it.path); active = null; } });
      side.append(big, name, tags, tagIn, dl, info, hideBtn);
      if (!edit) side.append(h('p', 'ml-empty', 'Чтобы менять название и теги, войдите через Google (кнопка «Войти для загрузки»).'));
    }

    // Изменение сразу видно; если хранилище отказало, возвращаем как было
    async function save(it, patch, apply) {
      const before = JSON.stringify([it.name, it.tags, it.hidden]);
      apply();
      draw();
      try { await MediaLib.update(it.path, patch); say('', false); }
      catch (e) {
        const [n, t, hd] = JSON.parse(before);
        it.name = n; it.tags = t; it.hidden = hd;
        say('Не удалось сохранить: ' + errText(e), true);
        draw();
      }
    }

    async function load(force) {
      if (cache && !force) { items = cache; draw(); return; }
      busy = 'list'; say(''); draw();
      try {
        loading = loading || MediaLib.list();
        cache = items = await loading;
      } catch (e) {
        say('Не удалось получить список файлов: ' + errText(e) + ' Проверьте интернет и правила хранилища (чтение media/ для списка).', true);
      }
      loading = null;
      busy = '';
      draw();
    }

    async function uploadFiles(files) {
      if (!user) { try { await mediaSignIn(); } catch (e) { say(errText(e), true); } return; }
      const list = [...files];
      const tags = [...tagsOn];
      let ok = 0;
      for (let i = 0; i < list.length; i++) {
        busy = `up${list.length > 1 ? `Загрузка ${i + 1} из ${list.length}…` : 'Загрузка…'}`;
        upBtn();
        try {
          const it = await MediaLib.upload(list[i], { tags });
          items = cache = [it, ...(cache || items)];
          active = it.path;
          if (pick) sel = multi ? [...sel, it.path] : [it.path];
          ok++;
          draw();
        } catch (e) {
          say(`${list[i].name}: ${errText(e)}`, true);
        }
      }
      busy = '';
      if (ok === list.length) say(ok > 1 ? `Загружено файлов: ${ok}.` : '');
      draw();
    }

    function choose() {
      const chosen = sel.map(p => items.find(x => x.path === p)).filter(Boolean);
      if (!chosen.length) return;
      close();
      if (opts.onPick) opts.onPick(chosen);
    }

    function close() {
      removeEventListener('keydown', onKey, true);
      back.remove();
      if (cur && cur.id === id) cur = null;
    }
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

    up.onclick = () => { if (!user) uploadFiles([]); else file.click(); };
    file.onchange = () => { const f = [...file.files]; file.value = ''; if (f.length) uploadFiles(f); }; // копия: после сброса поля список файлов пустеет
    refresh.onclick = () => load(true);
    closeBtn.onclick = cancel.onclick = close;
    okBtn.onclick = choose;
    back.onmousedown = e => { if (e.target === back) close(); };
    // Перетаскивание файлов прямо в окно
    box.ondragover = e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); };
    box.ondrop = e => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); uploadFiles(e.dataTransfer.files); } };
    addEventListener('keydown', onKey, true);

    cur = { id, close, auth: () => { upBtn(); drawSide(); } };
    document.body.append(back);
    draw();
    search.focus();
    load(false);
    return cur;
  }

  return { open };
})();

function openMediaLibrary(opts) { return MediaLibUI.open(opts); }
