// Плеер модуля Essay Writing: ученик пишет текст по заданию и видит, какие условия выполнены (слова, абзацы, нужные и запрещённые слова).
// Баллов и проверок нет, качество текста не оценивается; сервера нет — текст остаётся у ученика, его можно скопировать.
// Общая часть прохождения (шапка, инструкция, ↻) живёт в index.html. Единиц ответа нет (units пуст), кнопки «Проверить» нет (instant),
// строку внизу пишет status(). Текст сохраняется как черновик в браузере ученика (решение владельца 2026-10-25, пункт 6Б),
// «Начать заново» стирает его. В предпросмотре редактора черновик не сохраняется, а текст держится между пересборками.
const EssayWritingPlayer = (() => {
  const T = EssayText;
  const MAX_TEXT = 20000; // символов; больше не вставить, без молчаливого обрезания (браузер сам не даст)
  let idx = 0; // какое задание показано
  let fresh = false; // упражнение только что собрано (units)
  let texts = {}, checks = {}, opened = {}; // ID задания → текст; ID пункта «проверь себя» → отмечен; ID задания → образец открыт
  let storeOk = true, saveTimer = null, copyTimer = null;
  const tasks = () => data.tasks || [];
  const listView = () => data.view === 'list'; // «все задания сразу»: карточки друг под другом, без переключателя
  const live = () => !params.has('preview');
  const storeKey = () => 'dimvibe-essay:' + id;

  function loadDraft() {
    texts = {}; checks = {}; opened = {};
    if (!live()) return;
    try {
      const raw = localStorage.getItem(storeKey());
      if (raw) { const o = JSON.parse(raw); texts = (o && o.t) || {}; checks = (o && o.c) || {}; }
    } catch (e) { storeOk = false; }
  }
  function writeDraft() {
    if (!live()) return;
    try {
      const t = {}, c = {};
      Object.keys(texts).forEach(k => { if (texts[k]) t[k] = texts[k]; });
      Object.keys(checks).forEach(k => { if (checks[k]) c[k] = 1; });
      if (Object.keys(t).length || Object.keys(c).length) localStorage.setItem(storeKey(), JSON.stringify({ t, c }));
      else localStorage.removeItem(storeKey());
      if (!storeOk) { storeOk = true; storeNotes(); }
    } catch (e) { storeOk = false; storeNotes(); }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(writeDraft, 300); }
  const STORE_OK = 'Текст сохраняется в этом браузере. Кнопка ↻ стирает его.';
  const STORE_BAD = 'Браузер не разрешает сохранять черновик: скопируйте текст перед тем, как уйти со страницы.';
  const storeText = () => (live() ? (storeOk ? STORE_OK : STORE_BAD) : 'Так увидит ученик; в предпросмотре черновик не сохраняется.');
  function storeNotes() { document.querySelectorAll('.ew-store').forEach(n => { n.textContent = storeText(); n.classList.toggle('ew-warn', live() && !storeOk); }); }

  function units() {
    fresh = true;
    return [];
  }

  // Загрузка страницы — достаём черновик; пересборка предпросмотра — текст остаётся; «Начать заново» — стираем всё
  function reset() {
    if (fresh) {
      if (live()) loadDraft();
      else { const ids = new Set(tasks().map(t => t.id)); Object.keys(texts).forEach(k => { if (!ids.has(k)) delete texts[k]; }); idx = Math.min(idx, Math.max(0, tasks().length - 1)); }
      fresh = false;
      if (live()) idx = 0;
      return;
    }
    texts = {}; checks = {}; opened = {};
    idx = 0;
    clearTimeout(saveTimer);
    if (live()) { try { localStorage.removeItem(storeKey()); } catch (e) {} }
  }

  const started = () => Object.values(texts).some(v => !T.isEmpty(v)) || Object.values(checks).some(Boolean);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Строка внизу: сколько условий выполнено (обязательных и советов отдельно) — по показанному заданию или по всем сразу
  function status() {
    const shown = tasks().length > 1 && !listView() ? [tasks()[Math.min(idx, tasks().length - 1)]] : tasks();
    const n = { required: [0, 0], advisory: [0, 0] };
    let words = 0;
    shown.forEach(t => {
      const r = T.evaluate(t, texts[t.id] || '');
      words += r.words;
      r.conds.forEach(c => { n[c.level][1]++; if (c.state === 'ok') n[c.level][0]++; });
    });
    const parts = [];
    if (n.required[1]) parts.push(`Обязательных условий: ${n.required[0]} из ${n.required[1]}`);
    if (n.advisory[1]) parts.push(`Советов: ${n.advisory[0]} из ${n.advisory[1]}`);
    return parts.length ? parts.join(' · ') : `Слов: ${words}`;
  }

  const MARK = { ok: '✓', bad: '✗', todo: '○' };
  const STATE_RU = { ok: 'выполнено', bad: 'нарушено', todo: 'пока не выполнено' };

  // Обновляет счётчики и список условий задания на месте, не пересобирая карточку (иначе пропадёт курсор)
  function refresh(card, t) {
    const r = T.evaluate(t, texts[t.id] || '');
    const spec = card.querySelector('.ew-counts');
    spec.textContent = `Слов: ${r.words} · Абзацев: ${r.paras}`;
    const box = card.querySelector('.ew-conds');
    if (box) {
      box.innerHTML = '';
      [['required', 'Обязательные условия'], ['advisory', 'Советы']].forEach(([lv, title]) => {
        const rows = r.conds.filter(c => c.level === lv);
        if (!rows.length) return;
        box.append(el('p', 'ew-gh', title));
        const ul = el('ul', 'ew-list');
        rows.forEach(c => {
          const li = el('li', 'ew-cond ' + c.state);
          li.setAttribute('aria-label', `${c.text}, ${STATE_RU[c.state]}`);
          li.append(el('span', 'ew-mark', MARK[c.state]), el('span', 'ew-ctext', c.text));
          ul.append(li);
        });
        box.append(ul);
      });
    }
    const copy = card.querySelector('.ew-copy');
    if (copy) copy.setAttribute('aria-disabled', String(r.empty));
  }
  const fit = ta => { ta.style.height = 'auto'; ta.style.height = Math.max(180, ta.scrollHeight + 2) + 'px'; };

  function copyOut(card, t, ta) {
    const out = card.querySelector('.ew-copied');
    const say = s => { out.textContent = s; clearTimeout(copyTimer); copyTimer = setTimeout(() => { out.textContent = ''; }, 3000); };
    const text = texts[t.id] || '';
    if (T.isEmpty(text)) return say('Сначала напишите текст.');
    const fallback = () => {
      try {
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.setSelectionRange(ta.value.length, ta.value.length);
        say(ok ? 'Текст скопирован.' : 'Не удалось скопировать: выделите текст и скопируйте вручную.');
      } catch (e) { say('Не удалось скопировать: выделите текст и скопируйте вручную.'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => say('Текст скопирован.'), fallback);
    else fallback();
  }

  function taskCard(k) {
    const t = tasks()[k];
    const card = el('div', 'card ew-card');
    card.dataset.t = t.id;
    if (tasks().length > 1 && listView()) card.append(el('p', 'ew-gnum', `Задание ${k + 1}`));
    if (String(t.topic || '').trim()) card.append(el('p', 'ew-topic', String(t.topic).trim()));
    card.append(el('p', 'ew-prompt', String(t.prompt || '').trim()));

    const ta = el('textarea', 'ew-text');
    ta.value = texts[t.id] || '';
    ta.maxLength = MAX_TEXT;
    ta.placeholder = 'Напишите свой текст здесь…';
    ta.spellcheck = true;
    ta.setAttribute('aria-label', `Ваш текст${tasks().length > 1 ? ', задание ' + (k + 1) : ''}`);
    card.append(ta);
    card.append(el('div', 'ew-counts'));
    if (T.evaluate(t, '').conds.length) card.append(el('div', 'ew-conds'));

    const actions = el('div', 'ew-actions');
    const copy = el('button', 'ew-copy', 'Скопировать текст');
    copy.type = 'button';
    copy.onclick = () => copyOut(card, t, ta);
    actions.append(copy);
    const sample = String(t.sample || '').trim();
    let sampleBox = null;
    if (sample) {
      const sb = el('button', 'ew-sbtn', 'Образец ответа');
      sb.type = 'button';
      sb.setAttribute('aria-expanded', String(!!opened[t.id]));
      sb.onclick = () => {
        opened[t.id] = !opened[t.id];
        sb.setAttribute('aria-expanded', String(opened[t.id]));
        sampleBox.hidden = !opened[t.id];
      };
      actions.append(sb);
    }
    const copied = el('span', 'ew-copied');
    copied.setAttribute('role', 'status');
    actions.append(copied);
    card.append(actions);
    if (sample) {
      sampleBox = el('div', 'ew-sample');
      sampleBox.hidden = !opened[t.id];
      sampleBox.append(el('p', 'ew-gh', 'Образец ответа'), el('p', 'ew-sample-text', sample));
      card.append(sampleBox);
    }
    const list = (t.checklist || []).filter(c => String(c.text || '').trim());
    if (list.length) {
      const cb = el('div', 'ew-check');
      cb.append(el('p', 'ew-gh', 'Проверь себя'));
      list.forEach(c => {
        const lab = el('label', 'ew-ci');
        const inp = el('input');
        inp.type = 'checkbox';
        inp.checked = !!checks[c.id];
        inp.onchange = () => { checks[c.id] = inp.checked; saveSoon(); };
        lab.append(inp, el('span', '', String(c.text).trim()));
        cb.append(lab);
      });
      card.append(cb);
    }
    const note = el('p', 'ew-store');
    card.append(note);

    let raf = 0;
    ta.oninput = () => {
      texts[t.id] = ta.value;
      fit(ta);
      refresh(card, t);
      const dot = document.querySelectorAll('.tf-dot')[k];
      if (dot) dot.classList.toggle('answered', !T.isEmpty(ta.value));
      saveSoon();
      clearTimeout(raf);
      raf = setTimeout(updateStatus, 80);
    };
    refresh(card, t);
    setTimeout(() => { fit(ta); storeNotes(); }, 0);
    return card;
  }

  function nav(root) {
    const dots = el('div', 'tf-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Задания');
    tasks().forEach((t, i) => {
      const b = el('button', 'tf-dot' + (i === idx ? ' active' : '') + (!T.isEmpty(texts[t.id]) ? ' answered' : ''), String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `Задание ${i + 1}` + (i === idx ? ', текущее' : '') + (!T.isEmpty(texts[t.id]) ? ', текст написан' : ''));
      if (i === idx) b.setAttribute('aria-current', 'step');
      b.onclick = () => { idx = i; render(); };
      dots.append(b);
    });
    root.append(dots);
  }
  function pager(root) {
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Предыдущее'), next = el('button', '', 'Следующее ›');
    prev.type = next.type = 'button';
    prev.disabled = idx <= 0;
    next.disabled = idx >= tasks().length - 1;
    prev.onclick = () => { idx--; render(); };
    next.onclick = () => { idx++; render(); };
    bar.append(prev, el('span', 'tf-count', `${idx + 1} / ${tasks().length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    if (idx >= tasks().length) idx = Math.max(0, tasks().length - 1);
    const one = tasks().length > 1 && !listView();
    if (one) nav(root);
    if (one || tasks().length < 2) { if (tasks().length) root.append(taskCard(idx)); }
    else tasks().forEach((_, k) => root.append(taskCard(k)));
    if (one) pager(root);
  }

  // Проверок нет, но общий ход требует эти крючки
  const goMissing = () => {};
  const missingNote = () => '';
  const instant = () => true;

  return { units, reset, started, status, goMissing, missingNote, instant, render: renderInto };
})();
