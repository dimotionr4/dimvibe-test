# DimVibe — Behavior Core

Status: approved behavior specification (2026-10-14)

## Scope and architecture
Behavior Core defines common learning-session rules for Fill Blanks, Image to Gaps, and future compatible modules. Each module supplies its own answer interaction, completeness checks, answer validation, hint anchors, and item identities. Shared Behavior Core handles check budgets, scoring, locking, hints unlock timing, completion, reset, and footer state. Design System renders Classic and Comic separately.

## Practice-only model
- Training, not examination. No learner login required.
- No persistence of student scores, submissions, histories, or gradebook integration; session state is transient in Player.
- Each required scorable target yields 1 point when correct. Max points = number of scorable targets. Display count and percent.
- Publisher's version, content, design, and teacher-defined media are unaffected by resets.

## Check rules
- Teacher selects 1–5 allowed checks; default 5.
- All required targets must be filled before every valid check; already locked correct targets count as filled.
- Attempting an incomplete check gives a clear message and marks missing positions, without consuming a check.
- Only a valid completed check consumes one check.
- On valid check, correct positions lock and show success; incorrect ones display failure and stay editable if checks remain.
- Editing a wrong answer clears its stale error indicator; its next correctness is determined at the next valid check.
- End session immediately after 100% accuracy or exhaustion of checks; all inputs become read-only.

## Feedback and hints
- Correctness becomes visible after explicit check, not live while typing.
- Hints unlock **after the second completed valid check**, only for wrong/unresolved targets with teacher-supplied hints; no point or check penalty.
- Before unlock, teacher-supplied hints are indicated in a locked state; missing hints have no icon.
- If the configured budget is 1 or 2 and the exercise ends, after the second check existing hints remain viewable as explanatory aid, where applicable. A one-check exercise never reaches the second check, so hints remain locked (an unresolved product policy decision whether to show post-completion hints for one-check exercises).
- Ordinary instructional audio is distinct from audio hints, available immediately, replayable without restriction.

## Instructions and audio
- Optional instruction and cover: both can be hidden independently; when both hidden, exercise content appears directly.
- When an instruction exists, it starts expanded; student can collapse it; reset restores expanded state.
- One audio source plays at a time; starting another stops current playback; reset stops audio; audio remains accessible after completion.
- Hint popovers fit within Player viewport, also on mobile.

## Shared answer-bank behavior
- One element instance may occupy one target at a time; duplicate-looking words/images can have distinct instance IDs.
- Before validation, items can be freely placed, replaced, moved, or returned. Replacement returns previous instance to bank. On mobile, tap item then target; desktop supports drag and drop.
- A valid check locks correctly matched targets and their item instances. Incorrect assignments stay editable; they do not auto-return to bank.
- Distractors may remain unused; bank need not be empty for a valid check.
- Bank shuffle is enabled by default, applied once at session start; order stays stable during session.

## Ordering
- Reorder separate sentences only if teacher enables it; default off; unified prose and paragraphs do not shuffle.
- Gap/media/audio/hint metadata move with sentence. Stable IDs preserve answer identity; visible numbering follows displayed order.
- Reset/Restart creates a fresh randomized order when enabled; a repeat permutation is allowed.

## Text validation
- Compare normalized Unicode text (NFC), ignoring letter case and accidental leading/trailing or repeated whitespace.
- Ignore incidental sentence-ending punctuation (. , ? !); preserve meaningful punctuation inside words and phrases such as apostrophes and hyphens.
- Do not forgive misspellings or infer synonyms with AI.
- Teacher can supply explicitly accepted alternatives, each worth the same single point.
- Common Text Answer Validator can be reused across future text-based modules.

## Player presentation and controls
- Fixed **Player-internal** bottom toolbar presents filled-count before first check, then checked score/count/percent, remaining checks, and the main action on right.
- Main action reads 'Check' while active and 'Start again' when finished. Mobile layout may wrap compactly without covering content.
- Small always-available reset icon is in Player header top-right. If state was changed, reset requires compact confirmation; it uses the same underlying reset operation as the footer restart.
- Reset clears learner answers, locks, scores, feedback, check count, hint unlock/open states, stops audio and re-expands instruction. Published version and media do not change.

