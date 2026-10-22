# Categories / Sorting — CS-01–CS-04

**Module 12 · Functional design fully approved 2026-10-16 · documentation only, NOT a Codex task.**

## Purpose, reuse, contract
Categories / Sorting is a standalone many-items-to-one-category classification exercise. Not Matching: each item has exactly **one** correct `categoryId`, whereas each category can contain many items; no order within a category is graded. Reuse Editor Core, Player Core, Behavior Core, Media Library, Design System (Classic/Comic), Module Registry, publishing/iframe contracts and touch/accessible interactions. Treat module as *designed*, not implemented.

## CS-01 — Concept (A–F APPROVED)
- A: Independent module in registry.
- B: Exactly one correct category per item; many items per category.
- C: Cards may contain text, image, both and optional audio, using shared media IDs/components.
- D: Player supports drag-and-drop and select-item → tap-category without separate mode switch; learner can move unlocked items before Check.
- E: One point per correct item; correct items lock, wrong items return to bank for a new placement, with shared 3/5 default check budget.
- F: Responsive categorized drop areas; mobile, tablet, desktop, LearnWorlds iframe.

## CS-02 — Author Studio (A–F APPROVED)
- Content: exercise title/instruction, categories with stable `categoryId`, required unique non-empty display name and optional description; category add/edit/rename/duplicate/delete/reorder. Renaming/reordering never alters answer identity.
- Items live inside their correct category in the author workspace. Adding/moving an item to a different category updates its sole correct `categoryId`. Each has stable `itemId`; duplication generates a new independent ID, including when duplicating an entire category and its items.
- Item content: visible text and/or image, optional audio; shared Media Library and independent audio/image controls. Bulk paste of text items, one per nonblank line, into a chosen category; skip blank lines and apply duplicate validation.
- Distinguishability: learner-indistinguishable items assigned to **different** categories are publish-blocking; identical items in same category allowed with warning. Different text/image distinguishable to learner may be permitted. Audio distinction can qualify where accessible, genuinely distinguishable and teacher verified; system does not claim semantic audio comparison. Internal IDs alone never establish learner distinguishability.
- Design: `layout=columns` (default) or `stacked`, responsive fallback to a single column when needed; Classic/Comic and Compact/Standard shared styles; avoid individual custom per-card styling builders. Author editor desktop-only; Player responsive.
- Publish requires at least 2 categories, >=1 complete item per category, >=3 items total, unique nonempty category names, one correct category per item, learner-accessible meaningful content, valid mandatory referenced media, and no cross-category indistinguishable cards. Incomplete drafts savable but not publishable. Confirm category deletion affecting existing items; deletion behavior must not leave orphaned correct category links.

## CS-03 — Student Player (A–F APPROVED)
- Start with shuffled bank of all items (stable IDs preserved); show category names/drop areas. Item may be selected then assigned by tapping category, or dragged from bank to category / between categories / back to bank, provided not locked. Selecting another item replaces selection; tapping selected item cancels selection. Category contents grow naturally; empty categories while answering are allowed.
- Drag-and-drop must not hijack ordinary vertical scrolling; touch-friendly alternative via tap, accessible keyboard/focus controls, and prevent accidental activation from audio/image/zoom controls. No learner-facing correctness preview before Check.
- Check only enabled if **every unlocked item is assigned** to a category; already locked correct items count as complete. Incomplete placement consumes no Check.
- On intermediate Check, correct assignments lock in their categories, show green plus accessible icon/text status, score exactly once per `itemId`. Wrong assignments receive red accessible feedback and are returned to Item Bank for retry; teacher's correct category is not exposed while attempts remain. Feedback must not depend on color alone; avoid timer-dependent disclosure/interaction.
- Original total item count sets common default budget: 1–5 scorable items → 3 checks; 6+ → 5, so this module's publishable 3–5 items have 3 checks; >=6 have 5. Supported teacher override 1–5 as Behavior Core permits, evaluated by shared priority rules. Budget does not shrink as correct items lock.
- Finish as soon as all original items correctly classified (100%) or after last allowed Check. At finish, show accumulated points/total and percentage, remaining wrong items and correct category for each, summary/result; editing blocked, Start again resets check count, locks, results and selection and reshuffles bank. Audio playback and viewer controls are independent from assignment actions.

## CS-04 — Final scoring, edge cases, acceptance (A–F APPROVED)
- A: Exactly +1 once per uniquely correct `itemId` assignment; never partial points, proximity bonuses, penalties, or repeated points for already locked elements. Inner-category item ordering irrelevant.
- B: Cross-category visually/operationally indistinguishable cards block publishing; same-category identical cards allowed with warning; text + different learner-visible images may resolve ambiguity; different IDs alone do not.
- C: On **final** Check freeze a snapshot of learner placements, grade correct/incorrect, show red error state and correct category mapping, lock editing and do **not** put wrong items back into the interactive bank for another round. Correct are green and remain in category. If prior attempts have locked items, keep them represented in final results. Final output may use a separate read-only correct distribution.
- D: Duplicate category clones its item IDs independently; warn/confirm destructive deletion with count of affected cards; moving an item between author categories updates correct ID; reorder/rename never corrupts relations; incomplete draft save; bulk paste ignores blanks and validates duplicates; invalid required media prevents publish.
- E: Repeated/double Check must be idempotent for grade, lock state and any result delivery; safe retries do not multiply scores. DnD/touch scroll, oversized category content and iframe boundaries remain operable; Start again clears score, locks, answers, feedback and ongoing media playback.
- F: Acceptance suite **CS-AC-01–26** in `07_DELIVERY/ACCEPTANCE_CRITERIA.md` is approved as scope.

### Recommended implementation-facing conceptual data fields (not an approved wire schema)
- `categories[]`: stable `categoryId`, name, optional description, teacher presentation order.
- `items[]`: stable `itemId`, correct `categoryId`, content/media references; learner placements `itemId -> categoryId | unassigned` and locked correct-ID set.
- Check snapshots and feedback are run state, not a mutation of authored answer key; only server/published source defines correctness. Do not invent new persistence schema before shared contracts are reviewed.

### Integration and priority
- General Behavior Core 3/5 checks applies here, **no single-check exception** for Sorting. Ordering, Timeline and Matching `lines_pair_colors` exceptions remain untouched.
- Category layout is display-only: switching Columns/Stacked cannot change categories, grade or item IDs.
- This document supersedes any earlier placeholder listing Categories / Sorting as unapproved. No source-code changes or Codex instructions authorized by this design signoff.
