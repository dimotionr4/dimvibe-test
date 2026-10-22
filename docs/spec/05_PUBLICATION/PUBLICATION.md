# DimVibe — Publication / Publish tab (MVP)

**Status:** Functionally approved 2026-10-14, subject to LearnWorlds integration acceptance test.  
**Authority:** This document supersedes prior `05_PUBLICATION/PUBLICATION.md` where it described teacher-facing version history and rollback as MVP functionality.

## Product purpose
Teacher authors and publishes exercises through DimVibe Author Studio; learners see **only the lightweight Student Player** embedded as an activity in LearnWorlds. Embeds are public-by-link practice content, not examination or grade reporting. No student logins or recorded learner scores.

## Minimal Publish tab UI
1. **Player preview** for desktop/tablet/mobile, reading the current draft; only authorized Teacher (owner) and Administrator can access draft preview.
2. **Primary action:** `Publish` before first publication, `Publish changes` afterwards. Saving drafts NEVER publishes.
3. After first publication: permanent URL; `Copy link`; `Copy iframe`.
4. Compact `...` menu for unpublish and further authorized management. Complex version picker, visual diff, teacher-facing rollback and manual history UI are **deferred beyond MVP**.
5. States: Draft / Published / Unpublished / Unpublished changes (draft differs from live publication). Use one unambiguous status at a time; draft changes should be indicated even when a published version remains live.
6. Publication validation: valid module content, required answer mappings, supported behavior/design schema, media availability, and server-side ownership/permissions. If validation fails, do not modify the active publication and show actionable field-level errors.

## Embedding approach
The prior **working** LearnWorlds iframe used `https://dimvibe-prototype.ai.studio/?embed=true&project=<URL-encoded full exercise JSON>` at `width=100%`, `height=600px` and `frameborder=0`. That proved external iframe rendering in that activity, **not** live updates from a remote data store.

New DimVibe should instead embed a stable URL whose path holds **only the public exercise ID**. Illustrative code, **not a live production URL**:

```html
<iframe
  src="https://play.dimvibe.com/e/EXERCISE_ID"
  width="100%"
  height="600"
  style="border:0"
  title="DimVibe Exercise"
  loading="lazy"></iframe>
```

- Generate code in the Publish tab. Teacher copies it **once** into a LearnWorlds Embed activity.
- On load, Player resolves exercise ID to the active **published** exercise version, fetching structured content + immutable media references from DimVibe backend. No editor library/bundle or full JSON in iframe URL.
- On `Publish changes`, existing `src`, public exercise ID and code stay unchanged; after Player reload, learners see new content.
- This model requires deployed, reachable hosted Player, published-exercise API, and correct response headers permitting embedding from LearnWorlds. **It has not yet been acceptance-tested in LearnWorlds and must not be presented as proven.**
- A running learner session pins its loaded published version until reload, even if author republishes mid-session.
- Starting embed height: **600 px**, derived from working prototype; provide small height presets or editable height if needed after tests. The Player header and bottom toolbar remain inside its own iframe. The exercise's center scroll region scrolls independently, with space for footer. Mobile keyboard/focus and nested scroll must be validated in LearnWorlds.
- Optional auto-height messaging can be developed later only if the host supports an integration to resize the iframe; no unverified promise of automatic parent-iframe height.

## Publishing model and technical versions
- Editor autosaves draft separately from public data. Explicit Publish creates an **immutable snapshot** and atomically selects it as active, avoiding partial updates.
- Internally retain published snapshots needed for safe in-progress sessions, media references and future recovery. This does not imply a teacher-facing version UI in MVP.
- Technical versions protect publication integrity; complicated visual management/rollback is deferred. Admin recovery can be implemented later according to retention policy.
- A republish must not cause a running learner's responses to disappear. Next Player load uses active version.
- Media referenced by any retained published version must remain accessible until it is safely retired; replacing media creates new references rather than overwriting assets used by old snapshots.
- Public URL must resolve to published data only; a draft is never fetchable through the public endpoint.

## Access and safety
- Owner Teacher can create, edit, preview, publish, unpublish, soft-delete/restore own content. Admin can manage globally. Server verifies authorization on every action.
- Any user with live public Player URL can access the Player; not constrained to LearnWorlds origin. No Editor access, no learner history or score export.
- Unpublish means Player displays a friendly unavailable state at existing URL. Unpublishing does not erase the address. Soft deletion of teacher draft should **not** automatically break previously embedded live Player; unpublish is separate.
- Hard deletion of content and retained media is administrative, separately confirmed, and warned when embedded publications are affected.

## MVP exclusions
No teacher-facing multi-version browser, one-click rollback interface, detailed diff, grade passback, automatic LearnWorlds progress reporting, course authentication enforcement, or automatic resizing without verified host support.

## Acceptance gate
Do not mark dynamic embed integration as fully confirmed until the real LearnWorlds test in `LEARNWORLDS_IFRAME_TEST.md` passes.
