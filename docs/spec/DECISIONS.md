## Решения v10 · 2026-10-14 (утверждены)

- Главная Author Studio — сетка типов упражнений; левая боковая навигация сворачивается, автоматически сворачивается в редакторе, восстанавливает предпочтение.
- Каталог: карточки/список/иконки; сетка 2–8 колонок или auto; категории, избранное, теги/скрытие, пользовательский порядок.
- Мои упражнения: кастомизируемые папки (иконка/цвет), drag-and-drop, мультивыбор, нижняя плавающая панель массовых операций.
- Media Library: фильтры размеров изображений, пропорций, форматов, размеров файлов, теги, папки; сложную статистику перенести в Настройки → Хранилище.
- Сейчас один администратор. Панель управления преподавателями отложить, сохранив готовность архитектуры к ролям.
- Поведение: полное заполнение перед проверкой; 1 балл за пропуск; помощь только после второй проверки, исключение 1 проверка — помощь недоступна; едино для модулей. См. `03_CORE/BEHAVIOR_CORE.md`.
- Публикация: короткий iframe с неизменным ID и вручную вставленным кодом; динамическое обновление **ещё требует тестирования в LearnWorlds**. Учёт результатов отсутствует, история версий не является UI MVP.
- Доставка: работающий вертикальный сценарий важнее полного Admin Center или всех 20+ модулей.

# Реестр решений

**Статус:** утверждённые решения и заменённые правила  
**Проект:** DimVibe · 2026-10-14  
**Правило:** при конфликте см. `GOVERNANCE.md` и реестр решений `DECISIONS.md`.

## Утверждено (APPROVED)

| ID | Решение | Владелец |
|---|---|---|
| D-001 | Новая кодовая база с нуля; старый прототип — референс, не исходники | PRODUCT |
| D-002 | Единая версионированная схема `content/design/behavior/publication/moduleData` | CONTRACTS |
| D-003 | Независимые модули через единый интерфейс и внутренний реестр | CONTRACTS |
| D-004 | Модуль владеет структурой/изменением ответов; Core не интерпретирует их | CONTRACTS |
| D-005 | Модуль выполняет `validate` и `evaluate`; Core управляет проверками, результатом, завершением | PLAYER_CORE |
| D-006 | `CheckItem` = `{id, score, maxScore}`; статус вычисляется из баллов | CONTRACTS |
| D-007 | `maxAttempts` = 1–5, default 5; настраивается в Editor → Поведение; unlimited нет | PLAYER_CORE |
| D-008 | Обновление страницы/упражнения сбрасывает прохождение; незавершённое не восстанавливается | PLAYER_CORE |
| D-009 | История только проверок текущего прохождения; нет истории множества прохождений | PLAYER_CORE |
| D-010 | Макс. 10 пропусков в Fill Blanks / Words to Gaps / Image to Gaps, контроль в Editor | EDITOR_CORE |
| D-011 | Постоянный адрес/iframe; публикация создаёт immutable-версию и обновляет `publishedVersionId` | PUBLICATION |
| D-012 | История опубликованных версий и откат сменой указателя | PUBLICATION |
| D-013 | Общий Editor Core и независимые Module Editors; общие изменения отражаются во всех потребителях | EDITOR_CORE |
| D-014 | Общий Player Core и независимые Module Players | PLAYER_CORE |
| D-015 | Преподавательский Draft не меняет опубликованный Player до публикации | PUBLICATION |
| D-016 | Открытое прохождение не переключается на новую версию до новой загрузки | PUBLICATION |

## Заменено (SUPERSEDED)

- Автовосстановление ответов/банка/проверок через `sessionStorage` после reload.
- Хранение и UI истории многих завершённых прохождений, счётчики непрочитанных.
- Привязка незавершённого прохождения к старой опубликованной версии после reload.
- Сложная синхронизация `instanceId` / блокировки iframe / lease для сохранения ученического прогресса.
- Неограниченные или более пяти проверок.

## Открыто (OPEN)

Выбор AI-среды и workflow, Git-провайдера, стека, БД, авторизации, публичного доступа, точных API и миграций, LMS gradebook, состава релиза для остальных модулей. См. `OPEN_QUESTIONS.md`.

## Важно

Остальные подробно описанные UX-решения исходной инструкции сохранены в тематических спецификациях как согласованный дизайн, но **не являются основанием усложнять MVP** без необходимости.

## Решения MVP — утверждены 2026-10-14

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-017 | APPROVED | Fill Blanks и Image to Gaps — **два самостоятельных модуля**, каждый со своим Module Editor и Module Player, используют один Shared Gap Engine | CONTRACTS / GAP_ENGINE |
| D-018 | APPROVED | Базовый MVP (вариант B): два модуля, Editor Core, Player Core, Shared Gap Engine, Media Library, Publication | MVP_SCOPE |
| D-019 | APPROVED | Все **29 пунктов** матрицы MVP включены; отложенных пунктов в этой матрице нет | MVP_SCOPE |

