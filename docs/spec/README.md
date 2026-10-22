> **v15 (2026-10-15):** добавлен `04_MODULES/SELECT_TITLE.md` (ST-01–ST-04), решения D-051–D-056 и 16 критериев ST-AC-01–16. **Только документация**, без изменения кода, очереди Codex или спецификаций остальных модулей.

> **v13 (2026-10-15):** добавлены `04_MODULES/TRUE_FALSE.md` и `04_MODULES/MULTIPLE_CHOICE.md`, решения D-035–D-045 и критерии TF-AC-01–16 / MC-AC-01–18. Модули спроектированы, но **не переданы Codex на реализацию**. Вся очередь разработки сохранена. Fill Blanks и Image to Gaps не изменялись.


> **ITG-01–ITG-04 addendum (2026-10-15):** завершено функциональное проектирование Image to Gaps (Editor, Student Player, отображение и граничные случаи); утверждены решения D-029–D-034 и критерии AC-ITG-01–AC-ITG-12. Нормативный текст — `04_MODULES/IMAGE_TO_GAPS.md`. ITG-02 D (фиксированная мобильная панель) не утверждено. **Это обновление документации, не поручение Codex начинать реализацию.**

> **FB-02 addendum (2026-10-15):** утверждены режимы Fill Blanks, Word Bank (ловушки), Dropdown (общий пул), переключение без потери данных. Нормативный текст в `04_MODULES/FILL_BLANKS.md`, критерии `07_DELIVERY/ACCEPTANCE_CRITERIA.md`, решения D-023–D-028, задача Codex `07_DELIVERY/CODEX_BRIEF_FB_02_2026-10-15.md`.

> **v10 update (2026-10-14):** Авторский интерфейс, каталог 20+ модулей, управляемые папки, медиатека/аналитика хранилища, одиночный администратор и приоритет рабочего MVP. Новейшие нормативные документы: `08_AUTHOR_STUDIO/*`, `07_DELIVERY/IMPLEMENTATION_PRIORITY_2026-10-14.md`, `03_CORE/BEHAVIOR_CORE.md`. При противоречиях эти решения имеют приоритет над предыдущими предложениями.

> **v9 addendum (2026-10-14):** Publication UI simplified. See `05_PUBLICATION/PUBLICATION.md`, `05_PUBLICATION/PUBLICATION_DECISIONS.md`, and `05_PUBLICATION/LEARNWORLDS_IFRAME_TEST.md`. These newer decisions supersede earlier suggestions of teacher-facing publication history/rollback in MVP. Dynamic iframe update is pending real LearnWorlds acceptance test.

# DimVibe — комплект инструкций для разработки с нуля

Это **спецификация**, а не существующий код. Документы выделены из исходной согласованной инструкции и текущих уточнений. Инструмент разработки (Codex, Claude Code, Google AI Studio), Git-провайдер, фреймворк и backend **не выбраны**.

## С чего читать

1. `GOVERNANCE.md` — как читать требования и разрешать противоречия.
2. `DECISIONS.md` — утверждённые решения, заменённые правила, открытые вопросы.
3. `01_PRODUCT/PRODUCT.md` — продукт, терминология и границы.
4. `02_ARCHITECTURE/CONTRACTS.md` — общий контракт и независимость модулей.
5. `03_CORE/EDITOR_CORE.md`, `03_CORE/PLAYER_CORE.md` — общая логика.
6. `04_MODULES/<module>.md` — только нужный модуль.
7. `05_PUBLICATION/PUBLICATION.md` — публикация и откат.
8. `06_EXPERIENCE/UX_AND_LMS.md` — интерфейс, доступность, LearnWorlds.
9. `07_DELIVERY/TASKS.md` — план работ и критерии приёмки.
10. `07_DELIVERY/AI_DEVELOPER_RULES.md` — правила постановки задач AI.

## Правило работы

**Одна задача = одна ограниченная область кода + явные зависимости + критерии готовности.**
Перед задачей читать `GOVERNANCE.md`, соответствующий Core-документ, контракт и модульную спецификацию. Не передавать все документы как один запрос «реализуй всё».

