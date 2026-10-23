// Медиатека (общая библиотека картинок и звуков для модулей): каталог файлов в Firebase Storage, название, теги и папка — в метаданных файла.
// Работает поверх core/media.js (подключение Firebase, пути, проверки). В упражнениях по-прежнему лежат пути `media/…`, каталога там нет.
// Файлы медиатеки: `media/library/img-<код>.<расширение>` и миниатюра `media/library/th-<код>.webp` (до 256 px); звук — `media/library/aud-<код>.<расширение>`.
// Старые файлы из папок упражнений (`media/ex-…/img-….`) тоже попадают в список, без названия и без миниатюры.
// Удалять файлы из хранилища нельзя (на них могут ссылаться опубликованные упражнения): файл можно только скрыть из списка.
// Номер версии `?v=` у подключения этого файла поднимайте при любом изменении.
const MediaLib = (() => {
  const LIB_DIR = 'media/library';
  const THUMB_SIDE = 256;
  const isThumb = name => /^th-[0-9a-f]+\.webp$/.test(name);
  const cleanTag = t => String(t || '').replace(/[,;\n]/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 30);
  const cleanName = s => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const parseTags = s => [...new Set(String(s || '').split(',').map(cleanTag).filter(Boolean))];

  // Миниатюра рядом с файлом библиотеки: img-<код>.<расширение> → th-<код>.webp
  const thumbPath = path => {
    const m = /^media\/library\/img-([0-9a-f]+)\.[a-z0-9]+$/.exec(path);
    return m ? `${LIB_DIR}/th-${m[1]}.webp` : null;
  };

  // Папка — название и цвет, они хранятся в метаданных каждого файла папки (отдельного каталога папок нет).
  // Пустые папки (только что созданные) живут в этом браузере, пока в них не попадёт файл — решает окно медиатеки
  const cleanFolder = s => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const cleanColor = s => (/^#[0-9a-fA-F]{6}$/.test(String(s || '')) ? String(s).toLowerCase() : '');
  const kindOf = name => (MEDIA_TYPES[mediaExt(name)] || [])[1] || '';

  // Запись каталога из метаданных объекта хранилища
  function itemFrom(path, meta) {
    const c = (meta && meta.customMetadata) || {};
    const w = parseInt(c.w, 10) || 0, h = parseInt(c.h, 10) || 0;
    const kind = kindOf(path) || 'image';
    return {
      path,
      kind, // 'image' или 'audio'
      name: cleanName(c.name),
      tags: parseTags(c.tags),
      hidden: c.hidden === '1',
      folder: cleanFolder(c.folder),
      fcolor: cleanColor(c.fcolor),
      w, h,
      dur: Number(c.dur) || 0, // длительность звука, секунды
      size: Number(meta && meta.size) || 0,
      type: (meta && meta.contentType) || '',
      created: (meta && meta.timeCreated) || '',
      origin: path.split('/')[1] || '',
      thumb: kind === 'image' ? thumbPath(path) : null,
    };
  }

  // Длительность звукового файла в секундах (0, если браузер не смог прочитать)
  function audioDuration(file) {
    return new Promise(ok => {
      const url = URL.createObjectURL(file), a = new Audio();
      const done = v => { URL.revokeObjectURL(url); ok(v); };
      a.preload = 'metadata';
      a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration * 10) / 10 : 0);
      a.onerror = () => done(0);
      setTimeout(() => done(0), 4000);
      a.src = url;
    });
  }

  // Параллельно не больше n задач сразу
  async function pool(list, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
      while (i < list.length) { const k = i++; await fn(list[k], k); }
    }));
  }

  async function listPaths(sdk, ref, out) {
    const r = await sdk.st.listAll(ref);
    r.items.forEach(i => out.push(i.fullPath));
    await Promise.all(r.prefixes.map(p => listPaths(sdk, p, out)));
  }

  // Все картинки и звуки из хранилища (без миниатюр). onProgress(готово, всего) — для строки загрузки списка
  async function list(onProgress) {
    const sdk = await mediaLoad();
    const paths = [];
    await listPaths(sdk, sdk.st.ref(sdk.stInst, 'media'), paths);
    const imgs = paths.filter(p => {
      const name = p.split('/').pop();
      return safeMediaPath(p) && kindOf(name) && !isThumb(name);
    });
    const items = [];
    let done = 0;
    await pool(imgs, 8, async p => {
      try { items.push(itemFrom(p, await sdk.st.getMetadata(sdk.st.ref(sdk.stInst, p)))); } catch (e) { /* файл исчез или недоступен: пропускаем */ }
      if (onProgress) onProgress(++done, imgs.length);
    });
    return items.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  }

  // Картинка → миниатюра (webp до 256 px) и исходные размеры
  async function makeThumb(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, THUMB_SIDE / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * k));
    cv.height = Math.max(1, Math.round(bmp.height * k));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/webp', 0.82));
    const dims = { w: bmp.width, h: bmp.height };
    bmp.close && bmp.close();
    return { blob, ...dims };
  }

  // Загрузка в библиотеку: файл и миниатюра. Файл никогда не перезаписывается (у каждой загрузки случайный код).
  // Картинка: файл и миниатюра; звук: только файл (с длительностью). Вид определяется по расширению
  // meta: {name, tags[], folder, fcolor}; возвращает запись каталога
  async function upload(file, meta, onProgress) {
    const kind = kindOf(file.name) || 'image';
    const bad = checkMediaFile(file, kind);
    if (bad) throw Object.assign(new Error(bad), { userText: bad });
    const sdk = await mediaLoad();
    if (!sdk.authInst.currentUser) throw Object.assign(new Error('auth'), { code: 'storage/unauthenticated' });
    const ext = mediaExt(file.name) === 'jpeg' ? 'jpg' : mediaExt(file.name);
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
    const path = `${LIB_DIR}/${kind === 'image' ? 'img' : 'aud'}-${rnd}.${ext}`;
    let th = null, dur = 0;
    if (kind === 'image') { try { th = await makeThumb(file); } catch (e) { /* без миниатюры список покажет оригинал */ } }
    else dur = await audioDuration(file);
    const name = cleanName(meta && meta.name) || cleanName(file.name.replace(/\.[^.]+$/, ''));
    const tags = ((meta && meta.tags) || []).map(cleanTag).filter(Boolean);
    const folder = cleanFolder(meta && meta.folder), fcolor = cleanColor(meta && meta.fcolor);
    const custom = { name, ...(tags.length ? { tags: tags.join(',') } : {}), ...(folder ? { folder, ...(fcolor ? { fcolor } : {}) } : {}), ...(th ? { w: String(th.w), h: String(th.h) } : {}), ...(dur ? { dur: String(dur) } : {}) };
    const put = (p, blob, type, cm) => new Promise((ok, fail) => {
      const task = sdk.st.uploadBytesResumable(sdk.st.ref(sdk.stInst, p), blob, { contentType: type, cacheControl: 'public,max-age=31536000', ...(cm ? { customMetadata: cm } : {}) });
      task.on('state_changed', s => onProgress && onProgress(s.bytesTransferred / s.totalBytes), fail, ok);
    });
    if (th && th.blob) await put(thumbPath(path), th.blob, 'image/webp');
    await put(path, file, MEDIA_TYPES[mediaExt(file.name)][0], custom);
    return itemFrom(path, { customMetadata: custom, size: file.size, contentType: MEDIA_TYPES[mediaExt(file.name)][0], timeCreated: new Date().toISOString() });
  }

  // Меняет название, теги или признак «скрыт» (поля, которых нет в patch, не трогает)
  async function update(path, patch) {
    const sdk = await mediaLoad();
    if (!sdk.authInst.currentUser) throw Object.assign(new Error('auth'), { code: 'storage/unauthenticated' });
    const cm = {};
    // null удаляет поле из метаданных
    if ('name' in patch) cm.name = cleanName(patch.name) || null;
    if ('tags' in patch) cm.tags = patch.tags.map(cleanTag).filter(Boolean).join(',') || null;
    if ('hidden' in patch) cm.hidden = patch.hidden ? '1' : null;
    if ('folder' in patch) { cm.folder = cleanFolder(patch.folder) || null; cm.fcolor = (cleanFolder(patch.folder) && cleanColor(patch.fcolor)) || null; }
    if ('w' in patch) { cm.w = String(patch.w); cm.h = String(patch.h); }
    await sdk.st.updateMetadata(sdk.st.ref(sdk.stInst, path), { customMetadata: cm });
  }

  // Обмен с хранилищем можно подменить (для проверки интерфейса без сети): MediaLib.backend = { list, upload, update }
  const api = { list, upload, update };
  const out = { backend: api, cleanTag, cleanName, cleanFolder, cleanColor, parseTags, thumbPath, makeThumb, THUMB_SIDE };
  ['list', 'upload', 'update'].forEach(k => { out[k] = (...a) => out.backend[k](...a); });
  return out;
})();
