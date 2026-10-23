// Общий для редактора и плеера набор акцентных цветов упражнения. Набор меняется только здесь.
// У каждого цвета два оттенка: для светлой темы (белый текст на нём читается) и для тёмной (на нём тёмный текст).
// Номер версии `?v=` у подключения этого файла в index.html и editor.html поднимайте при любом изменении набора.
const ACCENTS = {
  violet: { label: 'Фиолетовый', light: '#6d4aff', dark: '#9d86ff' },
  blue:   { label: 'Синий',      light: '#1d62d8', dark: '#6ea8ff' },
  teal:   { label: 'Бирюзовый',  light: '#0a7c8c', dark: '#4cc9d9' },
  green:  { label: 'Зелёный',    light: '#12805c', dark: '#4cc99a' },
  orange: { label: 'Оранжевый',  light: '#b85400', dark: '#ff9a4d' },
  pink:   { label: 'Розовый',    light: '#c2307a', dark: '#ff7fb6' },
};
const DEFAULT_ACCENT = 'violet';

// Неизвестное имя (например, цвет убрали из набора) превращается в цвет по умолчанию
const accentOf = name => ACCENTS[name] || ACCENTS[DEFAULT_ACCENT];

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

// Макет страницы упражнения: ширина колонки, плотность отступов, фон. Один набор для редактора и плеера.
// Значения по умолчанию (стандартная, комфортно, обычный) = прежний вид.
const PAGE_WIDTHS = { compact: 'Компактная', standard: 'Стандартная', wide: 'Широкая' };
const PAGE_DENSITIES = { compact: 'Компактно', comfortable: 'Комфортно', loose: 'Свободно' };
const PAGE_BACKGROUNDS = { plain: 'Обычный', backdrop: 'Подложка', card: 'Карточка' };

function normalizePage(p) {
  p = p || {};
  return {
    width: PAGE_WIDTHS[p.width] ? p.width : 'standard',
    density: PAGE_DENSITIES[p.density] ? p.density : 'comfortable',
    background: PAGE_BACKGROUNDS[p.background] ? p.background : 'plain',
  };
}

// Классы на <html> плеера или образца (стили — в index.html); для значений по умолчанию классов нет
const PAGE_CLASSES = ['width-compact', 'width-wide', 'dens-compact', 'dens-loose', 'bg-backdrop', 'bg-card'];
const pageClasses = p => [
  p.width !== 'standard' ? 'width-' + p.width : '',
  p.density !== 'comfortable' ? 'dens-' + p.density : '',
  p.background !== 'plain' ? 'bg-' + p.background : '',
].filter(Boolean);

// Стиль упражнения: Classic или Comic; у Comic ещё цвет контура (акцентный или чёрный) и толщина линии.
// Неизвестные значения заменяются на допустимые.
function normalizeStyle(d) {
  d = d || {};
  return {
    style: d.style === 'comic' ? 'comic' : 'classic',
    comicLine: d.comicLine === 'black' ? 'black' : 'accent',
    comicWidth: d.comicWidth === 'thin' || d.comicWidth === 'thick' ? d.comicWidth : 'normal',
  };
}

// Классы для страницы или образца (стили — core/comic.css); для Classic пусто
const styleClasses = s => s.style === 'comic'
  ? `style-comic${s.comicLine === 'black' ? ' line-black' : ''}${s.comicWidth === 'thin' ? ' lw-thin' : s.comicWidth === 'thick' ? ' lw-thick' : ''}`
  : '';

// Страница берёт из переменных --accent-l и --accent-d нужный оттенок в зависимости от темы
function applyAccent(root, name) {
  const a = accentOf(name);
  root.style.setProperty('--accent-l', a.light);
  root.style.setProperty('--accent-d', a.dark);
}