## Карта владельцев требований

| Область | Единственный нормативный владелец |
|---|---|
| Общее устройство проекта и интерфейсы модулей | `02_ARCHITECTURE/CONTRACTS.md` |
| Общие части редактора | `03_CORE/EDITOR_CORE.md` |
| Жизненный цикл ученика, проверки, лимиты | `03_CORE/PLAYER_CORE.md` |
| Специфическое поведение типа задания | `04_MODULES/<module>.md` |
| Публикации, immutable-версии, откат | `05_PUBLICATION/PUBLICATION.md` |
| Общий UX, локализация, LMS | `06_EXPERIENCE/UX_AND_LMS.md` |
| Порядок разработки | `07_DELIVERY/TASKS.md` |

`DECISIONS.md` фиксирует *статус* и историю решения, а нормативные детали живут в документе-владельце. `SOURCE_ARCHIVE.md` — неизменённый исходник для сверки, **не второй источник активных требований**.

## Утверждённый MVP и приёмка

- `07_DELIVERY/MVP_SCOPE.md` — **утверждённые 29 функций**.
- `07_DELIVERY/ACCEPTANCE_CRITERIA.md` — проверяемые сценарии по каждой функции.
- `02_ARCHITECTURE/GAP_ENGINE.md` — единый Gap Engine для двух самостоятельных модулей.
- `04_MODULES/MEDIA_LIBRARY.md` — общая библиотека изображений.

## Проектирование хранения (новый этап)

`02_ARCHITECTURE/DATA_STORAGE.md` — **PROPOSED** модель данных, репозитории, медиа и атомарность. Она не утверждает выбор backend и не подменяет нормативные правила `05_PUBLICATION/PUBLICATION.md`. Открытые решения — `OPEN_QUESTIONS.md`.

**Модель пользователей:** утверждена B — отдельный аккаунт и личная библиотека на преподавателя; см. `02_ARCHITECTURE/ACCESS_CONTROL.md`.

## Доступ

Роли Administrator/Teacher утверждены. Единственный нормативный владелец матрицы прав: `02_ARCHITECTURE/ACCESS_CONTROL.md` (D-021, D-022).

## Технический blueprint

`02_ARCHITECTURE/IMPLEMENTATION_BLUEPRINT.md` — предлагаемая структура кодовой базы, зависимости, операции сервисов, инварианты безопасности и архитектурные тесты. Технологический стек ещё не выбран.

## UI/UX specification v1 (2026-10-14)

See `06_EXPERIENCE/UI_UX_SPEC_V1.md` for design principles, Editor/Player/Admin layouts, drag-and-drop and provider-agnostic audio UX acceptance tests.


## Обновление 2026-10-14: вкладка «Дизайн»

Новые документы по результатам продолжения проектирования:

- [`06_EXPERIENCE/DESIGN_SYSTEM_APPROVED.md`](06_EXPERIENCE/DESIGN_SYSTEM_APPROVED.md) — темы, инструкция, обложка, текстовые блоки, медиа, кнопка проверки, блок результатов, глобальный макет.
- [`06_EXPERIENCE/GAP_STYLES_AND_INDICATORS.md`](06_EXPERIENCE/GAP_STYLES_AND_INDICATORS.md) — 4 типа пропусков, 2 вида линий, полужирный ввод, 4 угловых индикатора и состояния проверки.
- [`03_CORE/AUDIO_AND_HINTS.md`](03_CORE/AUDIO_AND_HINTS.md) — прикрепление/генерация аудио, медиатека и подсказки без штрафов в MVP.
- [`06_EXPERIENCE/DESIGN_DECISIONS_CHECKLIST.md`](06_EXPERIENCE/DESIGN_DECISIONS_CHECKLIST.md) — короткий перечень утверждённых решений.

**При противоречиях в вопросах интерфейса и дизайна эти новые файлы имеют приоритет перед ранними вариантами в архиве.** Все документы — требования, а не свидетельство выполненной разработки.


## Specification Kit v14 — 2026-10-15

