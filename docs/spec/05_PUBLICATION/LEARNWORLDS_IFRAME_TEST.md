# DimVibe — LearnWorlds iframe acceptance test

**Status:** planned, not run. Existing working prototype iframe only confirms LearnWorlds can display that URL, not that remote exercise updates refresh without changing code.

## Preconditions
- Deploy test Player endpoint capable of resolving published exercise by immutable public `exerciseId`.
- Enable needed framing/CSP response headers for actual LearnWorlds learning activity.
- Publish example Fill Blanks exercise as version 1; obtain iframe code pointing to ID only.

## Test cases (must pass)

1. **Initial embed** — Paste generated iframe once into the actual LearnWorlds Embed activity; open as a learner. Player loads and shows only learner functionality; no editor.
2. **Live update from DimVibe** — Change draft title/text and design, verify LearnWorlds still shows old published version before republishing; click Publish changes, reopen/reload LearnWorlds activity without touching embed code, verify latest published version loads.
3. **Running session isolation** — Start exercise in one learner window, republish from another window; initial learner can finish unchanged version; a new/reloaded window gets updated version.
4. **Media** — Image, ordinary audio, hint audio and image references load and play through iframe (including cross-origin policies).
5. **Player viewport** — Test 600 px on desktop and mobile, scrolling long text, footer staying visible within Player, header reset, soft keyboard not obscuring focused gap, tap and drag interactions.
6. **Unpublish** — Unpublish published exercise; same iframe displays clear unavailable message; republish restores at same URL.
7. **Security** — Public URL cannot read draft or Teacher/Admin APIs; owner permissions enforced; no learner grade/session data persisted.
8. **Cache correctness** — After publication, newly loaded Player fetches new active version (no stale intermediary caching); within one running session loaded version stays fixed.

## Result log
Record browser/device, LearnWorlds activity type, original iframe snippet, Pass/Fail for each case and observed problems. Resolve failures before treating dynamic publishing as production-ready. If ID-only dynamic iframe fails due to LearnWorlds restrictions, revisit integration rather than silently reverting to full-JSON copy.
