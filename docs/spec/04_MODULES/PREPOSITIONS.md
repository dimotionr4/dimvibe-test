# Prepositions — Module 15 (APPROVED FUNCTIONAL DESIGN)

**Approval:** PR-01, PR-02, PR-03, PR-04 A–F approved 2026-10-16. Functional specification, not an implementation authorization. No Codex task was issued.

## 1. Purpose and reuse
Standalone specialized Fill Blanks module. Teachers compose one or more sentences with preposition-only gaps using a locally stored versioned prepositions library. Reuse shared Editor Core, structured Gap Engine, Fill Blanks interactions, Media Library, Design System, Behavior Core, publication/iframe and results. Library suggests *choices*, not automatic grammatical validation. Teacher-defined main and alternative correct answers are authoritative.

## 2. Library and permission model (PR-01 / PR-02 / PR-04)
- Initial curated English categories: Place; Time; Movement & Direction; Other Relations. A canonical entry (stable ID, language, visible normalized form) can belong to multiple categories. `in`, `on`, `at` can occur in both Place and Time.
- Example entries: Place: in, on, at, under, above, below, behind, between, next to, in front of, near, inside, outside, opposite, among. Time: in, on, at, before, after, during, since, for, until, by, throughout. Movement: to, from, into, out of, onto, off, through, across, along, around, towards, past, up, down. Other: with, without, by, for, about, of, because of, despite, instead of, according to. **Seed suggestions require linguistic editorial verification before production release.**
- Multiword prepositions form one atomic selectable option (`in front of`). Deduplicate overlapping categories by normalized visible form while retaining category metadata and stable canonical IDs; distinguish genuinely different visible lexical forms, don't collapse unrelated strings.
- Administrator alone edits the system library, with version/revision and change history. Teacher only selects categories and subsets in *own* exercise, never mutates system library or other teachers' data. Snapshots/version pins preserve published-exercise behavior after library updates.
- Other-language libraries must be curated independently (e.g. Georgian postposition/case complexities); translating English options directly is invalid. No runtime AI or paid dictionary required.

## 3. Author Studio (PR-02)
- Desktop Author Studio: Content / Design / Behavior / Publish.
- Content: select language, one or multiple categories, union of options; toggle/remove prepositions for exercise-level bank; optionally override individual gap choices with a narrower subset. All correct accepted answers must remain in each gap's offered options, otherwise Publish must fail.
- Create multiple sentences, reorder, duplicate, delete; insert one or more independent gap nodes inline in a sentence. Each sentence and gap has persistent unique IDs; representation is structured text with explicit gap nodes, *not* transient `___` string parsing. Editing adjacent text preserves gap identity; duplication makes new IDs. Removing a gap removes only its own settings after confirmation.
- Gap metadata: stable ID, primary canonical preposition, optional alternative accepted IDs, offered option IDs (explicit or inherited), optional explanation and media reference(s). Each gap can have multiple accepted answers. A teacher can create or retain unfinished draft safely.
- Library changes must not silently mutate old published or saved snapshot content. If teacher removes an in-use correct choice, surface blocking validation rather than silently editing correct answer. Show nonblocking warning if exactly one choice is offered. No claimed automated semantic/grammar inference.
- Design: `Dropdown` default (gap-local options) or `Word Bank` (shared selectable options reused any number of times); Classic/Comic, Compact/Standard via shared tokens, responsive line flow; no custom card styling builder.
- Behavior: per-correct-gap unit scoring and global dynamic default 3/5; allowable teacher override governed by existing Behavior Core, not by a new module-specific rule.

## 4. Student Player (PR-03)
- Both modes render coherent flowing sentence text, including multiple independently graded gaps inside one sentence.
- Dropdown: each gap independently lists configured allowed options, no global inventory or consumption. The learner can edit unlocked choices before Check and after a wrong Check.
- Word Bank: select option then select gap; replace previous unlocked answer; the same preposition can be reused indefinitely. Bank entries never disappear, reorder or decrement when used. Gap-specific allowable subset still applies; prevent placing disallowed options with understandable feedback.
- Enabled Check requires every *currently unlocked* gap filled; no Check consumed on incomplete work. Correct responses turn green, gain icon/text semantics, lock and score once. Wrong answers show red with icon, remain editable without revealing the key until final; their red state clears when edited. Corrections do not affect earned points.
- After all gaps correct finish immediately; otherwise finish after effective final Check. Finish locks state, shows learner's submitted responses, correct answer(s) and explanations; Start again resets answers, locks, score, and Check count. In locked correct gaps preserve the learner's accepted alternative, not necessarily the primary choice.
- Must support touch, keyboard, screen reader semantics, text wrapping, long multiword options, audio/image independent interactions and narrow LearnWorlds iframe without popover clipping.

## 5. Scoring & check precedence
- Each original gap = exactly 1 scored unit. Score once per unique gap ID after accepted-answer match, no penalties or partial credit. Alternative accepted choices equally score 1. Gaps may be distributed across multiple sentences. Total N is original number of gaps across entire exercise.
- Shared Behavior Core defaults: N=1–5 -> 3 Checks; N>=6 -> 5 Checks. Teacher may override within global supported settings. This module **does not** use Ordering/Timeline/Splice/WS one-final-Check exceptions. Correct responses remain locked, erroneous responses may be corrected until 100% or checks exhausted.
- Evaluate Check atomically and idempotently, including result emission in iframe; repeat clicks never double-count or double-dispatch.

## 6. Validation and edge cases (PR-04)
- Publish blocks: zero sentences or no gaps; blank/invalid gap; missing accepted answer; missing or empty offered option list; any accepted answer not offered for its gap; missing required media; unresolvable snapshot reference/duplicate inconsistent IDs. Draft saving remains allowed.
- Distinct language/canonical form/ID, category membership, Unicode-safe normalized deduplication of options, stable storage of multiword options. Same choice used in multiple sentences is expected. A single offered answer triggers warning only.
- Adjacent gaps are valid as independent structured nodes, though preview should flag hard-to-read authoring if necessary. Sentence order changes do not alter scores or answer references. Cloning creates new IDs, deleting does not corrupt other gaps.
- Author controls semantic acceptability and explanations; system never claims a competing valid English preposition is wrong *linguistically* beyond the teacher-approved key. Provide a clear author preview.
- Final results and non-color-only indicators, double-Check guard, mobile and keyboard/iframe support are release requirements.

## 7. Acceptance criteria
Normative matrix: `07_DELIVERY/ACCEPTANCE_CRITERIA.md`, PR-AC-01 through PR-AC-28. All approved under PR-04 F.

## 8. Decision / delivery boundary
PR-01 A–F: standalone module, category library, teacher choices, gaps, two display modes, local versioned architecture.
PR-02 A–F: two-level library, merging categories, structured editor, alternatives, Design, safe draft/publishing.
PR-03 A–F: Dropdown/Word Bank, repeated unlimited options, progressive scoring/locking, global 3/5, multi-gap, responsive results.
PR-04 A–F: teacher-authoritative grammar key, stable admin library, safe IDs, validation, robust Player, 28 acceptance cases.
**Specification only**: neither implementation nor a Codex assignment is authorized by this change.