- Новый утверждённый модуль [`04_MODULES/ODD_ONE_OUT.md`](04_MODULES/ODD_ONE_OUT.md): OO-01–OO-04.
- `DECISIONS.md`: D-046–D-050; `07_DELIVERY/ACCEPTANCE_CRITERIA.md`: OO-AC-01–16.
- Пятый модуль спроектирован, **реализация не подтверждена и не запрошена**. Рабочая очередь Codex не меняется.

## Specification Kit v16 — 2026-10-15

- Утверждённый проект **седьмого модуля** [`04_MODULES/MISTAKE_MODE.md`](04_MODULES/MISTAKE_MODE.md): MM-01–MM-04, окончательные уточнения без глобальных режимов и **только отдельные слова**.
- `DECISIONS.md`: D-057–D-063; `07_DELIVERY/ACCEPTANCE_CRITERIA.md`: MM-AC-01–18.
- Изменения только в проектных документах; **реализация и задания Codex не начинались, порядок разработки не меняется**.

## Specification Kit v17 — 2026-10-16

- Added `04_MODULES/ORDERING.md` for module 08 and documented latest, overriding decisions.
- `DECISIONS.md`: D-064–D-069; `07_DELIVERY/ACCEPTANCE_CRITERIA.md`: final OR-AC-01–18.
- Final policy: freely reorder correct items in Author Studio, Player auto-shuffles, one Check then result, Start again for new run, duplicate items block publishing.
- Documentation only; Codex tasks and code untouched.


## Specification Kit v18 — 2026-10-16

- Девятый функционально спроектированный модуль: [`04_MODULES/COLOR_CODING.md`](04_MODULES/COLOR_CODING.md), CC-01–CC-04.
- Решения D-070–D-075; сценарии `CC-AC-01–18`.
- Категории общие на упражнение; слова размечаются по отдельным вхождениям; по 1 баллу за корректную классификацию, ложные отметки мешают достичь 100%; категории доступны по названию и цвету.
- Только проектная документация. Код, существующая очередь и задания Codex не менялись.

## Specification Kit v19 — 2026-10-16
- Tenth designed module: [`04_MODULES/MATCHING.md`](04_MODULES/MATCHING.md), approved MT-01–MT-04; 20 cases `MT-AC-01–20`.
- Global Behavior Core policy updated: **1–5 original scorable units → 3 checks by default; 6+ → 5**; teacher override 1–5 where supported; Ordering remains one check.
- Matching correct pairs leave two columns and accumulate in green solved area underneath; wrong pairs remain above in red, are unlinked and can be retried.
- Documentation only; no implementation or Codex task assigned.

## Specification Kit v20 — 2026-10-16
- MT-05 approved visual extension for [`04_MODULES/MATCHING.md`](04_MODULES/MATCHING.md): `Standard` and `Lines + Pair Colors` in Design.
- Standard retains green solved section and 3/5 checks; Lines keeps all cards in place, colors links/cards green/red after **one** final Check, with Start again.
- Explicit precedence documented in `03_CORE/BEHAVIOR_CORE.md` and `03_CORE/BEHAVIOR_DECISIONS.md`; `07_DELIVERY/ACCEPTANCE_CRITERIA.md` adds MT-AC-21–27; `DECISIONS.md` includes D-082.
- Documentation update only. No changes to source code, existing Codex task queue, or prior nine module specifications.

## Specification Kit v21 — 2026-10-16
- Module 11 **Timeline** approved through TL-01–TL-04 (A–F each), new [`04_MODULES/TIMELINE.md`](04_MODULES/TIMELINE.md).
- Timeline reuses Ordering's movement and exact-position grading, while adding arbitrary user-facing date labels, teacher-defined chronology, date-visibility setting and separate Correct Timeline result.
- Timeline has exactly **one final Check** per run regardless of total events; explicit Behavior Core exception to default 3/5; score 1 point per event in correct canonical position.
- 22 TL-AC-01–22 acceptance scenarios and D-083–D-087 decisions are recorded. Equal date labels are permitted with warning; visually identical student cards block publish.
- Documentation only; preexisting modules and Codex source/task queue remain unchanged.


