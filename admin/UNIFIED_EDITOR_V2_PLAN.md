# Unified Editor V2 — integration baseline

## Verified entrypoint
- `admin/admin.html` links to `v2-editor.html`.
- `admin/v2-editor.html` immediately redirects to `cms-builder.html`.
- `admin/cms-builder.html` loads `cms-builder.js` and existing UI layers.
- `admin/cms-builder.js` handles Supabase admin checks and `vh_page_revisions` drafts.
- `admin/v2-cms-bridge.js` mounts another CMS in a hidden iframe. Do not build a second data engine.

## Non-negotiable integration constraints
1. Retain the existing Supabase project and revision schema.
2. Use one authoritative block state and one save/publish pipeline.
3. Do not replace the production entrypoint until the connected V2 passes integration tests.
4. Preserve all published content and existing drafts; do not reset revisions or write test data to production.
5. Test at least two block types, photo replacement, crop/position, preview, save draft, F5 reload, and publish.
6. Test the same flow with a newly added block, not only existing ones.
7. Keep `main` unchanged until validation.

## Implementation sequence
1. Trace CMS block models, event handlers, and revision serialization.
2. Extract a shared inspector/field adapter used by all block types.
3. Connect the approved V2 UI directly to that adapter; remove hidden-iframe dependencies only after parity.
4. Add automated regression checks for serialization, page selection, and media state.
5. Validate on the feature branch and merge only after successful review.

This is a technical baseline, not a claim that the editor has been implemented or tested.
