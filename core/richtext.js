// Простое форматирование текста инструкции, общее для редактора и плеера.
// В файле хранится обычный текст: **жирный**, *курсив*, новая строка — новый абзац.
// Разметка превращается в элементы через textContent, поэтому вставить в инструкцию чужой HTML нельзя.
// Номер версии `?v=` у подключения этого файла поднимайте при любом изменении.
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
