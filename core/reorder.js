// Перетаскивание элементов списка за ручку — общее для модулей «расставить по порядку» (Ordering, Timeline): редактор и плеер.
// Работает на событиях указателя (мышь и палец): HTML5-перетаскивание пальцем не работает.
// Страница прокручивается как обычно, если тянуть не за ручку: у ручки touch-action:none (в CSS модуля).
// Во время переноса элемент едет за пальцем, соседи меняются с ним местами прямо в списке; у края окна список прокручивается сам.
const Reorder = (() => {
  const EDGE = 48, SPEED = 14; // зона у края окна, где включается прокрутка, и её скорость (px за кадр)

  // Ближайший прокручиваемый родитель (в плеере это <main>), иначе вся страница
  function scrollerOf(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  // list — контейнер; itemSel — элементы списка (прямые дети); handleSel — ручка внутри элемента.
  // onDrop(from, to) вызывается, если место элемента изменилось; onStart() — когда перенос начался.
  // dragClass / listClass — классы переносимого элемента и списка на время переноса (у каждого модуля свои)
  function attach(list, { itemSel, handleSel, onDrop, onStart, dragClass = 'rd-dragging', listClass = 'rd-dragging-list' }) {
    list.addEventListener('pointerdown', e => {
      const handle = e.target.closest(handleSel);
      if (!handle || !list.contains(handle) || handle.disabled || e.button > 0) return;
      const item = handle.closest(itemSel);
      if (!item || item.parentElement !== list) return;
      e.preventDefault();
      const items = () => [...list.children].filter(c => c.matches(itemSel));
      const from = items().indexOf(item);
      const sc = scrollerOf(list);
      const st = () => (sc === document.scrollingElement || sc === document.documentElement ? window.scrollY : sc.scrollTop);
      let lastY = e.clientY, startY = e.clientY + st(), raf = 0;
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      item.classList.add(dragClass);
      list.classList.add(listClass);
      if (onStart) onStart();

      // Сдвиг элемента за пальцем; если его середина прошла середину соседа — меняем их местами в списке
      // При резком рывке элемент может пройти сразу несколько соседей: меняемся, пока есть с кем
      function follow() {
        const y = lastY + st();
        for (let guard = 0; guard < 50; guard++) {
          const mid = item.offsetTop + item.offsetHeight / 2 + (y - startY);
          const prev = item.previousElementSibling, next = item.nextElementSibling;
          const top0 = item.offsetTop;
          if (next && next.matches(itemSel) && mid > next.offsetTop + next.offsetHeight / 2) list.insertBefore(next, item);
          // Двигаем соседа, а не сам элемент: перенос элемента в списке снял бы с ручки захват указателя
          else if (prev && prev.matches(itemSel) && mid < prev.offsetTop + prev.offsetHeight / 2) list.insertBefore(prev, item.nextSibling);
          else break;
          startY += item.offsetTop - top0; // место в списке сменилось: сдвиг считаем от нового места
        }
        item.style.transform = `translateY(${y - startY}px)`;
      }
      // У верхнего или нижнего края видимой области список прокручивается сам
      function tick() {
        const r = sc === document.scrollingElement || sc === document.documentElement ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
        const v = lastY < r.top + EDGE ? -SPEED : lastY > r.bottom - EDGE ? SPEED : 0;
        if (v) {
          if (sc === document.scrollingElement || sc === document.documentElement) window.scrollBy(0, v); else sc.scrollTop += v;
          follow();
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      const move = ev => { if (ev.pointerId !== e.pointerId) return; ev.preventDefault(); lastY = ev.clientY; follow(); };
      const end = ev => {
        if (ev.pointerId !== e.pointerId) return;
        cancelAnimationFrame(raf);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        item.style.transform = '';
        item.classList.remove(dragClass);
        list.classList.remove(listClass);
        const to = items().indexOf(item);
        if (to !== from) onDrop(from, to);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  // Ручка «⋮⋮» (шесть точек)
  const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

  // Перемешивание, которое никогда не совпадает с исходным (правильным) порядком: иначе ученик сразу видит ответ.
  // shuffleFn — общий shuffle плеера (index.html)
  function mix(ids, shuffleFn) {
    if (ids.length < 2) return ids.slice();
    for (let k = 0; k < 20; k++) {
      const r = shuffleFn(ids);
      if (r.some((x, i) => x !== ids[i])) return r;
    }
    return ids.slice(1).concat(ids[0]);
  }

  return { attach, GRIP, mix };
})();
