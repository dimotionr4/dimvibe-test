// Простое форматирование текста инструкции, общее для редактора и плеера.
// В файле хранится обычный текст: **жирный**, *курсив*, новая строка — новый абзац.
// Разметка превращается в элементы через textContent, поэтому вставить в инструкцию чужой HTML нельзя.
// Номер версии `?v=` у подключения этого файла поднимайте при любом изменении.
// Ссылка на изображение: только полный адрес с https (на странице с https картинка по http не покажется).
// Возвращает адрес или null.
function safeImageUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'https:' ? u.href : null;
  } catch (e) {
    return null;
  }
}

// Изображение инструкции: image = {url, alt, size: small|medium|large, align: left|center|right}.
// Возвращает элемент или null, если ссылки нет или она неподходящая. Если картинка не загрузится, вместо неё покажется описание.
function instructionImageEl(image) {
  const url = image && safeImageUrl(image.url);
  if (!url) return null;
  const width = { small: '200px', medium: '400px', large: '100%' }[image.size] || '400px';
  const margin = { left: '0.5em auto 0.5em 0', right: '0.5em 0 0.5em auto' }[image.align] || '0.5em auto';
  const alt = String(image.alt || '').trim();
  const img = document.createElement('img');
  // Обработчик ошибки ставим до адреса, чтобы не пропустить быструю ошибку
  img.onerror = () => {
    const note = document.createElement('p');
    note.textContent = alt || 'Изображение не загрузилось.';
    note.style.cssText = 'color:var(--muted);font-style:italic;';
    img.replaceWith(note);
  };
  img.alt = alt;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer'; // сайту с картинкой не сообщаем, откуда её открыли
  img.style.cssText = `display:block;width:${width};max-width:100%;height:auto;border-radius:8px;margin:${margin};`;
  img.src = url;
  return img;
}

function richText(source) {
  const frag = document.createDocumentFragment();
  String(source || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
    const p = document.createElement('p');
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) p.append(line.slice(last, m.index));
      const el = document.createElement(m[1] !== undefined ? 'b' : 'i');
      el.textContent = m[1] !== undefined ? m[1] : m[2];
      p.append(el);
      last = re.lastIndex;
    }
    if (last < line.length) p.append(line.slice(last));
    frag.append(p);
  });
  return frag;
}