## Specification Kit v22 — 2026-10-16
- Module 12 **Categories / Sorting** completed through CS-01–CS-04 (all decisions A–F approved); see [`04_MODULES/CATEGORIES_SORTING.md`](04_MODULES/CATEGORIES_SORTING.md).
- Multiple learner items can belong to one category, while each card has exactly one correct category. Author creates categories and their cards, and Player shuffles the bank and supports both tap-to-place and drag-and-drop.
- Correct items lock in categories; wrong items return to the bank on intermediate checks; one point per item with inherited **3/5** Behavior Core checks. Final check freezes the learner's placement before showing correct classification and restart.
- Design has Columns/Stacked adaptive layouts; Author Studio desktop-only, Player responsive. 26 scenarios CS-AC-01–26, decisions D-088–D-092.
- All older modules are retained; this is documentation only, no new Codex tasks or source changes.


## Specification Kit v23 — 2026-10-16
- Fully approved module 13 **Word Scramble / Phrase Builder / Sentence Builder**, stages WS-01–WS-04 A–F: [`04_MODULES/WORD_SCRAMBLE_BUILDERS.md`](04_MODULES/WORD_SCRAMBLE_BUILDERS.md).
- Includes 28 acceptance cases WS-AC-01–28, decision summaries D-093–D-097 and Behavior Core one-global-final-Check exception. Scoring: 1 point per fully correct task, not per token.
- Prior twelve module specifications retained unmodified; only shared documentation and index files appended. **No Codex task assigned and no source code modified.**


## Specification Kit v24 — 2026-10-16
- Module 14 **Splice** completed concept/Player/edge-case design with SP-01, SP-03, SP-04 A–F approved and the SP-02 **game-mode and difficulty extension** explicitly approved: see [`04_MODULES/SPLICE.md`](04_MODULES/SPLICE.md).
- Single Word and Word Mosaic (Easy/Medium/Hard; Medium default), one global Check, 1 point per correct word, unordered multiset matching in Medium/Hard, 30 cases SP-AC-01–30.
- Historical detailed SP-02 editor proposals were not separately approved; their status is transparently marked in the new module spec.
- This package retains prior v23 documents. No Codex task assigned and no program source modified.


> **v25 (2026-10-16):** добавлен Module 15 `04_MODULES/PREPOSITIONS.md` — PR-01–PR-04 A–F утверждены, 28 критериев PR-AC-01–28, библиотека предлогов и повторное использование Fill Blanks/Behavior Core с лимитом 3/5. Дизайн-документация; **не задание Codex**. Спецификации предыдущих 14 модулей сохранены.


## Specification Kit v26 — 2026-10-16
- Module 16 **Essay Writing** functionally designed with approved EW-02–EW-04 A–F: [`04_MODULES/ESSAY_WRITING.md`](04_MODULES/ESSAY_WRITING.md). EW-01 was an initial proposal, **not separately A–F approved**; later stage approvals govern overlapping decisions.
- Practice vs secured server Submission, locally recovered/server synced drafts, deterministic versioned Text Analysis Core, constraints and Strict/Flexible, independent formal compliance and manual rubric score, safe server intake, timer/offline and iframe.
- 36 acceptance scenarios EW-AC-01–36; decisions D-108–D-111, Behavior Core exception: no standard 3/5 scored gap checking and no default AI grading. Earlier 15 module documents are retained unchanged. **No Codex task or source modifications.**


## Specification Kit v27 — 2026-10-16
- Module 17 **Flashcards** fully functionally designed, FC-01–FC-04 A–F explicitly approved: [`04_MODULES/FLASHCARDS.md`](04_MODULES/FLASHCARDS.md).
- Visual Editor / Quick Table / validated bulk import, multimedia two-sided faces; Study, Recall and deterministic Review; isolated directional ratings and no automatic objective score/SRS; responsive iframe, accessibility and media handling.
- 32 specialized verifiable acceptance scenarios FC-AC-01–32, decisions D-112–D-116, Behavior Core exception. Earlier 16 module specification documents remain byte-identical. **No Codex task or application changes.**