## Non-goals
No learner grade history, grade export, rankings, automatic answer autocorrection, server-grading for ordinary practice, or per-module duplicate behavior controls in MVP.

## Open detail to revisit
- Whether teachers with only 1 allowed check should allow post-completion hint viewing despite the two-check rule; currently *no*, as the unlock threshold is not reached.
- Exact punctuation normalization beyond the listed four trailing marks, and whether strict per-gap punctuation override is needed; not approved yet.

## Global dynamic check budget — approved 2026-10-16 (v19; supersedes static default 5)
- For compatible modules, **default** maximum completed checks = **3** when an exercise has **1–5 scorable units**, and **5** when it has **6 or more**.
- Count the exercise's original total scorable units (e.g., Matching pairs across all sets, Fill Blanks gaps, Color Coding teacher-marked words, Multiple Choice questions); do not recompute the budget as correct answers become locked or removed.
- Teacher can override allowed checks within **1–5**, where that module permits customization. A manual override takes precedence over the computed default.
- Explicit module-level policies override this default: **Ordering has exactly one final Check per run** and shows results immediately, then Start again for a new run; no repeated checks or locking.
- A check must satisfy the module's published completion predicate; Matching requires all currently unresolved left cards to be linked. Modules with undisclosed error positions such as Mistake Mode and Color Coding retain their approved exception: checking is allowed after at least one mark.
- Completion is 100% or exhausted permitted checks, and accumulated correct answers are not counted twice. These changes supersede every prior document statement of 'default 5' for compatible modules; historical sections remain archival.
- Matching-specific post-check display: solved pairs move to green solved section below; incorrect pairs stay above red and become unlinked for retry. This specializes generic feedback/bank mechanics, without duplicating the shared attempt counter.

## Matching Design-specific Check policy — MT-05 approved 2026-10-16 (v20)
- Matching `standard`: shared **dynamic 3/5 default** applies based on original total pairs across the exercise, plus supported teacher override.
- Matching `lines_pair_colors`: **one final Check per run**, independent of original pair count and independent of teacher-configured count. This explicit mode-level exception **takes priority** over the dynamic default and manual check override. Require complete one-to-one links across all unresolved pairs before Check; the check finalizes the exercise and locks editing.
- Both modes use shared correctness evaluation and 1 point per correct pair; only response presentation and permitted repeated checks differ. `lines_pair_colors` shows red/green on connected cards and lines **in place**, no movement to green solved area; only Start again allows another run.
- Ordering separately retains its approved one-check policy. All other module defaults remain unchanged.

## Timeline module-specific final Check — approved TL-01/TL-03/TL-04 (v21, 2026-10-16)
- `timeline`: **exactly one final Check** per run, for any event count; takes precedence over shared dynamic 3/5 defaults and teacher check overrides.
- Count scorable units as original number of timeline events. Check all event IDs against their exact canonical positions; 1 point for a correct position, 0 for others, no partial or repeated award.
- Submitting an unchanged or accidentally already-correct shuffled list is valid; no mandatory interaction requirement.
- After Check freeze learner order, reveal all date labels, grade positions green/red with non-color indicators, show canonical **Correct Timeline** below submitted **Your Timeline**; Start again fully resets and reshuffles.
- Author supplies chronology as canonical list position; identical date labels do not imply equivalence. Duplicate/rapid Check is idempotent.
- This is an explicit module-level override alongside Ordering and Matching `lines_pair_colors`, not a modification of the global default for other modules.


## Categories / Sorting — approved CS-01–CS-04 (v22, 2026-10-16)
- One original classifiable card/itemId = one scored unit, independently of category counts or order within category. Correct category assignment scores once then locks; wrong assignments return to Item Bank after **intermediate** Check without revealing the category.
- Uses the general original-unit default **3 checks for 1–5; 5 checks for >=6**, with supported teacher override. Published module has >=3 cards. The count is never recalculated from unresolved cards.
- On the **final** Check, freeze submitted placements, report red/green feedback and total/correct mapping; no interactive return to bank. 100% finishes early, check delivery idempotent, Start again clears and reshuffles.
- Sorting does NOT override the 3/5 rule, unlike the existing one-final-Check exceptions for Ordering, Timeline, and Matching `lines_pair_colors`.


