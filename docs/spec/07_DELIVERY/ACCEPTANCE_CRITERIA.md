# MVP — проверяемые критерии приёмки

**Статус:** рабочая детализация утверждённой матрицы M01–M29; технические способы реализации ещё OPEN.  
**Формат:** Given / When / Then. Не изменяет область MVP.

| ID | Покрытие | Проверка / ожидаемый результат |
|---|---|---|
| AC-01 | M01 | Создать упражнение, найти в библиотеке, открыть, дублировать с новым ID; удалить по утверждённой семантике удаления (OPEN). |
| AC-02 | M02 | Переключение четырёх вкладок не теряет несохранённые изменения; общая вкладка использует общий Editor Core для обоих модулей. |
| AC-03 | M03 | Preview показывает актуальный Draft, не обновляя опубликованную версию. |
| AC-04 | M04 | Сохранённый Draft восстанавливается после закрытия и повторного открытия Editor; learner-run не восстанавливается после reload. |
| AC-05 | M05 | Undo/Redo отменяет/возвращает локальные правки, включая разметку пропусков; не отменяет Publish или rollback. |
| AC-06 | M06 | Переключение Classic/Comic меняет оформление в Preview и Player без изменения правильных ответов. |
| AC-07 | M07 | Общие элементы Studio и Player отображаются на EN/RU/KA; непереведённые авторские поля не заменяются выдуманным переводом. |
| AC-08 | M08 | Настройки 1 и 5 работают; пустой обязательный ответ не расходует попытку; последняя валидная проверка завершает run. |
| AC-09 | M09 | Core считает `sum(score)/sum(maxScore)`, округляет процент для UI, показывает результат; статус derived, не дублируется. |
| AC-10 | M10 | После Restart/reload ответов, подсветки и счётчика проверок нет; Draft автора не затронут. |
| AC-11 | M11 | Player без горизонтального переполнения и потери элементов на узком экране; взаимодействия доступны на touch. |
| AC-12 | M12 | Teacher’s Note отображается под упражнением согласно настройке; не влияет на проверку. |
| AC-13 | M13 | Создать, изменить, удалить пропуск в обоих модулях через одну реализацию Gap Engine. |
| AC-14 | M14 | Редактирование текста вокруг пропуска не меняет gap ID и не теряет ответ/изображение. |
| AC-15 | M15 | При 10 пропусках попытка добавить 11-й блокируется, текущие данные сохраняются; предлагается смысловое разделение. |
| AC-16 | M16 | Ввод текста проверяется по настроенным правильным вариантам. |
| AC-17 | M17 | Слово из банка можно поставить кликом или drag/drop, вернуть и заменить; одно экземплярное слово не используется дважды без разрешённой конфигурации. |
| AC-18 | M18 | Dropdown показывает заданные варианты и оценивает выбранный ответ. |
| AC-19 | M19 | Допустимые альтернативы засчитываются; регистр и лишние пробелы нормализуются по согласованным правилам. |
| AC-20 | M20 | Подсказка и стиль пропуска отображаются в Player и не изменяют ответ/оценивание. |
| AC-21 | M21 | Загруженное изображение повторно используется из библиотеки в разных упражнениях. |
| AC-22 | M22 | Для каждого пропуска указан правильный image ID; дистракторы не маркированы как правильные в Player; повторное использование создаёт отдельные экземпляры банка. |
| AC-23 | M23 | Выбор/drag изображения заполняет пропуск; замена работает, на touch доступен click-путь. |
| AC-24 | M24 | Заполненный пропуск можно очистить с возвратом изображения в банк; оценка 1/0 на пропуск, invalid не тратит попытку. |
| AC-25 | M25 | `contain` показывает целиком, `cover` заполняет область с обрезкой; выбор сохраняется при публикации. |
| AC-26 | M26 | Publish создаёт immutable snapshot; прошлую опубликованную запись нельзя мутировать редактированием Draft. |
| AC-27 | M27 | URL/iframe не меняется после перепубликации; LearnWorlds показывает Player, не редактор. |
| AC-28 | M28 | Rollback меняет активную версию, но сохраняет историю и стабильную ссылку. |
| AC-29 | M29 | Правка Draft без Publish не влияет на новый или уже открытый опубликованный Player; новая версия применяется только при следующей загрузке. |
| AC-30 | Архитектура | Общая правка Editor Core работает в двух модулях; локальная правка одного Module Editor не меняет другой. |
| AC-31 | Архитектура | Player Core и Gap Engine не содержат условий, проверяющих конкретный `module` ради специфического оценивания. |
| AC-32 | Безопасность | В опубликованном Player правильные ответы не раскрываются до предусмотренного завершения; редактирование и публикация доступны только уполномоченному автору (модель авторизации OPEN). |

## Gate перед написанием кода

Решить открытые вопросы, влияющие на схему/безопасность: хранение и авторизация, точный контракт модулей, удаление опубликованных упражнений, форматы медиа, разграничение режимов банка слов. Визуальные мелочи можно уточнять после первого работающего вертикального сценария.

## Fill Blanks FB-02 — дополнительные приёмочные сценарии (2026-10-15)

| ID | Given / When / Then |
|---|---|
| AC-FB-01 | Given 3 пропуска, When выбран авто Word Bank, Then банк содержит нужные экземпляры основных правильных ответов без ручного копирования. |
| AC-FB-02 | Given авто банк, When автор добавляет/удаляет слово через `+ Добавить слово`, Then ловушка появляется/исчезает, но основной правильный ответ не изменяется. |
| AC-FB-03 | Given два одинаковых текста правильного ответа, When один экземпляр используется, Then второй экземпляр остаётся доступен; ID экземпляров независимы. |
| AC-FB-04 | Given заполненный пропуск в Word Bank, When слово переносится в другой незакреплённый пропуск с уже занятым местом, Then перемещённый элемент занимает цель, прежний элемент цели возвращается в банк. |
| AC-FB-05 | Given занятый экземпляр в банке, When он используется/возвращается, Then его позиция и порядок других экземпляров не меняются; click/touch и drag/drop работают. |
| AC-FB-06 | Given правильный ответ закреплён проверкой, When ученик пытается заменить/сместить его, Then действие блокируется без изменения оценки. |
| AC-FB-07 | Given несколько пропусков Dropdown, When сформирован пул, Then каждый показывает основные ответы всех пропусков, дополнительные правильные ответы и ловушки без текстовых дублей; для каждого пропуска своё множество допустимых ответов. |
| AC-FB-08 | Given Dropdown с одним вариантом или без ошибочного варианта, When автор публикует, Then публикация блокируется с понятным указанием проблемы; редактирование доступно. |
| AC-FB-09 | Given 9+ различных вариантов Dropdown, When автор редактирует упражнение, Then появляется только предупреждение; длинный список в мобильном Player прокручивается без обрезания. |
| AC-FB-10 | Given заполненное упражнение и ловушки, When автор переключает Free Input ↔ Word Bank ↔ Dropdown и возвращается, Then не изменяются текст, gap IDs, ответы и режимные настройки. |
| AC-FB-11 | Given альтернативный правильный ответ, When активен Word Bank, Then альтернатива не появляется автоматически, но может быть явно добавлена как доступный экземпляр и засчитывается в правильном пропуске. |
| AC-FB-12 | Given предварительный просмотр, When ученик выбирает ответы/сбрасывает Player, Then содержание и сохранённый Draft автора остаются без изменений, результаты не сохраняются. |
| AC-FB-13 | Given корректный ранее сохранённый Draft, When автор закрывает и открывает Editor, Then выбранный режим и относящиеся к нему ручные настройки восстанавливаются в рамках общей системы сохранения. |


## Image to Gaps ITG-04 — специализированные критерии приёмки (2026-10-15)

| ID | Given / When / Then |
|---|---|
| AC-ITG-01 | Given несколько пропусков и картинки Media Library, When преподаватель выбирает пропуск и нажимает на картинку, Then назначение применяется за одно действие без дублирования файла. |
| AC-ITG-02 | Given одна картинка назначена N пропускам, When формируется банк, Then имеются не менее N независимо используемых экземпляров, указывающих на один mediaId. |
| AC-ITG-03 | Given назначенные ответы, When преподаватель добавляет/удаляет ловушку, Then основное назначение ни одного пропуска не меняется. |
| AC-ITG-04 | Given одинаковые экземпляры картинки, When ученик размещает/возвращает один, Then другие остаются независимыми. Ученику не показывается instanceId. |
| AC-ITG-05 | Given разные instanceId с одним mediaId, When экземпляр размещён в пропуске, которому соответствует mediaId, Then проверка одинакова независимо от instanceId и признака ловушки. |
| AC-ITG-06 | Given незакреплённые заполненные/пустые пропуски, When ученик выбирает, перемещает, заменяет или возвращает картинку нажатием или drag-and-drop (мышь и touch), Then сохраняется корректное владение экземпляром; закреплённые ответы неизменны. |
| AC-ITG-07 | Given использованный экземпляр, When он занят/возвращён, Then его место в банке не меняется, соседние экземпляры не переставляются. |
| AC-ITG-08 | Given настройки S/M/L и contain/cover, When Player отображается на разных ширинах, Then размеры адаптируются, contain сохраняет всё изображение, cover кадрирует без искажения пропорций. |
| AC-ITG-09 | Given Player внутри узкого iframe LearnWorlds-подобного контейнера, When ширина контейнера меняется, Then сетка адаптируется без горизонтального переполнения и перекрытия функциональных элементов. |
| AC-ITG-10 | Given пропуск без назначенного или доступного изображения, When автор пытается опубликовать, Then публикация блокируется с ясной ошибкой; редактор остаётся доступен. |
| AC-ITG-11 | Given одинаковый mediaId используется в нескольких пропусках, When автор выполняет обычную замену для одного, Then остальные назначения не меняются; отдельная команда «Заменить во всех» меняет все связанные с сохранением прочих данных. |
| AC-ITG-12 | Given упражнение завершено с ошибками, When включена опция показа правильных изображений, Then ученик может показать/скрыть эталоны для ошибочных пропусков без изменения оценки; при выключенной опции они не раскрываются. |


## True / False — TF-05.2 (16 специальных критериев, утверждено 2026-10-15)

