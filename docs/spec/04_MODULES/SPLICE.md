# Splice — Module 14 (APPROVED FUNCTIONAL DESIGN)

Status: SP-01 A–F, SP-03 A–F, SP-04 A–F **APPROVED** on 2026-10-16. The two-game-mode and Mosaic three-difficulty decisions were explicitly agreed during SP-02. SP-02 editor details not separately approved remain **design proposals**, and must not be incorrectly presented as approved. These guidelines are for future implementation planning only; **no Codex assignment**.

## 1. Purpose and boundaries

Splice assembles words from **multigrapheme pieces**. It is a distinct module from Word Scramble (letters) and Ordering (ordering arbitrary cards). It can reuse shared token-bank/selection, drag-and-drop, player, media, design and results infrastructure. Teacher-defined words and their fragment order form the authoritative answer. No external dictionary or AI is necessary or required to assert syllable/morpheme boundaries.

## 2. Approved game modes

### Single Word

- Multiple teacher-authored words may form one exercise but the learner sees **one word at a time** with its own shuffled pieces. Navigation before final Check preserves each task's work.
- Learner can select/tap, return, drag/drop and rearrange pieces. Full assembly needed for final Check.
- Each wholly reconstructed word scores exactly **1**, independent of fragment count. Different fragment IDs with the same NFC-normalized content are interchangeable.

### Word Mosaic

- Multiple target words appear as **simultaneous assembly areas** with a **single combined shuffled fragment bank**. The learner selects an active assembly area and taps fragments, or drags to a specific area/position. Fragments can be returned, reordered and moved between areas before Check.
- All pieces are assigned to one area at most once; all pieces must be used for final Check; each area must contain the required amount (Easy/Medium) or at least 2 (Hard).
- The teacher chooses one of three preset difficulty levels; **Medium is the default**.

| Difficulty | Target word labels | Fragment count/slots | Correct-answer matching |
| --- | --- | --- | --- |
| Easy | Shown | Shown | **Fixed**: answer must be in designated target area |
| Medium (default) | Hidden | Shown | **Unordered**: accepted in any area with corresponding piece count |
| Hard | Hidden | Hidden | **Unordered**: accepted in any area regardless of canonical original area, minimum 2 pieces in each |

- Hidden-name areas display a neutral Word 1/2/3 identifier; this is not an answer label. Hard retains the *number of target words* as a visible fact. It does not enforce a teacher-specific fragment count per area or silently reveal it.
- In Medium and Hard compare learner-produced words against the **multiset of teacher target words**, with each canonical occurrence usable once. Correct targets in the same content class may occur multiple times and count by multiplicity. In Medium also validate fragment-count compatibility of the area. A word's spelling can match but cannot earn credit if it requires violating a given area's visible fragment-count rule.
- Equal piece text occurrences retain independent IDs for move operations, but may substitute for one another when comparing reconstructed text; a piece occurrence cannot be spent twice.

## 3. Editing and splitting

Approved conceptual direction from SP-01: one author-defined source word per word task, automatic approximate splitting into Auto/2/3/4 or teacher-chosen manual boundaries, with validation that nonempty pieces reconstruct the word exactly and that splitting respects Unicode extended grapheme clusters. Technical chunking **must not** claim linguistic syllable correctness. A teacher may revise a division. Full author-interface details (visual split UI, delimiter syntax, bulk paste/import, specific stored fields, stable-fragment-ID strategy, Tiles/Paper Pieces implementation, and further SP-02 subdecisions) remain **proposed pending a distinct approval**, even though general Tiles/Paper Pieces options were approved in SP-01 F.

Keep optional hint, audio, image and explanation consistent with shared components. Media controls must not inadvertently pick up, move or consume pieces. Teacher can save incomplete drafts. Validate missing/inaccessible required content before publishing.

## 4. Learner interactions and feedback

- Tap fragment -> append it to current word/active Mosaic area; tap a selected placed fragment -> return to bank; alternative mouse/touch Drag & Drop plus accessible reordering/movement fallback. The actual interaction should avoid scroll hijacking and iframe clipping.
- All tasks/areas must be complete before global final Check; incomplete interaction consumes **no** check.
- **Exactly one final Check for the entire Splice exercise**, irrespective of words or pieces. This module-specific override takes precedence over shared 3/5 defaults and teacher override. Check is atomic/idempotent; lock all pieces afterward.
- Correct complete word -> 1; incorrect word -> 0; **no per-piece/position partial points**, no penalty. Keep learner arrangements frozen and mark word outcomes with visual and text/icons, display score, canonical correct assembled words and segmentation on request/results, and offer Start again. Restart resets all run-state, reshuffles, and does not alter teacher content.

## 5. Ambiguity, publication and equality

- Only explicitly teacher-authored target words are accepted; coincidental alternate real words are not scored unless in the authored multiset. Do not promise lexical disambiguation/dictionary searches.
- Word/piece comparison uses Unicode NFC consistently while preserving meaningful case and punctuation. Exact fragment identities are stable for the player; text-value comparison prevents false negatives for duplicate fragments.
- Reject an invalid task when pieces cannot reconstruct its word, there are fewer than 2 nonempty pieces, required assets are unavailable, or a playable different shuffle cannot exist (when the word requires a meaningful reordering task). The distinction between 'possible other lexical words' and actual invalidity must be maintained: plausible alternatives generate teacher warnings/preview opportunities, not automatic publishing bans.
- For Hard, each area must have at least 2 pieces, all pieces must be assigned, and all areas must be nonempty; for Easy and Medium each area must match its visible required count. In Medium, the canonical number of pieces associated with a target constrains the applicable areas.
- Any design for *lexical* ambiguity avoidance beyond teacher-authored target acceptance is not approved; never silently expand answer keys based on a dictionary.

## 6. Design / accessibility

- Approved SP-01 F: Tiles and Paper Pieces renderings are alternative presets on shared Design System. Each must preserve readable text, focus indicators, selection, correct/wrong feedback with non-color status indicators, and responsive mouse/touch/keyboard fallback, including LearnWorlds iframes.
- Maintain common Classic/Comic and Compact/Standard tokens as applicable; do not introduce a separate fragment styling engine.
- Learner Player is responsive; Author Studio remains desktop-only per product-wide decision.

## 7. Acceptance

- All **SP-AC-01–30** in `07_DELIVERY/ACCEPTANCE_CRITERIA.md` are approved as final acceptance criteria by SP-04 F; these cover editor controls, both game modes, levels, single final check, multiset score, invalid data, restart and device integration.
- Implementation schema/API are **not established by these docs**. Use shared contracts review before assigning code work.

## 8. Approval trace

| Stage | Status | Notes |
| --- | --- | --- |
| SP-01 A–F | Approved | Separate module; Auto/Manual; Auto/2/3/4; multiword; tap+drag, one-check/one-point; Tiles/Paper Pieces |
| SP-02 mode extension | Approved | Single Word vs Word Mosaic; simultaneous areas and shared bank; easy/medium/hard; medium default; degree of hints and cross-area grading |
| SP-02 detailed editor proposals | **Not separately approved** | Avoid treating all editor-detail proposals as final commitments |
| SP-03 A–F | Approved | Controls, active area, hard min 2, multiset semantics, one final Check, results and accessibility |
| SP-04 A–F | Approved | Scoring, ambiguity, author/player validation and **30 acceptance cases** |
