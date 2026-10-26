// Редактор модуля Prepositions: это Fill Blanks (пропуски в тексте) + готовый список предлогов по категориям.
// Текст, пропуски, ответы, подсказки и звук делает редактор Fill Blanks; здесь — выбор предлогов для банка / списка.
// Выбранные предлоги лежат в d.distractors (как слова-ловушки Fill Blanks), поэтому плеер у модулей общий.
const PrepositionsEditor = (() => {
  const FB = FillBlanksEditor;
  const MODES = ['word_bank', 'dropdown'];
  // Английские категории (версия набора 1). По архиву набор требует проверки преподавателем-лингвистом до рабочего использования.
  // Один предлог может стоять в нескольких категориях (in, on, at: место и время) — состояние выбора считается по написанию.
  const LIBRARY = [
    { id: 'place', name: 'Место', words: ['in', 'on', 'at', 'under', 'above', 'below', 'behind', 'between', 'next to', 'in front of', 'near', 'inside', 'outside', 'opposite', 'among'] },
    { id: 'time', name: 'Время', words: ['in', 'on', 'at', 'before', 'after', 'during', 'since', 'for', 'until', 'by', 'throughout'] },
    { id: 'movement', name: 'Движение', words: ['to', 'from', 'into', 'out of', 'onto', 'off', 'through', 'across', 'along', 'around', 'towards', 'past', 'up', 'down'] },
    { id: 'other', name: 'Другое', words: ['with', 'without', 'by', 'for', 'about', 'of', 'because of', 'despite', 'instead of', 'according to'] },
  ];
  const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();

  let d, root, save, box, tabId = 'place';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const create = layout => ({ ...FB.create(layout), module: 'prepositions', mode: 'dropdown' });

  // Демо-пример: два режима видны переключателем; предлоги выбраны из нескольких категорий
  function demo(layout) {
    const A = DimDemo.AUD, text = layout === 'text';
    const items = text
      ? [{ id: 's1', parts: ['The cat is sitting ', { gap: 'g1' }, ' the table. We have lunch ', { gap: 'g2' }, ' noon.'], audio: A.a },
        { id: 's2', parts: ['She walked ', { gap: 'g3' }, ' the park ', { gap: 'g4' }, ' her friend.'], audio: '' }]
      : [{ id: 's1', parts: ['The cat is sitting ', { gap: 'g1' }, ' the table.'], audio: A.a },
        { id: 's2', parts: ['We have lunch ', { gap: 'g2' }, ' noon.'], audio: '' },
        { id: 's3', parts: ['She walked ', { gap: 'g3' }, ' the park ', { gap: 'g4' }, ' her friend.'], audio: '' }];
    return { ...create(layout), items, distractors: ['on', 'after', 'for'],
      instruction: DimDemo.instruction('Выберите подходящий предлог.'),
      gaps: {
        g1: { answer: 'under', alternatives: ['near'], hint: 'Где находится кошка?', audio: A.b, hintAudio: A.c },
        g2: { answer: 'at', alternatives: [], hint: '', audio: '', hintAudio: '' },
        g3: { answer: 'through', alternatives: [], hint: 'Движение сквозь', audio: '', hintAudio: '' },
        g4: { answer: 'with', alternatives: [], hint: '', audio: '', hintAudio: '' },
      } };
  }

  const answers = () => new Set(GapEngine.gapOrder(d.items).map(id => norm(d.gaps[id].answer)).filter(Boolean));
  const picked = w => d.distractors.some(x => norm(x) === norm(w));

  function toggle(w) {
    const i = d.distractors.findIndex(x => norm(x) === norm(w));
    if (i >= 0) d.distractors.splice(i, 1);
    else if (!answers().has(norm(w))) d.distractors.push(w);
    save();
    FB.render(root, d, save, sync);
    mount();
  }

  // Выбрать / снять всю категорию
  function toggleAll(cat) {
    const ans = answers(), all = cat.words.every(w => picked(w) || ans.has(norm(w)));
    cat.words.forEach(w => {
      const i = d.distractors.findIndex(x => norm(x) === norm(w));
      if (all && i >= 0) d.distractors.splice(i, 1);
      if (!all && i < 0 && !ans.has(norm(w))) d.distractors.push(w);
    });
    save();
    FB.render(root, d, save, sync);
    mount();
  }

  // Подсветка выбранных предлогов (вызывается при каждой перерисовке банка)
  function sync() {
    if (!box || !box.isConnected) return;
    const ans = answers();
    box.querySelectorAll('.pp-chip').forEach(b => {
      const used = ans.has(norm(b.dataset.w)), on = picked(b.dataset.w);
      b.classList.toggle('on', on || used);
      b.classList.toggle('used', used);
      b.setAttribute('aria-pressed', String(on || used));
      b.title = used ? 'Это ответ одного из пропусков — он уже в банке' : '';
    });
    box.querySelectorAll('.pp-all').forEach(b => {
      const cat = LIBRARY.find(c => c.id === b.dataset.cat);
      b.textContent = cat.words.every(w => picked(w) || ans.has(norm(w))) ? 'Снять все' : 'Выбрать все';
    });
  }

  function library() {
    box = el('div', 'pp-lib');
    const head = el('div', 'fb-labelrow');
    head.append(el('h3', '', 'Предлоги по категориям'),
      window.helpIcon ? window.helpIcon('Нажмите на предлог, чтобы добавить его в банк слов и выпадающий список. Один и тот же предлог (например, in) стоит в нескольких категориях и выбирается один раз. Ответы пропусков в банк попадают сами.') : document.createTextNode(''));
    const tabs = el('div', 'pp-tabs');
    tabs.setAttribute('role', 'tablist');
    LIBRARY.forEach(c => {
      const t = el('button', 'pp-tab' + (c.id === tabId ? ' active' : ''), c.name);
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(c.id === tabId));
      t.onclick = () => { tabId = c.id; drawBody(); tabs.querySelectorAll('.pp-tab').forEach((x, i) => { x.classList.toggle('active', LIBRARY[i].id === tabId); x.setAttribute('aria-selected', String(LIBRARY[i].id === tabId)); }); };
      tabs.append(t);
    });
    const body = el('div', 'pp-body');
    const drawBody = () => {
      body.innerHTML = '';
      const cat = LIBRARY.find(c => c.id === tabId);
      const chips = el('div', 'fb-chips pp-chips');
      cat.words.forEach(w => {
        const b = el('button', 'pp-chip', w);
        b.dataset.w = w;
        b.onclick = () => toggle(w);
        chips.append(b);
      });
      const all = el('button', 'pp-all');
      all.dataset.cat = cat.id;
      all.onclick = () => toggleAll(cat);
      body.append(chips, all);
      sync();
    };
    drawBody();
    box.append(head, tabs, body);
    return box;
  }

  function mount() {
    const bank = root.querySelector('.fb-bank');
    if (bank) bank.before(library());
    // Ввод вручную в этом модуле не нужен: только банк слов и выпадающий список
    const typing = root.querySelectorAll('.fb-modes button')[2];
    if (typing) typing.remove();
    sync();
  }

  function render(container, draft, onSave) {
    root = container;
    d = draft;
    save = onSave;
    if (!MODES.includes(d.mode)) d.mode = 'dropdown';
    FB.render(container, draft, onSave, sync);
    mount();
  }

  const exportData = draft => ({ ...FB.exportData(draft), module: 'prepositions' });

  function validate(draft) {
    const r = FB.validate(draft);
    const ex = exportData(draft);
    const order = ex.items.flatMap(i => i.parts.filter(p => p && p.gap).map(p => p.gap));
    const pool = new Set([...order.map(id => norm(ex.gaps[id].answer)), ...ex.distractors.map(norm)]);
    if (order.length && pool.size === 1) r.warnings.push('Предложен всего один предлог: выбор невозможен. Отметьте предлоги в списке.');
    return r;
  }

  function load(file) {
    const b = FB.load(file);
    return { ...b, module: 'prepositions', mode: MODES.includes(b.mode) ? b.mode : 'dropdown' };
  }

  return { create, demo, render, load, exportData, validate };
})();