| ID | Проверяемый сценарий |
|---|---|
| TF-AC-01 | Создание, редактирование, дублирование и удаление утверждений. |
| TF-AC-02 | Перестановка утверждений без потери текста, ответа, аудио и пояснения. |
| TF-AC-03 | Шесть готовых пар и Custom Labels для всего упражнения. |
| TF-AC-04 | Индивидуальный формат через галочку и выпадающий список. |
| TF-AC-05 | Индивидуальные Custom Labels и необязательная третья категория. |
| TF-AC-06 | Сохранение скрытых настроек при переключении общего/индивидуального формата. |
| TF-AC-07 | Валидация пустых/совпадающих названий и отключённых категорий при публикации. |
| TF-AC-08 | Навигация по одному утверждению с сохранением выбора. |
| TF-AC-09 | Список всех утверждений с теми же состояниями и результатом. |
| TF-AC-10 | Проверка всех обязательных утверждений через общий Behavior Core. |
| TF-AC-11 | Закрепление правильных и исправление ошибочных ответов. |
| TF-AC-12 | Пояснения скрыты до проверки и при ошибке до успешной проверки или завершения. |
| TF-AC-13 | Неограниченное воспроизведение прикреплённого аудио. |
| TF-AC-14 | Клавиатура, мышь, touch и iframe без потери функциональности. |
| TF-AC-15 | Результаты прохождения нигде не сохраняются. |
| TF-AC-16 | Require correction if False видна только неактивной с Coming soon. |

## Multiple Choice — MC-06 (18 специальных критериев, утверждено 2026-10-15)

| ID | Проверяемый сценарий |
|---|---|
| MC-AC-01 | Создание, изменение, дублирование и удаление вопросов. |
| MC-AC-02 | Изменение порядка вопросов без потери данных и ID. |
| MC-AC-03 | Добавление/удаление вариантов; минимум два при публикации. |
| MC-AC-04 | Single Choice имеет ровно один правильный вариант. |
| MC-AC-05 | Multiple Select допускает один или несколько правильных вариантов. |
| MC-AC-06 | Один балл только за точный набор, без частичных баллов. |
| MC-AC-07 | Переключение Single/Multiple сохраняет старые назначения, конфликт блокирует публикацию. |
| MC-AC-08 | Буквы/цифры меняют только маркировку по порядку. |
| MC-AC-09 | Перемешивание сохраняет привязку правильности к optionId. |
| MC-AC-10 | Показ числа правильных ответов только при включённой опции. |
| MC-AC-11 | По одному вопросу и все сразу: общие ответы и итог. |
| MC-AC-12 | Независимая главная картинка для каждого вопроса. |
| MC-AC-13 | Расположение картинки вопроса сверху/снизу/слева/справа и мобильная адаптация. |
| MC-AC-14 | Текстовые, графические и смешанные варианты ответа. |
| MC-AC-15 | Hover-увеличение опционально, иконка крупного просмотра не выбирает ответ. |
| MC-AC-16 | Независимая озвучка вопроса и вариантов. |
| MC-AC-17 | После проверки верные вопросы блокируются, неверные исправимы; для ошибочного Multiple Select нет раскрытия отдельных вариантов. |
| MC-AC-18 | Адаптивный Player для телефона и iframe без горизонтального переполнения. |


## Odd One Out — OO-04 (16 специальных критериев, утверждено 2026-10-15)

| ID | Проверяемый сценарий |
|---|---|
| OO-AC-01 | Создание, дублирование, удаление и сортировка групп с независимыми ID. |
| OO-AC-02 | Добавление, изменение, удаление и перестановка элементов. |
| OO-AC-03 | Публикация блокируется при менее чем трёх допустимых элементах группы; черновик доступен. |
| OO-AC-04 | Каждая публикуемая группа имеет ровно один корректно назначенный лишний элемент. |
| OO-AC-05 | Перестановка не меняет правильность, связанная с itemId. |
| OO-AC-06 | Работают текстовые, графические и смешанные элементы. |
| OO-AC-07 | Аудио воспроизводится независимо, без расхода проверок. |
| OO-AC-08 | Увеличение изображения не изменяет выбранный ответ. |
| OO-AC-09 | Стиль карточки/плашки применяется индивидуально и корректно наследует общий стиль. |
| OO-AC-10 | Отображение по одной группе / все группы сохраняет выбор и результат. |
| OO-AC-11 | Перемешивание сохраняет правильный itemId и стабильный порядок текущего прохождения. |
| OO-AC-12 | Выбор, замена и снятие выделения одного лишнего элемента до проверки. |
| OO-AC-13 | Проверенная правильная группа закрепляется, неправильная остаётся исправимой. |
| OO-AC-14 | Пояснение не раскрывает правильность при ошибке до успешного исправления/завершения. |
| OO-AC-15 | Предупреждения о дублях не блокируют публикацию; неполные обязательные данные блокируют. |
| OO-AC-16 | Адаптивный Player на телефонах и в узком iframe без горизонтального переполнения. |


## Select Title — ST-04 (16 специальных критериев, утверждено 2026-10-15)

| ID | Проверяемый сценарий |
|---|---|
| ST-AC-01 | Создание, изменение, дублирование и удаление текстов с независимыми стабильными ID. |
| ST-AC-02 | Перестановка текстов без потери материала, заголовков, медиа и пояснений. |
| ST-AC-03 | Собственный набор заголовков для каждого текста, без перекрёстного изменения. |
| ST-AC-04 | Не менее двух непустых заголовков на текст для публикации; четыре по умолчанию. |
| ST-AC-05 | Ровно один правильный заголовок на текст, привязанный к стабильному option ID. |
| ST-AC-06 | Совпадающие заголовки внутри одного текста блокируют публикацию независимо от регистра и лишних пробелов; между текстами разрешены. |
| ST-AC-07 | Сортировка и перемешивание сохраняют правильность; порядок стабилен во время прохождения. |
| ST-AC-08 | Длинные тексты, абзацы и поддерживаемое форматирование отображаются полностью без вложенной прокрутки. |
| ST-AC-09 | Режим одного текста обеспечивает навигацию без потери выбранных ответов. |
| ST-AC-10 | Режим всех текстов использует те же данные, проверку и результаты. |
| ST-AC-11 | Изображение каждого текста отображается и позиционируется через общий Media Layout с адаптацией к iframe. |
| ST-AC-12 | Аудио доступно сразу и воспроизводится без ограничений, не меняя ответ/проверки. |
| ST-AC-13 | Выбор, замена и закрепление заголовка работают через общую Single Choice механику. |
| ST-AC-14 | Пояснения не раскрывают неверному ученику ответ до исправления/завершения; после завершения доступны правильные заголовки через Player Core. |
| ST-AC-15 | Неполные обязательные данные или недоступное используемое медиа блокируют публикацию, но не редактирование. |
| ST-AC-16 | Адаптивный Player доступен с клавиатуры, мыши и touch на телефоне, планшете и в узком LearnWorlds iframe. |

## Mistake Mode — MM-04 (18 специальных критериев, утверждено 2026-10-15)

| ID | Проверяемый сценарий |
|---|---|
| MM-AC-01 | Создаются один или несколько текстовых блоков; дублирование и сортировка не ломают ID и содержимое. |
| MM-AC-02 | Автор размечает отдельные слова, без выделения диапазонов и фраз. |
| MM-AC-03 | Повторяющиеся одинаковые слова получают независимые стабильные ID. |
| MM-AC-04 | При безопасном редактировании текста корректные отметки сохраняются на прежних вхождениях. |
| MM-AC-05 | Неоднозначная либо повреждённая разметка требует переразметки без тихой смены целевого слова. |
| MM-AC-06 | Для каждой ошибки независимо включается/выключается обязательность исправления. |
| MM-AC-07 | При исправлении доступны основной правильный ответ и альтернативы, включая ответы из нескольких слов. |
| MM-AC-08 | Отключение обязательности исправления не стирает ранее заданные ответы. |
| MM-AC-09 | Публикация блокируется при пустых текстах, отсутствии размеченных ошибок, повреждённой разметке или отсутствующем обязательном исправлении; черновик сохраняется. |
| MM-AC-10 | Ученик изначально не видит авторские отметки или позиции ошибок. |
| MM-AC-11 | Один клик/тап отмечает слово; повторный снимает, если отметка не закреплена. |
| MM-AC-12 | Несколько слов можно пометить независимо, без перекрытий и диапазонов. |
| MM-AC-13 | Поля исправлений доступны у всех выбранных слов текста, если хотя бы одна ошибка в нём требует исправления; заранее правильность не раскрывается. |
| MM-AC-14 | За правильное обнаружение без исправления начисляется ровно 1 балл, при обязательном исправлении — только за обнаружение плюс правильный ответ без частичных баллов. |
| MM-AC-15 | Ложные отметки не приносят баллов, не создают отрицательных баллов и блокируют 100% до удаления. |
| MM-AC-16 | Проверка доступна после выбора хотя бы одного слова; пустые исправления не блокируют проверку; успешные ответы закрепляются, пропущенные ошибки не раскрываются. |
| MM-AC-17 | После окончания по 100% либо исчерпанию проверок доступны истинные позиции, исправления и имеющиеся пояснения; сброс очищает ученическое состояние. |
| MM-AC-18 | Мышь, клавиатура, touch, длинные тексты и узкие LearnWorlds iframe работают без горизонтального переполнения; режим одного/всех текстов сохраняет данные. |

## Ordering — OR-AC-01–18 (v17 final approved behavior)

