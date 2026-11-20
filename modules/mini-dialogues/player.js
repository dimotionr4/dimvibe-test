// Плеер модуля Mini Dialogues (мини-диалоги): реплики-«пузыри» с пропусками, ответ вводится с клавиатуры.
// Этап 1 (2026-11-21): только текст. Этап 3 (2026-11-21): у говорящего может быть картинка-аватар; у реплики и диалога — звук (кнопки «Слушать»; «только после завершения» — до конца кнопки нет совсем, ни в разметке, ни в адресах). Общая часть прохождения — шапка, инструкция, проверки, закрепление, результат, сброс —
// живёт в index.html и работает с теми же переменными (data, gaps, finished, note, checksUsed) и функцией render().
// Пропуск рисует общая makeGap(idx) из index.html (форма, ширина и нумерация — из вкладки «Дизайн»), подсказку — hintButton(idx).
// Каждый пропуск — единица ответа общего хода; одна общая проверка на все диалоги.
const MiniDialoguesPlayer = (() => {
  const isGap = p => typeof p !== 'string';

  // Пропуски в порядке появления в диалогах: так их считает общий ход (баллы, число проверок)
  function units() {
    return data.dialogues.flatMap(x => x.lines.flatMap(l => l.parts.filter(isGap).map(p => {
      const g = data.gaps[p.gap] || {};
      return { id: p.gap, answer: String(g.answer || ''), alternatives: Array.isArray(g.alternatives) ? g.alternatives : [], hint: String(g.hint || '').trim(), options: null, audio: null, hintAudio: null, value: '', bankKey: null, locked: false, state: null };
    })));
  }

  const reset = () => {};
  const instant = () => false;
  const missingNote = n => (n === 1 ? 'Заполните пропуск, который остался пустым.' : `Заполните все пропуски: ещё ${n}.`);
  const goMissing = () => {};

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const speakers = () => (Array.isArray(data.speakers) ? data.speakers : []);
  const nameOf = (sp, i) => String((sp && sp.name) || '').trim() || `Говорящий ${i + 1}`;

  // Сторона: свой выбор автора, иначе по очереди (первый слева, второй справа…)
  function sideOf(sp, i) {
    if (data.align === 'left') return 'left'; // настройка «Всё слева»
    if (sp && (sp.side === 'left' || sp.side === 'right')) return sp.side;
    return i % 2 === 0 ? 'left' : 'right';
  }

  // Звук доступен сразу или (если автор так выбрал) только после конца прохождения: до этого кнопки нет вообще
  const audioUrl = o => (o && o.audio && (!o.late || finished) ? mediaSrc(o.audio) : null);

  function render(root) {
    let gi = 0;
    data.dialogues.forEach((dlg, di) => {
      const card = el('div', 'card md-card' + (data.bubble === 'soft' ? ' md-b-soft' : data.bubble === 'compact' ? ' md-b-compact' : '') + (data.label === 'hidden' ? ' md-nolabel' : '') + (data.blocks === 'simple' ? ' md-simple' : '') + (data.avatarSize === 's' ? ' md-av-s' : data.avatarSize === 'l' ? ' md-av-l' : ''));
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', dlg.title || `Диалог ${di + 1}`);
      const dUrl = audioUrl(dlg);
      if (dlg.title || dUrl) {
        const head = el('div', 'md-dhead');
        if (dlg.title) head.append(el('h3', 'md-dtitle', dlg.title));
        if (dUrl) head.append(audioButton(dUrl, 'd' + dlg.id, 'md-listen', '🔊', 'Прослушать весь диалог', 'Слушать диалог'));
        card.append(head);
      }
      dlg.lines.forEach(line => {
        const si = Math.max(0, speakers().findIndex(s => s.id === line.speaker)), sp = speakers()[si];
        const who = nameOf(sp, si);
        const row = el('div', `md-line md-${sideOf(sp, si)} md-c${si % 6}`);
        // Аватар: картинка вместо буквы; размер — из «Дизайна» (avatarSize). Если картинка не загрузилась, остаётся буква
        const letter = (who[0] || '?').toUpperCase();
        const src = sp && sp.avatar ? mediaSrc(sp.avatar) : null;
        const ava = el('span', 'md-ava', letter);
        ava.setAttribute('aria-hidden', 'true');
        if (src) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = src;
          img.onerror = () => { img.remove(); ava.textContent = letter; ava.classList.remove('md-pic'); };
          ava.textContent = '';
          ava.append(img);
          ava.classList.add('md-pic');
        }
        const main = el('div', 'md-main');
        const nameRow = el('div', 'md-name');
        nameRow.append(el('span', 'md-who', who));
        const lUrl = audioUrl(line);
        if (lUrl) nameRow.append(audioButton(lUrl, 'l' + line.id, 'md-sound', '🔊', `Прослушать реплику: ${who}`));
        main.append(nameRow);
        const bubble = el('div', 'md-bubble');
        bubble.setAttribute('aria-label', `${who}:`);
        line.parts.forEach(p => {
          if (!isGap(p)) { bubble.append(document.createTextNode(p)); return; }
          const idx = gi++, g = gaps[idx];
          const gapEl = makeGap(idx);
          const hint = hintButton(idx);
          if (hint) gapEl.appendChild(hint);
          bubble.append(gapEl);
          // После последней проверки верный ответ показывается прямо в реплике (баллы за него не начисляются)
          if (finished && !g.locked) bubble.append(el('span', 'md-reveal', '→ ' + g.answer));
        });
        main.append(bubble);
        row.append(ava, main);
        card.append(row);
      });
      root.append(card);
    });
  }

  return { units, reset, render, instant, missingNote, goMissing };
})();
