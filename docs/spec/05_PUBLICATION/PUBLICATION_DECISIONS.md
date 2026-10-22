# DimVibe — Publication decisions and changes

**2026-10-14 — Approved in conversation**

- LearnWorlds activity contains manually pasted iframe code; students see only Player, never Author Studio.
- Stable public Player URL by exercise ID instead of old URL-encoded complete exercise JSON.
- Copy iframe once; edit draft and explicitly `Publish changes`; updates should be visible on next iframe load without changing copied code **if integration acceptance test succeeds**.
- Draft edits/autosave do not affect live exercises. Running learner stays on loaded snapshot.
- Publish tab: preview, Publish/Publish changes, link, copy iframe, small `...` menu.
- Prototype embed height 600 px is initial default, pending real desktop/mobile verification. Fixed bottom toolbar belongs inside Player, not LearnWorlds page.
- Unpublish is supported; soft-delete should not implicitly destroy a published embed. Admin permissions checked on server.
- **Changed from earlier specification:** visible version history, rollback picker and draft restoration UI are deferred to post-MVP. Retain lightweight immutable technical publication snapshots internally where needed.
- Public-by-link is not access-restricted to LearnWorlds; this is understood and accepted for training exercises.

**Not yet validated**

- Actual deployed new Player endpoint, version lookup, hosting headers and reload behavior in LearnWorlds.
- iframe height/mobile keyboard behavior, iframe overflow and scroll interaction.
- Whether optional parent-assisted dynamic iframe resizing can be supported.