| ID | Проверка / ожидаемый результат |
|---|---|
| OR-AC-01 | Преподаватель создаёт несколько независимых последовательностей; каждая имеет собственный корректный порядок и инструкцию. |
| OR-AC-02 | В Editor элементы свободно сортируются мышью через Drag & Drop и кнопками. После перемещения сохранённый порядок автоматически становится новым правильным ответом. |
| OR-AC-03 | После сохранения и повторного открытия Author Studio сохраняются порядок, ID и содержимое элементов; ответный ключ совпадает с текущим порядком редактора. |
| OR-AC-04 | Поддерживается редактирование содержимого элемента без потери стабильного ID; подходящие изображения/аудио используют общую Media Library и UI. |
| OR-AC-05 | Добавление и удаление элементов корректно обновляет последовательность; не повреждаются другие последовательности. |
| OR-AC-06 | Копирование и перестановка целых последовательностей не связывает их данные; дублированные записи получают новые ID. |
| OR-AC-07 | Нельзя опубликовать последовательность с менее чем двумя содержательными элементами или пустым элементом; черновик при этом сохраняется. |
| OR-AC-08 | При двух визуально одинаковых элементах в одной последовательности редактор предупреждает и блокирует публикацию; одинаковые элементы в разных последовательностях допустимы. |
| OR-AC-09 | После устранения повторяющихся элементов публикация снова доступна; скрытые ID не используются, чтобы оправдать одинаковое видимое содержимое. |
| OR-AC-10 | При каждом начале прохождения Player автоматически перемешивает элементы; стартовый порядок отличается от правильного, настройка отключения отсутствует. |
| OR-AC-11 | В Author Studio нет отдельного ручного стартового порядка; изменение порядка в Editor меняет только правильную последовательность, из которой Player генерирует перемешанный старт. |
| OR-AC-12 | До проверки Student Player поддерживает неограниченную перестановку Drag & Drop мышью и пальцем; касание за ручку не мешает обычной прокрутке страницы. |
| OR-AC-13 | Доступны кнопки перемещения и клавиатурная альтернатива Drag & Drop; они задают тот же порядок, что и перетаскивание. |
| OR-AC-14 | До проверки не подсвечиваются правильные позиции и не закрепляются элементы; весь список свободен для редактирования. |
| OR-AC-15 | Одна кнопка «Проверить» завершает сразу все последовательности одного прохождения, после чего сортировка недоступна и повторной проверки нет. |
| OR-AC-16 | Проверка даёт ровно один балл за каждую позицию с правильным элементом; итоговый результат показывает верные/неверные позиции и не начисляется повторно. |
| OR-AC-17 | «Начать заново» очищает прежние баллы/результаты, создаёт новое перемешивание и снова даёт одну проверку; история результатов не хранится. |
| OR-AC-18 | Player работает на мобильном, планшете, десктопе и в LearnWorlds iframe, с текстовыми и графическими элементами и без горизонтального переполнения. |


## Color Coding — CC-AC-01–18 (v18 approved)

| ID | Проверка / ожидаемый результат |
|---|---|
| CC-AC-01 | Преподаватель создаёт и удаляет категории; каждая имеет устойчивый ID, название и цвет. |
| CC-AC-02 | Публикация невозможна при повторяющихся (после нормализации) названиях категорий или повторном цвете, пустом названии. |
| CC-AC-03 | Переименование и изменение цвета категории обновляет все связанные тексты без потери назначений. |
| CC-AC-04 | Удаление используемой категории требует подтверждения с числом затронутых слов; только после подтверждения снимаются связанные отметки, текст сохраняется. |
| CC-AC-05 | Добавление, копирование, удаление и сортировка текстов сохраняют разметку; копии получают новые ID вхождений, категории остаются общими. |
| CC-AC-06 | Учитель отмечает отдельные слова в обычном тексте без ручного ввода кодов разметки и без диапазонов из нескольких слов. |
| CC-AC-07 | Повторяющиеся слова в одном/разных текстах имеют независимые ID и допускают независимое назначение категорий. |
| CC-AC-08 | Добавление/изменение текста сохраняет однозначно сопоставимые отметки и форматирование; сдвиг позиций не стирает разметку остальных слов. |
| CC-AC-09 | Повреждённые/неоднозначные отметки требуют восстановления в редакторе, не теряя несвязанные отметки. |
| CC-AC-10 | Публикация блокируется без категорий, текстов, хотя бы одного размеченного слова, при некорректных ID/названиях/цветах либо повреждённой разметке; черновик сохраняется. |
| CC-AC-11 | В Player выбор категории отражается названием, цветом и явным индикатором; категория общая для всех текстов. |
| CC-AC-12 | Нажатие окрашивает слово; повторное нажатие активным цветом снимает отметку; выбор другого цвета заменяет категорию. |
| CC-AC-13 | Режим одного текста (по умолчанию) и всех текстов сохраняет все ученические отметки при переключении и навигации. |
| CC-AC-14 | За корректную классификацию обязательного слова начисляется ровно 1 балл, без частичных, отрицательных и повторно начисляемых баллов. |
| CC-AC-15 | Неверная категория и окрашивание нейтрального слова не дают баллов и препятствуют 100%; простая окраска всего текста не считается решением. |
| CC-AC-16 | Проверка доступна после отметки хотя бы одного слова; корректные пары закрепляются, ошибочные остаются редактируемыми, пропущенные категории не раскрываются до завершения; действует общий лимит проверок. |
| CC-AC-17 | После завершения можно увидеть правильные категории и нейтральные слова; сброс очищает ученическое состояние без сохранения истории результата. |
| CC-AC-18 | Player сохраняет пробелы/абзацы, поддерживает контраст и нецветовые индикаторы, управление клавиатурой/касанием, мобильную адаптацию и LearnWorlds iframe без горизонтального переполнения. |

## Matching — MT-AC-01–20 (v19 approved)

| ID | Проверка / ожидаемый результат |
|---|---|
| MT-AC-01 | Create, edit and delete independent matching sets while preserving unrelated content. |
| MT-AC-02 | Create and edit rows defining exactly one left-right correct pair with stable identity. |
| MT-AC-03 | Editing, moving, copying and deleting pairs preserves valid links; copies get new stable IDs. |
| MT-AC-04 | Each card supports text, image and mixed media content through shared components. |
| MT-AC-05 | Optional audio and image viewer operate without creating/modifying a pairing. |
| MT-AC-06 | Duplicate, delete and reorder both pairs and sets, preserving independent IDs and connections. |
| MT-AC-07 | Indistinguishable items within the same column/set block publication; duplicates across sets or opposing columns are allowed. |
| MT-AC-08 | Incomplete/empty pair, fewer than two pairs in any set, and missing required media block publication while drafts remain savable. |
| MT-AC-09 | Both columns shuffle independently at new run while preserving correct pair IDs. |
| MT-AC-10 | Tap left then right creates link; changing/canceling the active left selection works. |
| MT-AC-11 | Drag and drop from a card handle creates a link without moving cards; touch scroll is unaffected. |
| MT-AC-12 | Unsolved links can be replaced, reassigned, and removed without corrupting other links. |
| MT-AC-13 | Any right card can be linked to at most one left card; reassigning an occupied right card unlinks its former unsolved source. |
| MT-AC-14 | Paired cards show same soft color and number, with non-color indicators; this does not reveal correctness before Check. |
| MT-AC-15 | After Check, correct pairs leave work columns and appear green, locked, in the lower solved section. |
| MT-AC-16 | Wrong pairs stay above, show red feedback, are unlinked for retry, and do not reveal correct matching. |
| MT-AC-17 | Each correct pair scores exactly once across checks and stays solved, without partial or negative scoring. |
| MT-AC-18 | Across all sets, original total of 1–5 pairs defaults to 3 valid checks, 6+ to 5; override and Ordering exception follow Behavior Core. |
| MT-AC-19 | Check requires all unresolved left cards linked, does not auto-score sole remaining pair, and completes with results/review/restart at 100% or budget exhaustion. |
| MT-AC-20 | Works with keyboard/touch/mouse on mobile/tablet/desktop and LearnWorlds iframe; one/all-set views preserve state. |

## Matching MT-05 — Design display mode acceptance criteria (approved 2026-10-16)

| ID | Acceptance test |
|---|---|
| MT-AC-21 | Author Studio Design offers `Standard` (default) and `Lines + Pair Colors`; published configuration persists without modifying pairs. |
| MT-AC-22 | In Lines mode, every learner-created link draws a connector between the correct **displayed endpoints**, and its line and two cards share one temporary, distinguishable pair color; color never signals correctness before Check. |
| MT-AC-23 | In Lines mode, Check is disabled until **every** left card in **all sets** is linked; then **exactly one** valid Check is allowed regardless of pair count or manual override, with unchanged score of 1 point per correct pair. |
| MT-AC-24 | The single Lines Check leaves cards in their original displayed columns/positions; correct pair cards **and line** become green, incorrect pair cards **and line** become red, with icons/text for non-color feedback. No pair moves to a separate solved section. |
| MT-AC-25 | After Lines Check, the board is immutable, final score is visible, and Start again resets results/connections and independently reshuffles each column; optional solution review does not alter the graded colored board. |
| MT-AC-26 | Lines and endpoints remain correctly attached during resize, line wrap, scrolling, keyboard interaction, touch, and LearnWorlds iframe/mobile rendering; line graphics do not block tap/drag/audio/image viewer. |
| MT-AC-27 | Standard mode retains existing 3/5 dynamic budget, allowed override and correct-pair movement to green lower section (MT-AC-15–20), unaffected by Lines-mode exception. |

## Timeline TL-01–TL-04 — accepted scenarios (2026-10-16, v21)

| ID | Acceptance test |
|---|---|
| TL-AC-01 | Author Studio can create a Timeline with instruction, published canonical order and module configuration. |
| TL-AC-02 | Events can be added and edited; event content and display date labels persist through save and reload. |
| TL-AC-03 | Manual list order is canonical; changing display date text does not re-sort or silently rewrite the answer key. |
| TL-AC-04 | Duplicating an event creates a unique ID, distinct from the source event, with independent subsequent edits. |
| TL-AC-05 | Delete, drag-reorder and move controls work without corrupting other event IDs or media. |
| TL-AC-06 | Text, image, optional audio and explanations persist through publishing and display with correct event. |
| TL-AC-07 | Design dateVisibility supports after_check default and always_visible; student cannot override the author choice. |
| TL-AC-08 | Incomplete drafts are savable without forcing publication. |
| TL-AC-09 | Publish refuses fewer than 2 complete events or any missing date label, required content or mandatory media reference. |
| TL-AC-10 | Publish blocks identical/learner-indistinguishable cards using what is visible before Check, including when distinct hidden dates exist. |
| TL-AC-11 | Duplicate/ambiguous date labels trigger a nonblocking warning and do not auto-sort the teacher canonical list. |
| TL-AC-12 | Player auto-shuffles event cards on starting a run while retaining stable event identities and canonical data. |
| TL-AC-13 | Reordering works via drag-and-drop with mouse and touch without corrupting event content. |
| TL-AC-14 | Up/down and accessible keyboard/focus alternatives reorder accurately and disable invalid edge moves. |
| TL-AC-15 | Audio/image viewer interactions never reorder events; zoom and mobile scroll operate without accidental dragging. |
| TL-AC-16 | Exactly one Check is accepted per run regardless of number of events and shared 3/5 setting. |
| TL-AC-17 | Final score equals number of event IDs in correct indexed position; no partial, negative, duplicate or date-label-based scoring. |
| TL-AC-18 | Double taps/concurrent or repeated Check requests cannot duplicate grading or record/result delivery. |
| TL-AC-19 | All dates are shown after Check, including when hidden before; graded positions have accessible red/green and icon/text feedback. |
| TL-AC-20 | The submitted Your Timeline remains fixed and a separate Correct Timeline displays the full teacher canonical order. |
| TL-AC-21 | Start again clears score, result, old ordering and media playback, then creates a new shuffled run. |
| TL-AC-22 | The Player works on mobile, tablet, desktop and inside LearnWorlds iframe, preserving usable touch scrolling and card layout. |