**D-017 заменяет** прежнее представление Image to Gaps как режима Fill Blanks. Список шести исторических режимов Fill Blanks в архиве больше не является списком режимов одного модуля; Image to Gaps — отдельный module ID. Image Hint + Text Input остаётся запланированной возможностью, не включённой в утверждённую матрицу MVP.

**Уточнение статусов:** Согласование 29 функций не утверждает автоматически весь дополнительный функционал, перечисленный в старых подробных заметках. Приоритет MVP определяет `07_DELIVERY/MVP_SCOPE.md`.

## Модель пользователей — утверждено 2026-10-14

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-020 | APPROVED | Модель B: несколько преподавателей, у каждого собственный аккаунт и личная библиотека упражнений | DATA_STORAGE / ACCESS_CONTROL |

**Не следует считать автоматически утверждёнными:** конкретный провайдер входа, методы регистрации, роли администратора, способ удаления публикаций и политика публичных ссылок.

## Роли и полномочия — утверждено 2026-10-14

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-021 | APPROVED | Две роли: Administrator — полный контроль над всеми ресурсами и настройками; Teacher — работа только со своими ресурсами, включая их удаление | ACCESS_CONTROL |
| D-022 | APPROVED | Единое приложение и общие Core/модули для обеих ролей; различия в доступе, а не в копиях функциональности | ACCESS_CONTROL |

**D-021 уточняет D-020:** личные библиотеки преподавателей сохраняются, но администратор имеет сквозной доступ. Устаревший пункт «нужен ли администратор» закрыт. Способ входа и политика удаления опубликованных материалов остаются OPEN.

## Fill Blanks FB-02 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-023 | APPROVED | Fill Blanks имеет Free Input / Word Bank / Dropdown; автонаполнение Word Bank — настройка, не четвёртый режим (закрывает OQ-014) | FILL_BLANKS |
| D-024 | APPROVED | Word Bank: авто/ручное наполнение, ловушки прямо в банке через `+ Добавить слово`, альтернативы добавляются в банк только явно | FILL_BLANKS |
| D-025 | APPROVED | Player Word Bank A/B/C: стабильные места использованных экземпляров, перемещение между пропусками, click/touch основной и drag/drop дополнительный | FILL_BLANKS |
| D-026 | APPROVED | Dropdown: общий пул из всех основных, альтернативных ответов и ловушек; каждый пропуск имеет свой список, правильность определяется индивидуально | FILL_BLANKS |
| D-027 | APPROVED | Dropdown: минимум 2 различных варианта (правильный и неправильный), обычно 3–5, предупреждение при >8, максимум не ограничен, некорректный Draft нельзя публиковать | FILL_BLANKS |
| D-028 | APPROVED | Переключение трёх режимов не теряет текст, gap IDs, ответы и настройки; Preview изолирован от Draft, в публикации один активный режим | FILL_BLANKS |

Детали и критерии: `04_MODULES/FILL_BLANKS.md`, `07_DELIVERY/ACCEPTANCE_CRITERIA.md`.


## Image to Gaps ITG-01–ITG-04 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-029 | APPROVED | ITG-01 A–D: назначение одним нажатием, единый банк и фильтры, общая Media Library с множественным выбором, автоматические ответы и ручные ловушки | IMAGE_TO_GAPS |
| D-030 | APPROVED | ITG-02 A–C: универсальный click/touch + drag/drop, стабильный банк, возврат/замена/перенос между незакреплёнными пропусками | IMAGE_TO_GAPS |
| D-031 | APPROVED | ITG-03 A–E: адаптивные размеры S/M/L, contain/cover, квадратные миниатюры, независимые экземпляры, адаптация к iframe-контейнеру | IMAGE_TO_GAPS |
| D-032 | APPROVED | ITG-04 A–B: скрытые ID экземпляров; оценивание по mediaId в контексте gapId; допустимые повторные экземпляры и предупреждение о совпадениях | IMAGE_TO_GAPS |
| D-033 | APPROVED | ITG-04 C–D: локальная/массовая замена назначений; опциональный показ правильных картинок после завершения без изменения результатов | IMAGE_TO_GAPS |
| D-034 | APPROVED | ITG-04 E: 12 дополнительных критериев приёмки Image to Gaps | IMAGE_TO_GAPS |

**Не утверждено:** ITG-02 D — фиксированная раскрываемая нижняя панель изображений на телефонах. Разработка в Codex пока остаётся на собственном последовательном плане; эти решения — спецификация будущего модуля, не задание на реализацию.


