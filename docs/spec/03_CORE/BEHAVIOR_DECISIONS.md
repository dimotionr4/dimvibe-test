# DimVibe — Behavior Decisions Register

Status: recorded from approved conversation through 2026-10-14.

| Topic | Approved decision |
|---|---|
| Scope | Shared Behavior Core; module-specific logic only where mechanics require it |
| Practice | No stored learner scores or history; 1 target = 1 point |
| Check allowance | 1–5; default 5 |
| Completeness | All required targets must be filled to validate and spend a check |
| Correct after check | Lock, show success indicator |
| Incorrect after check | Show error, allow revision while checks remain |
| Hint timing | Available following second valid check; no penalty |
| Instruction | Initially expanded; collapsible; reset expands |
| Ordinary audio | Unlimited playback independent from hints |
| Answer bank | Replace directly, return displaced item, keep wrong answers until manually replaced |
| Distractors | Allowed and need not be used |
| Duplicates | Separate instances with stable IDs |
| Bank shuffle | On by default, once per run |
| Sentence shuffle | Off by default and only for sentence-block mode |
| Prose order | Never shuffled |
| Completion | 100% or no checks remaining |
| Bottom panel | Fixed inside Player, compact score/progress and primary action |
| Top reset | Small icon top right, confirmation when progress exists |
| Restart | Full learner-session reset, preserve published exercise |
| Text case and whitespace | Ignore case and accidental excess whitespace |
| Punctuation | Ignore incidental final dot/comma/question/exclamation; retain internal apostrophes/hyphens |
| Misspellings | Not accepted |
| Alternatives | Only teacher-authored correct alternatives |
| Audio state on reset | Stop playback |
| Hint state on reset | Re-lock until next second check |

## Clarifications, not new approvals
- When checking after some positions are already locked correct, 'all filled' applies to the remaining required positions; locked correct ones count as complete.
- With a single configured check, the two-check hint unlock never occurs. This should be surfaced in teacher UX, not silently changed.
- Fixed footer is constrained to the Player iframe, not the surrounding LMS page.

## 2026-10-16 approved superseding global check decision (v19)
- **1–5 original scorable units → default 3 checks; 6+ → default 5 checks.** Compute once from total units in the exercise across all sets; teacher override within 1–5, where supported.
- **Ordering remains one final check** with no correction until Start again. Explicit other module exceptions remain valid.
- This section supersedes earlier rows claiming a universal static default of 5.

## Matching MT-05 mode-specific override (approved 2026-10-16)
- `standard`: existing Matching dynamic 3/5 checks (with supported teacher override) and green solved pairs moving below the board.
- `lines_pair_colors`: exactly one final check regardless of count/override, all links remain in place and become green/red, editing then locks, restart resets and reshuffles.
- Priority: explicit mode-level policy > teacher override > global 3/5 default. Matching uses a single answer/grading model for both modes.

## Timeline module override — TL-01 through TL-04 approved (2026-10-16)
- Timeline, like Ordering, uses one immutable final Check, even when more than five events; mode-level policy wins over default 3/5 and teacher override.
- Grade each original event ID by correct canonical **position** (1/0), once per run. Dates are descriptive labels and do not auto-sort; equal labels are allowed with a warning.
- Result retains the student's order (Your Timeline) and additionally shows canonical Correct Timeline; after Check all dates are visible and no rearrangement is possible. New run reshuffles.


## Categories / Sorting (CS-01–CS-04, APPROVED 2026-10-16)
- Apply default 3/5 based on original number of sortable items; no special single-check override.
- One itemId → one categoryId; 1 point once per correctly placed item; correct cards lock, wrong cards are returned to bank on intermediate checks only.
- Final check freezes the learner's original placement snapshot and reveals the correct categories; duplicate submissions are idempotent. No penalty for wrong cards and no ordering requirement inside categories.


## v23: WS-01–WS-04 final decision
- Word Scramble / Phrase Builder / Sentence Builder is one three-mode module, allowing mixed tasks; only one **global** final Check after all tasks complete, then frozen result and Start again.
- One completely correct task = 1 point; identical token occurrences are interchangeable by normalized value (NFC), but case and meaningful punctuation are preserved.
- The Fill Blanks tolerance row above (case/punctuation leniency) does not apply to token-sequence comparison in this builder module.
- Module-level check override supersedes the 3/5 default. No Codex implementation is authorized here.


## v24: Splice final evaluation exception (SP-03 A–F / SP-04 A–F APPROVED)
- Single Word / Word Mosaic Easy / Medium / Hard all use **one global final Check** per exercise run; never 3/5.
- One whole correct word -> one point. Easy fixes the target area. Medium/Hard match completed words against a **multiset** of teacher-authored words irrespective of area index; Medium preserves shown piece-count/capacity constraints; Hard does not expose teacher-specific counts and requires >=2 pieces in each area.
- Identical piece instances may substitute by NFC-normalized text, but cannot be used twice; target-word multiplicity limits credit. Freeze on Check, idempotent evaluation, final feedback, reset.
- This section does not constitute a Codex assignment or an implementation API contract.


