# Vintage Hedonista V2 — exact design integration

## Source of truth
Approved archive: `vintage-hedonista-v2-exact-design-cms-bridge(1).zip`
- `admin/index.html` — approved markup, CSS and SVG icons; preserve visually exactly.
- `admin/cms-bridge.js` — prototype adapter, **not** production-ready.
- `admin/thumb-*.jpg` — demonstration imagery.

## Existing production CMS
- `admin/cms-builder.html` — current builder shell.
- `admin/cms-builder.css` — current styling.
- `admin/cms-builder.js` — Supabase auth, revisions, draft/publish, block model and preview.
- `admin/cms-studio.js` — existing studio UI enhancements.

## Implementation sequence
1. Copy approved UI without modifying its visual markup, SVG or CSS; use an isolated route for QA.
2. Inventory all V2 controls and remove demo handlers *only after* wiring each to real CMS operations.
3. Replace hidden iframe bridge with explicit state/actions API; avoid duplicate listeners.
4. Map pages, block selection, content, image positioning, cropping and live preview.
5. Connect draft/save/publish to existing Supabase auth and revision model; report errors and confirmed completion.
6. Regression test desktop/mobile and verify that changing layout updates preview immediately.
7. Compare screenshots against approved V2 before considering replacement of production editor.

## Acceptance
- Pixel-consistent approved V2 design.
- All controls change real data and preview, no fake/demo success.
- No accidental publish or production changes during QA.
- Rollback remains possible via main branch.