## True / False (Binary Choice) TF-01–TF-05.2 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-035 | APPROVED | 2 категории с пресетами/Custom, необязательная третья; единый формат с индивидуальным override для каждого утверждения, все названия и назначения хранятся по ID | TRUE_FALSE |
| D-036 | APPROVED | Одно утверждение с навигацией по умолчанию или все сразу; компактный Editor, медиа и пояснения с отложенным раскрытием при ошибке | TRUE_FALSE |
| D-037 | APPROVED | Require correction if False неактивен (`Coming soon`); без счётчиков символов | TRUE_FALSE |
| D-038 | APPROVED | TF-05.2 A–C: отключённая третья категория не стирает назначение и блокирует публикацию при конфликте; индивидуальные настройки восстанавливаются; смена формата сохраняет ID и вызывает смысловое предупреждение | TRUE_FALSE |
| D-039 | APPROVED | TF-05.2 D: 16 критериев TF-AC-01–16 | TRUE_FALSE |

## Multiple Choice MC-01–MC-06 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-040 | APPROVED | ABCD переименован в Multiple Choice; Single Choice и Multiple Select в едином модуле; точно 1 балл за полностью правильный набор | MULTIPLE_CHOICE |
| D-041 | APPROVED | MC-03 A–D: буквенные/числовые обозначения; перемешивание по умолчанию включено; число верных ответов опционально; безопасная смена режима; одно/все вопросы | MULTIPLE_CHOICE |
| D-042 | APPROVED | MC-04 A–E: компактные карточки, минимум два варианта, локальный Single/Multiple, медиа и стабильные ID с защитой публикации | MULTIPLE_CHOICE |
| D-043 | APPROVED | Собственная главная картинка для каждого вопроса (верх/низ/лево/право как медиа инструкции), изображения у вариантов, общий Media Viewer и адаптация iframe | MULTIPLE_CHOICE |
| D-044 | APPROVED | MC-06 A–C: ошибки Multiple Select показываются на уровне вопроса, после завершения можно показать верный набор; конфликты сохраняются с предупреждением | MULTIPLE_CHOICE |
| D-045 | APPROVED | MC-06 D: 18 критериев MC-AC-01–18. AI Scanner и Smart Import — будущие общие инструменты, не текущий MVP | MULTIPLE_CHOICE |

**Статус:** обе новые спецификации описывают будущие модули; не менять очередь разработки Codex.


## Odd One Out OO-01–OO-04 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-046 | APPROVED | OO-01: карточки/плашки, общий стиль и индивидуальный override с восстановлением настроек | ODD_ONE_OUT |
| D-047 | APPROVED | OO-02 A–F: раскрывающиеся группы; минимум три элемента; ровно один лишний; смешанное медиа; необязательное защищённое пояснение; безопасный черновик | ODD_ONE_OUT |
| D-048 | APPROVED | OO-03 A–F: показ по одной/все сразу, один изменяемый выбор, закрепление через Behavior Core, независимые медиа, адаптивность, перемешивание по ID | ODD_ONE_OUT |
| D-049 | APPROVED | OO-04 A–B: разрешены повторы с предупреждением; сохранность данных при редактировании, сортировке, удалении и дублировании | ODD_ONE_OUT |
| D-050 | APPROVED | OO-04 C–D: показ правильного элемента после завершения; 16 критериев OO-AC-01–16 | ODD_ONE_OUT |

**Статус:** модуль спроектирован, не реализован. Новых заданий Codex не выдавать до планового этапа.


## Select Title ST-01–ST-04 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-051 | APPROVED | ST-01: у каждого текста собственный независимый набор заголовков и один правильный ответ; использовать Single Choice без отдельной системы проверки | SELECT_TITLE |
| D-052 | APPROVED | ST-02 A–E: компактные блоки текстов, 4 варианта по умолчанию и минимум 2 при публикации, стабильные ID, медиа через общие компоненты, пояснения и безопасный черновик | SELECT_TITLE |
| D-053 | APPROVED | ST-03 A–C: два режима отображения, по одному по умолчанию; полный текст без вложенной прокрутки; крупные кнопки без обязательной буквенной маркировки | SELECT_TITLE |
| D-054 | APPROVED | ST-03 D–F: перемешивание по умолчанию включено, общие медиа и адаптивность, проверка и отложенные пояснения через Behavior Core | SELECT_TITLE |
| D-055 | APPROVED | ST-04 A–C: дубликаты заголовков внутри одного текста блокируют публикацию; сохраняется форматирование; правильный вариант раскрывается после завершения через Player Core | SELECT_TITLE |
| D-056 | APPROVED | ST-04 D: 16 специализированных критериев приёмки ST-AC-01–16 | SELECT_TITLE |

