// Общий для редактора и плеера набор акцентных цветов упражнения. Набор меняется только здесь.
// У каждого цвета два оттенка: для светлой темы (белый текст на нём читается) и для тёмной (на нём тёмный текст).
// Номер версии `?v=` у подключения этого файла в index.html и editor.html поднимайте при любом изменении набора.
const ACCENTS = {
  brand: { label: 'Фирменный', light: '#029c91', dark: '#3cc4b8' }, // цвет интерфейса DimVibe (решение владельца 2026-10-25)
  violet: { label: 'Фиолетовый', light: '#6d4aff', dark: '#9d86ff' },
  blue:   { label: 'Синий',      light: '#1d62d8', dark: '#6ea8ff' },
  green:  { label: 'Зелёный',    light: '#12805c', dark: '#4cc99a' },
  orange: { label: 'Оранжевый',  light: '#b85400', dark: '#ff9a4d' },
  pink:   { label: 'Розовый',    light: '#c2307a', dark: '#ff7fb6' },
};
// Цвет файла без поля accent (старые упражнения остаются фиолетовыми, как были опубликованы).
// Новому упражнению редактор сразу ставит NEW_ACCENT
const DEFAULT_ACCENT = 'violet';
const NEW_ACCENT = 'brand';

// Убранные из набора цвета и чем их заменить (2026-10-25: «Бирюзовый» убран, его упражнения — «Фирменный»)
const ACCENT_ALIASES = { teal: 'brand' };
// Имя цвета из файла → имя из набора; неизвестное имя превращается в цвет по умолчанию
const accentKey = name => (ACCENTS[name] ? name : ACCENT_ALIASES[name] || DEFAULT_ACCENT);
const accentOf = name => ACCENTS[accentKey(name)];

// Оформление пропуска: форма, прерывистая линия, ширина, нумерация. Один набор для редактора и плеера.
const GAP_SHAPES = { line: 'Линия', frame: 'Рамка', pill: 'Плашка', free: 'Свободная форма' };
const GAP_WIDTHS = { auto: 'Авто', narrow: 'Узкая', wide: 'Широкая' };

// Приводит сохранённые настройки к допустимым (старый файл без них — сплошная линия, авто, без номеров).
// «Прерывистая» есть только у линии и рамки.
function normalizeGapDesign(g) {
  g = g || {};
  const shape = GAP_SHAPES[g.shape] ? g.shape : 'line';
  return {
    shape,
    dashed: !!g.dashed && (shape === 'line' || shape === 'frame'),
    width: GAP_WIDTHS[g.width] ? g.width : 'auto',
    numbered: !!g.numbered,
  };
}

// Классы пропуска по настройкам (стили — в core/gap.css)
const gapClasses = g => `shape-${g.shape} w-${g.width}${g.dashed ? ' dashed' : ''}`;

// Макет страницы упражнения: ширина колонки, плотность отступов, фон, размер текста. Один набор для редактора и плеера.
// Значения по умолчанию (стандартная, комфортно, обычный, обычный текст) = прежний вид.
const PAGE_WIDTHS = { compact: 'Компактная', standard: 'Стандартная', wide: 'Широкая' };
const PAGE_DENSITIES = { compact: 'Компактно', comfortable: 'Комфортно', loose: 'Свободно' };
const PAGE_BACKGROUNDS = { plain: 'Обычный', backdrop: 'Подложка', card: 'Карточка' };
const PAGE_FONTSIZES = { s: 'Мелкий', m: 'Обычный', l: 'Крупный', xl: 'Очень крупный' };
const PAGE_WEIGHTS = { normal: 'Обычный', bold: 'Жирный' };

function normalizePage(p) {
  p = p || {};
  return {
    width: PAGE_WIDTHS[p.width] ? p.width : 'standard',
    density: PAGE_DENSITIES[p.density] ? p.density : 'comfortable',
    background: PAGE_BACKGROUNDS[p.background] ? p.background : 'plain',
    fontSize: PAGE_FONTSIZES[p.fontSize] ? p.fontSize : 'm',
    fontWeight: p.fontWeight === 'bold' ? 'bold' : 'normal',
  };
}

// Классы на <html> плеера или образца (стили — в index.html); для значений по умолчанию классов нет
const PAGE_CLASSES = ['width-compact', 'width-wide', 'dens-compact', 'dens-loose', 'bg-backdrop', 'bg-card', 'fs-s', 'fs-l', 'fs-xl', 'fw-bold'];
const pageClasses = p => [
  p.width !== 'standard' ? 'width-' + p.width : '',
  p.density !== 'comfortable' ? 'dens-' + p.density : '',
  p.background !== 'plain' ? 'bg-' + p.background : '',
  p.fontSize !== 'm' ? 'fs-' + p.fontSize : '',
  p.fontWeight === 'bold' ? 'fw-bold' : '',
].filter(Boolean);