## Specification Kit v28 — 2026-10-16
- Module 18 **Hotspot** fully functionally designed: updated HS-01–HS-04 A–F expressly approved; `04_MODULES/HOTSPOT.md`.
- Point/Zone/Outline tasks, Find One/Multiple/in Order, reusable normalized geometry, author markup tools, mobile accessible Student Player and reference IoU.
- **Approved special behavior:** Find Multiple final remaining false marks reduce correct-target points 1 each (minimum 0); Find in Order has independent 3 checks for each one-target step. No spillover to other modules.
- Added 36 testable cases HS-AC-01–36 and decisions D-117–D-121; updated behavior registers, module index and changelog.
- Earlier 17 module specifications remain byte-identical. **No Codex assignment, code or deployment changes.**


## Specification Kit v29 — 2026-10-17
- Module 19 **Word Search** fully functionally designed with explicit WS-01–WS-04 A–F approval: [`04_MODULES/WORD_SEARCH.md`](04_MODULES/WORD_SEARCH.md).
- Automatic multilingual grid placement, ambiguity validation, Word List/Clues/Hidden, Drag/Tap–Tap/keyboard, immediate 1 point per unique target, free hints and optional timer; 36 scoped cases `word-search:WS-AC-01..36`.
- **Namespace collision:** Module 13 Word Scramble/Builders already owns unqualified `WS-AC-01..28`; both retained; use module-scoped references.
- Previous 18 module specifications preserved byte-identically. **Documentation only, no Codex task or source/deployment changes.**


## Specification Kit v30 — 2026-10-17
- Module 20 **Label the Diagram** fully functionally designed: LD-01–LD-04 A–F explicitly approved, [`04_MODULES/LABEL_THE_DIAGRAM.md`](04_MODULES/LABEL_THE_DIAGRAM.md).
- Four answer modes Drag/Click/Type/Numbered, image-normalized anchors plus independent composition-space labels and callouts, auto-arrangement, Exact/Distractor/Reusable bank, accessible responsive player and iframe.
- Standard 3/5 Check budget by original target count; correct locks and wrong remains editable; one point per target, no negative marks; hint options and mobile Numbered fallback.
- 36 explicit verifiable LD-AC-01–36 scenarios, decision register D-127–D-131, core behavior addenda. Existing 19 module documents preserved byte-identically. **Documentation only: no Codex task, code or deployment changes.**


## Specification Kit v31 — 2026-10-17
- Module 21 **Vocabulary** design approved (VC-01 A–E and revised F, VC-02/03/04 A–F): [`04_MODULES/VOCABULARY.md`](04_MODULES/VOCABULARY.md).
- Learner-facing informational dictionary with multilingual WordEntry/Meaning/Example, teacher-managed imports, images, uploaded/recorded audio and optional native TTS, Dictionary/Cards/Reveal/Listen.
- **No assessments, scoring, attempts, 3/5 checks, timers, completion requirement or study-progress tracking**; only transient presentation state. No global cross-teacher vocabulary sharing in v1.
- 32 action-and-expected-result checks VC-AC-01–32; appended D-132–D-137; behavior registry and index updated. Previous 20 module specifications preserved byte-for-byte. **Documentation only: no Codex handoff, code or deployment changes.**


## Specification Kit v32 — 2026-10-22
- Module 22 **Mini Dialogues** fully specified with explicit MD-01, MD-02, MD-03 and MD-04 A–F approval: [`04_MODULES/MINI_DIALOGUES.md`](04_MODULES/MINI_DIALOGUES.md).
- Primary product differentiation is dialogue bubbles with stable speaker identities, optional avatars, many conversations per exercise and inline gaps. Typing/Word Bank/Dropdown share a single exercise-wide response mode.
- Shared 3/5 Check model by original gap count across all dialogue blocks; correct locked, wrong revised; 1 point per gap. Optional line/whole-dialogue audio with controlled answer disclosure, mobile/iframe access and 36 explicit test cases MD-AC-01–36.
- Prior 21 module specifications preserved byte-for-byte. **No Codex assignment, code, database or deployment change.**
