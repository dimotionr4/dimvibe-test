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

  // Отпечаток файла для поиска одинаковых: MD5 в base64 — тот же, что хранилище записывает в метаданные каждого объекта (md5Hash),
  // поэтому старые файлы сравниваются без скачивания. Для нового файла считаем сами
  function md5Bytes(buf) {
    const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const len = buf.length, total = (((len + 8) >>> 6) + 1) << 6;
    const m = new Uint8Array(total);
    m.set(buf);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, (len << 3) >>> 0, true);
    dv.setUint32(total - 4, Math.floor(len / 536870912), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        const s = S[(i >> 4) * 4 + (i & 3)];
        B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16), o = new DataView(out.buffer);
    o.setUint32(0, a0, true); o.setUint32(4, b0, true); o.setUint32(8, c0, true); o.setUint32(12, d0, true);
    return out;
  }
  async function fileFingerprint(file) {
    return btoa(String.fromCharCode(...md5Bytes(new Uint8Array(await file.arrayBuffer()))));
  }

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
      md5: (meta && meta.md5Hash) || '',
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
    return itemFrom(path, { customMetadata: custom, size: file.size, md5Hash: meta && meta.md5, contentType: MEDIA_TYPES[mediaExt(file.name)][0], timeCreated: new Date().toISOString() });
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

  // Группы одинаковых файлов (одинаковый отпечаток и вид) среди нескрытых; в группе от двух файлов.
  // Первым в группе стоит файл, который разумнее оставить: с названием, из библиотеки, в папке, с тегами, потом самый старый
  function duplicateGroups(items) {
    const by = new Map();
    items.forEach(it => {
      if (it.hidden || !it.md5) return;
      const k = it.kind + ':' + it.md5;
      by.set(k, [...(by.get(k) || []), it]);
    });
    const score = it => (it.name ? 2 : 0) + (it.origin === 'library' ? 1 : 0) + (it.folder ? 1 : 0) + (it.tags.length ? 1 : 0);
    return [...by.values()].filter(g => g.length > 1)
      .map(g => g.sort((a, b) => score(b) - score(a) || (a.created || '').localeCompare(b.created || '')))
      .sort((a, b) => (a[0].name || '').localeCompare(b[0].name || '', 'ru'));
  }

  // Обмен с хранилищем можно подменить (для проверки интерфейса без сети): MediaLib.backend = { list, upload, update }
  const api = { list, upload, update };
  const out = { backend: api, cache: null, cleanTag, cleanName, cleanFolder, cleanColor, parseTags, thumbPath, makeThumb, md5Bytes, fileFingerprint, duplicateGroups, THUMB_SIDE };
  out.list = async (...a) => { const r = await out.backend.list(...a); out.cache = r; return r; };
  out.update = (...a) => out.backend.update(...a);
  // Защита от дублей: если точно такой файл уже есть в медиатеке, второй раз он не загружается. Возвращается запись
  // существующего файла с признаком duplicate (сама запись — в existing). Если список недоступен, файл просто загружается
  out.upload = async (file, meta, onProgress) => {
    const kind = kindOf(file.name) || 'image';
    let md5 = '';
    try { md5 = await fileFingerprint(file); } catch (e) { /* без отпечатка загружаем как обычно */ }
    if (md5) {
      let known = out.cache;
      if (!known) { try { known = await out.list(); } catch (e) { known = null; } }
      const dup = known && known.find(x => x.md5 === md5 && x.kind === kind);
      if (dup) return { ...dup, duplicate: true, existing: dup };
    }
    const it = await out.backend.upload(file, { ...(meta || {}), md5 }, onProgress);
    if (out.cache) out.cache.unshift(it);
    return it;
  };
  return out;
})();