// Кнопка «Проверить»: вид (залитая, контурная, мягкая) и расположение (справа, слева, по центру). По умолчанию — как раньше.
const CHECK_VARIANTS = { filled: 'Залитая', outline: 'Контурная', soft: 'Мягкая' };
const CHECK_ALIGNS = { right: 'Справа', left: 'Слева', center: 'По центру' };

function normalizeCheck(c) {
  c = c || {};
  return { variant: CHECK_VARIANTS[c.variant] ? c.variant : 'filled', align: CHECK_ALIGNS[c.align] ? c.align : 'right' };
}

// Классы на <html> плеера или контейнере образца (стили — core/check.css); для значений по умолчанию классов нет
const CHECK_CLASSES = ['chk-outline', 'chk-soft', 'chk-left', 'chk-center'];
const checkClasses = c => [c.variant !== 'filled' ? 'chk-' + c.variant : '', c.align !== 'right' ? 'chk-' + c.align : ''].filter(Boolean);

// Шрифт упражнения: свой набор у каждого стиля, первый в наборе — по умолчанию (прежний вид). Файлы шрифтов — core/fonts.css
// (Blogger Sans — core/comic.css). Грузинского в шрифтах нет, поэтому в конце каждого набора запасные шрифты с ним.
const FONT_TAIL = 'system-ui, "Noto Sans", "Noto Sans Georgian", "Segoe UI", sans-serif';
const FONTS = {
  classic: {
    system: { label: 'Системный', stack: FONT_TAIL },
    nunito: { label: 'Nunito', stack: '"DV Nunito", ' + FONT_TAIL },
    noto: { label: 'Noto Sans', stack: '"DV Noto Sans", ' + FONT_TAIL },
  },
  comic: {
    blogger: { label: 'Blogger Sans', stack: '"Blogger Sans", ' + FONT_TAIL },
    balsamiq: { label: 'Balsamiq Sans', stack: '"DV Balsamiq Sans", ' + FONT_TAIL },
    pangolin: { label: 'Pangolin', stack: '"DV Pangolin", ' + FONT_TAIL },
    neucha: { label: 'Neucha', stack: '"DV Neucha", ' + FONT_TAIL },
  },
};
const fontKey = (style, key) => (FONTS[style][key] ? key : Object.keys(FONTS[style])[0]);

// Очертания Comic: вид линии «от руки» (форму рисует core/rough.js по классу ol-…). «Аккуратная» — прежний вид
const COMIC_OUTLINES = { neat: 'Аккуратная', wobbly: 'Неровная', double: 'Двойная', angular: 'Угловатая' };
const OUTLINE_CLASSES = ['ol-wobbly', 'ol-double', 'ol-angular'];

// Стиль упражнения: Classic или Comic; у Comic ещё цвет контура (акцентный или чёрный) и толщина линии.
// Шрифт хранится отдельно для каждого стиля (classicFont, comicFont): при переключении стиля выбор другого не теряется.
// Неизвестные значения заменяются на допустимые.
function normalizeStyle(d) {
  d = d || {};
  return {
    style: d.style === 'comic' ? 'comic' : 'classic',
    comicLine: d.comicLine === 'black' ? 'black' : 'accent',
    comicWidth: d.comicWidth === 'thin' || d.comicWidth === 'thick' ? d.comicWidth : 'normal',
    classicFont: fontKey('classic', d.classicFont),
    comicFont: fontKey('comic', d.comicFont),
    comicOutline: COMIC_OUTLINES[d.comicOutline] ? d.comicOutline : 'neat',
  };
}

// Набор шрифтов (font-family) для выбранного стиля; страница ставит его в переменную --ex-font
const fontStack = s => FONTS[s.style][s.style === 'comic' ? s.comicFont : s.classicFont].stack;

// Классы для страницы или образца (стили — core/comic.css); для Classic пусто
const styleClasses = s => s.style === 'comic'
  ? `style-comic${s.comicLine === 'black' ? ' line-black' : ''}${s.comicWidth === 'thin' ? ' lw-thin' : s.comicWidth === 'thick' ? ' lw-thick' : ''}${s.comicOutline !== 'neat' ? ' ol-' + s.comicOutline : ''}`
  : '';

// Страница берёт из переменных --accent-l и --accent-d нужный оттенок в зависимости от темы
function applyAccent(root, name) {
  const a = accentOf(name);
  root.style.setProperty('--accent-l', a.light);
  root.style.setProperty('--accent-d', a.dark);
}