## v23: Word Scramble / Phrase / Sentence Builder exception (approved WS-03 B, WS-04 E)
- The combined Word Scramble / Phrase Builder / Sentence Builder module has **exactly one final Check per exercise run**, not one per task, irrespective of count of tasks or tokens. Check only after every task is fully assembled. No correction after Check; `Start again` for new shuffled run.
- Score = number of fully correct tasks (1 per task), never number of matching token positions. Compare each assembled token-value sequence, using Unicode NFC, preserving case/punctuation, and treating identical token values as interchangeable regardless of occurrence IDs.
- Priority: module-specific one-check exception supersedes teacher/global 3/5 policies for this module; all previous module-specific exceptions and default 3/5 policies remain in force elsewhere.


## v24: Splice module — final Check exception (approved SP-01 / SP-03 / SP-04)
- **Exactly one final Check for the entire Splice exercise**, both Single Word and all Word Mosaic difficulties (Easy/Medium/Hard); this explicit policy overrides the general 3/5 checks and teacher count override without modifying other modules.
- Check is available only when all Single Word words are fully assembled or when all Mosaic fragments are used and area capacities satisfied (Easy/Medium expected count; Hard at least two per area).
- Score 1 per fully assembled correct **word** (not fragment); no partial credit. Easy validates word in its fixed area; Medium/Hard compare across areas to the multiset of teacher-authored target words, with multiplicity and Medium count constraints. NFC normalizes equivalent Unicode text without flattening case or punctuation.
- One Check is atomic/idempotent. Freeze all learner placements, indicate per-word result without relying on color alone, expose canonical answers in results and allow Start again to fully reset learner state and reshuffle.
- This override does not affect Ordering, Timeline, Word Scramble Builders, Matching mode-specific rules or the common 3/5 default.


## v25: Prepositions Module 15 (PR-01–PR-04 approved)
- Reuse standard Fill Blanks/Gap Engine scoring. Each original preposition gap is one scoring unit; accepted alternatives each award one point, once per unique gap ID.
- Apply globally approved original-unit default: 1–5 gaps = 3 checks, 6+ gaps = 5; allow only existing teacher override policy. Correct gaps lock green, wrong remain editable/red until changed; complete on all correct or limit exhausted.
- All unlocked gaps must be filled for Check; Check and result emission atomic/idempotent. Final view may show teacher-authoritative accepted answers and explanations.
- **No one-final-Check exception for Prepositions.** The previously approved Ordering, Timeline, WS, Splice, and mode-specific Matching exceptions remain untouched.


## v26: Essay Writing — EW-02–EW-04 approved
- Free-text writing uses **continuous/repeatable live checks of formal requirements**, NOT automatic scored-unit 3/5 checks, correct-gap locking, or one-final-Check assembly logic. Author can set required/advisory and Strict/Flexible (Flexible default); machine-check only objective constraints.
- Formal compliance counts X/N remain distinct from teacher-only subjective quality scoring; no automatic essay-quality score, mandatory AI, or default score fusion.
- Submission uses a server-confirmed, immutable, idempotently created attempt and versioned Text Analysis Core snapshot. Teacher rubric grading and subsequent controlled publication are separate. Practice needs no server submission. Historical Behavior Core exceptions remain unchanged.


## v27: Flashcards — FC-01–FC-04 A–F approved
- **Unscored study/recall exception**: there is no objective scored Check, no original-unit 3/5 cap, no numeric grade and no SRS in v1. Study records visits only. Recall and Review record learner self-rating Known or Repeat only after reveal.
- Ratings are latest unique status keyed by `(publishedDeckVersion, cardId, direction)` with Unrated separate. Front→Back and Back→Front have isolated rating maps. Known/Repeat counts reflect current unique card statuses and do not imply demonstrated correctness.
- Review snapshot queue of currently Repeat cards at cycle start; every member once, changes filter **next** cycle only. Reset clears both directions of current session and session positions. No effect on previous module behaviors.