## v25: Prepositions / PR-03 and PR-04 approved
- Per-gap grading with main or teacher-approved alternative preposition = 1 point; no penalties or partial points. Original gap count determines 3/5 checks and any teacher override remains under global Behavior Core.
- Correct responses locked, errors editable without key disclosure until final result. Word Bank options remain indefinitely reusable, never consumed; individual gap allowed subsets remain enforceable.
- The local preposition library does **not** perform autonomous grammatical acceptability checks. Correctness derives exclusively from each gap's authored accepted answers.
- Double-Check cannot duplicate scores or external result events. No Codex task.


## v26: Essay Writing / EW-02–EW-04 decisions approved
- Objective word/sentence/paragraph, required/prohibited word and phrase checks are continuously recomputed; do **not** reuse normal 3/5 check loops, scored gaps or auto-revealed semantic keys.
- Strict blocks objectively measurable failed *required* conditions, Flexible warns but permits confirmed submission; advisory conditions cannot block. Quality grade comes from explicitly published teacher rubric, never inferred from condition compliance.
- Immutable attempt, protected review, versioned counts, draft recovery and idempotent server intake are module obligations; no Codex assignment.


## v27: Flashcards / FC-03–FC-04 approved
- Study browses with flips and visited distinct IDs, no ratings. Recall requires flip before self-rating Known/Repeat; latest rating replaces previous by card+direction. Review contains only Repeat of current direction, immutable queue per cycle, at most one appearance per cycle. No unknown auto-enrollment, no infinite requeue.
- There is no automatic grade, Check attempts, 3/5 limit, penalty or scheduled SRS. Summary is descriptive self-report. Published deck changes must not silently rewrite active session progress. No Codex task.


## v28: Hotspot / HS-01–HS-04 approved
- Point hit/Zone ID/Outline IoU (65% default, 30–90% selectable) are separate machine-check types. Unique correct zone gives 1 point.
- Find One/Multiple: global default 3/5 checks from number of original target units, correct lock and wrong revise. HS-04 C explicitly adds final one-point deduction **per remaining false-positive selection** in Find Multiple, floor 0; this exception does not change other modules.
- Find in Order: sequential one-target steps each get independent default 3 checks; step exhaustion reveals answer, scores zero for that step, then continues. No duplicate score on repeated request.
- Invalid geometry cannot spend a check. Show accurate post-final overlays, protect published versions and mobile coordinate transforms. No Codex task.


## v29 — Word Search (Module 19)
- Approved WS-01–04 A–F: target-by-target instant scored discovery, one score per authored unique target; neutral wrong gestures, no 3/5 checks, no negative marks. Optional unpenalized direction/start/partial hints with quota.
- Manual Finish, all-found completion and timer expiry finalize once; reveal does not award points. Reset preserves pinned published grid.
- Beware scoped acceptance namespace: Word Search `word-search:WS-AC-01..36` vs old Word Scramble `WS-AC-01..28`. No changes to the latter.


## v30 — Label the Diagram (Module 20)
- LD-01–LD-04 A–F explicitly approved. Shared 3/5 Check model by original scored object count; one point for each correctly assigned unique object, lock correct, permit errors/empties to be revised.
- Author-selected Drag/Click share same stored assignments and may be switched by learner. Type accepts canonical + explicit alternatives under case/whitespace-normalization only; Numbered is display/entry variant, including mobile fallback.
- Match same-text cards semantically for eligible targets, independent of physical duplicate card IDs; explicit reusable/distractor semantics, no negative scoring. Require new/changed unlocked attempt for Check; idempotent responses.
- Text/Audio/Focus hints unpenalized, results reveal unearned keys without new score; final score immutable and Restart resets. No changes to other modules or Codex.


## v31 — Vocabulary / VC-01–VC-04 approved
Revised VC-01 F expressly prohibits Check, scores, timer, completion gating, attempts, mastery/progress and SRS in this informational module. No shared Behavior Core assessment inheritance. VC-01 A–E, VC-02/03/04 A–F approved; views Dictionary/Cards/Reveal/Listen and audio/UI state temporary only. Author records may be versioned, but learner study results are not written. No Codex task.


## v32 — Mini Dialogues (MD-01–MD-04 A–F)
Module 22 uses one shared Check for all dialogues, 3/5 original-gap-based budget, one point per correct unique Gap ID, correct-lock/wrong-revise and immutable final reveal. One global response mode: Typing, Word Bank, or Dropdown. Speaker/line IDs must not be used as scored keys; every gapId is stable. Identical-text one-use bank cards are interchangeable when valid, with enough copies; manual distractors unscored. Optional line and dialogue audio may be teacher-gated always/after finish/selectively to avoid answer leakage. The Student Player is conversation-first, not prose Fill Blanks. Approved MD-AC-01..36. No Codex task.
