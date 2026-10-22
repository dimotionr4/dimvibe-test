# Остальные модули

**Статус:** PLANNED / OPEN  
**Проект:** DimVibe · 2026-10-14  
**Правило:** при конфликте см. `GOVERNANCE.md` и реестр решений `DECISIONS.md`.



- **Words to Gaps** — модуль пропусков со словами, подчиняется лимиту 10 пропусков.
- **Matching**, **Sorting**, **ABCD**, **Color Coding** — запланированные типы; должны использовать общий контракт, но сохранять собственные `moduleData`, состояние ответов и оценивание.
- Не утверждать детальную структуру этих модулей до отдельного проектирования/прототипа.


## Правило

Words to Gaps, Matching, Sorting, ABCD, Color Coding разрабатываются независимо по общим контрактам. **Не выдумывать** их внутреннюю механику, схемы `moduleData`, оценивание или лимиты до отдельной спецификации. Для каждого создать свой документ после утверждения требований.


> **2026-10-15:** ABCD теперь спроектирован как **Multiple Choice** (`MULTIPLE_CHOICE.md`). Также спроектирован **True / False (Binary Choice)** (`TRUE_FALSE.md`). Старое описание ABCD выше — исторический контекст, не активный статус проектирования.

> **2026-10-15:** Odd One Out спроектирован как отдельный модуль, см. [`ODD_ONE_OUT.md`](ODD_ONE_OUT.md). Это будущая реализация, не текущая задача Codex.

> **2026-10-15:** Select Title завершён на уровне проектирования; отдельная спецификация [`SELECT_TITLE.md`](SELECT_TITLE.md). Реализация не назначена Codex.

> **2026-10-15:** Mistake Mode полностью спроектирован, см. [`MISTAKE_MODE.md`](MISTAKE_MODE.md). Итоговая механика — поиск отдельных слов, с необязательным требованием исправления для каждой ошибки. Старые предложения двух режимов и выделения фраз не действуют. Codex задача не назначена.

> **2026-10-16:** Ordering — финальный дизайн и сценарии OR-AC-01–18 см. [`ORDERING.md`](ORDERING.md). Преподаватель задаёт правильный порядок свободным перетаскиванием; Player всегда перемешивает, даёт одну проверку; одинаковые элементы запрещены в одной последовательности. Codex не назначен.


> **2026-10-16:** Color Coding окончательно спроектирован; его актуальные требования — [`COLOR_CODING.md`](COLOR_CODING.md), CC-AC-01–18. Упоминания Color Coding как «запланированного без детальной спецификации» выше относятся к историческому состоянию и больше не действуют. Реализация Codex не назначена.

> **v19 (2026-10-16):** Matching design approved MT-01–MT-04; see [`MATCHING.md`](MATCHING.md). Historic opening text listing Matching as not yet designed is superseded. Global Behavior Core default: 3 checks for 1–5 units, 5 checks for 6+ units; Ordering retains one final check. No Codex assignment.

> **v21 (2026-10-16):** Module 11 Timeline is fully designed and approved TL-01–TL-04; see [`TIMELINE.md`](TIMELINE.md), acceptance `TL-AC-01–22`. Separate module reusing Ordering mechanisms, teacher-defined chronology and display date labels, date reveal and Correct Timeline, one final Check. No Codex assignment.


**v22 (2026-10-16):** Module 12 **Categories / Sorting** finalized: [`CATEGORIES_SORTING.md`](CATEGORIES_SORTING.md), CS-01–CS-04 A–F approved, CS-AC-01–26. Any historic placeholder listing it as unimplemented remains true for code but is superseded for *design status*. No Codex assignment.


**v23 (2026-10-16):** Module 13 **Word Scramble / Phrase Builder / Sentence Builder** is fully designed, WS-01–WS-04 A–F approved; see [`WORD_SCRAMBLE_BUILDERS.md`](WORD_SCRAMBLE_BUILDERS.md), acceptance WS-AC-01–28. A unified three-mode exercise with one Check for all tasks and whole-task binary scoring. No Codex assignment.


