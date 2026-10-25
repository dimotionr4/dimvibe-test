// Демо-режим (решение владельца 2026-10-25): пока он включён в «Настройках», новое упражнение любого модуля создаётся
// уже заполненным примером — чтобы проверять модули, не вводя всё заново. Уже созданные упражнения не меняются.
// Пример у каждого модуля свой: функция demo(layout) в его editor.js (возвращает черновик как create, но заполненный).
// Здесь — только включатель и общие файлы медиатеки для примеров (картинки и звук уже лежат в хранилище, новое не загружается).
// Номер версии `?v=` у подключения поднимайте при изменении.
const DimDemo = (() => {
  const KEY = 'dimvibe.demo';
  const on = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const set = v => { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); return true; } catch (e) { return false; } };

  // Файлы медиатеки для примеров. Если какой-то файл уберут из хранилища, пример покажет заглушку, редактор и плеер не сломаются
  const IMG = {
    one: 'media/ex-vh5bb9/img-8b138b5e.webp', // цифра 1 в синем круге
    two: 'media/ex-vh5bb9/img-2db88fd0.png', // цифра 2 в красном круге
    four: 'media/ex-vh5bb9/img-bc5f3595.webp', // цифра 4 в зелёном круге
    question: 'media/ex-vh5bb9/img-79b1fc9b.png', // знак вопроса
    house: 'media/ex-ugfvkv/img-0133b924.jpg', // дом
  };
  const AUD = {
    a: 'media/library/aud-a50607d4.wav',
    b: 'media/ex-ugfvkv/aud-2c5eda3e.wav',
    c: 'media/ex-ugfvkv/aud-87321932.mp3',
  };
  // Картинка в виде, который хранят модули: {media, url, alt}
  const img = (key, extra) => ({ media: IMG[key] || '', url: '', alt: '', ...(extra || {}) });

  // Инструкция примера (общий блок «Инструкция и картинка» редактора): текст от модуля, картинка и звук отсюда
  const instruction = text => ({
    title: '', text: text || 'Демо-пример: так выглядит заполненное упражнение.',
    image: { media: IMG.house, url: '', alt: '', size: 'medium', align: 'center' },
    audio: { media: AUD.a },
  });

  return { on, set, IMG, AUD, img, instruction };
})();
