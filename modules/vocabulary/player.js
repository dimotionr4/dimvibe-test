// Плеер модуля Vocabulary: словарь для чтения. Два вида — «Словарь» (список с поиском и фильтром по части речи, подробности слова)
// и «Карточки» (одно слово целиком, листать «Предыдущий / Следующий»). Баллов, проверок и результата нет.
// Общая часть прохождения (шапка, инструкция, ↻) живёт в index.html. Единиц ответа нет (units пуст), кнопки «Проверить» нет:
// плеер сообщает noFooter(), и нижняя панель скрыта. Поиск, фильтр и открытое слово живут только в открытой странице.
const VocabularyPlayer = (() => {
  const POS = { noun: 'Существительное', verb: 'Глагол', adj: 'Прилагательное', adv: 'Наречие', pron: 'Местоимение', prep: 'Предлог',
    conj: 'Союз', interj: 'Междометие', phrase: 'Фраза', other: 'Другое' };
  let view = 'dictionary'; // 'dictionary' | 'cards'
  let query = '', posFilter = '', sortAz = false; // поиск, фильтр по части речи, сортировка по алфавиту
  let openId = null; // слово, открытое в списке (на узком экране — вместо списка)
  let cardIdx = 0; // какая карточка показана
  let refocus = null;
  const words = () => data.words || [];
  const key = s => String(s || '').normalize('NFC').toLowerCase();

  const units = () => [];
  function reset() {
    view = data.view === 'cards' ? 'cards' : 'dictionary';
    query = ''; posFilter = ''; sortAz = false; openId = null; cardIdx = 0; refocus = null;
  }
  const noFooter = () => true;
  const instant = () => true;
  const status = () => '';
  const goMissing = () => {};
  const missingNote = () => '';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const meanings = w => w.meanings || [];
  const sorted = () => {
    const list = words().slice();
    if (sortAz) list.sort((a, b) => key(a.text).localeCompare(key(b.text)));
    return list;
  };
  // Поиск идёт по слову и по переводам всех значений
  const matches = w => {
    if (posFilter && !meanings(w).some(m => m.pos === posFilter)) return false;
    const q = key(query).trim();
    if (!q) return true;
    return key(w.text).includes(q) || meanings(w).some(m => key(m.translation).includes(q));
  };
  const shown = () => sorted().filter(matches);
  const posPresent = () => Object.keys(POS).filter(p => words().some(w => meanings(w).some(m => m.pos === p)));
  const summary = w => meanings(w).map(m => m.translation).filter(Boolean).join('; ');

  function picture(im) {
    const src = mediaSrc(im);
    if (!src) return null;
    const wrap = el('div', 'vc-pic');
    const img = el('img');
    img.alt = String(im.alt || '');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = () => { wrap.classList.add('broken'); img.remove(); };
    img.src = src;
    wrap.append(img);
    addZoom(wrap, wrap, src, img.alt);
    return wrap;
  }

  // Подробная запись слова: картинка, слово, транскрипция, значения с примерами. Общая для обоих видов
  function entry(w) {
    const c = el('div', 'card vc-card vc-size-' + (['s', 'l'].includes(data.imageSize) ? data.imageSize : 'm') + (data.imageFit === 'cover' ? ' vc-fit-cover' : ''));
    const pic = picture(w.image);
    if (pic) c.append(pic);
    c.append(el('h2', 'vc-word', w.text));
    if (w.ipa) c.append(el('p', 'vc-ipa', w.ipa));
    meanings(w).forEach((m, i) => {
      const box = el('div', 'vc-mean');
      const line = el('p', 'vc-mline');
      if (meanings(w).length > 1) line.append(el('span', 'vc-mnum', `${i + 1}.`));
      line.append(el('span', 'vc-pos', POS[m.pos] || POS.other), el('b', 'vc-tr', m.translation));
      box.append(line);
      if (m.note) box.append(el('p', 'vc-note', m.note));
      if ((m.examples || []).length) {
        const ul = el('ul', 'vc-exs');
        m.examples.forEach(x => {
          const li = el('li');
          li.append(el('span', 'vc-extext', x.text));
          if (x.translation) li.append(el('span', 'vc-extr', x.translation));
          ul.append(li);
        });
        box.append(ul);
      }
      c.append(box);
    });
    return c;
  }

  // ---- Словарь ----
  function dictionary(root) {
    const list = shown();
    const cur = words().find(w => w.id === openId);
    const wrap = el('div', 'vc-dict' + (cur ? ' vc-open' : ''));
    const left = el('div', 'vc-left');

    const bar = el('div', 'vc-bar');
    const search = el('input', 'vc-search');
    search.type = 'search';
    search.placeholder = 'Поиск по слову или переводу';
    search.value = query;
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.setAttribute('aria-label', 'Поиск по слову или переводу');
    bar.append(search);
    const present = posPresent();
    const sort = el('button', 'vc-sort' + (sortAz ? ' active' : ''), 'А–Я');
    sort.type = 'button';
    sort.title = sortAz ? 'Сейчас по алфавиту; вернуть порядок автора' : 'Сейчас порядок автора; показать по алфавиту';
    sort.setAttribute('aria-pressed', String(sortAz));
    sort.setAttribute('aria-label', 'Сортировать по алфавиту');
    sort.onclick = () => { sortAz = !sortAz; refocus = '.vc-sort'; render(); };
    bar.append(sort);
    left.append(bar);

    if (present.length > 1) {
      const chips = el('div', 'vc-chips');
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', 'Часть речи');
      [['', 'Все'], ...present.map(p => [p, POS[p]])].forEach(([p, name]) => {
        const b = el('button', 'vc-chip' + (posFilter === p ? ' active' : ''), name);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(posFilter === p));
        b.onclick = () => { posFilter = p; refocus = `.vc-chip:nth-child(${[...chips.children].indexOf(b) + 1})`; render(); };
        chips.append(b);
      });
      left.append(chips);
    }

    const items = el('div', 'vc-items');
    const paint = () => {
      const now = shown();
      items.innerHTML = '';
      if (!words().length) { items.append(el('p', 'vc-empty', 'В словаре пока нет слов.')); return; }
      if (!now.length) {
        const empty = el('p', 'vc-empty', 'Ничего не найдено.');
        const clear = el('button', 'vc-clear', 'Сбросить поиск');
        clear.type = 'button';
        clear.onclick = () => { query = ''; posFilter = ''; refocus = '.vc-search'; render(); };
        empty.append(document.createTextNode(' '), clear);
        items.append(empty);
        return;
      }
      now.forEach(w => {
        const b = el('button', 'vc-item' + (w.id === openId ? ' active' : ''));
        b.type = 'button';
        b.append(el('span', 'vc-iword', w.text), el('span', 'vc-itr', summary(w)));
        b.onclick = () => { openId = w.id; refocus = null; render(); };
        items.append(b);
      });
    };
    paint();
    // Поиск обновляет только список: поле ввода остаётся на месте вместе с курсором и клавиатурой
    search.oninput = () => { query = search.value; paint(); showDetail(); };
    left.append(items);

    // Справа (на широком экране) — подробности; на узком — вместо списка после выбора слова
    const right = el('div', 'vc-right');
    const showDetail = () => {
      right.innerHTML = '';
      const now = shown();
      const w = cur && matches(cur) ? cur : now[0];
      if (!w) return;
      const back = el('button', 'vc-back', '‹ К списку');
      back.type = 'button';
      back.onclick = () => { openId = null; refocus = '.vc-search'; render(); };
      right.append(back, entry(w));
    };
    showDetail();
    wrap.append(left, right);
    root.append(wrap);
  }

  // ---- Карточки ----
  function cards(root) {
    const list = sorted();
    if (!list.length) return;
    if (cardIdx >= list.length) cardIdx = list.length - 1;
    root.append(entry(list[cardIdx]));
    const bar = el('div', 'tf-pager');
    const prev = el('button', '', '‹ Назад'), next = el('button', '', 'Далее ›');
    prev.type = next.type = 'button';
    prev.disabled = cardIdx <= 0;
    next.disabled = cardIdx >= list.length - 1;
    prev.onclick = () => { cardIdx--; refocus = '.tf-pager button:first-child'; render(); };
    next.onclick = () => { cardIdx++; refocus = '.tf-pager button:last-child'; render(); };
    bar.append(prev, el('span', 'tf-count', `${cardIdx + 1} / ${list.length}`), next);
    root.append(bar);
  }

  function renderInto(root) {
    const tabs = el('div', 'vc-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Вид');
    [['dictionary', 'Словарь'], ['cards', 'Карточки']].forEach(([v, name]) => {
      const b = el('button', 'vc-tab' + (view === v ? ' active' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(view === v));
      b.onclick = () => { if (view === v) return; view = v; refocus = null; render(); };
      tabs.append(b);
    });
    root.append(tabs);
    if (view === 'cards') cards(root); else dictionary(root);
    if (refocus) {
      const t = document.querySelector(refocus);
      refocus = null;
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
  }

  return { units, reset, render: renderInto, instant, status, goMissing, missingNote, noFooter };
})();
