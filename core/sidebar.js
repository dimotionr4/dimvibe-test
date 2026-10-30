// Общая левая панель страниц «Модули», «Мои упражнения» и «Настройки» (редактор рисует свою: в ней список черновиков и его собственные кнопки).
// Файл сам вставляет разметку и стили панели, затемнение для телефона и окно «Авторство и лицензии», хранит «свёрнуто / развёрнуто».
// Подключать после core/shell.js. Нужна страница с <div id="shell"> (панель встанет в её начало), кнопкой <button id="sideToggle"> в верхней полосе
// и цветами темы в переменных --bg, --card, --text, --muted, --accent, --accent-soft, --line.
//
// DimSidebar.mount({ active: 'home' | 'exercises' | 'settings', afterModules: '<html>', middle: '<html>' }) → { side }
//   afterModules — свои кнопки сразу под «Модули» (на табло это «Избранное»), middle — свой блок перед «Настройками» (список черновиков).
// DimSidebar.setSide(collapsed, save), DimSidebar.narrow() — для страниц, которым нужно свернуть панель сами.
(function () {
  const SIDE_KEY = 'dimvibe.sideCollapsed'; // общее состояние с редактором
  const narrow = () => matchMedia('(max-width: 900px)').matches;
  const ico = d => `<span class="si"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></span>`;
  const ICONS = {
    home: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    exercises: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    editor: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
  };
  if (window.DVIcons) ICONS.settings = DVIcons.ui.settings;
  const NAV = [
    { id: 'home', href: 'home.html', label: 'Модули' },
    { id: 'exercises', href: 'exercises.html', label: 'Мои упражнения' }
  ];

  const css = document.createElement('style');
  css.textContent = `
    #shell { display:flex; align-items:flex-start; }
    #side { flex:none; width:var(--sw, 260px); position:sticky; top:48px; height:calc(100vh - 48px); height:calc(100dvh - 48px); overflow-y:auto; border-right:1px solid var(--line); padding:16px 12px; display:flex; flex-direction:column; gap:4px; background:var(--bg); z-index:20; }
    #side.collapsed { width:56px; padding:16px 8px; align-items:center; overflow:visible; }
    #side.collapsed .lbl { display:none; }
    #side.collapsed .side-btn { width:44px; padding:0; justify-content:center; }
    #side:not(.collapsed) [data-tip]::after { display:none; }
    #side.collapsed [data-tip]::after { top:50%; left:calc(100% + 8px); transform:translateY(-50%); }
    #side h3 { font-size:.85rem; color:var(--muted); font-weight:600; margin:6px 0 0; text-transform:uppercase; letter-spacing:.04em; }
    .side-btn { display:flex; align-items:center; gap:12px; min-height:42px; padding:6px 14px; border:1px solid transparent; background:transparent; color:inherit; font:inherit; font-weight:500; border-radius:12px; text-align:left; text-decoration:none; cursor:pointer; position:relative; transition:background .12s; }
    .side-btn svg { color:var(--muted); }
    .side-btn:hover svg, .side-btn.active svg, .side-btn[aria-pressed="true"] svg { color:inherit; }
    .side-btn:hover { background:var(--accent-soft); }
    .side-btn.active, .side-btn[aria-pressed="true"] { background:var(--accent-soft); border-color:transparent; color:var(--accent); font-weight:600; }
    .side-btn .si { display:inline-flex; flex:none; }
    .side-btn svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    .side-btn.push { margin-top:auto; }
    .creditpop { position:fixed; z-index:60; left:12px; bottom:100px; max-width:300px; background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:12px; padding:10px 14px; font-size:.85rem; line-height:1.45; box-shadow:0 8px 28px rgba(0,0,0,.28); }
    .creditpop[hidden] { display:none; }
    .creditpop p { margin:6px 0 0; }
    .creditpop a { color:var(--accent); }
    #scrim { position:fixed; inset:48px 0 0 0; background:rgba(0,0,0,.4); z-index:15; }
    #scrim[hidden] { display:none; }
    @media (max-width:900px) {
      #side { position:fixed; top:48px; left:0; bottom:0; height:auto; width:min(290px, 86vw); box-shadow:4px 0 16px rgba(0,0,0,.25); }
      #side.collapsed { display:none; }
    }`;
  document.head.appendChild(css);

  function setSide(collapsed, saveIt) {
    const side = document.getElementById('side'), tg = document.getElementById('sideToggle'), sc = document.getElementById('scrim');
    side.classList.toggle('collapsed', collapsed);
    if (tg) tg.setAttribute('aria-expanded', String(!collapsed));
    sc.hidden = !(narrow() && !collapsed);
    if (saveIt) { try { localStorage.setItem(SIDE_KEY, collapsed ? '1' : '0'); } catch (e) {} }
  }

  function mount(opts) {
    opts = opts || {};
    const shell = document.getElementById('shell');
    const nav = NAV.map(n => `<a class="side-btn${n.id === opts.active ? ' active' : ''}" href="${n.href}" data-tip="${n.label}"${n.id === opts.active ? ' aria-current="page"' : ''}>${ico(ICONS[n.id === 'home' ? 'home' : n.id])}<span class="lbl">${n.label}</span></a>`);
    // «Свои» кнопки встают сразу после «Модули»
    nav.splice(1, 0, opts.afterModules || '');
    const html = `<aside id="side">${nav.join('')}${opts.middle || ''}
      <a class="side-btn push${opts.active === 'settings' ? ' active' : ''}" href="settings.html" data-tip="Настройки"${opts.active === 'settings' ? ' aria-current="page"' : ''}>${ico(ICONS.settings)}<span class="lbl">Настройки</span></a>
      <button class="side-btn" id="creditBtn" data-tip="Авторство и лицензии" aria-haspopup="true" aria-expanded="false">${ico(ICONS.info)}<span class="lbl">Авторство и лицензии</span></button>
    </aside>
    <div id="scrim" hidden></div>
    <div id="creditPop" class="creditpop" role="dialog" aria-label="Авторство и лицензии" hidden>
      <b>Авторство и лицензии</b>
      <p>Шрифт Comic: Blogger Sans, © Sergiy S. Tkachenko, <a href="https://creativecommons.org/licenses/by-nd/4.0/" target="_blank" rel="noopener">CC BY-ND 4.0</a></p>
      <p>Шрифты Balsamiq Sans, Pangolin, Neucha, Nunito, Noto Sans: <a href="https://openfontlicense.org" target="_blank" rel="noopener">SIL Open Font License 1.1</a>, авторы и лицензии — в папке fonts</p>
    </div>`;
    shell.insertAdjacentHTML('afterbegin', html);

    const side = document.getElementById('side');
    const tg = document.getElementById('sideToggle');
    if (tg) tg.onclick = () => setSide(!side.classList.contains('collapsed'), !narrow());
    document.getElementById('scrim').onclick = () => setSide(true, false);
    let saved = null;
    try { saved = localStorage.getItem(SIDE_KEY); } catch (e) {}
    setSide(narrow() ? true : saved === '1', false);

    const pop = document.getElementById('creditPop'), btn = document.getElementById('creditBtn');
    const setCredit = open => { pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.onclick = () => setCredit(pop.hidden);
    addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('#creditPop, #creditBtn')) setCredit(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) setCredit(false); });

    if (window.DimShell) DimShell.init(side, opts.onWidth);
    return { side };
  }

  window.DimSidebar = { mount, setSide, narrow };
})();
