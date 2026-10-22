# Module 17 — Flashcards (FC-01–FC-04)

**Status:** Functional design complete. FC-01, FC-02, FC-03 and FC-04 A–F **explicitly approved** on 2026-10-16. Documentation/specification only; no Codex task and no implementation authorized.

## Product model — FC-01, approved A–F
- Standalone flashcard module based on common Author Studio, Editor/Player Core, Design System, Media Library and Publish/LearnWorlds iframe. Deck may teach vocabulary, translations, concepts, grammar, questions/answers or other pairwise recall content.
- Each card has stable card ID, authored order and two independent faces (Front and Back). Each face supports text, one principal image and one principal audio recording in combinations; optional hint, image caption/alt description and necessary audio transcript. No video in v1.
- Study freely reveals and browses; Recall is active recall with self-ratings **Known / Repeat**; Review repeats cards marked Repeat. Recall is default. No automated objective correctness test, points, score, standard 3/5 checks or SRS scheduler in v1.
- Permitted directions Front→Back and Back→Front; permitted modes and shuffle/teacher order configurable. Both directions have independent progress.

## FC-02 — Author Studio, all A–F approved
- Content: deck title and instructions, visually editable front/back blocks, hints; choose/reuse referenced media from existing Media Library, not duplicate files. Author desktop-only.
- Three creation paths: **Visual Editor** for rich cards; **Quick Table** with Front/Back/Hint; **Bulk Paste/import** for TSV/CSV and delimited text with preflight preview and explicit confirmation. Copy/paste table ranges from Excel/Sheets. Import only text fields in v1; media added in Visual Editor.
- Cards may be added, duplicated (fresh stable IDs), reordered by drag-and-drop, multi-selected, removed with confirmation. Identical content can legitimately occur; warn without blocking. Media asset not removed by card deletion.
- Design: existing independent **Classic/Comic** style and **Compact/Standard** sizing, **Flip 3D/Fade** animation, hints shown or requested, direction and progress controls, accessible reduced-motion alternative. Image fitted without destructive crop. Automatic audio only when allowed by browser/user gesture and accessibility policy.
- Behavior: Recall initially, Study/Recall/Review allowed by default, Front→Back default, reverse allowed, initial shuffle default, Repeat cycles available, rating-only progress within session. Teacher can restrict modes/directions.
- Save incomplete drafts; publish requires >=1 completed card, nonempty effective content on *both* faces (media-only permitted with accessibility equivalents when needed), at least one permitted mode, usable required media. Warn about one-card deck and visually identical fronts/backs rather than block. Published versions hold fixed card/media references.

## FC-03 — Student Player, all A–F approved
### Study
- Face starts in prompt position, tap/keyboard turns over and back; Next/Previous browse fixed session order and reset face to prompt side. Mark distinct visited-card count; do not alter Known/Repeat ratings even on revisits. Study complete when every card in relevant pass has been visited; navigation remains possible.
### Recall
- On each card learner thinks, flips to answer, then rates **Known** or **Repeat**; rating controls disabled before revealing answer. The latest rating overwrites previous rating for same card+direction; no double count. Current Recall position preserved when temporarily switching into Study and back.
- Recall complete after each card in that direction has a rating in the current pass. Learner may revisit a rated card and change its rating; progress reflects current unique card statuses.
### Review
- Start only if at least one Repeat card exists in **selected direction**; if none rated, invite Recall; if all Known, show empty Review state.
- Snapshot ordered queue of Repeat card IDs at cycle start. Each ID encountered **at most once per cycle**, even if rated Known while traversing; no mutating/removing elements from in-progress iteration, which could skip cards. Re-rating affects the *next* cycle only. At cycle end learner can start new snapshot from remaining Repeat cards or exit. Single-card and all-Repeat cases supported.
- Switching directions selects separate rating map and Review queue; switching modes does not accidentally erase progress. Teacher may restrict direction change.
### Navigation, progress, media
- Teacher order or one-time shuffle on pass start; stable throughout pass, including Back and flip. Restart confirms and clears current session state of **both directions** (ratings, visited, queues and positions) and reshuffles if configured.
- Summary shows unique Known/Repeat/Unrated counts *per direction*, visited counts for Study, queue progress per Review cycle. **Self-ratings never presented as objective grade/points.** SRS/spaced daily scheduling out of v1. Local recovery optional/best-effort, no promise of permanent progress or account synchronization.
- Image fit and optional enlarge, audio play/pause/replay on corresponding face. Stop playback when switching face/card or leaving mode; error and retry on media failure without falsely changing rating. Keyboard Enter/Space for flip, focusable controls, swipe as optional alternative, reduced-motion, audio textual alternatives, no horizontal overflow on mobile/iframe. Do not let swipe trigger unintentional flip.

## FC-04 — Boundary rules, all A–F approved
### Progress correctness
- Key all ratings by `(deckPublishedVersion, cardStableId, direction)` within session. Explicit `unrated` is neither Known nor Repeat; one latest value. Never implicitly mark Known from Study or from merely flipping. A session may contain separate in-progress Study/Recall positions. Direction inversion must not transfer ratings.
- Review cycles use immutable queue snapshots with membership/position captured at start; update global ratings, filter future rounds only. On mode switch, restore or deliberately end interrupted round without losing assessments. If an external edit changes a *draft*, do not alter an already active published session.
### Import reliability
- Accept UTF-8 text import with TSV, standards-compliant CSV quoted commas and embedded line breaks, and explicitly selected `;` or `|` delimiters. Optionally map third Hint column; extra columns require mapping/error, not silent truncation. Empty physical rows skipped with counted report. Empty face -> row error, invalid encoding -> visible failure, large files limited and explained. Duplicate rows warn only. Preview and correct invalid rows; no mutation of deck before explicit commit. Commit is **atomic**: fully insert rows with new unique card IDs in intended order or insert none on failure; retry must not duplicate a previously committed batch.
- Quick Table paste follows the same validation and content mapping. Media are attached separately. Preserve Unicode and embedded quoted CSV newlines, never execute spreadsheet formulas from imported text.
### Media/content and publication
- Sides may be media-only; accessible descriptions/transcripts provided as appropriate. Long text grows/scrolls accessibly, no clipping or device-dependent truncation. Broken required media stops publish, runtime error shows retry and accessible status, not fabricated answer/rating. Duplicate cards retain independent IDs. Card delete never destroys shared Media Library resource.
- Publish version freezes deck membership, order, media version references, modes, directions and design. Editing draft or republishing does not mutate active sessions or previously published assets. Use stable IDs/version for future optional persistence. Optimize large decks with lazy media-loading/prefetch without preloading all assets. Support responsive Player and LearnWorlds iframe with access controls from core platform.

## Cross-module Behavior Core
- **Flashcards exception:** no numeric grades, no scored Check button, no 3/5 checks. Known/Repeat is a learner self-report, not an objectively assessed response. No penalties, no inferred correctness from flipping, and no automatic SRS. This exception must not alter other module scoring (Fill Blanks, Matching, Timeline, Essay Writing, etc.).

## Acceptance and release
- 32 explicit verifiable scenarios **FC-AC-01–FC-AC-32** in `07_DELIVERY/ACCEPTANCE_CRITERIA.md`; acceptance requires manual runtime tests on mobile, desktop and a constrained LearnWorlds iframe including media errors and import rollback.
- **Approval boundary:** FC-01 A–F, FC-02 A–F, FC-03 A–F, FC-04 A–F explicitly approved. No other proposals approved by implication. No Codex brief, code changes or deployment.
