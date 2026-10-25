// Плеер модуля Ordering: ученик расставляет перемешанные элементы в правильном порядке (за ручку ⋮⋮ или стрелками).
// Общая часть прохождения — шапка, инструкция, результат, сброс — живёт в index.html.
// Каждое место в последовательности — единица общего хода (unit): answer — ID элемента, который должен там стоять,
// value — ID элемента, который поставил ученик (заполняется при проверке). Проверка одна, итоговая (решение архива D-069).
const OrderingPlayer = (() => {
  let seqs = [];
  let orders = {}; // ID последовательности → порядок ID элементов на экране
  let moved = false; // ученик уже переставлял элементы (для вопроса «Начать заново?»)
  let fresh = false, cache = null; // fresh: упражнение только что собрано (units); cache: порядок для предпросмотра

  const instant = () => false;
  const maxChecks = () => 1;
  const unitId = (s, p) => s.id + ':' + p;

  function units() {
    seqs = Array.isArray(data.sequences) ? data.sequences : [];
    fresh = true;
    return seqs.flatMap(s => (s.items || []).map((it, p) => ({
      id: unitId(s, p), answer: it.id, alternatives: [], hint: '', audio: null, hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    })));
  }

  // Перемешивание, которое никогда не совпадает с правильным порядком
  function mix(ids) {
    if (ids.length < 2) return ids.slice();
    for (let k = 0; k < 20; k++) {
      const r = shuffle(ids);
      if (r.some((x, i) => x !== ids[i])) return r;
    }
    return ids.slice(1).concat(ids[0]);
  }

  // Новое прохождение — новое перемешивание. В предпросмотре редактора каждая правка пересобирает упражнение:
  // пока набор элементов тот же, порядок не меняем, чтобы карточки не прыгали
  function reset() {
    const sig = seqs.map(s => (s.items || []).map(i => i.id).sort().join(' ')).join('|');
    const reuse = fresh && params.has('preview') && cache && cache.sig === sig;
    fresh = false;
    moved = false;
    if (reuse) { orders = JSON.parse(JSON.stringify(cache.orders)); return; }
    orders = {};
    seqs.forEach(s => { orders[s.id] = mix((s.items || []).map(i => i.id)); });
    cache = { sig, orders: JSON.parse(JSON.stringify(orders)) };
  }

  // Одна проверка: каждое место сравнивается один раз, после неё порядок не меняется
  function check() {
    seqs.forEach(s => (orders[s.id] || []).forEach((id, p) => {
      const g = gaps.find(x => x.id === unitId(s, p));
      if (!g) return;
      g.value = id;
      g.locked = id === g.answer;
      g.state = g.locked ? 'ok' : 'bad';
    }));
    return { done: true };
  }

  const status = () => (finished || checksUsed ? null : 'Расставьте элементы по порядку. Проверка одна.');
  const started = () => moved;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svg = inner => `<svg class="or-ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

  function place(s, from, to) {
    const o = orders[s.id];
    if (to < 0 || to >= o.length || from === to) return;
    const [id] = o.splice(from, 1);
    o.splice(to, 0, id);
    moved = true;
    note = '';
  }

  function seqCard(s, k) {
    const many = seqs.length > 1;
    const c = el('div', 'card or-card');
    c.dataset.s = s.id;
    if (many) c.append(el('p', 'or-snum', `Последовательность ${k + 1}`));
    const ins = String(s.instruction || '').trim();
    if (ins) c.append(el('p', 'or-sinstr', ins));
    const byId = Object.fromEntries((s.items || []).map(i => [i.id, i]));
    const list = el('ol', 'or-list');
    const o = orders[s.id] || [];
    o.forEach((id, p) => {
      const it = byId[id];
      if (!it) return;
      const g = gaps.find(x => x.id === unitId(s, p));
      const st = finished && g ? (g.state === 'ok' ? ' ok' : ' bad') : '';
      const li = el('li', 'card or-item' + st);
      const num = el('span', 'or-num', String(p + 1));
      const text = el('span', 'or-text', it.text);
      if (!finished) {
        const grip = el('button', 'or-grip');
        grip.type = 'button';
        grip.innerHTML = OrderingDrag.GRIP;
        grip.title = 'Перетащить';
        grip.setAttribute('aria-label', `Перетащить: ${it.text}`);
        const b = (html, tip, to, disabled) => { const x = el('button', 'or-ib'); x.type = 'button'; x.innerHTML = html; x.title = tip; x.setAttribute('aria-label', `${tip}: ${it.text}`); x.disabled = disabled; x.onclick = () => { place(s, p, to); render(); }; return x; };
        const arrows = el('span', 'or-arrows');
        arrows.append(b(svg('<path d="M6 15l6-6 6 6"/>'), 'Выше', p - 1, p === 0), b(svg('<path d="M6 9l6 6 6-6"/>'), 'Ниже', p + 1, p === o.length - 1));
        li.append(grip, num, text, arrows);
      } else {
        li.append(num, text, el('span', st === ' ok' ? 'or-tick' : 'or-cross', st === ' ok' ? '✓' : '✗'));
        li.setAttribute('aria-label', `${p + 1}. ${it.text}, ${st === ' ok' ? 'верно' : 'неверно'}`);
        // У неверного места — какой элемент должен был здесь стоять (если автор включил «Показывать правильный ответ»)
        if (st === ' bad' && data.showAnswers === true && g && byId[g.answer]) {
          const right = el('span', 'or-right');
          right.append(el('span', 'or-right-l', 'Правильно: '), document.createTextNode(byId[g.answer].text));
          li.append(right);
        }
      }
      list.append(li);
    });
    if (!finished) OrderingDrag.attach(list, { itemSel: '.or-item', handleSel: '.or-grip', onDrop: (from, to) => { place(s, from, to); render(); } });
    c.append(list);
    return c;
  }

  function renderInto(root) {
    seqs.forEach((s, k) => root.append(seqCard(s, k)));
  }

  // Проверка своя (check), «не заполнено» у Ordering не бывает: порядок есть всегда
  const goMissing = () => {};
  const missingNote = () => '';

  return { units, reset, check, status, started, instant, maxChecks, goMissing, missingNote, render: renderInto };
})();
