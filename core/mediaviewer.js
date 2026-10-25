// Общий просмотр картинки крупно поверх страницы (без новой вкладки). addZoom(...) — лупа на углу картинки; openMediaViewer(src, alt) показывает окно;
// закрывается кнопкой ×, Esc, щелчком мимо картинки. Фокус возвращается на кнопку, с которой открыли.
// Стили вставляются отсюда, чтобы подключать один файл. Номер версии `?v=` у подключения поднимайте при изменении.
(() => {
  const css = `
.mv { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.78); }
.mv img { max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; background:var(--card, #fff); box-shadow:0 8px 32px rgba(0,0,0,.5); }
.mv .mv-x { position:absolute; top:10px; right:10px; bottom:auto; width:44px; height:44px; min-height:0; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.6); background:rgba(0,0,0,.55); color:#fff; font-size:1.5rem; line-height:1; cursor:pointer; }
.mv-host { position:relative; }
.mv-host .mv-zoom { position:absolute; top:0; left:0; right:auto; bottom:auto; z-index:3; width:32px; height:32px; min-height:0; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.7); background:rgba(0,0,0,.55); color:#fff; cursor:zoom-in; opacity:0; transition:opacity .15s; }
.mv-host .mv-zoom svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; }
.mv-host:has(.mv-target:hover) .mv-zoom, .mv-host .mv-zoom:hover, .mv-host .mv-zoom:focus-visible { opacity:1; }
@media (hover:none) { .mv-host .mv-zoom { opacity:1; } }
.mv-host .mv-zoom::before { inset:-4px; }
.mv-host .mv-zoom.mv-zoom-sm { width:22px; height:22px; }
.mv-host .mv-zoom.mv-zoom-sm svg { width:13px; height:13px; }
.mv-host .mv-zoom.mv-zoom-sm::before { inset:0; }
`;
  let box = null, back = null;
  const addStyle = () => {
    if (document.getElementById('mv-style')) return;
    const st = document.createElement('style');
    st.id = 'mv-style';
    st.textContent = css;
    document.head.append(st);
  };

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
    addStyle();
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

  // Лупа в правом верхнем углу самой картинки (решение владельца 2026-10-25): видна при наведении на картинку,
  // на сенсорных экранах — всегда. host — блок, куда кладётся кнопка (не внутри другой кнопки: кнопку в кнопке
  // браузер не нажимает, когда вариант уже заблокирован); target — рамка с картинкой <img>.
  // При «вписать целиком» угол считается по видимой части картинки, а не по рамке. Невидимая область нажатия у лупы
  // меньше, чем у других круглых кнопок (4 px, у маленькой — 0), чтобы не мешать перетаскиванию карточки за картинку.
  window.addZoom = function addZoom(host, target, src, alt) {
    if (!src || !host || !target) return null;
    addStyle();
    host.classList.add('mv-host');
    target.classList.add('mv-target');
    const z = document.createElement('button');
    z.type = 'button';
    z.className = 'mv-zoom hintbtn'; // hintbtn — исключение из контуров Comic
    z.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>';
    z.title = 'Увеличить';
    z.setAttribute('aria-label', 'Увеличить картинку');
    z.onclick = e => { e.stopPropagation(); openMediaViewer(src, alt); };
    host.append(z);
    const place = () => {
      const img = target.querySelector('img');
      const f = (img || target).getBoundingClientRect(), h = host.getBoundingClientRect();
      if (!f.width || !h.width) return;
      let right = f.right, top = f.top, w = f.width, ht = f.height;
      if (img && img.naturalWidth && getComputedStyle(img).objectFit === 'contain') {
        const k = Math.min(f.width / img.naturalWidth, f.height / img.naturalHeight);
        w = img.naturalWidth * k; ht = img.naturalHeight * k;
        right = f.right - (f.width - w) / 2;
        top = f.top + (f.height - ht) / 2;
      }
      // Маленькая картинка (размер S, карточки для перетаскивания): лупа меньше и вплотную к углу, чтобы за картинку можно было взять
      const small = Math.min(w, ht) < 100, pad = small ? 2 : 6;
      z.classList.toggle('mv-zoom-sm', small);
      z.style.left = Math.max(0, right - h.left - z.offsetWidth - pad) + 'px';
      z.style.top = Math.max(0, top - h.top + pad) + 'px';
    };
    const img = target.querySelector('img');
    if (img) img.addEventListener('load', place);
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(place); ro.observe(target); ro.observe(host); }
    requestAnimationFrame(place);
    return z;
  };
})();
