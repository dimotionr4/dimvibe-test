// Окно «Медиатека»: папки, сетка картинок и звуков, поиск, теги, загрузка, свойства файла. Данные — core/medialib.js.
// openMediaLibrary({pick, multi, kind, onPick(items)}): pick=true — окно выбора (кнопка «Выбрать»), иначе просмотр и правка;
// kind='image' или 'audio' — показывать только этот вид (без него есть переключатель «Все / Картинки / Звук»).
// link=true — вызвавший принимает и картинку по ссылке: тогда onPick может получить [{kind:'image', url, link:true}] вместо файла.
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
  const fmtDur = s => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
  const ORIENT = { all: 'Любая форма', landscape: 'Горизонтальная', portrait: 'Вертикальная', square: 'Квадратная' };
  const SORTS = { new: 'Сначала новые', old: 'Сначала старые', name: 'По названию', size: 'По размеру' };
  const KINDS = { all: 'Всё', image: 'Картинки', audio: 'Звук' };
  const titleOf = it => it.name || 'Без названия';
  const orientOf = it => (!it.w || !it.h ? '' : Math.abs(it.w / it.h - 1) < 0.08 ? 'square' : it.w > it.h ? 'landscape' : 'portrait');

  // Цвета папок: готовый набор (как у цветов упражнения, плюс серый и красный)
  const FCOLORS = ['#6d4aff', '#1d62d8', '#0a7c8c', '#12805c', '#b85400', '#c2307a', '#6b6b80', '#d64545'];
  // Пустые папки хранятся в этом браузере, пока в них не попадёт файл (у файла в хранилище лежат название и цвет папки)
  const FKEY = 'dimvibe.libFolders';
  const readPending = () => { try { const a = JSON.parse(localStorage.getItem(FKEY)); return Array.isArray(a) ? a.filter(p => p && p.name) : []; } catch (e) { return []; } };
  const writePending = a => { try { localStorage.setItem(FKEY, JSON.stringify(a)); } catch (e) { /* без памяти браузера пустые папки не запоминаются */ } };

  function open(opts) {
    if (cur) cur.close();
    opts = opts || {};
    const pick = !!opts.pick, multi = !!opts.multi;
    let items = cache || [], q = '', tagsOn = new Set(), orient = 'all', sort = 'new', showHidden = false;
    let kindF = opts.kind === 'image' || opts.kind === 'audio' ? opts.kind : 'all';
    let folderSel = '*'; // '*' — все файлы, '' — без папки, иначе название папки
    let folderForm = null; // null | 'new' | 'edit'
    let removeAsk = false;
    let dupMode = false, dupKeep = {}; // режим «Дубликаты»: какой файл оставить в каждой группе
    let pending = readPending();
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
    const title = h('b', '', opts.kind === 'audio' ? 'Медиатека: звук' : opts.kind === 'image' ? 'Медиатека: картинки' : 'Медиатека');
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

    // Панель: вид, форма, сортировка, скрытые, обновить, загрузка
    const bar = h('div', 'ml-bar');
    const mkSelect = (values, get, set, label) => {
      const s = h('select');
      s.setAttribute('aria-label', label);
      Object.entries(values).forEach(([v, t]) => s.append(new Option(t, v)));
      s.value = get();
      s.onchange = () => { set(s.value); draw(); };
      return s;
    };
    const kindSel = mkSelect(KINDS, () => kindF, v => { kindF = v; }, 'Вид файлов');
    kindSel.hidden = !!opts.kind;
    const orientSel = mkSelect(ORIENT, () => orient, v => { orient = v; }, 'Форма картинки');
    const sortSel = mkSelect(SORTS, () => sort, v => { sort = v; }, 'Сортировка');
    const hid = h('label', 'ml-check');
    const hidBox = h('input');
    hidBox.type = 'checkbox';
    hidBox.onchange = () => { showHidden = hidBox.checked; draw(); };
    hid.append(hidBox, document.createTextNode(' Скрытые'));
    const refresh = h('button', '', 'Обновить');
    const file = h('input');
    file.type = 'file'; file.multiple = true; file.hidden = true;
    file.accept = opts.kind === 'audio' ? MEDIA_ACCEPT.audio : opts.kind === 'image' ? MEDIA_ACCEPT.image : MEDIA_ACCEPT.image + ',' + MEDIA_ACCEPT.audio;
    const dupBtn = h('button', 'ml-dupbtn', 'Дубликаты');
    dupBtn.title = 'Найти одинаковые файлы (по содержимому)';
    dupBtn.onclick = () => { dupMode = !dupMode; draw(); };
    const up = h('button', 'ml-up primary');
    const linkBtn = h('button', 'ml-linkbtn', 'По ссылке');
    linkBtn.title = 'Картинка из интернета по адресу';
    linkBtn.hidden = opts.kind === 'audio';
    bar.append(kindSel, orientSel, sortSel, hid, refresh, dupBtn, linkBtn, up, file);

    const tagRow = h('div', 'ml-tags');
    const note = h('div', 'ml-note');
    note.hidden = true;
    const linkBox = h('div', 'ml-link');
    linkBox.hidden = true;

    // Середина: папки, сетка и свойства
    const mid = h('div', 'ml-mid');
    const folderBox = h('div', 'ml-folders');
    folderBox.setAttribute('role', 'group');
    folderBox.setAttribute('aria-label', 'Папки');
    const grid = h('div', 'ml-grid');
    const side = h('div', 'ml-side');
    mid.append(folderBox, grid, side);

    const foot = h('div', 'ml-foot');
    const picked = h('span', 'ml-picked');
    const okBtn = h('button', 'primary', 'Выбрать');
    const cancel = h('button', '', 'Отмена');
    if (pick) foot.append(picked, cancel, okBtn); else foot.hidden = true;
    box.append(head, bar, tagRow, note, linkBox, mid, foot);

    const say = (t, bad) => { msg = t; note.textContent = t; note.hidden = !t; note.classList.toggle('bad', !!bad); };
    const errText = e => e.userText || mediaErrorText(e);

    // Файлы, которые вообще можно показать (вид, скрытые), — от них считаются папки и теги
    const base = () => items.filter(it => (kindF === 'all' || it.kind === kindF) && (!it.hidden || showHidden));

    function folders() {
      const m = new Map();
      base().forEach(it => {
        if (!it.folder) return;
        const f = m.get(it.folder) || { name: it.folder, color: it.fcolor, count: 0 };
        if (!f.color) f.color = it.fcolor;
        f.count++;
        m.set(it.folder, f);
      });
      // Папки с файлами других видов или скрытыми тоже существуют: пустой остаётся только та, где файлов нет совсем
      pending.forEach(p => { if (!m.has(p.name) && !items.some(it => it.folder === p.name)) m.set(p.name, { name: p.name, color: p.color, count: 0 }); });
      return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    const folderColor = name => (folders().find(f => f.name === name) || {}).color || '';

    function visible() {
      const words = q.split(/\s+/).filter(Boolean);
      const r = base().filter(it => {
        if (folderSel === '' && it.folder) return false;
        if (folderSel !== '*' && folderSel !== '' && it.folder !== folderSel) return false;
        if ([...tagsOn].some(t => !it.tags.includes(t))) return false;
        if (orient !== 'all' && it.kind === 'image' && orientOf(it) && orientOf(it) !== orient) return false;
        if (orient !== 'all' && it.kind === 'audio') return false;
        const hay = (it.name + ' ' + it.tags.join(' ') + ' ' + it.folder + ' ' + it.path.split('/').pop()).toLowerCase();
        return words.every(w => hay.includes(w));
      });
      const cmp = { new: (a, b) => (b.created || '').localeCompare(a.created || ''), old: (a, b) => (a.created || '').localeCompare(b.created || ''), name: (a, b) => titleOf(a).localeCompare(titleOf(b), 'ru'), size: (a, b) => b.size - a.size }[sort];
      return r.sort(cmp);
    }

    function drawTags() {
      tagRow.innerHTML = '';
      const counts = {};
      base().forEach(it => it.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
      Object.keys(counts).sort((a, b) => a.localeCompare(b, 'ru')).forEach(t => {
        const b = h('button', 'ml-tag' + (tagsOn.has(t) ? ' on' : ''), `${t} · ${counts[t]}`);
        b.setAttribute('aria-pressed', String(tagsOn.has(t)));
        b.onclick = () => { if (tagsOn.has(t)) tagsOn.delete(t); else tagsOn.add(t); draw(); };
        tagRow.append(b);
      });
      tagRow.hidden = !tagRow.firstChild;
    }

    // ---- Папки ----
    const dot = c => { const d = h('span', 'ml-dot'); d.style.background = c || 'var(--muted)'; return d; };
    const colorRow = (get, set) => {
      const row = h('div', 'ml-colors');
      FCOLORS.forEach(c => {
        const b = h('button', 'ml-color' + (get() === c ? ' on' : ''));
        b.type = 'button';
        b.style.background = c;
        b.setAttribute('aria-label', 'Цвет ' + c);
        b.setAttribute('aria-pressed', String(get() === c));
        b.onclick = () => { set(c); row.querySelectorAll('.ml-color').forEach(x => x.classList.toggle('on', x === b)); };
        row.append(b);
      });
      return row;
    };

    function drawFolders() {
      folderBox.innerHTML = '';
      const list = folders();
      const row = (key, label, n, color, extra) => {
        const b = h('button', 'ml-folder' + (folderSel === key ? ' on' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(folderSel === key));
        b.append(color !== undefined ? dot(color) : h('span', 'ml-dot none'), h('span', 'ml-fname', label), h('span', 'ml-fcount', String(n)));
        b.onclick = () => { folderSel = key; folderForm = null; removeAsk = false; draw(); };
        folderBox.append(b);
        return b;
      };
      const b0 = base();
      row('*', 'Все файлы', b0.length);
      row('', 'Без папки', b0.filter(it => !it.folder).length);
      list.forEach(f => row(f.name, f.name, f.count, f.color));
      const add = h('button', 'ml-folder-add', '+ Папка');
      add.type = 'button';
      add.onclick = () => { folderForm = folderForm === 'new' ? null : 'new'; draw(); };
      folderBox.append(add);
      const named = folderSel !== '*' && folderSel !== '';
      if (named) {
        const edit = h('button', 'ml-folder-add', 'Изменить папку');
        edit.type = 'button';
        edit.onclick = () => { folderForm = folderForm === 'edit' ? null : 'edit'; removeAsk = false; draw(); };
        folderBox.append(edit);
      }
      if (folderForm) folderBox.append(folderFormEl());
    }

    function folderFormEl() {
      const isEdit = folderForm === 'edit';
      const cu = isEdit ? list0(folderSel) : null;
      let color = (cu && cu.color) || FCOLORS[0];
      const form = h('div', 'ml-fform');
      const name = h('input');
      name.placeholder = 'Название папки';
      name.maxLength = 40;
      name.value = isEdit ? folderSel : '';
      name.setAttribute('aria-label', 'Название папки');
      const colors = colorRow(() => color, c => { color = c; });
      const err = h('div', 'ml-ferr');
      err.hidden = true;
      const ok = h('button', 'primary', isEdit ? 'Сохранить' : 'Создать');
      const cancelF = h('button', '', 'Отмена');
      cancelF.onclick = () => { folderForm = null; removeAsk = false; draw(); };
      const go = async () => {
        const nm = MediaLib.cleanFolder(name.value);
        if (!nm) { err.textContent = 'Введите название.'; err.hidden = false; return; }
        const taken = folders().some(f => f.name.toLowerCase() === nm.toLowerCase() && (!isEdit || f.name !== folderSel));
        if (taken) { err.textContent = 'Такая папка уже есть.'; err.hidden = false; return; }
        if (!isEdit) {
          pending = [...pending.filter(p => p.name !== nm), { name: nm, color }];
          writePending(pending);
          folderSel = nm; folderForm = null;
          draw();
          return;
        }
        const old = folderSel, its = items.filter(it => it.folder === old);
        if (its.length && !user) { err.textContent = 'Чтобы менять папку с файлами, войдите через Google.'; err.hidden = false; return; }
        folderForm = null;
        await batch(its, { folder: nm, fcolor: color }, it => { it.folder = nm; it.fcolor = color; });
        pending = pending.filter(p => p.name !== old && p.name !== nm).concat(its.length ? [] : [{ name: nm, color }]);
        writePending(pending);
        folderSel = nm;
        draw();
      };
      ok.onclick = go;
      name.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      form.append(name, colors, err);
      const btns = h('div', 'ml-fbtns');
      btns.append(ok, cancelF);
      form.append(btns);
      if (isEdit) {
        const rm = h('button', 'ml-frm', removeAsk ? 'Точно убрать? Файлы останутся' : 'Убрать папку');
        rm.onclick = async () => {
          if (!removeAsk) { removeAsk = true; draw(); return; }
          const old = folderSel, its = items.filter(it => it.folder === old);
          if (its.length && !user) { say('Чтобы менять папку с файлами, войдите через Google.', true); removeAsk = false; draw(); return; }
          folderForm = null; removeAsk = false;
          await batch(its, { folder: '' }, it => { it.folder = ''; it.fcolor = ''; });
          pending = pending.filter(p => p.name !== old);
          writePending(pending);
          folderSel = '*';
          draw();
        };
        form.append(rm);
      }
      setTimeout(() => name.focus(), 0);
      return form;
    }
    const list0 = name => folders().find(f => f.name === name);

    // Одно изменение для нескольких файлов; при отказе хранилища возвращаем уже изменённые обратно
    async function batch(its, patch, apply) {
      const before = its.map(it => [it, it.folder, it.fcolor]);
      busy = 'folder'; say('Сохранение…'); draw();
      try {
        for (const it of its) { await MediaLib.update(it.path, patch); apply(it); }
        say('');
      } catch (e) {
        before.forEach(([it, f, c]) => { it.folder = f; it.fcolor = c; });
        say('Не удалось сохранить: ' + errText(e), true);
      }
      busy = '';
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
      drawFolders();
      drawTags();
      const list = visible();
      const total = base().length;
      count.textContent = total ? `${list.length} из ${total}` : '';
      orientSel.hidden = kindF === 'audio';
      grid.innerHTML = '';
      if (busy === 'list') grid.append(h('p', 'ml-empty', 'Загрузка списка…'));
      else if (!list.length) grid.append(h('p', 'ml-empty', total ? 'Ничего не найдено. Измените поиск, папку или фильтры.' : opts.kind === 'audio' ? 'В медиатеке пока нет звуков. Нажмите «Загрузить».' : 'В медиатеке пока ничего нет. Нажмите «Загрузить».'));
      list.forEach(it => {
        const c = h('button', 'ml-card' + (sel.includes(it.path) ? ' sel' : '') + (active === it.path ? ' act' : '') + (it.hidden ? ' hid' : ''));
        c.type = 'button';
        c.title = titleOf(it) + (it.folder ? ' · ' + it.folder : '');
        const th = h('span', 'ml-th');
        if (it.kind === 'audio') {
          th.classList.add('aud');
          th.append(h('span', 'ml-note-ico', '♪'));
          if (it.dur) th.append(h('span', 'ml-dur', fmtDur(it.dur)));
        } else th.append(thumbImg(it));
        c.append(th, h('span', 'ml-name', titleOf(it)));
        if (it.folder) { const d = dot(it.fcolor); d.classList.add('ml-fdot'); c.append(d); }
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
      const gc = MediaLib.duplicateGroups(items.filter(it => !opts.kind || it.kind === opts.kind)).length;
      dupBtn.textContent = gc ? `Дубликаты (${gc})` : 'Дубликаты';
      dupBtn.classList.toggle('on', dupMode);
      if (dupMode) { grid.innerHTML = ''; drawDups(); }
      drawSide();
      drawFoot();
      upBtn();
    }

    // Режим «Дубликаты»: группы файлов с одинаковым содержимым; в каждой выбирается файл, который остаётся, остальные скрываются
    function drawDups() {
      const wrap = h('div', 'ml-dups');
      grid.append(wrap);
      const groups = MediaLib.duplicateGroups(items.filter(it => !opts.kind || it.kind === opts.kind));
      wrap.append(h('p', 'ml-dupnote', 'Здесь файлы, которые полностью совпадают по содержимому. Оставьте один, остальные скройте: из хранилища они не удаляются, упражнения, где они уже есть, продолжают работать.'));
      if (!groups.length) { wrap.append(h('p', 'ml-empty', 'Одинаковых файлов нет.')); return; }
      const key = g => g[0].kind + ':' + g[0].md5;
      const keepOf = g => { const p = dupKeep[key(g)]; return g.some(x => x.path === p) ? p : g[0].path; };
      const extras = g => g.filter(x => x.path !== keepOf(g));
      const total = groups.reduce((n, g) => n + extras(g).length, 0);
      const all = h('button', 'primary', `Скрыть лишние во всех группах (${total})`);
      all.disabled = !user || busy !== '';
      all.title = user ? '' : 'Скрывать файлы может только вошедший через Google';
      all.onclick = () => hideExtras(groups.flatMap(extras));
      wrap.append(all);
      groups.forEach(g => {
        const box = h('div', 'ml-dup');
        box.append(h('div', 'ml-duphead', `Одинаковых файлов: ${g.length}`));
        const row = h('div', 'ml-duprow');
        g.forEach(it => {
          const lab = h('label', 'ml-dupitem' + (keepOf(g) === it.path ? ' keep' : ''));
          const th = h('span', 'ml-th' + (it.kind === 'audio' ? ' aud' : ''));
          if (it.kind === 'audio') { th.append(h('span', 'ml-note-ico', '♪')); if (it.dur) th.append(h('span', 'ml-dur', fmtDur(it.dur))); } else th.append(thumbImg(it));
          const r = h('input');
          r.type = 'radio';
          r.name = 'dup' + key(g);
          r.checked = keepOf(g) === it.path;
          r.onchange = () => { dupKeep[key(g)] = it.path; draw(); };
          const sub = [it.folder, it.origin === 'library' ? 'медиатека' : 'упражнение ' + it.origin].filter(Boolean).join(' · ');
          lab.append(th, h('span', 'ml-name', titleOf(it)), h('span', 'ml-sub', sub), h('span', 'ml-keep', r.checked ? 'Оставить' : 'Скрыть'), r);
          row.append(lab);
        });
        box.append(row);
        const hide = h('button', '', `Скрыть лишние (${extras(g).length})`);
        hide.disabled = !user || busy !== '';
        hide.onclick = () => hideExtras(extras(g));
        box.append(hide);
        wrap.append(box);
      });
    }

    async function hideExtras(its) {
      if (!its.length) return;
      busy = 'dups'; say('Скрываю…'); draw();
      let done = 0;
      try {
        for (const it of its) { await MediaLib.update(it.path, { hidden: true }); it.hidden = true; sel = sel.filter(p => p !== it.path); if (active === it.path) active = null; done++; }
        say(`Скрыто файлов: ${done}.`);
      } catch (e) {
        say(`Скрыто ${done} из ${its.length}. Не удалось сохранить: ` + errText(e), true);
      }
      busy = '';
      draw();
    }

    function drawFoot() {
      const what = opts.kind === 'audio' ? 'звук' : 'картинку';
      picked.textContent = sel.length ? `Выбрано: ${sel.length}` : multi ? 'Отметьте один или несколько файлов' : `Выберите ${what}`;
      okBtn.disabled = !sel.length;
    }

    function upBtn() {
      up.disabled = busy !== '' && busy !== 'list';
      up.textContent = busy.startsWith('up') ? busy.slice(2) : user ? 'Загрузить' : 'Войти для загрузки';
      up.title = user ? 'Новые файлы получают теги и папку, выбранные слева и в фильтре' : 'Загружать и менять файлы может только вошедший через Google';
    }

    function drawSide() {
      side.innerHTML = '';
      const it = items.find(x => x.path === active);
      if (!it) { side.append(h('p', 'ml-empty', 'Нажмите на файл, чтобы увидеть и изменить его свойства.')); return; }
      const big = h('div', 'ml-big');
      if (it.kind === 'audio') {
        const a = h('audio');
        a.controls = true; a.preload = 'none';
        a.src = mediaUrl(it.path) || '';
        big.classList.add('aud');
        big.append(a);
      } else big.append(thumbImg(it, true));
      const edit = !!user;
      const name = h('input');
      name.value = it.name;
      name.placeholder = 'Название';
      name.disabled = !edit;
      name.setAttribute('aria-label', 'Название');
      name.onchange = () => save(it, { name: name.value }, () => { it.name = MediaLib.cleanName(name.value); });
      // Папка файла
      const fsel = h('select');
      fsel.setAttribute('aria-label', 'Папка');
      fsel.disabled = !edit;
      fsel.append(new Option('Без папки', ''));
      folders().forEach(f => fsel.append(new Option(f.name, f.name)));
      if (it.folder && ![...fsel.options].some(o => o.value === it.folder)) fsel.append(new Option(it.folder, it.folder));
      fsel.value = it.folder;
      fsel.onchange = () => {
        const f = fsel.value, c = f ? folderColor(f) : '';
        save(it, { folder: f, fcolor: c }, () => { it.folder = f; it.fcolor = c; });
      };
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
      const rows = [['Формат', (it.type.split('/')[1] || '—').toUpperCase()]];
      if (it.kind === 'audio') rows.push(['Длительность', it.dur ? fmtDur(it.dur) : '—']);
      else rows.push(['Размеры', it.w ? `${it.w} × ${it.h} px` : '—']);
      rows.push(['Размер файла', it.size ? fmtSize(it.size) : '—'], ['Загружено', fmtDate(it.created)], ['Откуда', it.origin === 'library' ? 'медиатека' : 'упражнение ' + it.origin]);
      rows.forEach(([k, v]) => info.append(h('dt', '', k), h('dd', '', v)));
      const hideBtn = h('button', '', it.hidden ? 'Вернуть в список' : 'Скрыть из списка');
      hideBtn.disabled = !edit;
      hideBtn.title = 'Файл не удаляется из хранилища: упражнения, где он уже есть, продолжают работать';
      hideBtn.onclick = () => save(it, { hidden: !it.hidden }, () => { it.hidden = !it.hidden; if (it.hidden && !showHidden) { sel = sel.filter(p => p !== it.path); active = null; } });
      side.append(big, name, h('div', 'ml-lab', 'Папка'), fsel, h('div', 'ml-lab', 'Теги'), tags, tagIn, dl, info, hideBtn);
      if (!edit) side.append(h('p', 'ml-empty', 'Чтобы менять название, папку и теги, войдите через Google (кнопка «Войти для загрузки»).'));
    }

    // Изменение сразу видно; если хранилище отказало, возвращаем как было
    async function save(it, patch, apply) {
      const before = JSON.stringify([it.name, it.tags, it.hidden, it.folder, it.fcolor]);
      apply();
      draw();
      try { await MediaLib.update(it.path, patch); say('', false); }
      catch (e) {
        const [n, t, hd, f, c] = JSON.parse(before);
        it.name = n; it.tags = t; it.hidden = hd; it.folder = f; it.fcolor = c;
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
      const folder = folderSel !== '*' ? folderSel : '', fcolor = folder ? folderColor(folder) : '';
      let ok = 0, failed = false;
      const same = [];
      for (let i = 0; i < list.length; i++) {
        busy = `up${list.length > 1 ? `Загрузка ${i + 1} из ${list.length}…` : 'Загрузка…'}`;
        upBtn();
        // Файл другого вида, чем показывает окно (например, звук в окне картинок), не загружаем
        const k = (MEDIA_TYPES[mediaExt(list[i].name)] || [])[1];
        if (opts.kind && k !== opts.kind) { say(`${list[i].name}: ${opts.kind === 'audio' ? 'здесь нужен звук. ' + MEDIA_NAMES.audio : 'здесь нужна картинка. ' + MEDIA_NAMES.image}.`, true); continue; }
        try {
          const res = await MediaLib.upload(list[i], { tags, folder, fcolor });
          if (res.duplicate) {
            // Такой файл уже есть: второй раз не загружаем, показываем и (при выборе) отмечаем существующий
            const ex = res.existing;
            if (ex.hidden && !showHidden) { showHidden = true; hidBox.checked = true; }
            active = ex.path;
            if (pick && (!opts.kind || ex.kind === opts.kind) && !sel.includes(ex.path)) sel = multi ? [...sel, ex.path] : [ex.path];
            same.push(`«${list[i].name}» уже есть в медиатеке${ex.name ? ' как «' + ex.name + '»' : ''}${ex.hidden ? ' (скрыт)' : ''}`);
            draw();
            continue;
          }
          const it = res;
          if (!items.includes(it)) items = cache = [it, ...items];
          active = it.path;
          if (pick && (!opts.kind || it.kind === opts.kind)) sel = multi ? [...sel, it.path] : [it.path];
          ok++;
          draw();
        } catch (e) {
          failed = true;
          say(`${list[i].name}: ${errText(e)}`, true);
        }
      }
      busy = '';
      if (!failed) say([ok > 1 ? `Загружено файлов: ${ok}.` : '', ...(same.length > 2 ? [`Уже были в медиатеке, повторно не загружались: ${same.length}.`] : same.map(s => s + '. Второй раз не загружал.'))].filter(Boolean).join(' '));
      draw();
    }

    // «По ссылке»: картинка из интернета. В окне выбора (если вызвавший принимает ссылки, opts.link) её можно взять как ссылку —
    // в медиатеку она не попадает; или сохранить в медиатеку обычным файлом. Сохранить можно, только если сайт картинки
    // разрешает её скачать (CORS); показать картинку браузер может и без этого разрешения.
    function drawLink() {
      linkBox.innerHTML = '';
      const row = h('div', 'ml-linkrow');
      const inp = h('input', 'ml-linkin');
      inp.type = 'url';
      inp.placeholder = 'Адрес картинки: https://…/picture.jpg';
      inp.setAttribute('aria-label', 'Адрес картинки');
      const close0 = h('button', 'ml-x', '×');
      close0.setAttribute('aria-label', 'Закрыть «По ссылке»');
      close0.onclick = () => toggleLink(false);
      row.append(inp, close0);
      const body = h('div', 'ml-linkbody');
      linkBox.append(row, body);
      const say0 = (t, bad) => { body.textContent = ''; if (t) body.append(h('p', 'ml-linkmsg' + (bad ? ' bad' : ''), t)); };
      let seq = 0;
      const show = () => {
        const n = ++seq, raw = inp.value.trim(), url = safeImageUrl(raw);
        if (!raw) return say0('');
        if (!url) return say0('Нужен полный адрес, который начинается с https://', true);
        say0('Загружаю картинку…');
        const img = h('img');
        img.alt = '';
        img.onerror = () => { if (n === seq) say0('По этому адресу картинка не открылась. Нужна прямая ссылка на изображение (правой кнопкой по картинке → «Копировать адрес изображения»).', true); };
        img.onload = () => {
          if (n !== seq) return;
          body.textContent = '';
          const prev = h('span', 'ml-linkprev');
          prev.append(img);
          const acts = h('div', 'ml-linkacts');
          if (pick && opts.link) {
            const use = h('button', 'primary', 'Использовать ссылку');
            use.title = 'Картинка останется на чужом сайте и в медиатеку не попадёт';
            use.onclick = () => { close(); opts.onPick([{ kind: 'image', url, name: '', link: true }]); };
            acts.append(use);
          }
          const keep = h('button', pick && opts.link ? '' : 'primary', user ? 'Сохранить в медиатеку' : 'Войти, чтобы сохранить');
          keep.onclick = () => saveFromLink(url, keep);
          acts.append(keep);
          const hint = pick && opts.link ? 'Ссылка: картинка остаётся на чужом сайте; если её там уберут, она пропадёт и у ученика. Сохранить в медиатеку надёжнее.' : 'Картинка будет сохранена в медиатеку обычным файлом.';
          acts.append(h('p', 'ml-linkhint', hint));
          body.append(prev, acts);
        };
        img.src = url;
      };
      inp.oninput = show;
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); show(); } };
      setTimeout(() => inp.focus(), 0);
    }
    function toggleLink(on) {
      linkBox.hidden = !on;
      linkBtn.classList.toggle('on', on);
      linkBtn.setAttribute('aria-pressed', String(on));
      if (on) drawLink();
    }

    async function saveFromLink(url, btn) {
      if (!user) { uploadFiles([]); return; } // запускает вход через Google
      const bad = t => { const m = linkBox.querySelector('.ml-linkhint'); if (m) { m.textContent = t; m.classList.add('bad'); } btn.disabled = false; btn.textContent = 'Сохранить в медиатеку'; };
      btn.disabled = true;
      btn.textContent = 'Скачиваю…';
      let blob;
      try {
        const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        blob = await r.blob();
      } catch (e) {
        return bad('Этот сайт не разрешает сохранять свою картинку. ' + (pick && opts.link ? 'Используйте её как ссылку или скачайте' : 'Скачайте') + ' файл на компьютер и загрузите его кнопкой «Загрузить».');
      }
      const type = (blob.type || '').split(';')[0];
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
      if (!ext) return bad(`Сохранить можно только JPEG, PNG или WebP, а здесь ${type || 'неизвестный формат'}.` + (pick && opts.link ? ' Используйте картинку как ссылку.' : ''));
      // Название — из имени файла в адресе, без расширения и лишних знаков
      let base = '';
      try { base = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch (e) { /* странный адрес: без названия */ }
      base = base.replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'picture';
      toggleLink(false);
      await uploadFiles([new File([blob], base + '.' + ext, { type })]);
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
    linkBtn.onclick = () => toggleLink(linkBox.hidden);
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