## Categories / Sorting — CS-AC-01–26 (CS-04 F APPROVED, 2026-10-16)

| ID | Acceptance criterion |
|---|---|
| CS-AC-01 | Author can create a Categories / Sorting draft through the Module Registry and common Editor Core. |
| CS-AC-02 | Author can create, rename and delete categories without corrupting independent answer references. |
| CS-AC-03 | Duplicating a category clones its cards with independent new category/item IDs. |
| CS-AC-04 | Reordering categories changes display order only, never classification truth. |
| CS-AC-05 | Author can add and edit cards under their correct categories. |
| CS-AC-06 | Bulk-paste adds one text card per nonblank line to the chosen category, with validation. |
| CS-AC-07 | Moving a card between author categories updates its single correct categoryId. |
| CS-AC-08 | Text, image, mixed cards and optional audio persist via Media Library references. |
| CS-AC-09 | Publish blocks learner-indistinguishable cards assigned to different categories; warns on same-category duplicates. |
| CS-AC-10 | Publish enforces >=2 unique-named categories, each with >=1 complete card, >=3 cards overall and valid mandatory media/content. |
| CS-AC-11 | Incomplete drafts save and reopen while publication stays blocked. |
| CS-AC-12 | Columns/Stacked layout options, responsive fallback and Classic/Comic, Compact/Standard tokens render consistently. |
| CS-AC-13 | Player starts with shuffled Item Bank, preserves stable item identities and correct category IDs. |
| CS-AC-14 | Learner can choose card then tap a category; selection can be changed/cancelled. |
| CS-AC-15 | Drag-and-drop works with mouse and touch without disrupting normal page/iframe scrolling. |
| CS-AC-16 | Unlocked cards can move between categories and back to Item Bank; moves replace old placement. |
| CS-AC-17 | Check is unavailable until all unlocked cards are assigned; incomplete work consumes no checks. |
| CS-AC-18 | Correct cards remain green, locked, accessible with icon/text feedback after each check. |
| CS-AC-19 | On intermediate checks wrong cards get red feedback then return to bank; correct categories stay undisclosed. |
| CS-AC-20 | Score is exactly one point for each uniquely correctly placed itemId, never double-awarded or order-dependent. |
| CS-AC-21 | Behavior Core grants 3 checks for original 3–5 cards and 5 for 6+; supported teacher overrides work; correct locking does not alter budget. |
| CS-AC-22 | 100% correct placement finishes exercise immediately, without requiring remaining checks. |
| CS-AC-23 | Final check freezes a snapshot (wrong cards do not return for editing); final scores and correct categories display. |
| CS-AC-24 | Double-clicks/duplicate Check events cannot regrade, duplicate scores or send results twice. |
| CS-AC-25 | Start again resets graded state, locks, answers, selections, media playback and check counter, then reshuffles. |
| CS-AC-26 | Responsive mobile/tablet/desktop and LearnWorlds iframe work with accessible non-color-only feedback, media controls and large categories. |


## Word Scramble / Phrase Builder / Sentence Builder — WS-AC-01–28 (WS-04 F APPROVED, 2026-10-16)

| ID | Acceptance criterion |
|---|---|
| WS-AC-01 | Create Word Scramble task with grapheme-token bank and correct answer. |
| WS-AC-02 | Create Phrase Builder task with word/fragment tokens. |
| WS-AC-03 | Create Sentence Builder task including teacher-approved punctuation. |
| WS-AC-04 | Mix all three task modes in one exercise and persist their independent configuration. |
| WS-AC-05 | Automatically segment author correct answer by the selected mode. |
| WS-AC-06 | Segment Unicode grapheme clusters correctly across Latin, Cyrillic, Georgian, accents and combined sequences. |
| WS-AC-07 | Split and merge adjacent tokens without corrupting reconstruction or identity. |
| WS-AC-08 | Add, delete, edit and reorder canonical tokens within a task. |
| WS-AC-09 | Duplicate repeated tokens with independently stable occurrence IDs. |
| WS-AC-10 | Preserve case, attached punctuation, apostrophes, hyphens and intended whitespace during reconstruction. |
| WS-AC-11 | Detect out-of-sync original answer vs manually customized tokenization; explicit regeneration does not silently destroy edits. |
| WS-AC-12 | Create, duplicate and delete tasks; duplicated tasks/tokens have fresh IDs. |
| WS-AC-13 | Save/reopen instructions, optional hint, picture, audio, explanation and validated Media Library refs. |
| WS-AC-14 | Render Tiles and Chips, Classic/Comic, Compact/Standard with consistent responsive styling. |
| WS-AC-15 | Allow draft saves but block publish for missing/empty elements, fewer than 2 per task, missing task or invalid reconstruction/media. |
| WS-AC-16 | Allow duplicate token values but block publication when no visually distinguishable shuffle exists. |
| WS-AC-17 | Shuffle token bank at run start, not into canonical value order where a noncanonical arrangement exists. |
| WS-AC-18 | Learner assembles tokens by tap without reusing a token instance twice. |
| WS-AC-19 | Drag bank↔answer, reorder in answer with mouse/touch and fallback controls. |
| WS-AC-20 | Return selected token to bank, preserving its ID and content. |
| WS-AC-21 | Navigate one task at a time while preserving all unfinished answers until final Check. |
| WS-AC-22 | Disable global Check until each task has used all its required tokens; incomplete work consumes no check. |
| WS-AC-23 | Exactly one global final Check per run; answer edits lock after Check. |
| WS-AC-24 | Award 1 point only for fully correct task; no partial token/position credit or penalties. |
| WS-AC-25 | Treat duplicate equal-value token IDs as interchangeable using Unicode NFC while preserving case/meaningful punctuation. |
| WS-AC-26 | Prevent duplicate Check taps/events from regrading or dispatching repeated results. |
| WS-AC-27 | Show per-task outcomes, learner answer, canonical answer for incorrect tasks, optional explanation and full reset/re-shuffle. |
| WS-AC-28 | Render and operate accessibly on desktop/mobile/tablet/LearnWorlds iframe, with independent media controls and safe scrolling. |


## v24 — Splice acceptance criteria (SP-04 F APPROVED, SP-AC-01–30)

| ID | Acceptance criterion |
|---|---|
| SP-AC-01 | Create Splice as standalone module in Author Studio. |
| SP-AC-02 | Switch Single Word / Word Mosaic without corrupting source word and piece data. |
| SP-AC-03 | Auto division proposes 2–4 valid nonempty grapheme-safe pieces subject to word length. |
| SP-AC-04 | Manual division can represent exact teacher-intended boundaries without losing graphemes. |
| SP-AC-05 | Handle Unicode extended graphemes and preserve original casing. |
| SP-AC-06 | Reconstruct source word exactly from canonical ordered pieces. |
| SP-AC-07 | Handle multiple teacher words; proposed bulk-input path must not violate data integrity. |
| SP-AC-08 | Duplicate words with independent IDs for word and fragment instances. |
| SP-AC-09 | Preserve optional image, audio, hint, explanation without interactive conflicts. |
| SP-AC-10 | Render Tiles / Paper Pieces while retaining accessibility and responsive legibility. |
| SP-AC-11 | Easy visibly supplies target words and fragment counts. |
| SP-AC-12 | Medium hides word labels but shows required fragment counts (default). |
| SP-AC-13 | Hard hides word labels and fragment counts but still shows number of word areas. |
| SP-AC-14 | Author validation blocks nonreconstructible, insufficient or unshufflable pieces; alternatives warn rather than falsely claim equivalence. |
| SP-AC-15 | Single Word shuffles independently on initial and repeat run. |
| SP-AC-16 | Mosaic mixes all target pieces in one bank and shuffles. |
| SP-AC-17 | Mosaic simultaneously renders all target assembly areas. |
| SP-AC-18 | Active Mosaic area can be selected without losing placements. |
| SP-AC-19 | Tap piece -> place once; taps never clone same instance. |
| SP-AC-20 | Drag/drop and reorder across bank/areas and within an area, mouse and touch. |
| SP-AC-21 | Return and move a piece between areas with exactly one current owner. |
| SP-AC-22 | Easy/Medium enforce shown fragment capacity of each area. |
| SP-AC-23 | Hard requires at least two pieces per area while allowing different legal counts. |
| SP-AC-24 | One global final Check only, once all pieces/tasks are fully assigned; edits lock. |
| SP-AC-25 | Binary one point per wholly reconstructed word; no per-piece partial points. |
| SP-AC-26 | Medium/Hard scoring ignores area order and applies necessary part-count constraint for Medium. |
| SP-AC-27 | Duplicate equal-valued fragments interchangeable; equal target words scored with multiset multiplicity. |
| SP-AC-28 | Double Check is idempotent: no repeated grading, scoring or result dispatch. |
| SP-AC-29 | Show word statuses, frozen submitted answers, correct source words and splits, full restart/reshuffle. |
| SP-AC-30 | Player works with keyboard-accessible controls, touch scrolling, narrow screens and LearnWorlds iframe. |


## Module 15 — Prepositions (PR-01–PR-04 A–F approved; v25)