**Статус:** проектирование завершено, Codex не поручено реализовывать модуль. Детали: `04_MODULES/SELECT_TITLE.md`.

## Mistake Mode MM-01–MM-04 — утверждено 2026-10-15

| ID | Статус | Решение | Владелец |
|---|---|---|---|
| D-057 | APPROVED | MM-01 A–D: один модуль с общим подходом к тексту и разметке нескольких ошибок; позднее режимы переработаны | MISTAKE_MODE |
| D-058 | APPROVED | MM-02 A–E: единая механика поиска, исправление как опция каждой ошибки; основной ответ и альтернативы хранятся при отключении | MISTAKE_MODE |
| D-059 | APPROVED | MM-02 F–K: авторская разметка ошибок, стабильные ID, безопасное редактирование, независимые текстовые блоки, валидация и пояснения; позднее ограничено одним словом | MISTAKE_MODE |
| D-060 | APPROVED | MM-03 A–E: нет глобальных режимов; поиск обязателен, исправление по настройке каждой ошибки; выбор многословного фрагмента **отменён поздним решением** | MISTAKE_MODE |
| D-061 | APPROVED | MM-03 F–J (финальная редакция): одно слово по нажатию, повторное снятие, независимые отметки, одинаковые поля ввода без подсказок, корректировка неверных ответов | MISTAKE_MODE |
| D-062 | APPROVED | MM-04 A–C: одна ошибка максимум один балл; ложные выделения блокируют 100% без штрафных баллов; проверка после выбора хотя бы одного слова и без обязательного заполнения исправлений | MISTAKE_MODE |
| D-063 | APPROVED | MM-04 D–F: закрепление правильных ответов, безопасная обратная связь, итоговый разбор и MM-AC-01–18 | MISTAKE_MODE |

**Приоритет:** поздняя модель **только отдельных слов** отменяет первоначальные предложения о произвольных диапазонах, пунктуационных отметках и двух режимах. Детали в `04_MODULES/MISTAKE_MODE.md`. **Код и план Codex не изменены.**

## Ordering — final design clarifications (2026-10-16)

| ID | Status | Decision | Scope |
|---|---|---|---|
| D-064 | APPROVED | OR-01 A–E: universal Ordering, teacher correct sequence, DnD/buttons, multiple sequences and one point per correct position | ORDERING |
| D-065 | APPROVED WITH SUPERSESSION | OR-03 A–F initially accepted; any multi-check, lock or moving-across-lock requirements superseded by final one-check policy | ORDERING |
| D-066 | APPROVED | The teacher freely reorders elements inside Author Studio; the saved editor order **is the correct answer key**, automatically updated by every rearrangement | ORDERING |
| D-067 | APPROVED | Player always reshuffles at the start of each run; no shuffle switch or manual starting order; shuffled result must differ from answer key | ORDERING |
| D-068 | APPROVED | Identical items within one sequence are forbidden at publication (with warning); no interchangeability assessment | ORDERING |
| D-069 | APPROVED | One final Check for entire exercise/run; per-position score and correct/incorrect result shown; no locks or repeated checks; Start again begins a reshuffled new run | ORDERING |

**Status boundary:** OR-02 A–F and the previous OR-04 A–F bundles were not formally accepted as sets. Their older conflicting ideas (allowing identical items, optional shuffle, manual start, multiple checks, locking) are superseded. The v17 acceptance scenarios specify the final confirmed Ordering behavior. No Codex assignment.


## Color Coding — CC-01–CC-04 approved 2026-10-16

| ID | Status | Decision | Scope |
|---|---|---|---|
| D-070 | APPROVED | CC-01 A–E: separate Color Coding module, teacher annotates plain text without markup codes; student selects category then individual words; multiple passages; **no phrase ranges** | COLOR_CODING |
| D-071 | APPROVED | CC-02 A–C: globally shared categories, unique nonempty names and colors, direct word-occurrence annotation by teacher | COLOR_CODING |
| D-072 | APPROVED | CC-02 D–F: stable occurrence IDs and careful mark reconciliation on editing; category deletion with confirmation; multiple passages and draft/publish validation | COLOR_CODING |
| D-073 | APPROVED | CC-03 A–C: tap to color/recolor/uncolor, shared accessible palette, one/all passage view with retained answers | COLOR_CODING |
| D-074 | APPROVED | CC-03 D–F, CC-04 A–E: one point per correctly classified word; false marks prevent 100%; locked correct marks, no premature disclosure; safe feedback, valid publishing data, unused-category warning, accessibility and responsive iframe | COLOR_CODING |
| D-075 | APPROVED | CC-04 F: 18 module-specific acceptance cases CC-AC-01–18 | COLOR_CODING |

