// Медиа (картинки и звук): хранилище Firebase Storage, общее для редактора и плеера.
// В файле упражнения лежит путь внутри бакета (`media/ex-.../img-xxxxxx.webp`) или, как раньше, полный адрес https.
// Адрес собирает mediaUrl(): если хранилище поменяется, правится только этот файл.
// Настройки Firebase (apiKey и остальное) не секрет: доступ защищают правила хранилища (читать может любой, писать — только владелец).
// Номер версии `?v=` у подключения этого файла поднимайте при любом изменении.
const MEDIA_BUCKET = 'dimvibe-7a52e.firebasestorage.app';
const MEDIA_FIREBASE = {
  apiKey: 'AIzaSyBuNq93iSbO8GHKoWndBGxMGVPP-zLz-Y4',
  authDomain: 'dimvibe-7a52e.firebaseapp.com',
  projectId: 'dimvibe-7a52e',
  storageBucket: MEDIA_BUCKET,
  messagingSenderId: '351783026108',
  appId: '1:351783026108:web:a4f183c1b67f78bb95bfb9',
};
const MEDIA_SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

// Допустимые файлы (те же ограничения стоят в правилах хранилища): расширение → тип и вид
const MEDIA_TYPES = {
  jpg: ['image/jpeg', 'image'], jpeg: ['image/jpeg', 'image'], png: ['image/png', 'image'], webp: ['image/webp', 'image'],
  mp3: ['audio/mpeg', 'audio'], m4a: ['audio/mp4', 'audio'], ogg: ['audio/ogg', 'audio'],
};
const MEDIA_MAX = { image: 2 * 1024 * 1024, audio: 10 * 1024 * 1024 };
const MEDIA_ACCEPT = { image: '.jpg,.jpeg,.png,.webp', audio: '.mp3,.m4a,.ogg' };
const MEDIA_NAMES = { image: 'Картинка: JPEG, PNG или WebP, до 2 МБ', audio: 'Звук: MP3, M4A или OGG, до 10 МБ' };

// Путь вида media/<папка>/<файл>; без «..», пробелов и других необычных знаков
function safeMediaPath(path) {
  const p = String(path || '').trim();
  return /^media\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(p) ? p : null;
}

function mediaUrl(path) {
  const p = safeMediaPath(path);
  return p ? `https://firebasestorage.googleapis.com/v0/b/${MEDIA_BUCKET}/o/${encodeURIComponent(p)}?alt=media` : null;
}

// Источник файла: {media} (путь в хранилище) или {url} (внешняя ссылка https). Возвращает адрес или null
function mediaSrc(item) {
  if (!item) return null;
  if (item.media) return mediaUrl(item.media);
  try {
    const u = new URL(String(item.url || '').trim());
    return u.protocol === 'https:' ? u.href : null;
  } catch (e) {
    return null;
  }
}

const mediaExt = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

// Проверка файла до загрузки. kind — 'image' или 'audio'. Возвращает текст ошибки или null
function checkMediaFile(file, kind) {
  const t = MEDIA_TYPES[mediaExt(file.name)];
  if (!t || t[1] !== kind) return 'Этот формат не подходит. ' + MEDIA_NAMES[kind] + '.';
  if (file.size > MEDIA_MAX[kind]) return `Файл слишком большой (${(file.size / 1048576).toFixed(1)} МБ). ${MEDIA_NAMES[kind]}.`;
  return null;
}

// ---- Загрузка (только редактор). Firebase подключается при первом обращении ----
let mediaSdk = null, mediaAuthHooks = new Set();
function mediaLoad() {
  if (!mediaSdk) {
    mediaSdk = (async () => {
      const [app, auth, st] = await Promise.all([
        import(MEDIA_SDK + 'firebase-app.js'), import(MEDIA_SDK + 'firebase-auth.js'), import(MEDIA_SDK + 'firebase-storage.js'),
      ]);
      const a = app.initializeApp(MEDIA_FIREBASE);
      const sdk = { auth, st, a, authInst: auth.getAuth(a), stInst: st.getStorage(a) };
      auth.onAuthStateChanged(sdk.authInst, u => mediaAuthHooks.forEach(h => h(u)));
      return sdk;
    })();
    mediaSdk.catch(() => { mediaSdk = null; });
  }
  return mediaSdk;
}

// Подписка на вход и выход: cb(user | null). Подключает Firebase в фоне; без сети молча ничего не делает
function mediaOnAuth(cb) {
  mediaAuthHooks.add(cb);
  mediaLoad().catch(() => {});
}

async function mediaSignIn() {
  const s = await mediaLoad();
  await s.auth.signInWithPopup(s.authInst, new s.auth.GoogleAuthProvider());
}

async function mediaSignOut() {
  const s = await mediaLoad();
  await s.auth.signOut(s.authInst);
}

function mediaErrorText(e) {
  const c = String((e && e.code) || '');
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Вход отменён.';
  if (c === 'auth/popup-blocked') return 'Браузер заблокировал окно входа. Разрешите всплывающие окна для этого сайта.';
  if (c === 'auth/unauthorized-domain') return 'Этот адрес сайта не добавлен в Firebase (Authentication → Settings → Authorized domains).';
  if (c === 'storage/unauthorized') return 'Нет прав на загрузку. Войдите под той почтой, которая указана в правилах хранилища.';
  if (c === 'storage/unauthenticated') return 'Сначала войдите через Google.';
  if (c === 'storage/retry-limit-exceeded' || c === 'storage/canceled') return 'Загрузка прервалась. Проверьте интернет и повторите.';
  if (c.startsWith('auth/network') || /Failed to fetch|dynamically imported|Importing a module/i.test(String(e && e.message))) return 'Нет связи с Firebase. Проверьте интернет.';
  return 'Не удалось выполнить действие' + (c ? ' (' + c + ')' : '') + '.';
}

// Загружает файл и возвращает путь в хранилище. folder — номер упражнения, kind — 'image' или 'audio'.
// Файл никогда не перезаписывается: у каждой загрузки случайное имя (опубликованное упражнение не должно меняться «под ногами»)
async function mediaUpload(file, kind, folder, onProgress) {
  const bad = checkMediaFile(file, kind);
  if (bad) throw Object.assign(new Error(bad), { userText: bad });
  const s = await mediaLoad();
  if (!s.authInst.currentUser) throw Object.assign(new Error('auth'), { code: 'storage/unauthenticated' });
  const ext = mediaExt(file.name) === 'jpeg' ? 'jpg' : mediaExt(file.name);
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
  const dir = String(folder || 'misc').replace(/[^A-Za-z0-9_-]/g, '') || 'misc';
  const path = `media/${dir}/${kind === 'image' ? 'img' : 'aud'}-${rnd}.${ext}`;
  const ref = s.st.ref(s.stInst, path);
  const task = s.st.uploadBytesResumable(ref, file, { contentType: MEDIA_TYPES[mediaExt(file.name)][0], cacheControl: 'public,max-age=31536000' });
  await new Promise((ok, fail) => {
    task.on('state_changed', snap => onProgress && onProgress(snap.bytesTransferred / snap.totalBytes), fail, ok);
  });
  return path;
}
