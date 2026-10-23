// Общий просмотр картинки крупно поверх страницы (без новой вкладки). openMediaViewer(src, alt) показывает окно;
// закрывается кнопкой ×, Esc, щелчком мимо картинки. Фокус возвращается на кнопку, с которой открыли.
// Стили вставляются отсюда, чтобы подключать один файл. Номер версии `?v=` у подключения поднимайте при изменении.
(() => {
  const css = `
.mv { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.78); }
.mv img { max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; background:var(--card, #fff); box-shadow:0 8px 32px rgba(0,0,0,.5); }
.mv .mv-x { position:absolute; top:10px; right:10px; bottom:auto; width:44px; height:44px; min-height:0; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.6); background:rgba(0,0,0,.55); color:#fff; font-size:1.5rem; line-height:1; cursor:pointer; }
`;
  let box = null, back = null;

  function close() {
    if (!box) return;
    box.remove();
    box = null;
    document.removeEventListener('keydown', onKey, true);
    if (back && back.isConnected) back.focus({ preventScroll: true });
    back = null;
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  window.openMediaViewer = function openMediaViewer(src, alt) {
    if (!src) return;
    close();
    if (!document.getElementById('mv-style')) {
      const st = document.createElement('style');
      st.id = 'mv-style';
      st.textContent = css;
      document.head.append(st);
    }
    back = document.activeElement;
    box = document.createElement('div');
    box.className = 'mv';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Просмотр картинки');
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.referrerPolicy = 'no-referrer';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'mv-x hintbtn'; // hintbtn: общий вид круглой кнопки и исключение из контуров Comic
    x.textContent = '×';
    x.setAttribute('aria-label', 'Закрыть');
    x.onclick = close;
    box.onclick = e => { if (e.target !== img) close(); };
    box.append(img, x);
    document.body.append(box);
    document.addEventListener('keydown', onKey, true);
    x.focus({ preventScroll: true });
  };
})();
