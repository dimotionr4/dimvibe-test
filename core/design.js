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

// Страница берёт из переменных --accent-l и --accent-d нужный оттенок в зависимости от темы
function applyAccent(root, name) {
  const a = accentOf(name);
  root.style.setProperty('--accent-l', a.light);
  root.style.setProperty('--accent-d', a.dark);
}