**Status:** functional design complete; this specification is documentation only and **not an implementation instruction to Codex**. Details: `04_MODULES/COLOR_CODING.md`.

## Matching — MT-01–MT-04; global Behavior Core update (2026-10-16)

| ID | Status | Decision | Scope |
|---|---|---|---|
| D-076 | APPROVED | MT-01 A–F: matching one-to-one, mixed media, two-column tap/drag, independent shuffle, 1 point per pair, multiple sets | MATCHING |
| D-077 | APPROVED | MT-02 A–F: paired-row Author Studio, shared media, copy/delete/reorder, no identical cards within same column/set at publish, draft validation and shared styling | MATCHING |
| D-078 | APPROVED | MT-03 A–F (latest superseding refinements): correctly connected pairs move down to green locked solved area; wrong red pairs stay in upper work area and automatically unlink for next try; tap + optional DnD, numbers/colors, aggregate checks | MATCHING |
| D-079 | APPROVED | MT-04 A–E: unique cumulative score, all outstanding pairs linked before Check, last pair not auto-scored, edge-case validation, final review/restart | MATCHING |
| D-080 | APPROVED | MT-04 F: MT-AC-01–20 accepted | MATCHING |
| D-081 | APPROVED GLOBAL | Default Behavior Core check budget: 1–5 **original exercise-wide scorable units → 3 checks**; 6+ → **5**; teacher override 1–5 where supported. Ordering retains exactly one check; other explicit exceptions retained. Supersedes blanket default 5. | BEHAVIOR_CORE |

**Status:** Matching functional design complete. Documentation only, no new Codex assignment or change to implementation queue.

## D-082 — Matching MT-05 visual mode and Check override (APPROVED 2026-10-16)
- Design provides two presentation modes: `Standard` (default) and `Lines + Pair Colors`.
- Standard: connection markers, no lines, solved pairs move to lower green section, incorrect pairs remain above, and shared 3/5 dynamic budget applies.
- Lines + Pair Colors: each created link is drawn with a temporary shared color on both cards and connector line; exactly **one** Check for the full run; correct links/cards turn green, incorrect links/cards red, with every card staying in its own column **in place**; final score and Start again, no editing after Check.
- This is a **mode-specific approved exception** in Behavior Core, not a platform-wide replacement of 3/5. Pair correctness, one-to-one linking, scoring and author data remain unchanged.
- MT-05 explicitly supersedes any older Matching design recommendation that prohibits connection lines or assumes that correct links always move to the lower solved section.

## Timeline — TL-01–TL-04 (all A–F approved, 2026-10-16)

| ID | Status | Decision | Scope |
|---|---|---|---|
| D-083 | APPROVED | TL-01 A–F: Timeline separate from Ordering; event + date, configurable reveal, up/down + drag, Correct Timeline and one final Check | TIMELINE |
| D-084 | APPROVED | TL-02 A–F: Author Studio canonical list; display date separate from position; edit/duplicate/reorder stable IDs; optional media; date visibility; publish validation/warnings | TIMELINE |
| D-085 | APPROVED | TL-03 A–F: touch/mouse accessible ordering, reshuffle, final single Check, 1 point per correct position, submitted timeline plus correct timeline, responsive media | TIMELINE |
| D-086 | APPROVED | TL-04 A–E: no partial scores, identical dates warning not a block, distinguishability validation, frozen results, duplicate-Check safety and full restart | TIMELINE |
| D-087 | APPROVED | TL-04 F: specialized acceptance scenarios TL-AC-01–22 approved | TIMELINE |

**Status:** Timeline functional design complete. No source code changes, implementation initiation or new Codex task. Timeline's single final Check is an explicit module exception to shared dynamic 3/5 defaults.


## Categories / Sorting — CS-01–CS-04 (all A–F APPROVED, 2026-10-16)

| ID | Status | Decision | Scope |
|---|---|---|---|
| D-088 | APPROVED | CS-01 A–F: standalone many-to-one sorting, media cards, tap/drag, one point per item, 3/5 dynamic checks, responsive Player | CATEGORIES_SORTING |
| D-089 | APPROVED | CS-02 A–F: Author categories/items with stable IDs, bulk text paste, duplicate validation, Columns/Stacked, minimum publish rules | CATEGORIES_SORTING |
| D-090 | APPROVED | CS-03 A–F: editable placements until Check, full assignment gate, correct lock, wrong bank retry, dynamic grading, responsive media | CATEGORIES_SORTING |
| D-091 | APPROVED | CS-04 A–E: once-per-ID score, ambiguity guard, final frozen result, author safety, Player double-check safety and restart | CATEGORIES_SORTING |
| D-092 | APPROVED | CS-04 F: complete acceptance suite CS-AC-01–26 | CATEGORIES_SORTING |

