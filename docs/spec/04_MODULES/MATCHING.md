# Matching — approved design MT-01–MT-04

**Status:** functional design complete, approved 2026-10-16. Documentation only, not a Codex development assignment.

## Scope and model (MT-01 A–F)
- Matching is one-to-one: each left item has exactly one unique right partner, and vice versa. Each pair carries a stable pair ID; learner mappings are keyed by those IDs, not screen positions.
- Multiple independent matching sets may belong to one exercise. Each set has its own instruction and at least two pairs. Exercise-wide Check and Behavior Core budget cover all sets together.
- Each side can contain text, image, or mixed text/image, plus optional audio. Use existing Media Library, viewer and media sizing; playing audio or opening a viewer must never select/connect a card.
- At session start, shuffle both columns independently; their order remains stable within a run until solved cards are removed, and refreshes on Start again.
- Scoring is one point per correctly matched pair. No partial/negative points and no double counting across checks.

## Author Studio (MT-02 A–F)
- Teacher creates the answer key by entering left and right sides **in the same row**; no manual drawing/link wiring. Edits preserve the pair's stable ID.
- Add, reorder, copy, and delete pairs; add, reorder, copy, collapse, and delete sets with shared Editor Core. Copies get fresh set/pair/card instance IDs but preserve intended internal correspondences.
- Shared content editor supports text, image, mixed, optional audio. Common Classic/Comic styles; compact or standard card size, shared text alignment/image sizing. Avoid per-card layout builder.
- Duplicate indistinguishable items **within the same column of one set** block publication; the same content in another set or in opposite columns is permitted. Compare learner-perceptible content (normalized text, images, distinguishing audio), not hidden record IDs. Duplication actions allowed in drafts, flagged before publish.
- Publishing requires at least one set, at least two complete pairs **in every set**, nonempty left and right content, resolvable mandatory media and valid one-to-one links. Drafts can be incomplete. Optional missing audio is not blocking.
- Pair reordering does not alter correspondence. Destroying a pair does not damage any other pair or set.

## Student Player (MT-03 A–F, including approved revisions)
- Two responsive columns, with tap-left then tap-right as primary touch/keyboard-operable interaction. Clicking selected left again cancels selection; selecting another left switches active source. Drag from a handle to the right is an optional alternative, creating a **link** rather than rearranging card order. Page scrolling must not conflict with dragging.
- A left card can have only one right partner. Assigning a different right item replaces its previous link. Selecting an occupied right item removes its previous **unlocked** link, then assigns it to the new left. Allow explicit unlink for unfinished connections.
- Created connections have matching soft-color backgrounds and numeric tags; these indicate correspondence, **not correctness**. No crossing connector lines are required by default. Clear non-color status cues and accessible names required.
- Before each Check, every unresolved left card across all sets must have exactly one linked unresolved right card; otherwise Check disabled, no budget consumed.
- Following a valid check, **correct links move as complete pairs into the green solved section beneath the active work area**, both cards lock and leave the two-column work area. Wrong pairs remain above with red feedback and are automatically unlinked for the next round; their error state remains discernible until learner begins a new connection, then returns to neutral. Wrong feedback must not reveal the correct partner.
- Later checks score newly solved unique pair IDs only; previously solved green pairs remain below, are not re-evaluated or awarded twice. Remaining cards stay available. A lone unresolved pair still requires explicit learner connection and a valid Check; never auto-score it.
- For multiple sets, show one set by default or all sets stacked; changing view preserves links/solved state. Solved sections are associated with their sets; aggregate score and controls are exercise-wide.
- Finish on 100% or spent check budget. Final state is read-only, shows score, green solved pairs, and optionally reveals correct matches for the remainder in shared results. Start again resets all links/checks/locks, independently re-shuffles columns and stores no learner history.
- Responsive on phone/tablet/desktop/LearnWorlds iframe; audio and zoom remain independent of matching actions.

## Global approved check policy (Behavior Core; applies to Matching)
- Budget computed from **original total scorable units for the entire exercise**: 1–5 pairs = 3 checks by default, >=6 pairs = 5. A teacher may override within 1–5 where supported; this override does not mutate global default.
- Remaining unresolved pairs do not reduce the budget. This global behavior applies to compatible modules based on their own scorable-unit count. **Ordering retains its approved one-check policy**.

