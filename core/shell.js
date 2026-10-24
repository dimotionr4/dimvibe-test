// Общее для левой панели страниц DimVibe (редактор, табло, «Мои упражнения», «Настройки»):
// настройки панели в браузере и ручка для изменения ширины. Ничего не знает о модулях и упражнениях.
// Настройки: dimvibe.settings.v1 = { sideWidth: 200–400, autoCollapse: bool }.
(function () {
  const KEY = 'dimvibe.settings.v1', DEF = { sideWidth: 260, autoCollapse: false };
  const clamp = w => Math.min(400, Math.max(200, Math.round(w) || 260));
  const read = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return Object.assign({}, DEF); } };
  const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  const applyWidth = w => document.documentElement.style.setProperty('--sw', clamp(w) + 'px');

  const css = document.createElement('style');
  css.textContent = `
    .side-resizer { display:none; position:absolute; top:0; bottom:0; right:0; width:7px; cursor:col-resize; touch-action:none; z-index:2; }
    .side-resizer::after { content:""; position:absolute; top:0; bottom:0; right:0; width:1px; background:transparent; }
    .side-resizer:hover::after, .side-resizer:focus-visible::after, body.side-dragging .side-resizer::after { width:3px; background:var(--accent, #6d4aff); }
    body.side-dragging { cursor:col-resize; user-select:none; }
    body.side-dragging iframe { pointer-events:none; }
    @media (min-width:901px) { #side:not(.collapsed) .side-resizer { display:block; } }`;
  document.head.appendChild(css);

  // Ручка на правом краю панели: тянуть мышью или пальцем, со стрелками ← → — шаг 10 px; Home — вернуть 260 px
  function attachResizer(side, onChange) {
    const h = document.createElement('div');
    h.className = 'side-resizer';
    h.setAttribute('role', 'separator');
    h.setAttribute('aria-orientation', 'vertical');
    h.setAttribute('aria-label', 'Ширина панели');
    h.tabIndex = 0;
    side.appendChild(h);
    const save = w => { const s = read(); s.sideWidth = clamp(w); write(s); applyWidth(s.sideWidth); if (onChange) onChange(s.sideWidth); };
    h.addEventListener('pointerdown', e => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      document.body.classList.add('side-dragging');
      const left = side.getBoundingClientRect().left;
      const move = ev => applyWidth(ev.clientX - left);
      const up = ev => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        document.body.classList.remove('side-dragging');
        save(ev.clientX - left);
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    h.addEventListener('keydown', e => {
      const w = read().sideWidth;
      if (e.key === 'ArrowLeft') save(w - 10); else if (e.key === 'ArrowRight') save(w + 10); else if (e.key === 'Home') save(DEF.sideWidth); else return;
      e.preventDefault();
    });
  }

  window.DimShell = {
    read, write, clamp, applyWidth, attachResizer,
    // Ширина применяется сразу; ручка — если передан элемент панели
    init(side, onChange) { applyWidth(read().sideWidth); if (side) attachResizer(side, onChange); }
  };
})();