**Status:** Twelfth module functional design completed; documentation only. No code changes, Codex assignments, or modifications to prior approvals.


## 2026-10-16 — v23 / Word Scramble, Phrase Builder, Sentence Builder
**WS-01–WS-04: A–F APPROVED in each stage; the following decision IDs summarize approved groupings (not a separate voting event).**
- **D-093 — WS-01:** one builder module with word/phrase/sentence submodes, mixed tasks, shuffled bank, repeat occurrence IDs and tap/drag assembly.
- **D-094 — WS-02:** teacher correct-text input with grapheme/word segmentation and deliberate split/merge/edit; source/text reconstruction and media safeguards; Tiles/Chips responsive Design.
- **D-095 — WS-03:** sequential task Player, one global final Check, 1 point per wholly correct task, repeated occurrences interchangeable by token value, restart and result view.
- **D-096 — WS-04:** Unicode NFC with case and punctuation integrity; block impossible-to-distinguish shuffles; safe segmentation updates and publication; atomic Check, accessible responsive iframe.
- **D-097 — Delivery boundary:** WS-AC-01–28 approved as future acceptance scope; design/spec updates only, no Codex task or source-code change.


## 2026-10-16 — v24 / Splice
**SP-01 A–F, SP-03 A–F and SP-04 A–F approved.** SP-02 two-game-mode + difficulty extension explicitly agreed; remaining detailed SP-02 editor proposals are **not separately approved**.
- **D-098 — SP-01:** Splice standalone module, multigrapheme pieces and teacher split, Auto/Manual and 2–4 options, list of words, Tiles/Paper Pieces, 1 point/word and one global final Check.
- **D-099 — SP-02 approved extension:** Single Word vs Word Mosaic common mixed bank, all word areas simultaneous, active area; Easy labels/counts visible, Medium (default) labels hidden/counts visible, Hard labels/counts hidden. Medium and Hard grading independent of target area positions.
- **D-100 — SP-03:** approved universal tap/drag controls, allocation and reorder, completeness gate with Hard >=2 pieces/area, multiset scoring and responsive results.
- **D-101 — SP-04 A–E:** binary whole-word scoring, duplicate pieces/canonical words and multiplicity, teacher target key only, valid/nonambiguous technical reconstruction and robust Player end-state.
- **D-102 — SP-04 F / delivery:** 30 acceptance cases SP-AC-01–30 approved; specification only, no Codex request, no source changes.

**Status:** 14th module functional design complete. Read `04_MODULES/SPLICE.md` for scope and approval boundary.


## 2026-10-16 — v25 / Prepositions (Module 15)
**PR-01–PR-04 A–F all approved.**
- **D-103 / PR-01:** Standalone specialization of Fill Blanks; ready local preposition category library, teacher category/subset choice, authored sentence gaps, Dropdown/Word Bank, no paid AI requirement.
- **D-104 / PR-02:** Versioned admin-managed system library plus teacher exercise snapshot; overlapping categories deduplicated; independent structured gap nodes, accepted alternatives, per-gap offered options, design defaults and strict publish validations.
- **D-105 / PR-03:** Dropdown gap-specific choices and unlimited-reuse Word Bank; locked green correct gaps and editable red errors; each gap scores 1 point; original unit count determines 3/5 checks; responsive and accessible result UI.
- **D-106 / PR-04 A–E:** Teacher-approved answers are authoritative (no grammar inference), multiword options, stable IDs, admin library revision history, publishing checks and easy-option warnings, idempotent checks, safe restart and iframe behavior.
- **D-107 / PR-04 F:** 28 acceptance scenarios PR-AC-01–28 approved. Specification only, no code or Codex task.
**Status:** Module 15 functional design complete. See `04_MODULES/PREPOSITIONS.md`.


## 2026-10-16 — v26 / Essay Writing (Module 16)
**Approval precision:** EW-02, EW-03, EW-04 A–F explicitly approved. EW-01 A–F presented as proposals but never separately voted on; overlap with later approved stages applies only through those approvals.
- **D-108 / EW-02:** Practice and secure Submission; live objectively checkable constraints; versioned server-confirmed intake; separate compliance vs teacher quality rubric; Strict/Flexible (Flexible default); teacher feedback publication.
- **D-109 / EW-03:** Accessible responsive free-text Student Player, local recovery plus authorized server draft sync, idempotent confirmed send and protected result channel, timer/offline handling, LearnWorlds iframe constraints.
- **D-110 / EW-04 A–E:** Versioned Text Analysis Core, word/sentence/paragraph and lexical-boundary rules with permitted forms and occurrence counts; required/advisory distinction; durable immutable attempts and server deadline; teacher-only rubric and confidentiality.
- **D-111 / EW-04 F:** 36 explicit acceptance scenarios EW-AC-01–36. This is **documentation only**, no Codex task or program edits.
**Status:** Module 16 functional design complete with EW-01 stage approval nuance. See `04_MODULES/ESSAY_WRITING.md`.


