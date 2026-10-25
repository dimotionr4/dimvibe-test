// Разбор текста для Essay Writing: слова, абзацы, обязательные и запрещённые слова и фразы. Общий для редактора и плеера.
// Правила счёта (архив EW-04, упрощённо): слово — буквы и цифры, внутри слова допустимы апостроф и дефис («don't», «well-known»);
// регистр и вид апострофа не важны, Unicode приводится к NFC; абзац — блок текста между пустыми строками;
// слово или фраза ищутся по целым словам («art» не найдётся в «smart»), фраза — слова подряд, лишние пробелы и знаки между ними не мешают;
// каждое вхождение считается один раз, формы слова преподаватель перечисляет сам (программа их не угадывает).
const EssayText = (() => {
  const WORD = /[\p{L}\p{N}\p{M}]+(?:['\-][\p{L}\p{N}\p{M}]+)*/gu;
  const norm = s => String(s == null ? '' : s).normalize('NFC').replace(/[‘’ʼ]/g, "'").toLowerCase();
  const tokens = s => norm(s).match(WORD) || [];
  const isEmpty = s => !String(s == null ? '' : s).trim();
  const paragraphs = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').split(/\n[ \t ]*(?:\n[ \t ]*)+/).filter(p => p.trim()).length;
  const num = v => { const n = Math.floor(Number(v)); return v !== '' && v != null && Number.isFinite(n) && n >= 0 ? n : null; };
  const list = s => (Array.isArray(s) ? s : String(s || '').split(/[,;\n]/)).map(x => String(x).trim()).filter(Boolean);

  // Слово или фраза и их формы → список вариантов (каждый — массив слов); без повторов
  function variants(text, forms) {
    const seen = new Set(), out = [];
    [text, ...list(forms)].forEach(v => {
      const t = tokens(v);
      if (!t.length) return;
      const k = t.join(' ');
      if (!seen.has(k)) { seen.add(k); out.push(t); }
    });
    return out;
  }

  // Сколько раз встречается: самый длинный подходящий вариант на каждом месте, найденное не пересекается
  function occurrences(toks, vars) {
    let n = 0, i = 0;
    while (i < toks.length) {
      let best = 0;
      for (const v of vars) {
        if (v.length > best && i + v.length <= toks.length && v.every((w, j) => toks[i + j] === w)) best = v.length;
      }
      if (best) { n++; i += best; } else i++;
    }
    return n;
  }

  // Одна последовательность слов внутри другой (для поиска противоречий «обязательно» и «запрещено»)
  function contains(big, small) {
    if (!small.length || small.length > big.length) return false;
    for (let i = 0; i + small.length <= big.length; i++) if (small.every((w, j) => big[i + j] === w)) return true;
    return false;
  }

  const range = (min, max) => (min != null && max != null ? `${min}–${max}` : min != null ? `от ${min}` : `до ${max}`);

  // Условия задания по тексту ученика. Пустой текст (или одни пробелы) не выполняет ни одно условие.
  // state: ok — выполнено; bad — нарушено (слишком много слов, запрещённое слово); todo — ещё не выполнено
  function evaluate(task, text) {
    const empty = isEmpty(text), toks = tokens(text), out = [];
    const rangeCond = (id, label, spec, now) => {
      const min = num(spec && spec.min), max = num(spec && spec.max);
      if (min == null && max == null) return;
      const ok = !empty && (min == null || now >= min) && (max == null || now <= max);
      const bad = !empty && max != null && now > max;
      out.push({ id, level: spec.level === 'advisory' ? 'advisory' : 'required', state: ok ? 'ok' : bad ? 'bad' : 'todo', text: `${label}: ${now} (нужно ${range(min, max)})` });
    };
    rangeCond('words', 'Слов', task.words, toks.length);
    rangeCond('paras', 'Абзацев', task.paras, empty ? 0 : paragraphs(text));
    (task.terms || []).forEach(t => {
      const vars = variants(t.text, t.forms);
      if (!vars.length) return;
      const need = Math.max(1, num(t.min) || 1), now = occurrences(toks, vars);
      out.push({ id: t.id, level: t.level === 'advisory' ? 'advisory' : 'required', state: !empty && now >= need ? 'ok' : 'todo', text: `Использовать «${String(t.text).trim()}»: ${now} из ${need}` });
    });
    (task.banned || []).forEach(t => {
      const vars = variants(t.text, t.forms);
      if (!vars.length) return;
      const now = occurrences(toks, vars);
      out.push({ id: t.id, level: t.level === 'advisory' ? 'advisory' : 'required', state: empty ? 'todo' : now ? 'bad' : 'ok', text: `Не использовать «${String(t.text).trim()}»: ${now ? 'найдено ' + now : 'нет'}` });
    });
    return { words: toks.length, paras: empty ? 0 : paragraphs(text), empty, conds: out };
  }

  return { tokens, paragraphs, variants, occurrences, contains, evaluate, num, list, isEmpty, range };
})();