## Feedback and edge cases (MT-04 A–F)
- Only valid complete checks expend attempts. No auto-correct before final review. Green solved pairs are immutable; false/red feedback only concerns learner's chosen pairing.
- Colliding/right-occupied reassignments maintain one-to-one invariant. Deletions and copies in Editor keep consistent IDs/references. Missing required media, empty pair, duplicate ambiguous column elements, and sets under two pairs prevent publishing, not saving draft.
- A valid completed session at 100% ends early even when checks remain. At zero checks, correct-answer review is allowed and all interaction frozen until Start again.
- Module-specific acceptance suite **MT-AC-01–20** in `07_DELIVERY/ACCEPTANCE_CRITERIA.md`; common Behavior Core checks also apply.

## Supersession notes
- Previously proposed leaving correct matches in the original columns is superseded by **move down into green solved area**.
- The previous blanket default of 5 checks is superseded by the approved global dynamic 3/5 policy, except Ordering and other expressly approved module exceptions.
- The older generic rule that incorrect bank assignments remain linked until changed does **not** override Matching's approved auto-unlink behavior after Check.

## MT-05 — Approved Design display modes (2026-10-16; supersedes conflicting MT-03/MT-04 presentation rules)

Teacher-facing Design setting **Pair visualization** supports exactly two modes. Default = `standard`.

### `standard` — existing behavior retained
- Show paired cards with matching soft colors and numeric connection markers, without connector lines.
- Valid Check budget is the Behavior Core default based on original exercise-wide pair count: **1–5 pairs = 3 checks; 6+ pairs = 5 checks**, unless an eligible teacher override applies.
- Each correctly linked pair **leaves the active columns and moves to the green solved section beneath the work area**, locked. Incorrect pairs remain above, display red feedback, and become available to reconnect for subsequent checks.
- Accumulated scoring and all previously approved MT-01–MT-04 Standard behavior remain active.

### `lines_pair_colors` — optional visual mode with one-check final evaluation
- Display a visible connector **line** between each learner-linked left/right card, using the **same temporary, distinguishable pair color** for the line and both cards. Before Check, pair colors represent the learner-created links **only**, never correctness.
- Support the same one-to-one linking model, click/tap left then right, drag-and-drop as an alternative, independent column shuffling, media controls, and all sets sharing the exercise-wide Check action.
- **Exactly one final Check per full exercise run**, regardless of pair count, teacher manual override, or the global 3/5 default. This setting is an explicit Matching-specific override in Behavior Core. Enable Check only when every left card across all sets has one linked right card.
- On final Check, **all cards remain at their current positions in their two columns**. Correct links **and both corresponding cards** change to green; incorrect links and their cards change to red. Connection lines remain visible in the same status colors. Use accessible status icons/text as well as color.
- Freeze the entire matching board immediately after Check; **no second attempt, re-linking, removal, or relocation to the green solved section** in this mode. Show score/percent and **Start again**. On restart, clear links and result colors, reset count, and independently reshuffle the two columns.
- If the common final-results facility can show the correct matches, present them through an explicit review action **without overwriting the learner's red/green submission or rearranging the graded board**.
- Connector lines must track card positions and size changes during responsive layout, font wrapping, scrolling, and iframe resizing; do not obstruct clicking, audio, image zoom, or accessibility. Narrow/mobile layouts retain two readable matching sides where practical, otherwise provide a usable accessible layout with clear corresponding endpoints. No horizontal clipping of matching controls.

### Separation of data and presentation
- Switching the teacher's Design setting changes the Player visualization and its Check policy; **it does not change pair IDs, correct associations, pair count, stored media, or scoring definition** (1 correctly matched pair = 1 point).
- The chosen mode is part of the published exercise configuration; do not switch modes within an active learner run. Standard and Lines use the same shared matching data/model and grading logic.
- This MT-05 section has priority over older statements implying that all Matching sessions have 3/5 checks, all correct pairs move down, or no connector lines are present.