## 2026-10-16 — v27 / Flashcards (Module 17)
**Approval precision:** FC-01, FC-02, FC-03 and FC-04 **A–F explicitly approved**. No other design decisions assumed.
- **D-112 / FC-01:** Standalone multimedia two-sided Flashcards, Study/Recall/Review, configurable direction/order, learner-only self-assessment and shared DIMVIBE infrastructure, no SRS or automatic score.
- **D-113 / FC-02:** Visual Editor, Quick Table, validated bulk TSV/CSV/paste; Front/Back text/image/audio/hints, stable card IDs, independent Classic/Comic and Compact/Standard, mode/direction controls and publication checks.
- **D-114 / FC-03:** Study browse/flip without rating, Recall revealed-then-rated, Review only Repeat once per cycle, independent per-direction progress, fixed pass order, accessible mobile and iframe Player.
- **D-115 / FC-04 A–E:** Direction-isolated last ratings, immutable Review cycle snapshots, atomic importer including CSV quoting, media failure and accessibility, versioned publication and large-deck performance.
- **D-116 / FC-04 F:** 32 acceptance scenarios FC-AC-01–32. Documentation only; no implementation task or code modifications.
**Status:** Module 17 functional design complete. See `04_MODULES/FLASHCARDS.md`.


## 2026-10-16 — v28 / Hotspot (Module 18)
**Approval precision:** Updated HS-01 A–F, HS-02 A–F, HS-03 A–F, HS-04 A–F **explicitly approved** by user. HS-03 and HS-04 were approved in one user message; an earlier brief “давай” alone was not treated as formal approval.
- **D-117 / HS-01:** Standalone Hotspot with Find One/Multiple/in Order; Point/Zone/Outline answers, source-normalized Rectangle/Ellipse/Polygon authored geometry, IoU 65% default; shared DIMVIBE tooling.
- **D-118 / HS-02:** Reusable image zone library and separately authored tasks, desktop geometry editor with Undo/Redo/Zoom/Pan, polygon validation and overlap ambiguity policy; Marker/Highlight design and versioned publication checks.
- **D-119 / HS-03:** Real input for Point/Zone, freehand and vertex Outline, unique target assignment, mobile Zoom/Pan and accessible alternatives, score one per target, Find in Order independent default three checks per step, final overlays and IoU.
- **D-120 / HS-04 A–E:** Deterministic source-space geometry, small/overlap handling, independently approved Find Multiple final remaining-false-positive 1-point deductions with zero floor, exhausted sequential steps advance, performance/accessibility and stable published snapshot.
- **D-121 / HS-04 F:** 36 acceptance scenarios HS-AC-01–36. **Documentation only**, no Codex handoff or application code modifications.
**Status:** Module 18 functional design complete. See `04_MODULES/HOTSPOT.md`.


## 2026-10-17 — v29 / Word Search (Module 19)
**Approval precision:** WS-01, WS-02, WS-03 and WS-04 **A–F explicitly approved** by user; do not infer approval of other unspecified proposals.
- **D-122 / WS-01:** Independent Word Search, Word List/Clues/Hidden, automatic grid, Easy/Medium/Hard (Medium default), multilingual graphemes, instant no-3/5 scoring, free hints.
- **D-123 / WS-02:** Desktop Author Studio, bulk word entry, Auto/Custom 5–20 square grid, enabled directions, deterministic validation of all placement and incidental occurrences, text/image/audio clues, design and draft/published snapshots.
- **D-124 / WS-03:** Drag/Tap–Tap/keyboard, exact placement match, immediately locked unique finds, free three-tier hint system, completion and mobile/iframe accessibility.
- **D-125 / WS-04 A–E:** Reverse tracing, Unicode NFC graphemes and collisions, no ambiguous extra target runs, optional timer, controlled hint quotas, immutable score and same-grid restart.
- **D-126 / WS-04 F:** 36 acceptance scenarios `word-search:WS-AC-01..36`; namespace qualified because Module 13 already has WS-AC-01..28. No historical IDs renamed.
**Status:** Module 19 functional design complete. No Codex handoff, source code or deployment modifications.