## v28: Hotspot — HS-01–HS-04 A–F approved
- Three answer interactions: Point, Zone, Outline; Find One / Find Multiple / Find in Order are task patterns. One unique correct target = 1 point; no duplicate target credit.
- Find One / Find Multiple use standard shared 3/5 check budget by original target count. Correct targets lock; wrong marks remain removable/revisable before final check.
- **Hotspot-specific approved final Find Multiple adjustment (HS-04 C):** final score `max(0, correctUniqueTargets - unrepairedFalsePositiveMarks)` (capped by original target count). Deduct only remaining final false-positive responses; do not create negative scores or apply platform-wide penalties.
- **Find in Order exception:** one target per step, **independent 3 checks per step by default**. Failure on step reveals target, scores zero on that step, then advances. No global shared check counter consumption for these sequential steps.
- Outline evaluates shape IoU against authored reference threshold default 65%, teacher-configurable 30–90%. Invalid/open/degenerate/self-crossing outlines repair before Check without spending a check. Final results show target and drawn contour/IoU. Geometry uses normalized source-image coordinate space, unaffected by zoom/iframe.
- This supplements, and does not modify, exceptions for Ordering, Matching line mode, Essay Writing, Flashcards or standard Fill Blanks.


## v29: Word Search — WS-01–WS-04 A–F approved
- Word Search is continuous discovery, not gap Check: immediate 1 point per uniquely located authored target ID; no standard 3/5 Check budget and no single final Check.
- Incorrect, partial, duplicate or interrupted selection never scores or deducts. Hint tiers are unpenalized and tracked. Word list / Clues / Hidden presentation does not change placement correctness.
- Completion: all targets found, manual confirmed Finish, or optional timer expiry. Reveal unlocated words on end only; score immutable. Restart same fixed published grid, clear hints/found/time/score.
- Validate matches against exact authored placement cell run (reverse traversal allowed), not matching spelled letters anywhere. Historical Module 13 Word Scramble uses `WS-AC` IDs too; qualify Word Search acceptance refs with `word-search:`. Other modules' special Behavior rules unchanged.


## v30: Label the Diagram — LD-01–LD-04 A–F approved
- Shared Check budget: 1–5 original scored objects = 3 checks, 6+ = 5 checks. One scored unit = one authored target object, independent of cards or distractors.
- Correct assignments/Type aliases lock after Check and score one point per distinct objectId; incorrect and blank slots remain editable. Do not consume Check until at least one new/changed unlocked answer exists. Repeat or concurrent Check must be idempotent.
- Drag and Click are interchangeable input modes over the same assignments. Numbered is alternative presentation/mobile fallback without score change; Type uses separately authored accepted answers and conservative normalization.
- Duplicate visibly identical card texts are interchangeable for matching target labels even when physical card IDs differ. Explicit Reusable bank cards can fill multiple targets; distractors never earn independent points nor subtract points.
- At last Check reveal correct remaining assignments without credit; completed result immutable, Restart clears answer assignments, locks, counters and hints. Text/Audio/Focus hints do not deduct points.
- Versioned source image/anchors/callouts, geometry safety, error states and accessible assignment are required. Module-specific behavior does not alter other modules' checking and exceptions. No Codex task.


## v31 — Vocabulary informational module exception (Module 21)
Vocabulary has **no evaluated units**. Shared Check, default 3/5 check budgets, grading, corrective locks, attempts, scoring, timers, completion and learner study-progress tracking do not apply. Dictionary/Cards/Reveal/Listen are read/playback views, not assessments. UI selection, Reveal and audio state may be transient only. Keep all other modules' behavior unchanged.


## v32 — Mini Dialogues (Module 22)
- Conversation-first visual Player uses existing Fill Blanks validation & standard global Check behavior; 1 original scored gap = 1 scored unit. 1–5 gaps → 3 Checks, 6+ → 5 Checks, across **all** dialogue blocks together, not per bubble or block.
- One score per distinct correctly solved gap; correct entries lock on Check, incorrect/blank remain editable; last Check reveals remaining keys without awarding credit. No independent penalty for distractors. Prevent repeated/double Checks and require new/changed unlocked answer. Restart resets all learner state.
- Typing / Word Bank / Dropdown are mutually exclusive at **exercise** level. Repeated same-text bank cards distinct in identity but interchangeable semantically. Global bank consumption, per-gap dropdown options, typed canonical and explicit aliases with existing validator.
- Audio policies always (default), after_finish, selected_lines including dialogue-level clips; prevent premature accessibility/media exposure for gated answers. Does not modify other modules' checks; no Codex handoff.
