# Timeline — TL-01–TL-04

**Module 11 · functional design approved 2026-10-16 · specification only; NOT a Codex task**

## Purpose and relation to Ordering
Timeline is a standalone chronological ordering exercise reusing Ordering's stable IDs, reorder UI, one-final-check grade mechanism, and shared Player/Media/Design/Publish interfaces. Each event has a display date label and event content. Unlike general Ordering, Timeline includes date visibility configuration and a full Correct Timeline display following the one final Check. It is NOT a separate scoring engine.

## TL-01 — Concept (A–F approved)
- Separate module `timeline`, not merely an Ordering skin.
- Each event contains a date/time label and an event. An optional image, audio, and explanation may be attached via shared Media Library.
- Teacher may hide the date until Check (default); the alternative shows dates from the start.
- After Check dates are visible and an additional **Correct Timeline** section presents the full canonical order.
- Student ordering works with drag-and-drop and up/down buttons, mobile touch supported.
- **Exactly one final Check per playthrough**, then an immutable result and Start again.

## TL-02 — Author Studio (A–F approved)
- Content tab: exercise instruction/title and a directly ordered list of events; this list **is the answer key**. Teacher can add, edit, duplicate, delete, freely drag-and-drop and move via controls. Moves preserve stable event IDs and attached media; duplicates get new IDs.
- Each event: stable `eventId`, required `dateLabel` (arbitrary user-facing text: e.g. `1914`, `July 1969`, `44 BC`, `18th century`), event content (text and/or a clearly distinguishable image), optional media/audio and explanation. Display label is separate from canonical `orderIndex`/list position.
- No automatic date parsing or numerical chronological sorting is assumed. The teacher determines canonical event order through the list, including identical date labels or periods.
- Design setting `dateVisibility`: `after_check` (default) or `always_visible`; no in-Player student toggle.
- Publish requires >=2 complete events, date label for each, meaningful learner-visible event content, valid required media references, and distinguishable cards as they appear **before** Check (so differing hidden dates alone do not make duplicate cards distinguishable). Save incomplete drafts without publishing.
- Duplicate date labels trigger a non-blocking warning: teacher explicitly verifies the canonical ordering; they do not silently determine or alter it.
- Common Design System cards, shared media controls, no bespoke per-card styling interface.

## TL-03 — Student Player (A–F approved)
- Each new run uses the published canonical list and automatically shuffles event cards. Shuffle does not change IDs, date labels, content or answer key. A shuffled start may by chance equal the solution; do not change the grading rule if so. Re-run requests a fresh shuffle.
- Mouse/touch drag-and-drop and accessible up/down movement controls. Whole event cards move together; audio playback and image viewer are independent of reorder gestures; mobile scrolling remains usable.
- Date labels are hidden until Check by default, or visible from the start under teacher config.
- Check scores the **position** of every event against its canonical ID at that index; 1 point for each exact index, 0 for other indices, no partial credit, penalties, bonus points or duplicate scoring. Result `correctPositions / totalEvents` and percent. A single check evaluates all positions, even if the student has never moved a card.
- Immediately after Check, freeze ordering; reveal all dates, show green success/red error per position with accessible symbols/text; preserve learner's submitted order in **Your Timeline** and show all event cards in canonical order under **Correct Timeline**. The correct reference section is not an edit of the learner's graded list.
- After Check, allow read-only result and Start again only. Reset clears attempted order, score, exposed result/feedback, and media playback; reshuffles on new run.

## TL-04 — Edge cases, grade rules and acceptance (A–F approved)
- Equal display dates are permitted with warning; teacher-defined canonical order remains determinative. Unclear periods and BCE date labels remain text; no implicit auto-sort.
- Publish-blocking: fewer than 2 events, missing date labels, absent event contents, unresolved essential media, or two learner-indistinguishable cards in same timeline (particularly when dates hidden). Optional audio may be absent. Incomplete drafts can still be saved.
- Double-tap and simultaneous Check requests are idempotent: grade/finalize only once per run and do not duplicate events, score records, or LMS results.
- Media overlays pause reordering; playback and image zoom cannot reorder. Touch drag must not prevent natural page/iframe scrolling; line wraps and responsive layouts do not detach associated dates/media.
- Zero movement may still be submitted. Already-correct shuffled order earns full score. No second Check, no correction after finalization. Next run clears state and reshuffles.
- Single-run scoring uses event IDs rather than date labels or text labels, and exact target positions. Example: canonical `[A,B,C,D]`, learner `[A,C,B,D]` yields 2/4, not 0/4 and not 4/4.
- Do not introduce changing dynamic 3/5 checks for Timeline: module-specific 1 final Check supersedes shared defaults and teacher overrides, exactly as Ordering.

## Proposed stable published module data contract (design-level, implementation can align with common schema)
```json
{
  "moduleType": "timeline",
  "instruction": "Arrange the historical events in order",
  "design": {"dateVisibility": "after_check"},
  "events": [
    {"id":"e1","dateLabel":"1914","text":"World War I begins","imageId":null,"audioId":null,"explanation":null},
    {"id":"e2","dateLabel":"1939","text":"World War II begins","imageId":null,"audioId":null,"explanation":null}
  ]
}
```
The published array is canonical order. Do not give the student the answer order as a visible index; use scoped publication/Player contracts to deliver required grading data safely. No date-parsing algorithm is required.

## Acceptance
See `07_DELIVERY/ACCEPTANCE_CRITERIA.md`: **TL-AC-01–22**. Tests for date-hidden identical cards must use learner-visible representation. General requirements for accessibility, authorization, publication snapshots, iframe integration, and media apply without modification.

## Approved vs not approved
TL-01 A–F, TL-02 A–F, TL-03 A–F, TL-04 A–F are approved. Unrequested features (automatic parsing, auto-sort, advanced date ranges, multiple mandatory retries, time-based bonus, auto-generating AI historical chronology) are **not** approved. No Codex task is created by this document.
