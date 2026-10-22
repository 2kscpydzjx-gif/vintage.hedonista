# Editor V2 consolidation — audit 2026-10-22

## Scope and safety
- Work only in `refactor/editor-v2-cleanup-20261022`. Do not merge or change `main` before interactive tests.
- Preserve all Supabase data, products, storage, layout and SEO snapshots.
- No deletion of legacy code until every caller is identified and replacement behavior verified.

## Verified source findings
1. `admin/admin.js` contains 4,018 lines and multiple generations of admin/editor logic in one file.
2. Around lines 3036–3264, the V81/V82 constructor implementation owns `CONSTRUCTOR_PREVIEW_MAP`, preview drawer/frame, section navigator, collapse controls, and `MutationObserver` watching page classes.
3. Later code still calls constructor functions: `resetCapsuleEditorSections()` (around line 3859) invokes `constructorEnhanceSection` and `constructorSetCollapsed`; `openStyleEditor` and `openCapsuleEditor` call that reset function. Removing V81/V82 wholesale would break capsule/style editing.
4. Journal has separate legacy content compatibility (`VH_BLOCKS_V1:` around line 2024), with conversion to HTML editor. Do not confuse journal content migration with page-builder V1/V2.
5. `admin/index.html` is an authentication entry point; it is not the V2 page builder. Actual editor entry point and script ownership still require tracing.
6. `site.js` is a separate public storefront script, so builder preview and publishing must be checked against public rendering without editing storefront design.

## Next implementation gates
1. Locate exact V2 editor entry point and every script loaded by it.
2. Map page/block storage schema, draft vs publish paths, and legacy fallback precedence.
3. Add a single shared block edit contract (text/image/width/crop/SEO) without per-page special-case handlers where possible.
4. Prevent simultaneous legacy/V2 initialization and duplicate preview rendering.
5. Verify save/reload/publish on Home, Capsules, Journal, About, Contacts, and a newly added block.
6. Only then remove unreachable legacy handlers and styles.

## Acceptance criteria
- One editor per page, no old block flash or duplicate elements.
- Same page remains selected after refresh.
- Autosaved draft survives refresh/close; publish updates public site.
- Image thumbnails are actual assets; pan/crop/zoom and width controls function.
- Preview scrolls once and zoom presets work without flicker.
- No regressions in products, capsules, journal, public pages, or mobile layout.

**Status:** audit baseline only; no runtime changes or cleanup claimed.
