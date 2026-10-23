// Плеер модуля True / False: ученик выбирает для каждого утверждения одну категорию ответа.
// Общая часть прохождения — шапка, инструкция, проверки, закрепление, результат, сброс — живёт в index.html и работает
// с теми же переменными (data, gaps, finished, note, checksUsed) и функцией render(). Здесь только то, что отличает модуль:
// карточки утверждений, показ «по одному» или «списком», пояснения. Каждое утверждение — «пропуск» общего хода: answer — верная категория (a, b, c),
// value — выбранная.
const TrueFalsePlayer = (() => {
  let idx = 0; // какое утверждение показано в режиме «по одному»
  let refocus = null; // куда вернуть фокус после перерисовки
  const listView = () => data.view === 'list';

  function labelsOf(item) {
    const a = item.answers || data.answers || {};
    const out = [{ k: 'a', text: String(a.a || '') }, { k: 'b', text: String(a.b || '') }];
    if (typeof a.c === 'string') out.push({ k: 'c', text: a.c });
    return out;
  }

  // Утверждения как единицы общего хода: подсказок нет, звук — озвучка утверждения
  function units() {
    return data.items.map(it => ({
      id: it.id, answer: it.correct, alternatives: [], hint: '', audio: mediaSrc(it.audio), hintAudio: null,
      value: '', bankKey: null, locked: false, state: null,
    }));
  }

  const reset = () => { idx = 0; refocus = null; };

  // Не отвеченные утверждения: в режиме «по одному» показываем первое из них
  function goMissing() {
    const i = gaps.findIndex(g => g.state === 'missing');
    if (i >= 0) idx = i;
  }

  function pick(i, key) {
    const g = gaps[i];
    if (frozen(g)) return;
    g.value = g.value === key ? '' : key; // повторное нажатие снимает выбор
    g.state = null;
    note = '';
    refocus = `.tf-card[data-i="${i}"] .tf-ans[data-k="${key}"]`;
    render();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(i) {
    const item = data.items[i], g = gaps[i];
    const c = el('div', 'card tf-card' + (g.state ? ' ' + g.state : '') + (g.locked ? ' locked' : ''));
    c.dataset.i = i;
    const head = el('div', 'tf-q');
    if (data.items.length > 1) head.append(el('span', 'tf-num', `${i + 1}.`));
    head.append(el('span', 'tf-text', item.text));
    if (g.audio) head.append(audioButton(g.audio, 't' + i, 'hintbtn tf-voice', '🔊', 'Прослушать утверждение'));
    c.append(head);
    const row = el('div', 'tf-answers');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Ответ на утверждение ${i + 1}`);
    labelsOf(item).forEach(l => {
      const chosen = g.value === l.k;
      const b = el('button', 'tf-ans' + (chosen ? ' active' : '') + (chosen && g.state ? ' ' + g.state : ''));
      b.type = 'button';
      b.dataset.k = l.k;
      b.setAttribute('aria-pressed', String(chosen));
      b.append(el('span', 'tf-lab', l.text));
      // Результат не только цветом: у верного ✓, у неверного ✗
      if (chosen && g.state === 'ok') b.append(el('span', 'tf-mark', ' ✓'));
      if (chosen && g.state === 'bad') b.append(el('span', 'tf-mark', ' ✗'));
      if (frozen(g)) b.disabled = true;
      else b.onclick = () => pick(i, l.k);
      row.append(b);
    });
    c.append(row);
    // Пояснение: после проверки только у верно отвеченных (закреплённых), в конце упражнения у всех
    const ex = String(item.explanation || '').trim();
    if (ex && (g.locked || finished)) {
      const box = el('div', 'tf-expl');
      box.append(el('b', '', 'Пояснение: '), document.createTextNode(ex));
      c.append(box);
    }
    return c;
  }

  // Навигация режима «по одному»: номера утверждений с отметками и кнопки «Предыдущее / Следующее»
  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Утверждения');
    gaps.forEach((g, i) => {
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (g.value ? ' answered' : '') + (g.state ? ' ' + g.state : ''), String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Утверждение ${i + 1}` + (i === idx ? ', текущее' : '') + (g.state === 'ok' ? ', верно' : g.state === 'bad' ? ', неверно' : g.value ? ', ответ выбран' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; refocus = `.tf-dot:nth-child(${i + 1})`; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущее'), next = el('button', '', 'Следующее ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= gaps.length - 1;
    prev.onclick = () => { idx--; refocus = '.tf-pager button:first-child'; render(); };
    next.onclick = () => { idx++; refocus = '.tf-pager button:last-child'; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${gaps.length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= data.items.length) idx = Math.max(0, data.items.length - 1);
    if (listView() || data.items.length < 2) data.items.forEach((_, i) => root.append(card(i)));
    else { nav(root); root.append(card(idx)); pager(root); }
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, goMissing, render: renderInto };
})();