| ID | Criterion |
|---|---|
| PR-AC-01 | **Создание упражнения Prepositions в Author Studio** — Create a valid Prepositions draft using the shared author shell. |
| PR-AC-02 | **Выбор библиотеки языка** — Selecting English loads its versioned curated preposition category source. |
| PR-AC-03 | **Выбор нескольких категорий** — Teacher selects one or more categories and sees the merged options. |
| PR-AC-04 | **Добавление и исключение предлогов** — Per-exercise inclusion/exclusion updates available options without changing system library. |
| PR-AC-05 | **Объединение повторяющихся записей** — Same normalized visible preposition in overlapping categories appears once in bank. |
| PR-AC-06 | **Многословные предлоги** — A multiword preposition is one atomic choice in author and learner views. |
| PR-AC-07 | **Сохранение версии библиотеки** — Saved/published exercise references or snapshots exact authored library selections. |
| PR-AC-08 | **Создание нескольких предложений** — Add and edit multiple sentences without lost IDs. |
| PR-AC-09 | **Несколько пропусков в предложении** — Separate gaps inside the same flowing text preserve independent answers. |
| PR-AC-10 | **Стабильные ID пропусков** — Editing adjacent text/reordering sentences preserves existing gap IDs. |
| PR-AC-11 | **Альтернативные правильные ответы** — Main and multiple alternatives match exactly according to teacher accepted choices. |
| PR-AC-12 | **Индивидуальные варианты пропуска** — Gap-level subset overrides global exercise bank and presents allowed choices only. |
| PR-AC-13 | **Правильный вариант обязательно доступен** — Publishing fails if any accepted choice is not in that gap offered options. |
| PR-AC-14 | **Дублирование/удаление/сортировка предложений** — Clones receive new sentence/gap IDs and edits cannot corrupt unrelated answers. |
| PR-AC-15 | **Сохранение незавершённого черновика** — Incomplete drafts save, but invalid publications cannot proceed. |
| PR-AC-16 | **Изоляция публикаций от обновлений библиотеки** — Administrator library revision leaves earlier published exercises unchanged. |
| PR-AC-17 | **Переключение Dropdown / Word Bank** — Both designs operate on the same exercise answer model. |
| PR-AC-18 | **Повторное использование одного предлога** — Bank preposition stays available for unlimited gaps and never depletes. |
| PR-AC-19 | **Заполнение и изменение ответов** — Learner can fill and replace unlocked choices, obeying per-gap options. |
| PR-AC-20 | **Проверка только при полном заполнении** — Cannot Check with any currently unlocked gap empty. |
| PR-AC-21 | **Закрепление правильных пропусков** — Correct gaps lock once, visible green/icon/text status and cumulative score. |
| PR-AC-22 | **Исправление неправильных пропусков** — Wrong gaps remain editable without answer disclosure; red clears on edit. |
| PR-AC-23 | **Оценивание альтернативных предлогов** — Any teacher-approved answer earns exactly one point per gap. |
| PR-AC-24 | **Динамический лимит проверок** — Original <=5 gaps yields 3 checks, >=6 yields 5, teacher override per shared rules. |
| PR-AC-25 | **Защита от повторного оценивания** — Double Check cannot duplicate points or iframe result dispatch. |
| PR-AC-26 | **Итоговый результат и пояснения** — On 100% or exhausted checks show submitted response, accepted answers and explanation. |
| PR-AC-27 | **Полный перезапуск** — Restart resets answers, locks, scores, and check count. |
| PR-AC-28 | **Адаптивность, доступность, iframe** — Tap/keyboard/screen readers, no clipped selects, long options wrap, narrow LearnWorlds iframe. |


## v26 — Essay Writing (Module 16): EW-AC-01–EW-AC-36

EW-02, EW-03, EW-04 A–F approved; see `04_MODULES/ESSAY_WRITING.md`. Formal checking is distinct from subjective grading.

| ID | Verifiable acceptance criterion |
|---|---|
| EW-AC-01 | **Create and configure essay exercise** — Create an exercise with a topic and substantive prompt; reopen saved exercise with correct title/language/mode. |
| EW-AC-02 | **Practice and Submission** — Preview Practice without server dependency; offer Submission only when authorized server intake is configured. |
| EW-AC-03 | **Word range validation** — Configure valid min/max; refuse publication where min exceeds max; live counts respond to edits. |
| EW-AC-04 | **Sentence constraints** — Apply min/max sentence thresholds according to selected language profile; reject reversed range. |
| EW-AC-05 | **Paragraph constraints** — Count nonempty paragraphs and apply enabled minimum/maximum without counting visual wrapping. |
| EW-AC-06 | **Required vocabulary** — Create required exact word and expression requirements, each with editable min occurrences. |
| EW-AC-07 | **Prohibited vocabulary** — Add forbidden words and validate conflict with required occurrences; block contradictory publication. |
| EW-AC-08 | **Inflection alternatives** — Teacher-specified alternatives match and count without treating arbitrary morphological guesses as valid. |
| EW-AC-09 | **Strict/Flexible and importance** — Set required vs advisory constraints and Strict/Flexible; confirm Flexible is default. |
| EW-AC-10 | **Teacher rubric** — Create weighted/max-point criteria, enforce score limits, save draft reviewer marks and comment. |
| EW-AC-11 | **Optional timer and structure** — Disable/enable timer; objective section fields check mechanically, subjective structure instructions not auto-graded. |
| EW-AC-12 | **Snapshot and publishing validation** — Draft saves while incomplete; publishing rejects impossible rules; version required data and rubric. |
| EW-AC-13 | **Word segmentation** — Count contractions/hyphenated tokens under documented language profile; visual wrapping does not alter count. |
| EW-AC-14 | **Abbreviation sentence parsing** — Common `Dr.`/`e.g.` abbreviations are not spuriously separate sentences under supported English profile. |
| EW-AC-15 | **Sentence punctuation and boundaries** — Count sentences in mixed punctuation, newline and trailing incomplete texts according to explicit profile. |
| EW-AC-16 | **Paragraph segmentation** — Empty lines between text blocks determine paragraphs; spaces-only blocks do not count. |
| EW-AC-17 | **Unicode normalization** — Handle composed/decomposed Unicode equivalence for matching while preserving learner raw text. |
| EW-AC-18 | **Exact word and expression boundary** — `art` does not match `smart`; phrase requires token sequence and permissible whitespace, not substring. |
| EW-AC-19 | **Required term occurrence counts** — Each qualifying occurrence counted at most once per requirement; teacher-listed forms count appropriately. |
| EW-AC-20 | **Client/server analysis parity** — Identical text, profile and rules produce same counters on client/server; version preserved on submission. |
| EW-AC-21 | **Accessible essay input** — Edit multi-paragraph text on desktop/mobile using keyboard and assistive tech with instructions visible. |
| EW-AC-22 | **Live requirement status** — Show counts and each fulfilled/failed rule without equating condition ratio with quality grade. |
| EW-AC-23 | **Local draft recovery** — Reload recovers draft when browser storage available; denied storage shows warning and copy workaround. |
| EW-AC-24 | **Server draft persistence** — Authorized Submission draft reports saved only after server confirmation and persists across login/reload. |
| EW-AC-25 | **Conflict protection** — Concurrent tabs/devices do not silently overwrite a newer draft; recovery is possible. |
| EW-AC-26 | **Offline and network error** — Offline editing when locally possible; send not marked successful until server acknowledgement. |
| EW-AC-27 | **Strict submission gate** — Block submit on failed required objectively measurable rule; advisory rule never blocks. |
| EW-AC-28 | **Flexible submission** — Warn and allow explicit confirmation despite unmet required rule; store failed conditions snapshot. |
| EW-AC-29 | **Idempotent submission** — Multiple clicks/retries create exactly one attempt; ambiguous timeout resolved through server receipt query. |
| EW-AC-30 | **Immutable submitted attempt** — After confirmed send, archived text, requirement/rubric versions and compliance are unchanged; resubmission new ID. |
| EW-AC-31 | **Timer and server deadline** — Submission uses server clock; expiry stops editing; offline timeout does not fabricate acceptance. |
| EW-AC-32 | **Access isolation and confidentiality** — Teacher can access only own assignment submissions, admins as authorized; no raw text in URL/logs/public iframe. |
| EW-AC-33 | **Manual rubric scoring** — Teacher draft scoring validates maxima; unpublished score is invisible to student. |
| EW-AC-34 | **Publication and feedback visibility** — Published teacher grade/comment are visible to authorized learner only; ungraded differs from zero. |
| EW-AC-35 | **History and data lifecycle** — Prior assessments survive later prompt/rubric/checker updates; retention, export and delete obey permissions. |
| EW-AC-36 | **Responsive iframe and accessibility** — Narrow LearnWorlds iframe/mobile editor works without clipping; focus/status accessible, error and result views usable. |


## Module 17 — Flashcards: FC-AC-01–FC-AC-32 (FC-04 F approved)