## 2026-10-17 — v30 / Label the Diagram (Module 20)
**Approval precision:** LD-01, LD-02, LD-03 and LD-04 **A–F explicitly approved** by user; no additional proposals implied.
- **D-127 / LD-01:** Independent diagram labeling module with Drag, Click, Type, Numbered responses; On-image/Callouts/Numbered presentation; shared 3/5 checking and reusable Hotspot/media/design architecture.
- **D-128 / LD-02:** Desktop author editor with independent normalized anchor and composition-space label positions, callout geometry, Auto Arrange (without moving anchors), Exact/Distractor/Reusable label banks, explicit Type alternatives, validation and drafts.
- **D-129 / LD-03:** Student Drag/Click interchange without answer loss, Type and Numbered modes, 1 point per correct unique target object, lock correct and revise wrong, Text/Audio/Focus hints without penalty, mobile and keyboard/iframe support.
- **D-130 / LD-04 A–E:** Separate geometry reference frames, meaningful overlap validation, identical-text card interchangeability, case/whitespace-only default Type normalization, source replacement review and immutable publication versions, mobile Numbered fallback and media/accessibility failure behavior.
- **D-131 / LD-04 F:** 36 explicit acceptance scenarios LD-AC-01–36. Documentation-only. No Codex handoff, code or deployment modifications.
**Status:** Module 20 functional design complete. See `04_MODULES/LABEL_THE_DIAGRAM.md`.


## 2026-10-17 — v31 / Vocabulary (Module 21)
**Approval precision:** VC-01 A–E plus updated VC-01 F, VC-02 A–F, VC-03 A–F, VC-04 A–F **explicitly approved**. No extra proposed features deemed approved.
- **D-132 / VC-01:** Standalone multilingual informational Vocabulary with words/phrases, translations, POS, meaning-specific examples, optional IPA/image/word and example audio; Dictionary/Cards/Reveal/Listen; future cross-module vocabulary reuse architecture only (no global Library now).
- **D-133 / VC-01 F revised:** **No Check, score, grade, mistakes, attempts, timer, mandatory completion, progress tracking, SRS or results.** Non-evaluative reveal/listen and transient UI state permitted.
- **D-134 / VC-02:** Desktop Quick Table + Detailed Editor, stable entry/meaning/example IDs, atomic CSV/TSV imports, optional native TTS, recording and uploaded media; original author text and POS/translation publication validation; teacher ownership.
- **D-135 / VC-03:** Four adaptive read-only learner views, multi-meaning display, search word/translation, POS filter, author/alphabetical sort, per-word/example controlled audio with no unsupported locale fallback, mobile/iframe accessibility.
- **D-136 / VC-04 A–E:** Unicode NFC search keys and original display, multilingual/RTL, no automatic merging of duplicates, one audio stream, media version references, import preview + atomic commit, teacher/admin permissions and immutable published snapshots.
- **D-137 / VC-04 F:** 32 explicit scenario tests VC-AC-01–32. **Documentation only; no Codex handoff, code or deployment changes.**


## 2026-10-22 — v32 / Mini Dialogues (Module 22)
**Approval precision:** MD-01, MD-02, MD-03, MD-04 **A–F explicitly approved** in user's final confirmation. Prior MD-01 and MD-02 tentative status is superseded by this approval; no additional unselected proposals automatically approved.
- **D-138 / MD-01 A–F:** Dedicated dialogue-layout module, 1+ dialogue blocks, each line linked to speaker with optional avatar; conversation bubbles are primary; Typing, Word Bank and Dropdown as exercise-wide exclusive modes; no branching or live roleplay in v1.
- **D-139 / MD-02 A–F:** Desktop Speakers→Dialogues→Lines editor, inline gaps with stable IDs, optional audio, configurable global response mode, Auto/Manual Word Bank with manual distractors, bubble-based Design and Preview.
- **D-140 / MD-03 A–F:** Conversation-first responsive player, Drag/Tap bank/typing/dropdown inputs, one global Check across all dialogues, shared original-gap-based 3/5 budget, 1 point per gap, lock correct/revise wrong, optional per-line/whole-dialogue audio and iframe/keyboard accessibility.
- **D-141 / MD-04 A–E:** Stable speaker/line/gap identity; repeated same-text bank cards semantically interchangeable; local dropdown and conservative typed aliases; teacher-controlled audio gating (always / after_finish / selected_lines); accessible mobile layout; strict publishing, immutable sessions, idempotent Checks and Restart.
- **D-142 / MD-04 F:** 36 action-and-expected-result acceptance tests MD-AC-01–36. **Documentation only, no Codex task, source or deployment changes.**
**Status:** Module 22 design complete; implementation not asserted. See `04_MODULES/MINI_DIALOGUES.md`.