**v24 (2026-10-16):** Module 14 **Splice** functionally designed; see [`SPLICE.md`](SPLICE.md), SP-AC-01–30. Single Word and Word Mosaic (Easy/Medium/Hard) use one final global Check and per-correct-word grading. Some detailed SP-02 editor proposals remain unapproved. No Codex task.


**v25 (2026-10-16):** Module 15 **Prepositions** functionally designed, PR-01–PR-04 A–F approved; see [`PREPOSITIONS.md`](PREPOSITIONS.md), PR-AC-01–28. Structured Fill Blanks with versioned curated English preposition categories, Dropdown or unlimited-reuse Word Bank, per-gap alternatives and standard Behavior Core 3/5. Design complete; **no Codex assignment**.


**v26 (2026-10-16):** Module 16 **Essay Writing** functionally designed, EW-02–EW-04 A–F approved; see [`ESSAY_WRITING.md`](ESSAY_WRITING.md), EW-AC-01–36. EW-01 initial concept proposals were not separately approved but overlapping functionality received approval in EW-02–04. Practice and secure Submission, Text Analysis Core, rubric review and teacher publishing; no default automatic semantic grade or 3/5 checks. **No Codex task.**


**v27 (2026-10-16):** Module 17 **Flashcards** functionally designed, FC-01–FC-04 A–F approved; see [`FLASHCARDS.md`](FLASHCARDS.md), FC-AC-01–32. Two-face multimedia cards, Study / Recall / Review, independent self-ratings per direction, frozen Review queue, atomic bulk TSV/CSV import, no automatic grade or daily SRS. Design complete; **no Codex assignment**.


**v28 (2026-10-16):** Module 18 **Hotspot** functionally designed, updated HS-01 through HS-04 A–F approved; see [`HOTSPOT.md`](HOTSPOT.md), HS-AC-01–36. One image with reusable normalized Rectangle/Ellipse/Polygon zones; Point / Zone / Outline and Find One / Multiple / in Order, IoU verification, distinct step checking and explicitly approved final false-positive deductions in Find Multiple. **No Codex assignment**.


**v29 (2026-10-17):** Module 19 **Word Search** functionally designed; WS-01–WS-04 A–F approved; see [`WORD_SEARCH.md`](WORD_SEARCH.md), 36 tests `word-search:WS-AC-01..36`. Auto/Custom grid, Word List/Clues/Hidden, eight directions, instant unique-word scoring, three modes of selection, free hints and optional timer. This design status does not imply implementation. **No Codex assignment**. Module 13 Word Scramble/Builders tests retain their historical WS-AC names; always qualify Word Search test references.


**v30 (2026-10-17):** Module 20 **Label the Diagram** functionally designed; LD-01–LD-04 A–F approved; see [`LABEL_THE_DIAGRAM.md`](LABEL_THE_DIAGRAM.md), LD-AC-01–36. Author-defined image anchors, labels, Straight/Elbow callouts, Auto Arrange, four student answer modes, stable 3/5 checks, interchangeable duplicate label cards, mobile Numbered fallback. Design complete; **no Codex assignment**.


**v31 (2026-10-17):** Module 21 **Vocabulary** functionally designed, VC-01 A–E and revised F, VC-02–VC-04 A–F approved; see [`VOCABULARY.md`](VOCABULARY.md), VC-AC-01–32. Informational multilingual word/meaning/example/audio/image dictionary with Dictionary, Cards, Reveal, Listen and no Check, score, timer, required completion or study progress. This is **not** the future cross-module global vocabulary library. **No Codex assignment**.


**v32 (2026-10-22):** Module 22 **Mini Dialogues** functionally designed, all MD-01–MD-04 A–F explicitly approved; see [`MINI_DIALOGUES.md`](MINI_DIALOGUES.md), MD-AC-01–36. Dialogue bubbles with speaker names/avatars/initials, inline Typing/Word Bank/Dropdown (one exercise-wide mode), multiple dialogue blocks with one 3/5 global Check, optional gated line/dialogue audio, accessible responsive Player. Previous 21 module specification files byte-identical. **No Codex assignment.**