| ID | Acceptance condition |
|---|---|
| FC-AC-01 | **Create deck** — New deck stores title, instructions, stable deck ID and module type; incomplete draft is saveable. |
| FC-AC-02 | **Front/Back editor** — Edit text independently on both faces; saving/reopening preserves exact Unicode and content order. |
| FC-AC-03 | **Media on both faces** — Attach image/audio on either or both faces from Media Library; preview/player load correct media without duplicate upload. |
| FC-AC-04 | **Hints and captions** — Hint, image alternative/caption and required audio transcript persist and appear at intended times. |
| FC-AC-05 | **Duplicate unique ID** — Duplicate card preserves content but creates fresh stable card ID; ratings of original cannot leak. |
| FC-AC-06 | **Delete and shared media** — Delete with confirmation removes card only, keeps shared media asset and other cards intact. |
| FC-AC-07 | **Reorder cards** — Mouse/desktop drag-and-drop reorder survives save/reload and teacher-order playback. |
| FC-AC-08 | **Quick Table paste** — Paste spreadsheet Front/Back/Hint ranges; validation, order and Unicode remain correct. |
| FC-AC-09 | **TSV bulk import** — Valid TSV two/three-column rows preview and commit with new stable IDs. |
| FC-AC-10 | **Quoted CSV** — Quoted comma, escaped quotation mark and embedded newline are parsed inside one CSV field. |
| FC-AC-11 | **Import validation preview** — Show row numbers/errors, empty-row count, column mapping, duplicates warning and no premature mutation. |
| FC-AC-12 | **Atomic import** — Invalid/failed or repeated batch cannot leave partial or duplicate imported cards; success inserts all rows once. |
| FC-AC-13 | **Duplicate warnings** — Identical or visually identical cards warn, are not forcibly deduplicated and retain distinct IDs. |
| FC-AC-14 | **Publish validation** — Empty face or absent mandatory media/mode blocks publish; one-card and same-looking faces warn only. |
| FC-AC-15 | **Draft persistence** — Incomplete deck saves and restores without bypassing publish-only validation. |
| FC-AC-16 | **Versioned publication** — New draft/republication does not mutate published version, referenced media or active session. |
| FC-AC-17 | **Study navigation and flip** — Flip/tap/back/next keyboard controls work; visited progress unique; Study never modifies ratings. |
| FC-AC-18 | **Recall reveal before rating** — Known/Repeat disabled until answer side revealed, then rating advances and stores current direction. |
| FC-AC-19 | **Rating replacement** — Revisiting/re-rating same card+direction updates unique current status without counter inflation. |
| FC-AC-20 | **Direction isolation** — Front→Back and Back→Front ratings/counters independent; switch back restores original status. |
| FC-AC-21 | **Review input selection** — Only Repeat IDs of selected direction enter cycle; No Ratings and No Repeat produce proper empty states. |
| FC-AC-22 | **Review one-show cycle** — Queue fixed at cycle start, each card once despite Known mutations; next cycle contains only current Repeat. |
| FC-AC-23 | **Review empty/one/all** — No marked cards, one Repeat and all Repeat scenarios do not skip or lock up. |
| FC-AC-24 | **Mode switch preservation** — Study↔Recall↔Review switch does not destroy independent ratings or unexpectedly reset saved Recall position. |
| FC-AC-25 | **Order/shuffle stability** — Teacher order preserved or shuffle once on new pass; flip and previous do not reshuffle. |
| FC-AC-26 | **Mode-specific completion** — Study all visited, Recall all rated, Review queue exhausted; results do not fabricate scored grade. |
| FC-AC-27 | **Full session restart** — Explicit reset clears both direction ratings, visited, queues, position; optional reshuffle on restart. |
| FC-AC-28 | **Media failure** — Missing media/audio playback failure shows accessible retry; no incorrect flip or rating, playback stops on navigation. |
| FC-AC-29 | **Long text/media-only** — Long answers remain legible and scrollable; media-only cards work with necessary accessible alternatives. |
| FC-AC-30 | **Keyboard and accessibility** — Keyboard flipping, navigation and review controls, visible focus, non-color statuses and reduced-motion alternatives. |
| FC-AC-31 | **Mobile and swipe** — Touch targets adequate; swipe navigates only when applicable, does not double-trigger flip; no horizontal overflow. |
| FC-AC-32 | **LearnWorlds iframe** — Player works at constrained iframe widths/heights, media and buttons remain accessible, no accidental session loss on resize. |


## v28 — Hotspot: HS-AC-01–HS-AC-36 (HS-04 F approved)

| ID | Проверяемый сценарий: Given / When / Then |
|---|---|
| HS-AC-01 | **Create exercise** — Can create Hotspot with one source image and author tasks, saved and reopened with stable IDs. |
| HS-AC-02 | **Rectangle geometry** — Draw, move and resize a positive-area rectangle; normalized source coordinates persist after reload. |
| HS-AC-03 | **Ellipse geometry** — Draw and resize ellipse and verify exact hit geometry follows ellipse, not its bounding box. |
| HS-AC-04 | **Polygon geometry** — Draw and close >=3 valid vertices; edit, add or remove vertices; persists as valid polygon. |
| HS-AC-05 | **Undo/Redo** — Editing transformations, vertex changes and delete operations undo/redo predictably. |
| HS-AC-06 | **Zoom/Pan editor** — Author zooms/pans without moving underlying source-coordinate geometry. |
| HS-AC-07 | **Invalid zones** — Zero-area, self-intersecting, out-of-frame and open polygon zones block publish, not draft save. |
| HS-AC-08 | **Image change** — Image replacement/aspect change requires revalidation of geometry; previous zones not silently accepted. |
| HS-AC-09 | **Zone reuse** — Tasks reuse zone IDs on same image; a draft zone edit updates task references without ID corruption. |
| HS-AC-10 | **Point task config** — Author assigns a target to Point and task instruction; validates target exists. |
| HS-AC-11 | **Zone task overlap** — Ambiguously overlapping selectable zones block Zone task publication; Point overlap remains allowed. |
| HS-AC-12 | **Outline task config** — Author sets polygon/ellipse/rect target and per-task IoU threshold within 30–90%, default 65%. |
| HS-AC-13 | **Task patterns** — Find One/Multiple/in Order each validate target multiplicity and canonical ordered steps. |
| HS-AC-14 | **Design/preview** — Marker/Highlight, optional precheck boundaries, opacity and Classic/Comic Compact/Standard preview/publish consistently. |
| HS-AC-15 | **Point hit/boundary** — Inside/on boundary within explicit tolerance is accepted, outside is not, independent of render scale. |
| HS-AC-16 | **Point multiple dedupe** — Several markers on same target cannot produce repeated credited targets; one-to-one matching. |
| HS-AC-17 | **Point edit** — Markers movable/removable before check; locked correct target cannot be changed. |
| HS-AC-18 | **Zone select/deselect** — Selecting named geometry by visible region identity toggles pending selection, not arbitrary DOM overlap. |
| HS-AC-19 | **Outline vertex drawing** — Draw/edit/close polygon vertices, undo and clear; resulting closed region evaluated. |
| HS-AC-20 | **Outline freehand** — Draw with mouse/touch/stylus; smoothing closes sensible polygon without falsely improving accuracy. |
| HS-AC-21 | **Invalid Outline no check cost** — Open, zero-area or self-intersecting learner outlines require repair, consume no Check. |
| HS-AC-22 | **IoU accuracy** — Known reference/learner shapes produce deterministic area intersection/union and threshold comparison in source coordinates. |
| HS-AC-23 | **Outline multi-target matching** — Multiple learner contours matched one-to-one to unique targets; two contours cannot score one target twice. |
| HS-AC-24 | **Shared check budgets** — Find One/Multiple default 3 checks for 1–5 original targets and 5 for >=6; approved teacher overrides apply. |
| HS-AC-25 | **Intermediate feedback** — Correct unique targets turn green/lock; wrong marks red/editable; Check request idempotent. |
| HS-AC-26 | **Multiple false-positive deduction** — Final with 4/4 correct + 1 unrepaired false mark -> 3/4; two false -> 2/4, floor 0; no premature deductions or duplicate penalty. |
| HS-AC-27 | **Order independent steps** — Five Find in Order targets each receive separate default 3 checks, global 3/5 pool not shared. |
| HS-AC-28 | **Order exhaustion** — At third failed check for a step, reveal correct target, award 0 and advance; later steps still playable. |
| HS-AC-29 | **Final results** — Displays student marks, correct reference zones, correct/incorrect statuses, score and IoU/threshold for Outline. |
| HS-AC-30 | **Full reset** — Reset clears marks, geometry, attempts, locks and grades, restores first step and resets session state. |
| HS-AC-31 | **Zoom/pinch reliability** — At zoom pan/orientation changes/contain letterboxing answers stay aligned; pinch does not create stray marks. |
| HS-AC-32 | **Keyboard accessibility** — Keyboard navigation can select/move point or zone and build/edit vertex Outline without leaking hidden target labels. |
| HS-AC-33 | **Accessible alternative** — Teacher can provide equivalent text alternative; reduced motion, focus and non-color cues available. |
| HS-AC-34 | **Media failure** — Missing/revoked image blocks incorrect score/submission and gives accessible failure state. |
| HS-AC-35 | **Publish snapshot** — Published image/zone/task version remains stable for active players when author edits new draft. |
| HS-AC-36 | **Mobile and iframe** — Small touch screens, desktop and constrained LearnWorlds iframe support selection, drawing, scrolling/zoom, completion without overflow. |


## v29 — Module 19 Word Search (approved WS-01–WS-04 A–F)

**Identifier scope warning:** Earlier Module 13 Word Scramble / Builders uses `WS-AC-01`–`WS-AC-28`. Those historical IDs and tests are preserved intact. The following *new* user-approved names `WS-AC-01`–`WS-AC-36` belong to **Word Search** and must always be referenced with module namespace `word-search:WS-AC-NN` (canonical unique alias `WSEARCH-AC-NN`) in tickets/tests/imports. Do not use bare `WS-AC-NN` across modules.

