# Ordering — OR-01–OR-04

**Module 08 · Design approved through 2026-10-16 · Not assigned to Codex**

## Purpose and structural rules
- Ordering supports sequencing of words, phrases, full sentences, process steps and pictures; multiple independent sequences can belong to one exercise (OR-01 A,D).
- Author creates **the correct sequence directly in Author Studio**, and may freely drag/reorder any element or use move buttons. **The current editor order is always the answer key**; any edit to that order updates the answer key automatically. There is no separate answer-position selector (clarification approved 2026-10-16).
- The Student Player **always automatically shuffles** the author's sequence at the start of each run. It must never start in the correct order; there is **no shuffle toggle and no teacher-defined starting order** (final override 2026-10-16).
- Drag and drop by mouse and touch, plus accessible movement controls/keyboard alternative (OR-01 C; OR-03 B,C). Keep normal touch scrolling usable, preferably via a drag handle.
- OR-01 E: **1 point for each element occupying its correct position**. Never award twice for the same element/position; score is calculated once from final ordering per run.

## Single-check behavior — module-specific approved override
- **Exactly one Check action for the entire exercise per run**, even with multiple sequences.
- Until Check, rearrangements are unlimited. On Check, calculate each position once, freeze rearrangement and show which positions are correct or incorrect, along with total points; optionally show the correct item for each incorrect position in the result state.
- No second Check, no provisional locks, no correction cycle, no accumulating points over checks, and no hints that reveal correct positions mid-run.
- **Start again** creates a new run, clears scores/result state, reshuffles each sequence, and permits a fresh single Check. Scores/history of completed runs are not stored.
- This module-specific rule supersedes the shared Behavior Core's normal 1–5 checks / correction flow; implement as a configured policy in common core rather than a duplicate scoring engine.

## Author Studio
- Store elements with stable IDs and one ordered list defining their correct positions.
- Allow insert, edit, delete, reorder by drag & drop and buttons; support multiple sequences with independent instructions.
- Editing sequence order changes the answer key, never just a display-only order. After save/reopen, its correct order must be identical.
- **Visually identical elements inside the same sequence block publishing**; show clear validation identifying duplicates. No interchangeability/equivalence scoring is needed because duplicates are prohibited.
- Compare visible text after whitespace/case normalization for text-only items; compare identical images by media identity and relevant visible configuration; compare mixed items by their displayed components. Any ambiguous or indistinguishable duplicate should be flagged for teacher review and resolved before publishing. Identical items *across different sequences* are allowed.
- Minimum two populated elements per sequence. Empty sequences or elements block publishing; drafts may be retained.
- Media: reuse Media Library and existing picture/audio UI where relevant. No separate media implementation. Specific defaults/layout details in earlier OR-02 proposal are **not independently signed off** unless explicitly covered by final decisions; do not infer new authoring options.

## Student Player
- Show items vertically with natural wrapping on narrow screens; support mouse/touch drag and buttons/keyboard without conflicting with page scrolling.
- Do not reveal the correct answer before the only Check. One Check reveals per-position outcomes across all sequences at once. Results remain viewable until Start again.
- Player responsive in desktop, tablet, mobile and LearnWorlds iframe. Do not persist result history.

## Decision precedence and prior proposals
- **Approved**: OR-01 A–E; OR-03 A–F at time of proposal **as later superseded**; 2026-10-16 user corrections prohibiting identical elements, requiring one final check, automatic shuffle only, and freely sortable correct author sequence.
- **Superseded**: OR-03 proposals about locking correct positions, navigating around locks, repeated checks and 5-check limit; OR-02 proposals to allow duplicates with interchangeability; OR-02 shuffle toggle; OR-04 teacher-defined initial order, duplicate equivalence, cumulative checks.
- **Not formally ratified as a set**: the former OR-02 A–F checkbox bundle and the original OR-04 A–F checkbox bundle. Only individual requirements explicitly confirmed in later turns are final; see decisions register.
- Code, Codex implementation queue and other module specs are unchanged.

## Acceptance
See `07_DELIVERY/ACCEPTANCE_CRITERIA.md`, OR-AC-01 through OR-AC-18 (v17 final revision). 
