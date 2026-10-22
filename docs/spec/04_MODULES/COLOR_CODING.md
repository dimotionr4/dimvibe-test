# Color Coding — CC-01–CC-04 (Module 09)

**Status:** APPROVED DESIGN (2026-10-16). **Implementation:** not assigned to Codex.  
**Normative authority:** approved CC-01 A–E, CC-02 A–F, CC-03 A–F, CC-04 A–F; common Editor Core, Player Core and Behavior Core remain authoritative for shared features.

## Purpose and interaction

Students read ordinary text and classify **individual word occurrences** by choosing a named, colored category then tapping a word. A second tap with the *same* selected category removes the mark; tapping with a different category changes the mark. This is **not** a phrase-highlighting tool. Unmarked words can be neutral by teacher design; no answer location or category is shown in advance.

## Author Studio

- Teacher enters ordinary text, no handwritten markup codes such as `[word|cat1]`.
- Teacher defines **exercise-wide** categories with stable IDs, unique nonempty names and distinct colors from a compact accessible palette. Names should be normalized for duplicate validation (trim and case-fold). Category changes update all passages by reference, never by renumbering.
- Add/rename/change color/remove categories. Deletion of a category requires confirmation showing the affected mark count; after confirmation only associated classifications are removed, not words/text. Unused categories are allowed with a warning, not publication-blocked.
- Assign categories to individual word occurrences by tapping a word with an active category, including independent occurrences of identical words. Teacher can unassign a mark or replace it with another category.
- Preserve punctuation, spaces, line breaks, paragraphs and source text. Punctuation attached to a word is displayed normally but is not independently classifiable. Multiple-word ranges are out of scope.
- Use stable per-occurrence word IDs and category IDs; never use positional array indices as durable identifiers. When passage text is edited, preserve unambiguously mapped tokens/marks. Flag damaged/ambiguous marks for review and block publishing until repaired; unrelated marks remain intact. Avoid treating a mere positional shift as loss of all marks.
- Support multiple independent text blocks with collapse/expand, creation, duplication, deletion and sorting using shared Editor Core. Duplicated blocks get new block/word/mark IDs but refer to the same shared category IDs.
- Drafts may be incomplete. Publishing requires at least one category, at least one nonempty text block, at least one classified word in the exercise, valid category IDs for all marks, no unreconciled damaged marks, and unique nonempty names and colors. Other neutral words are valid. Unused categories trigger only a warning.

## Student Player

- Named category palette displayed above current text, shared across blocks; selected category indicated by a visible outline/check in addition to its color, with sufficient text contrast.
- Tap individual word to color/uncolor/recolor. Separate occurrences of identical word are independent. Preserve word order, spacing, punctuation and paragraphs. No permanent box decoration around each word is required in the final text display.
- Display modes: **one text at a time (default)** with Back/Next, or **all texts** stacked. Switching modes does not erase marks. Palette remains consistent.
- Mobile/tablet/desktop responsive within LearnWorlds iframe; categories wrap, words remain touch accessible, no horizontal scrolling or nested text scrolling. Keyboard interaction and non-color cues for choice/feedback are required.

## Check, scoring, feedback

- Shared Behavior Core check policy (1–5 checks, default 5), successful answers lock; score **1 point per correctly classified teacher-marked word**, once only. No fractional or negative points. Neutral words colored by student or teacher-marked words assigned the wrong color are incorrect attempts; missing required marks score zero.
- **100% requires both** all teacher-marked words classified correctly **and zero false/incorrect student markings**. Do not treat marking every word as full credit.
- Checking is enabled after at least one student word is colored because learner cannot know total correct targets upfront; no forced completion of undisclosed positions.
- After check, correct word/category pairs lock; wrong category and colored neutral words can be edited/unmarked. Incorrect words may be identified as failed attempts, but do not reveal the correct replacement category or previously unmarked target positions until the run ends. Maintain correct cumulative score without double counting.
- End at 100% or exhausted check limit. Final review may expose all true categories and neutral words; Reset starts clean without saved individual results. Hints/general player behavior use shared cores, not a bespoke Color Coding engine.

## Edge cases and guardrails

- Names and colors unique among categories; missing names/colors or dangling references block publishing.
- Unused categories: warning only. Two identically spelled words at different positions: independent word occurrence IDs.
- Deleting a used category removes its marks only after confirmation; changing colors/names preserves marks. Partially damaged text marking blocks publishing, not saving a draft.
- Category styling must remain meaningful with labels, active indicators, success/failure indicators and sufficient contrast even for low color discernment; do not introduce a new mandatory patterned palette in this version.
- Shared UI and checking logic take precedence over divergent prototype counter/streak mechanics; no additional Codex task or implementation is implied.

## Acceptance

See `07_DELIVERY/ACCEPTANCE_CRITERIA.md`, **CC-AC-01–CC-AC-18**. Decisions D-070–D-075 in `DECISIONS.md`. All further enhancements need separate approval.