| Scoped ID (Word Search) | Verifiable expectation |
|---|---|
| word-search:WS-AC-01 | Create Word Search and retain stable module identity; exercise success and error boundary verified. |
| word-search:WS-AC-02 | Bulk add/paste target words and preserve original Unicode text; exercise success and error boundary verified. |
| word-search:WS-AC-03 | Edit/reorder/remove targets without changing unrelated stable IDs; exercise success and error boundary verified. |
| word-search:WS-AC-04 | Normalize phrases into grapheme-grid tokens under language policy; exercise success and error boundary verified. |
| word-search:WS-AC-05 | Block duplicate/colliding grid forms after normalization; exercise success and error boundary verified. |
| word-search:WS-AC-06 | Auto and Custom dimensions 5×5–20×20 enforce bounds; exercise success and error boundary verified. |
| word-search:WS-AC-07 | Easy/Medium/Hard preset directions and manual overrides work; exercise success and error boundary verified. |
| word-search:WS-AC-08 | All targets placed in-bounds or generation explicitly fails; exercise success and error boundary verified. |
| word-search:WS-AC-09 | Word intersections allowed only on identical graphemes; exercise success and error boundary verified. |
| word-search:WS-AC-10 | No accidental extra occurrences in any enabled placement direction; exercise success and error boundary verified. |
| word-search:WS-AC-11 | Georgian and other Unicode scripts yield correct grapheme cells; exercise success and error boundary verified. |
| word-search:WS-AC-12 | Regenerate produces validated pinned version; stale layout cannot publish; exercise success and error boundary verified. |
| word-search:WS-AC-13 | Text/image/audio Clues and media validation work; exercise success and error boundary verified. |
| word-search:WS-AC-14 | Word List, Clues, Hidden display only their authorized data; exercise success and error boundary verified. |
| word-search:WS-AC-15 | Publish validation rejects missing/invalid targets, clues or media; exercise success and error boundary verified. |
| word-search:WS-AC-16 | Incomplete drafts save without accidental publication; exercise success and error boundary verified. |
| word-search:WS-AC-17 | Drag selects correctly with mouse, touch and stylus; exercise success and error boundary verified. |
| word-search:WS-AC-18 | Tap–Tap selects endpoints and converts to contiguous line; exercise success and error boundary verified. |
| word-search:WS-AC-19 | Keyboard arrow/Enter/Space/Escape can find and cancel selections; exercise success and error boundary verified. |
| word-search:WS-AC-20 | Only exact saved placement cell sequences score, never text alone; exercise success and error boundary verified. |
| word-search:WS-AC-21 | Reversed traversal of the same allowed physical placement scores; exercise success and error boundary verified. |
| word-search:WS-AC-22 | Invalid, incomplete and interrupted gestures yield zero points; exercise success and error boundary verified. |
| word-search:WS-AC-23 | Found target immediately locks and visibly persists; exercise success and error boundary verified. |
| word-search:WS-AC-24 | Repeated found target and duplicate events cannot increment points; exercise success and error boundary verified. |
| word-search:WS-AC-25 | Intersecting words score independently once per target ID; exercise success and error boundary verified. |
| word-search:WS-AC-26 | Hint tiers direction/start/first-cells expose only authorized cues; exercise success and error boundary verified. |
| word-search:WS-AC-27 | Quota enforced; no score penalty and no charge for duplicate unchanged hint; exercise success and error boundary verified. |
| word-search:WS-AC-28 | Hidden List hints avoid exposing unnamed target words; exercise success and error boundary verified. |
| word-search:WS-AC-29 | Optional timer starts on Start, expiry stops scores and finalizes once; exercise success and error boundary verified. |
| word-search:WS-AC-30 | Manual Finish confirms and freezes scored vs revealed words; exercise success and error boundary verified. |
| word-search:WS-AC-31 | Finding every word auto-completes exactly once; exercise success and error boundary verified. |
| word-search:WS-AC-32 | End score reflects unique found only; revealed targets add no points; exercise success and error boundary verified. |
| word-search:WS-AC-33 | Full restart resets progress/hints/timer using same published grid; exercise success and error boundary verified. |
| word-search:WS-AC-34 | 20×20 on mobile supports readable magnification and no layout corruption; exercise success and error boundary verified. |
| word-search:WS-AC-35 | Keyboard, assistive labels, low-motion and media failure fallbacks; exercise success and error boundary verified. |
| word-search:WS-AC-36 | Constrained LearnWorlds iframe, resize/orientation, published version stability; exercise success and error boundary verified. |


## v30 — Module 20 Label the Diagram — LD-AC-01–36 (LD-01–LD-04 A–F approved)

| ID | Test setup / action | Expected verifiable result |
|---|---|---|
| LD-AC-01 — Create LD exercise | Create new Label the Diagram draft. | Draft opens with no objects; save succeeds but Publish is blocked until valid. |
| LD-AC-02 — Media Library image | Choose a valid existing image asset and reopen draft. | Source asset ID, intrinsic size and view preview persist; geometry coordinate frame initialized. |
| LD-AC-03 — Anchor + label | Click Anchor then Label to mark a leaf. | A unique object ID binds an in-image normalized anchor and editable label box. |
| LD-AC-04 — Callout kinds | Switch a selected connector Straight → Elbow and drag bend. | Both endpoints remain attached; editable elbow geometry persists after reload. |
| LD-AC-05 — Endpoint dragging | Move anchor then move label box. | Connector redraws to each moved endpoint and never detaches. |
| LD-AC-06 — Object operations | Duplicate, rename, reorder and delete an object. | New stable ID for duplicate; unchanged IDs preserved; deleted links removed or flagged. |
| LD-AC-07 — Undo/Redo | Drag a label, delete it, Undo twice then Redo twice. | Both operations are reversibly restored in correct order and draft saves resulting state. |
| LD-AC-08 — Normalized geometry | Resize Preview, pan, zoom and change image contain letterboxing. | Every anchor remains over the same image location; label/callout remain aligned. |
| LD-AC-09 — Auto Arrange | Arrange around image and columns, then Undo. | Only label boxes/connectors move; anchors unchanged; Undo restores prior layout. |
| LD-AC-10 — Occlusion validation | Force two slots to completely overlap, then leave a simple line crossing. | Fully obscured interactive slot blocks publishing; mere line crossing warns only. |
| LD-AC-11 — Layout presentations | Preview On-image, Callouts, Numbered and mixed On-image/Callout. | Correct target bindings unchanged; valid layouts render, numbers remain tied to IDs. |
| LD-AC-12 — Stable IDs + order | Reorder authored objects then inspect numbered Player. | Visible numbers update; object IDs, labels and correct answers remain intact. |
| LD-AC-13 — Exact Set | Publish three different targets with three correct cards. | All cards usable exactly once and each target can be correctly labeled. |
| LD-AC-14 — Distractor + reusable | Create two correct targets, a distractor and one reusable label. | Distractor can be selected but cannot score; reusable card can fill all allowed targets. |
| LD-AC-15 — Duplicate names | Create two Leaf targets with visually identical Leaf cards, swap physical instances. | Both targets score equally regardless of source card ID; no arbitrary one-to-one penalty. |
| LD-AC-16 — Type aliases | Accept USA and United States for a target and reject a misspelling. | Configured aliases score; unintended spelling or diacritic variants do not. |
| LD-AC-17 — Drag gestures | Drag card by mouse and by touch into empty and occupied unlocked slot. | Assignment updates; replaced card returns to bank; locked card cannot move. |
| LD-AC-18 — Click orders | Assign label→field then field→label, cancel an in-progress selection. | Both flows yield same stored assignment; Escape cancels without mutating slot. |
| LD-AC-19 — Input control switch | Enter two Drag assignments then switch to Click and back. | Same assignments and locked statuses persist unchanged. |
| LD-AC-20 — Typed checking | Enter correct alias, wrong text and blank across three fields and Check. | Only correct field locks; wrong text editable; blank stays unanswered. |
| LD-AC-21 — Numbered mapping | Reorder objects and select a number in narrow Preview. | Corresponding response field opens, linked to original object ID. |
| LD-AC-22 — Check budget | Create drafts with 5 and 6 original scored targets, publish, make mistakes. | Exactly 3 and 5 Checks respectively, independent of number of distractors. |
| LD-AC-23 — Correct lock | Submit mixed correct/incorrect fields and Check. | Correct answer locks once; remaining fields editable; score reflects unique locked objects. |
| LD-AC-24 — Error correction | Replace an incorrect card after first Check. | Second Check accepts revised correct answer without altering already locked answers. |
| LD-AC-25 — Idempotent Check | Double-click Check or send concurrent identical Check event. | At most one check deducted and one point per object; final state consistent. |
| LD-AC-26 — Distractor scoring | Place distractor on a target and Check. | Target scores zero and can be repaired; never any negative score. |
| LD-AC-27 — Hints | Trigger Text, Audio and Focus hints, including blocked/missing audio. | Teacher-authorized hints appear; scores unaffected; media failure recoverable. |
| LD-AC-28 — Result reveal | Spend final Check with one wrong and one empty slot. | Correct solutions reveal but do not score; final numerator/denominator immutable. |
| LD-AC-29 — Restart | Finish then restart exercise. | All answers, checks, locks, hint counters cleared; original published assets reused. |
| LD-AC-30 — Replace image | Replace source with different aspect and try to publish without confirming anchors. | Draft editable but publishing blocked until all anchors and layout checked/confirmed. |
| LD-AC-31 — Publish validation | Remove image, move an anchor outside source or position a label outside canvas. | Each invalid case blocks Publish with actionable object-specific error. |
| LD-AC-32 — Incomplete draft | Save exercise with absent image and incomplete fields, reopen. | Draft persists; no invalid publication occurs. |
| LD-AC-33 — Mobile numbered fallback | Preview a dense callout layout on narrow mobile and rotate. | Accessible Numbered layout activates as needed without losing scores/assignment links. |
| LD-AC-34 — Keyboard accessibility | Use Tab, Enter, Space, Escape without mouse to complete assignment. | All actions accessible, visible focus, meaningful target names without answer leakage. |
| LD-AC-35 — Media failure / state | Lose hint audio, retry image load, resize frame mid-edit. | No false score, current valid answers/check state maintained; Check blocked if required image inaccessible. |
| LD-AC-36 — Version + iframe | Begin v1 in constrained LearnWorlds iframe, publish v2 and continue v1. | Active session uses v1 media/keys; iframe resize retains geometry; fresh load uses new publication. |


## v31 — Vocabulary / Module 21 — VC-AC-01–32
**Approval:** VC-01 A–E + revised F, VC-02/03/04 A–F. These are informational display checks; no scoring.

