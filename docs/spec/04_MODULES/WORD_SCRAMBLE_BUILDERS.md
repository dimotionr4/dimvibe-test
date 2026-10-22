# Module 13 — Word Scramble / Phrase Builder / Sentence Builder

**Status: DESIGN APPROVED.** 2026-10-16. WS-01, WS-02, WS-03, WS-04: decisions A–F at each stage approved. Documentation only; no Codex assignment or code changes.

## Purpose / shared architecture
One module supports three task modes: `word` (assemble word from grapheme clusters), `phrase` (assemble phrase from words/fragments), `sentence` (assemble sentence from words/fragments with punctuation). Individual tasks of different modes may coexist in one exercise. Reuse Editor Core, Player Core, shared Media Library, Design System (Classic/Comic, Compact/Standard) and ordering/movement primitives. The exercise is distinct from Ordering: rebuilding text, Unicode tokenization, permitted repeat tokens, text punctuation and grading by complete task.

## WS-01 — Concept (A–F APPROVED)
- A: one module, three submodes.
- B: assemble text from shuffled letters, words or fragments.
- C: repeated visually equal items are valid; each occurrence has an independent stable ID.
- D: teacher enters correct text; system auto-segments; teacher may manually adjust boundaries.
- E: tap and drag-and-drop interaction, reordering/removing fragments, mouse and touch.
- F: multiple tasks per exercise and a shared result.

## WS-02 — Author Studio (A–F APPROVED)
- A: shared editor asks for correct answer and mode; word mode defaults to Unicode *grapheme cluster* segmentation; phrase/sentence default to splitting by words. Teacher may refine.
- B: teacher can split/merge adjacent elements, edit/add/remove/duplicate/reorder; no loss or accidental reuse of stable token IDs. Author-defined canonical token order is the answer key; learner receives a shuffled bank.
- C: preserve Unicode graphemes (including combining marks), displayed case, apostrophes, hyphens and punctuation. Attach incidental punctuation to relevant word by default, e.g. `book.` or `Hello,`; preserve text spacing/reconstruction rules and original teacher-written answer.
- D: multiple tasks, including a mixture of modes, can coexist; each task has independent tokenization, hint, content, media and canonical order.
- E: task-level optional instruction, hint, image, audio and post-check explanation using Media Library; Design modes Tiles (default) and Chips, common Classic/Comic and Compact/Standard responsive tokens.
- F: publish requires at least 1 task and each task at least 2 nonempty tokens, valid text reconstruction and required media; incomplete drafts save. Repeat tokens are never an automatic publication error.
- On editing original full answer after custom segmentation, show mismatch and offer explicit **Regenerate tokens from answer** with warning rather than silently discarding manual splits. Validate that displayed rendered answer reconstructs teacher original accurately according to mode-specific punctuation and whitespace rules.
- Teacher edits desktop-only; Player supports mobile, tablet, desktop and iframe.

## WS-03 — Student Player (A–F APPROVED)
- A: tap token in bank adds it to the end of answer; tap token in answer returns it; drag bank↔answer and reorder answer; accessible move controls permit completion without dragging. Each token occurrence can be placed once only.
- B: **one final Check for the whole exercise**; only enabled once ALL tasks use all required tokens and answer slots are complete. After Check grading and answers freeze. `Start again` resets the full run and reshuffles. This is an explicit module-level exception to global 3/5 default, not a teacher-adjustable repeat-check policy.
- C: exactly one point per entirely correct task (word/phrase/sentence); no fractional positional points and no penalty. Maximum score = original number of tasks, regardless of number of tokens. Incorrect task = zero.
- D: identical repeated tokens are interchangeable by value, not ID. Preserve distinctions of case and punctuation, canonical equivalence under Unicode NFC. Example: two `P` occurrences in `APPLE` can swap without affecting correctness.
- E: Player shows one task at a time; navigate between tasks before Check and preserve answers; one global Check button gated by complete assembly of all tasks.
- F: results show each task's correct/incorrect status; for wrong tasks show learner submitted text, canonical correct full answer and optional explanation; independent audio/image interactions; accessible, responsive viewport/iframe and safe restart.

## WS-04 — Edge cases and final acceptance (A–F APPROVED)
- A: binary score by whole task, no partial credits/penalties, never awarded twice due to repeated Check delivery.
- B: equal displayed values across distinct IDs must not count as errors; compare normalized NFC **without** lowercasing, stripping meaningful punctuation or conflating lookalikes from different scripts. Grapheme-aware segmentation is required. No extra whitespace errors from rendering automatically joined fragments.
- C: shuffle at each run should yield a visibly distinguishable permutation from correct token-value sequence whenever possible; if *all* token values are visually identical so no distinguishable permutation exists, block publication as unsolvable scramble. Do not promise a distinct permutation on every restart where limited arrangements exist.
- D: prevent publication on empty/missing tokens, invalid reconstruction or broken required media; protect handcrafted segmentation on original answer edits; explicitly regenerate after confirmation; incomplete drafts allowed; cloning tasks creates distinct IDs.
- E: one check submitted only when every task assembled; check is atomic/idempotent, locks after result, shows correct full answers and supports new play with full reset/re-shuffle; double-click cannot duplicate score/event.
- F: acceptance suite WS-AC-01–28 is authoritative and enumerated in `07_DELIVERY/ACCEPTANCE_CRITERIA.md`.

## Final-state consistency and edge clarifications
- Scoring compares a task's **ordered sequence of token values** (Unicode NFC normalization) rather than token IDs; whitespace/punctuation formatting is reconstructed from teacher-approved segmentation and full-answer source. Never conflate the separate globally configurable Fill Blanks input-tolerance rules with this assembled-token module.
- Same-valued tokens have distinct stable instance IDs for drag/drop, list keys, storage and duplicates. One occurrence cannot be spent twice. A stable taskId identifies each task.
- The Player checks all tasks at once; per-task preview/navigation is not itself an attempt. Early completion requires explicit final Check, even if all answers happen to match.
- When a task's token value sequence has only one distinct ordering, publishing is invalid even if >=2 token instances.
- Reset ends audio playback, removes prior feedback/score, preserves published teacher content and shuffles token banks again. Interactions with media must not trigger token pickup or reorder; touch scrolling remains usable inside an embedded iframe.
- The new mode does NOT alter Ordering duplicate-block rule, Ordering/Timeline positional scoring, Matching's mode-specific policies, or general 3/5 checks for other modules.

## Implementation-facing conceptual data (NOT an approved storage schema)
- `tasks[]`: `taskId`, `mode`, `originalAnswer`, `canonicalTokens[]` with occurrence `tokenId` and text/whitespace attributes, optional instructions/hints/explanations and media refs.
- Learner run: ordered selected `tokenId` list per task; a token may appear in exactly one place; optional bank order; global checked flag/result; `Start again` wipes learner run only.
- Any persistence and publication wire format must pass shared contracts review before implementation. These are behavioral requirements, not instruction to Codex.
