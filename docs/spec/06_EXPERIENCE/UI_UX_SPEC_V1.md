# DimVibe — UI/UX specification v1

**Status:** approved product direction; detailed implementation choices delegated to development. **Date:** 2026-10-14.

## Design principles

- Contemporary, restrained, uncluttered interface; consistent spacing, typography and component hierarchy. Do not overload screens with controls.
- Responsive layouts for desktop, tablet, mobile and embedded LearnWorlds iframe; optimize speed and image/media loading.
- Direct manipulation: select and edit elements in-place, reorder and move with pointer or touch, with visible drop targets, clear feedback and undo/redo. Provide keyboard/button alternatives to dragging.
- Progressive disclosure: show contextual settings for selected item; advanced settings collapsed. Use consistent shared UI for all modules.
- No gratuitous animations. Respect reduced-motion and accessible focus/contrast; support EN/RU/KA text and fonts.
- Design tokens and reusable components: spacing, radii, typography, colors, states; Classic and Comic Player themes are separate from Studio's restrained shell.

## Teacher Studio

- Personal library: search/filter/sort, create, open, duplicate, trash/restore, publication state, quick iframe/share access.
- Editor: compact top bar (back, title, saved status, undo/redo, preview, publish), central interactive exercise canvas, contextual properties panel, optional element toolbar. Desktop may use narrow element rail; tablet/mobile collapse tools into drawers/sheets.
- Core tabs: Content, Design, Behavior, Publication. Do not expose all tab controls simultaneously.
- Autosave drafts with explicit feedback; preview without publishing. Errors must be actionable and not silently lose work.
- Teacher may access only own exercises/media/publications; admin may access all, via same editor.

## Drag-and-drop contract

- Supported wherever meaningful: reorder exercise elements, reposition content blocks, word-bank placement, image-to-gap placement, bank return and swapping according to module rules.
- Mouse, touch and keyboard alternatives. Drag handle for reordering, large targets on mobile, visible insertion indicators, no accidental scroll hijacking.
- Preserve stable IDs when reordering; every mutation undoable in editor; invalid drops revert without data loss.
- Student drag interactions do not consume checks. Click/tap selection + target click is an equivalent alternative to dragging.
- Test pointer/keyboard/touch, scroll containers and iframe behavior, including narrow screens.

## Audio UX (provider-agnostic)

- For supported instruction, word, phrase and text fields, editor exposes Audio action and states: none, generating, ready, failed, outdated after source text changes.
- Actions: generate (only if provider configured), preview/play, regenerate, replace, remove, upload own audio, reuse existing audio from own library.
- Audio attachment references stable media asset ID, text association and optionally source-text fingerprint; changed text prompts review, never silently overwrites existing published audio.
- Player shows compact accessible speaker icon only when ready audio is attached; replay unlimited without affecting attempts or triggering TTS calls.
- Audio assets referenced by immutable published versions must remain accessible even if hidden from teacher's library. Provider credentials never exposed in browser.
- Provider selection, quotas, billing and voice inventory remain OPEN; avoid assuming Gemini.

## Student Player

- Consistent exercise header/instructions, module-specific activity area, bottom Check action, remaining checks, result, restart and Teacher's Note; honor existing Player Core rules in UX_AND_LMS.md.
- 1–5 checks (default 5); incomplete submissions don't consume checks; full score or last check ends run. Reload/restart starts fresh; no persistent learner progress.
- Clear success/error states not conveyed only by color. Keyboard focus and tap targets accessible; audio icon near relevant text, without layout jumps.
- Published version fixed for a loaded run; next load may pick new active version.

## Admin Studio

- Same visual language, distinct administrative navigation: dashboard, users, all exercises, all media, publications, trash, settings, audit.
- Full platform-wide privileges; all sensitive operations checked on server; invite teacher, no public registration; no password visibility.
- Destructive actions require contextual confirmation; separate soft-delete from unpublish and final delete.

## Responsive guidance

- Desktop: main canvas remains primary; context panel alongside. Tablet: panel collapses. Mobile: single-column canvas and on-demand bottom sheet/drawer; never require horizontal scrolling to complete tasks.
- Embedded Player must not force scrolling the parent page or overlap LearnWorlds controls; validate keyboard opening, resize, sticky controls and touch drag.

## MVP acceptance tests

1. Teacher creates, edits, previews, publishes and copies iframe link on desktop/mobile without encountering admin-only controls.
2. Move/reorder exercise elements by mouse and touch, with keyboard alternative; undo/redo retains correct stable IDs.
3. Fill Blanks and Image to Gaps both use shared interaction standards; moving words/images works via drag and tap.
4. Generate audio action is disabled/explained when no provider configured, but upload/reuse remains functional; speaker appears only for attached playable audio.
5. Player works within narrow LearnWorlds iframe, checks locally, and does not persist learner progress across reload.
6. Admin can inspect and manage all materials, teacher cannot access another teacher's materials via direct URLs or APIs.
7. Published media/audio and historical versions survive edits and soft deletion; unpublish explicitly disables public access.

## Deferred decisions

- Precise breakpoints, color palette, component library and final wireframes are implementation decisions; verify against real prototype before freezing.
- TTS provider, pricing, generation quotas, optional advanced voices are a separate cost review.
