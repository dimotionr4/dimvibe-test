// Плеер модуля Odd One Out: в каждой группе ученик нажимает на лишний элемент.
// Общая часть прохождения — шапка, инструкция, проверка, число проверок, результат, сброс — живёт в index.html.
// Каждая группа — единица общего хода (unit): answer — ID лишнего элемента, value — ID выбранного.
// Проверка общая (index.html): у всех групп должен быть выбор, верные закрепляются, неверные можно поменять.
const OddOneOutPlayer = (() => {
  let idx = 0; // какая группа показана
  let fresh = false; // упражнение только что собрано (units)
  let orders = {}; // ID группы → {key, ids}: порядок элементов на это прохождение
  const groups = () => data.groups || [];
  const listView = () => data.view === 'list'; // «все группы сразу»: карточки друг под другом, без переключателя
  const unitOf = gr => gaps.find(g => g.id === gr.id);

  // Порядок перемешивается один раз на прохождение. Предпросмотр редактора пересобирает упражнение после каждой правки:
  // пока набор элементов группы тот же, порядок не меняется, чтобы элементы не «прыгали»
  function orderOf(gr) {
    const ids = (gr.items || []).map(i => i.id), key = ids.join(',') + (data.shuffle === false ? '|fixed' : '');
    if (!orders[gr.id] || orders[gr.id].key !== key) orders[gr.id] = { key, ids: data.shuffle === false ? ids : shuffle(ids) };
    return orders[gr.id].ids;
  }

  function units() {
    fresh = true;
    return groups().map(gr => ({
      id: gr.id, answer: String(gr.odd || ''), alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  // Новое прохождение и «Начать заново» — новое перемешивание (кроме пересборки в предпросмотре)
  function reset() {
    if (!(fresh && params.has('preview'))) orders = {};
    fresh = false;
    idx = 0;
  }

  // Нажатие выбирает элемент, нажатие на другой меняет выбор, повторное нажатие на выбранный снимает его
  function choose(gr, itemId) {
    const g = unitOf(gr);
    if (!g || finished || g.locked) return;
    g.value = g.value === itemId ? '' : itemId;
    g.state = null;
    note = '';
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Элемент — блок, а не кнопка (на этапе картинок и звука внутри появятся кнопки лупы и звука).
  // Класс .chip даёт в Comic овальный контур, .card — прямоугольный
  function item(gr, g, it) {
    const on = g.value === it.id, odd = it.id === g.answer;
    // on — выбран; ok — верный выбор (закреплён); bad — неверный выбор после проверки;
    // right — в конце показан лишний, если ученик ошибся и автор включил «Показывать правильный ответ»
    const st = on && g.locked ? 'ok' : on && g.state === 'bad' ? 'bad' : on ? 'on' : finished && odd && data.showAnswers === true ? 'right' : '';
    const fixed = finished || g.locked;
    const b = el('div', (data.look === 'cards' ? 'card' : 'chip') + ' oo-item' + (st ? ' ' + st : '') + (fixed ? ' fixed' : ''));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(on));
    b.append(el('span', 'oo-text', it.text));
    if (st === 'ok' || st === 'right') b.append(el('span', 'oo-tick', '✓'));
    if (st === 'bad') b.append(el('span', 'oo-cross', '✗'));
    if (st) b.setAttribute('aria-label', it.text + { ok: ', верно', bad: ', неверно', on: ', выбран', right: ', лишний' }[st]);
    if (fixed) b.setAttribute('aria-disabled', 'true');
    else b.onclick = e => { if (!e.target.closest('button')) choose(gr, it.id); };
    return b;
  }

  function groupCard(k) {
    const gr = groups()[k], g = unitOf(gr);
    const c = el('div', 'card oo-card' + (g && g.state === 'missing' ? ' missing' : ''));
    c.dataset.g = gr.id;
    if (groups().length > 1 && listView()) c.append(el('p', 'oo-gnum', `Группа ${k + 1}`)); // при показе всех групп сразу каждая подписана номером
    const prompt = String(gr.prompt || '').trim();
    c.append(el('p', 'oo-ask' + (prompt ? ' oo-own' : ''), prompt || 'Найдите лишнее.'));
    const box = el('div', 'oo-items ' + (data.look === 'cards' ? 'oo-cards' : 'oo-chips'));
    box.setAttribute('role', 'radiogroup');
    box.setAttribute('aria-label', prompt || `Группа ${k + 1}`);
    const byId = Object.fromEntries((gr.items || []).map(i => [i.id, i]));
    orderOf(gr).forEach(id => { if (byId[id]) box.append(item(gr, g, byId[id])); });
    c.append(box);
    // Пояснение — после верного ответа или в конце упражнения (при ошибке до конца не раскрывается)
    const ex = String(gr.explanation || '').trim();
    if (ex && (g.locked || finished)) c.append(el('p', 'oo-expl', ex));
    return c;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Группы');
    groups().forEach((gr, i) => {
      const g = unitOf(gr);
      const st = g.locked ? ' ok' : g.state === 'bad' ? ' bad' : g.state === 'missing' ? ' missing' : '';
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (g.value ? ' answered' : '') + st, String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Группа ${i + 1}` + (i === idx ? ', текущая' : '') + (g.locked ? ', верно' : g.state === 'bad' ? ', неверно' : g.value ? ', выбор сделан' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущая'), next = el('button', '', 'Следующая ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= groups().length - 1;
    prev.onclick = () => { idx--; render(); };
    next.onclick = () => { idx++; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${groups().length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= groups().length) idx = Math.max(0, groups().length - 1);
    const one = groups().length > 1 && !listView(); // переключатель нужен только при показе «по одной»
    if (one) nav(root);
    if (one || groups().length < 2) { if (groups().length) root.append(groupCard(idx)); }
    else groups().forEach((_, k) => root.append(groupCard(k)));
    if (one) pager(root);
  }

  // Неполный ответ: показать первую группу без выбора (при показе «по одной»)
  function goMissing() { const i = gaps.findIndex(g => g.state === 'missing'); if (i >= 0) idx = i; }
  const missingNote = n => (groups().length === 1 ? 'Выберите лишнее, потом нажмите «Проверить».' : n === 1 ? 'Выберите лишнее в группе, которая осталась без ответа.' : `Выберите лишнее во всех группах: ещё ${n}.`);
  const instant = () => false;

  return { units, reset, goMissing, missingNote, instant, render: renderInto };
})();
