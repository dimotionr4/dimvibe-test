// Язык интерфейса DimVibe (редактор, табло, «Мои упражнения», «Настройки»). Плеер ученика сюда не подключается.
// Русский — исходный язык: в коде и разметке остаётся русский текст, а переводы лежат в словарях core/lang/<код>.js
// (сейчас en.js; грузинский позже — файл ka.js вида DimI18n.add('ka', {...}) и строка в LANGS ниже).
// Выбор хранится в браузере: localStorage "dimvibe.lang" ('ru' по умолчанию), общий для всех страниц.
//
// Как это работает:
//  • DimI18n.t('Русская строка', {n: 5}) — перевод строки в коде; в строке можно писать {n}. Ключ словаря — сама русская строка.
//  • Всё, что попадает на страницу (текст, а также атрибуты title, placeholder, aria-label, data-tip, alt), переводится само:
//    при смене языка — сразу, без перезагрузки; для новых узлов (карточки, окна, списки) — наблюдателем за страницей.
//  • alert / confirm / prompt тоже переводятся.
//  • Не переводится: script, style, textarea, contenteditable и всё внутри [data-no-i18n] (содержимое упражнений).
//  • Строки с числами и вставками — правилами DimI18n.rule(/регулярка/, (m) => 'английский текст') в файле словаря.
//  • Составные строки «А — Б», «А: Б», «А · Б» переводятся по частям, если целиком нет в словаре.
//  • DimI18n.missing() — список русских строк, которым не нашлось перевода (для проверки полноты).
(function () {
  const KEY = 'dimvibe.lang';
  const LANGS = [['ru', 'Русский'], ['en', 'English']]; // сюда позже добавится ['ka', 'ქართული']
  const dict = {}, rules = {}, missingSet = new Set(), listeners = [];
  const CYR = /[А-Яа-яЁё]/;
  const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'alt', 'data-placeholder'];
  const SKIP = 'script,style,textarea,[contenteditable]:not([contenteditable="false"]),[data-no-i18n]';
  const norm = s => s.replace(/\s+/g, ' ').trim();

  function readLang() {
    try { const v = localStorage.getItem(KEY); if (LANGS.some(l => l[0] === v)) return v; } catch (e) {}
    return 'ru';
  }
  let lang = readLang();

  function add(code, entries) { dict[code] = Object.assign(dict[code] || {}, entries); }
  function rule(re, fn, code) { (rules[code || 'en'] = rules[code || 'en'] || []).push([re, fn]); }
  const fill = (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s;

  // Перевод нормализованной строки (без краёв-пробелов) или null
  function lookup(s, code) {
    const d = dict[code]; if (!d) return null;
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    for (const [re, fn] of rules[code] || []) { const m = re.exec(s); if (m) { const r = fn(m, s); if (r != null) return r; } }
    // составная строка: «А — Б», «А: Б», «А · Б» (и хвост «(скоро)» и т. п.)
    for (const sep of [' — ', ': ', ' · ', ' / ']) {
      if (s.indexOf(sep) > 0) {
        const parts = s.split(sep); let any = false;
        const out = parts.map(p => { const r = p && CYR.test(p) ? lookup(p, code) : null; if (r != null) any = true; return r != null ? r : p; });
        if (any) return out.join(sep);
      }
    }
    const tail = /^(.*\S)\s+\(([^()]*)\)$/.exec(s);
    if (tail) { const a = lookup(tail[1], code), b = lookup(tail[2], code); if (a != null || b != null) return (a != null ? a : tail[1]) + ' (' + (b != null ? b : tail[2]) + ')'; }
    return null;
  }

  // Перевод произвольной строки с сохранением пробелов по краям
  function tr(s) {
    if (lang === 'ru' || typeof s !== 'string' || !CYR.test(s)) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const r = lookup(norm(m[2]), lang);
    if (r == null) { missingSet.add(norm(s)); return s; }
    return m[1] + r + m[3];
  }
  const t = (s, p) => fill(tr(s), p);

  // ---------- Страница ----------
  const textOrig = new WeakMap();  // текстовый узел → { ru, tr }
  const attrOrig = new WeakMap();  // элемент → { атрибут: { ru, tr } }
  let obs = null;

  const skipped = el => !el || (el.closest && el.closest(SKIP));

  function doText(n) {
    if (lang === 'ru' || skipped(n.parentElement)) return;
    const v = n.nodeValue, e = textOrig.get(n);
    if (e && v === e.tr) return;                       // это наш же перевод
    if (!CYR.test(v)) { if (e) textOrig.delete(n); return; }
    const r = tr(v);
    if (r !== v) { textOrig.set(n, { ru: v, tr: r }); n.nodeValue = r; } else textOrig.delete(n);
  }
  function doAttr(el, a) {
    if (lang === 'ru' || skipped(el)) return;
    const v = el.getAttribute(a); if (v == null) return;
    const m = attrOrig.get(el) || {}, e = m[a];
    if (e && v === e.tr) return;
    if (!CYR.test(v)) { if (e) { delete m[a]; } return; }
    const r = tr(v);
    if (r !== v) { m[a] = { ru: v, tr: r }; attrOrig.set(el, m); el.setAttribute(a, r); } else if (e) delete m[a];
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const attrs = el => { for (const a of ATTRS) if (el.hasAttribute(a)) doAttr(el, a); };
    if (root.nodeType === 1) attrs(root);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else attrs(n); }
  }
  function restore(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) { const e = textOrig.get(n); if (e && n.nodeValue === e.tr) n.nodeValue = e.ru; textOrig.delete(n); }
      else if (n.nodeType === 1) { const m = attrOrig.get(n); if (m) { for (const a in m) if (n.getAttribute(a) === m[a].tr) n.setAttribute(a, m[a].ru); attrOrig.delete(n); } }
    }
  }
  let titleOrig = null;
  function doTitle() {
    if (lang === 'ru') { if (titleOrig != null) { document.title = titleOrig; titleOrig = null; } return; }
    const cur = document.title;
    if (titleOrig != null && cur === tr(titleOrig)) return;
    titleOrig = cur; document.title = tr(cur);
  }

  function startObserver() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
        else m.addedNodes.forEach(walk);
      }
      doTitle();
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function stopObserver() { if (obs) { obs.disconnect(); obs = null; } }

  function apply() {
    document.documentElement.lang = lang;
    if (lang === 'ru') { stopObserver(); restore(document.documentElement); doTitle(); return; }
    startObserver(); walk(document.documentElement); doTitle();
  }

  function set(code) {
    if (!LANGS.some(l => l[0] === code) || code === lang) return;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    const was = lang; lang = code;
    if (was !== 'ru') { lang = 'ru'; restore(document.documentElement); doTitle(); lang = code; }
    apply();
    listeners.forEach(f => { try { f(lang); } catch (e) {} });
  }

  // Диалоги браузера
  ['alert', 'confirm', 'prompt'].forEach(name => {
    const orig = window[name]; if (!orig) return;
    window[name] = function (msg) { const a = Array.prototype.slice.call(arguments); a[0] = tr(String(msg)); return orig.apply(window, a); };
  });

  // Смена языка в другой вкладке
  addEventListener('storage', e => { if (e.key === KEY) { const v = readLang(); if (v !== lang) { const was = lang; lang = was; set(v); } } });

  if (lang !== 'ru') {
    document.documentElement.lang = lang;
    startObserver();
    // словарь подключается следующим скриптом: первый проход — когда страница разобрана
    const first = () => { apply(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first); else first();
  }

  window.DimI18n = {
    LANGS, t, tr, add, rule, set, apply,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
    missing() { return Array.from(missingSet); }
  };
})();