| ID | Test action | Expected result |
|---|---|---|
| VC-AC-01 — Create Vocabulary Set | Create a draft with title and source/translation language pair. | The draft keeps its unique ID and language settings; no grading configuration appears. |
| VC-AC-02 — Word Entry editing | Add a word, edit its spelling and reopen the editor. | Text persists without changing stable WordEntry ID. |
| VC-AC-03 — Multiple meanings | Add noun and verb meanings to one spelling and reorder them. | Both meaning blocks display in author order with stable IDs. |
| VC-AC-04 — Part of speech | Edit POS independently for two meanings of one word. | Each meaning retains its selected POS, without overwriting the other. |
| VC-AC-05 — Multiple examples | Add two examples to one meaning, then reorder and delete one. | Expected examples remain in defined author order; other meanings are unchanged. |
| VC-AC-06 — Translations | Edit a meaning translation and optional note; add another meaning. | All text survives save/reopen and correct links remain. |
| VC-AC-07 — Unicode and Georgian | Import and edit ქართული, composed/decomposed Unicode text and mixed-script phrase. | Original display preserved; normalized case/search key matches canonical equivalents without corrupting graphemes. |
| VC-AC-08 — Ordering | Switch from author order to alphabetic sort and back. | Sorting is consistent and stored author ordering remains unchanged. |
| VC-AC-09 — Quick and detailed editor | Enter a record in Quick Table; edit its nested meanings in Detailed Editor. | Both views show one shared WordEntry, not duplicate copies. |
| VC-AC-10 — CSV/TSV bulk import | Load TSV and CSV files with several words and non-Latin text. | Columns mapped to correct fields and all Unicode values retained. |
| VC-AC-11 — Preview import | Supply an import row with missing Word or Meaning translation. | Preview identifies row+column errors and shows no committed changes. |
| VC-AC-12 — Atomic import | Cancel preview or attempt import with one invalid row, then import valid data. | Cancel/invalid batch leaves old data byte-equivalent semantically; valid batch commits as one unit. |
| VC-AC-13 — Library image | Attach image to word and image to one meaning; switch contain/cover. | Correct referenced image displays with proper aspect handling, alt text and no cross-meaning leakage. |
| VC-AC-14 — Word audio | Choose an uploaded word sound file and press Play in Preview. | Correct audio is associated with word and is independently playable. |
| VC-AC-15 — Example audio | Attach a different sound to an example and play it. | Only example audio plays; word audio association unaffected. |
| VC-AC-16 — Microphone recording | Grant microphone permission, record, preview and save; repeat after denial. | Permission success yields playable clip; denial is recoverable and causes no broken mandatory record. |
| VC-AC-17 — Browser TTS | Enable TTS on a device with supported voice and test an unsupported locale. | Supported locale plays chosen voice after gesture; unsupported locale is visibly unavailable and never substitutes another language. |
| VC-AC-18 — Audio failure | Start audio then switch cards, rapid-press Play, and simulate broken URL. | At most one stream plays, old stream stops on navigation, failure is recoverable without blocking text. |
| VC-AC-19 — Dictionary mode | Open published set in Dictionary, expand an entry. | List displays word/POS/translation and details open without score or Check. |
| VC-AC-20 — Cards mode | Navigate forward/back through image and text cards. | Card shows all meanings and available media; current entry advances in chosen sort order. |
| VC-AC-21 — Reveal mode | Open a word with concealed translations, use Reveal via keyboard. | Translations/examples hidden until action, then visible and assistive-technology accessible; no mastery event. |
| VC-AC-22 — Listen mode | User starts listen queue, pauses/skips and reaches final record. | Queue plays only available audio in order, stops at end, does not loop indefinitely or store progress. |
| VC-AC-23 — Search | Search a word and a translation attached to its second meaning. | Both retrieve the correct entry; clearing search restores list. |
| VC-AC-24 — POS filter | Filter nouns while one entry has both noun and adjective meanings. | Entry included if any meaning qualifies; clearing filter restores all. |
| VC-AC-25 — Many meanings rendering | Open polysemous entry with multiple examples and image per meaning. | No duplicated parent words, each value belongs to right meaning. |
| VC-AC-26 — Missing optional media | Open records without image, IPA, example audio or any audio. | Text displays without blank filler or inert play button; other records unaffected. |
| VC-AC-27 — Mobile responsive | Open in narrow portrait and rotate tablet; zoom browser to 200%. | Single-column layout remains readable; controls usable and no forced horizontal scroll for standard content. |
| VC-AC-28 — Keyboard/assistive access | Navigate list, filters, Reveal, audio and cards by keyboard/screen reader. | Focus and controls have meaningful labels; hidden Reveal contents not read before reveal. |
| VC-AC-29 — Publication validation | Publish empty set or entry missing POS/translation; repeat with only example missing. | Critical omissions block publish with specific errors; missing example warns but permits publication. |
| VC-AC-30 — Version and permissions | Teacher A publishes v1, Teacher B tries edit; A publishes v2 while reader has v1 open. | B denied; admin access works; old reader retains v1, new reader sees v2. |
| VC-AC-31 — LearnWorlds iframe | Embed publication with narrow viewport, search and play clips. | Reader remains usable, text visible, scroll/audio handled, no author interface exposed. |
| VC-AC-32 — No assessment/progress | Use every mode, Reveal, play audio repeatedly, close and reopen. | No Check/score/timer/attempts/mandatory completion/SRS or persisted learning-progress fields/events occur. |


## v32 — Module 22 Mini Dialogues — MD-01..04 A–F explicitly approved
| ID / scenario | Test actions / fixture | Expected result |
|---|---|---|
| MD-AC-01 — Create exercise | Create Mini Dialogues with title/instructions. | Draft saves with moduleId mini-dialogues, no other module modified. |
| MD-AC-02 — Speaker setup | Create two named speakers, set initial/role and rename one. | All references display updated speaker data by stable speakerId. |
| MD-AC-03 — Avatar and initial fallback | Set avatar for speaker A, leave B without avatar. | A shows image; B presents readable name/initial without blank placeholder. |
| MD-AC-04 — Side and bubble styles | Set left/right align and styles, then switch theme. | Sides/colors change presentation only and speaker identity persists. |
| MD-AC-05 — Multiple dialogue blocks | Create two dialogues with optional scene/title. | Both render separately and preserve their author order. |
| MD-AC-06 — Lines reorder | Add, edit and reorder lines including consecutive same speaker. | Bubble order updates, associated IDs/gaps remain attached. |
| MD-AC-07 — Stable identities | Reorder speakers/dialogues/lines then save and reload. | speakerId/dialogueId/lineId and gapId are preserved and no links orphaned. |
| MD-AC-08 — Inline insertion | Select a text span and convert to a gap. | Original correct text stored as answer and text/gap segments round-trip. |
| MD-AC-09 — Multiple inline gaps | Insert two gaps in one line and one at utterance boundary. | Each independent gap is displayed with intact spaces and punctuation. |
| MD-AC-10 — Unicode and punctuation | Use Georgian script, apostrophes and punctuation around gaps. | No corruption after edit/publish/preview and conservative validation. |
| MD-AC-11 — Single global mode | Set Word Bank on two dialogues and preview; switch to Dropdown after confirmation. | One global answer mode applies to both; mode-specific data loss warned/controlled. |
| MD-AC-12 — Auto Word Bank | Generate bank for multiple authored correct gaps. | One matching consumable card per required occurrence; stable order and editable additions. |
| MD-AC-13 — Manual Word Bank | Add manually editable cards and distractors. | Bank contains intended choices; distractors are never scored as units. |
| MD-AC-14 — Duplicate card texts | Provide two identical needed texts with separate card IDs. | Two physical cards available, interchangeable semantically for correct gaps. |
| MD-AC-15 — Dropdown local choices | Define different choices for two gaps. | Each dropdown uses only its own unique options including an accepted answer. |
| MD-AC-16 — Typing alternatives | Type case/spacing variants and explicit synonym, then typo. | Canonical and explicit aliases accepted; typo rejected according to Text Answer Validator. |
| MD-AC-17 — Bubble rendering | Publish A/B conversation with different line lengths. | Lines render ordered left/right bubbles with speaker labels and embedded input. |
| MD-AC-18 — Three speakers | Use A/B/C, two on same side. | Speaker names/initials disambiguate regardless of side or color. |
| MD-AC-19 — Drag bank assignment | Drag card into gap then replace it before checking. | Card follows placement and displaced consumable card returns to bank. |
| MD-AC-20 — Tap bank assignment | Select word then tap gap via touch/keyboard. | Equivalent gap assignment to drag, without loss of other answers. |
| MD-AC-21 — Revise wrong answers | Check one right and one wrong response then change wrong. | Wrong answer is editable, locked correct gap remains unchanged. |
| MD-AC-22 — Lock correct | Supply correct responses across several Checks. | Each correct gap locks after first success with one point only. |
| MD-AC-23 — Check budget | Test 5 gaps and 6 gaps in multi-dialogue exercises. | Total allowed Checks are 3 and 5 respectively, global across all blocks. |
| MD-AC-24 — Point granularity | Answer 3 of 4 gaps correctly with one distractor used. | Score is 3/4, distractor contributes no independent or negative point. |
| MD-AC-25 — Idempotent Check | Double-click Check rapidly or submit same locked answer twice. | One atomic check and no double points/attempt consumption. |
| MD-AC-26 — One Check for blocks | Fill gaps in two dialogue blocks and press Check once. | All eligible gaps evaluated in one global action; no per-block gating. |
| MD-AC-27 — Line audio | Attach line clip and play, start another clip. | Selected clip plays, prior stream stops; no autoplay. |
| MD-AC-28 — Dialogue audio | Attach whole-dialogue clip and play independently. | Whole clip plays with controls without mutating gap state. |
| MD-AC-29 — Audio availability | Configure always, after_finish and selective line access; inspect unfinished player. | Gated controls/transcripts/media source withheld until authorized release; always clip works. |
| MD-AC-30 — Mobile bubble wrap | Open long speech with multiple gaps in narrow portrait. | Readable wrapping; dropdown options and input do not clip or scroll horizontally. |
| MD-AC-31 — Keyboard/touch accessibility | Perform all modes without drag, examine speaker and gap accessible labels. | Complete reachable interaction with visible focus, correct semantic speaker/gap announcements. |
| MD-AC-32 — Media error resilience | Make optional avatar/audio fail during active attempt. | Conversation text, gap answers, score/check state remain available. |
| MD-AC-33 — Publication validation | Attempt publishing missing speakers, no gaps, incomplete Dropdown and insufficient bank. | Specific blocking errors; optional avatar/audio/title absence permitted. |
| MD-AC-34 — Immutable active version | Open v1 player while author publishes v2. | Existing session remains on v1 including correct responses/media and newly opened session uses v2. |
| MD-AC-35 — Restart and reveal | Exhaust Checks with incomplete gaps, reveal, then Restart. | Reveal awards no points; reset clears all student state including bank and restores authored content. |
| MD-AC-36 — Iframe and Design System | Embed in narrow LearnWorlds iframe and switch Classic/Comic Compact/Standard. | No clipped dialogue/gap/word-bank controls; responsive player and themed tokens preserved. |
