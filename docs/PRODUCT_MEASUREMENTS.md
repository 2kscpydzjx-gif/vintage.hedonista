# Product measurement groups

The existing `measurement_*` columns remain authoritative for legacy measurements. No existing value is converted, doubled, relabelled, copied to a garment part or cleared by choosing a category/template. Unedited legacy columns are omitted from product updates, including fields previously populated from aliases. Previously filled legacy inputs stay visible when a category changes.

The optional `products.measurements_v2` JSONB value has `{version:1,showLegacy:true,groups:[{id,title,template,fields:[{id,label,value}]}]}`. Values remain strings, including ranges and units. Each garment part has its own fields. Template changes retain filled fields; empty fields can be replaced. Explicit removal is confirmed for filled data and can be undone during the session. Unknown server versions remain read-only while unrelated product fields remain editable.

## Current test behavior

The migration is prepared but has **not** been applied to the shared live Supabase. Vercel review deployments always save changed measurements locally. Without an explicit `VH_CONFIG.measurementsStorage: "database"`, other hosts also use this review behavior. The main product Save action stops before any product/gallery/SEO mutation when measurement changes are being saved locally; it reports that other product fields have not been written either. Ordinary admin operations outside this measurement workflow still use the shared backend.

Browser drafts use `vh-measurements-preview-v1:<product-id>` and preserve incomplete typed fields. They contain only product measurements, no customer/auth data. Preview is explicit via `product.html?slug=...&vh-measurements-preview=<id>`; normal navigation ignores local drafts. A preview URL alone does not carry its data to another browser/origin. Export/import JSON transfers grouped measurements for the same product; importing never changes flat legacy fields. Export before changing browsers or clearing site storage. Local/server changes require an explicit choice when a draft's baseline differs.

## Activate database persistence later

1. Back up products/schema and verify a restore in an isolated database. Preserve local exports separately.
2. Review the actual products RLS/table/column privileges. Only administrators may update product measurements; grouped measurements are public product information. This migration does not change policies or grants.
3. Apply `supabase/migrations/202610290001_product_measurements.sql` to an isolated Supabase first. It adds a nullable JSONB column and reloads the PostgREST schema. It performs no UPDATE or backfill. Repeated application preserves rows.
4. Verify admin Save/reload and anonymous product rendering, legacy-only products, jacket/skirt and jacket/trousers sets, corsets/accessories, ranges, custom fields, failed writes and concurrent editors.
5. Enable `measurementsStorage: "database"` in the admin configuration only after the schema and privileges are ready. Vercel review remains local-only. Structured updates use a JSONB compare-and-set filter; a stale editor cannot overwrite another structured edit. Unchanged structured/legacy columns are omitted from ordinary saves.
6. Transfer desired test groups with per-product export/import. Never automatically assign old flat length/waist values to components. The show-legacy checkbox controls display only and does not delete old columns.

No production database change, activation flag or legacy data migration is included in this frontend test release. The nullable field does not require creating separate products or changing capsule/cart/order behavior.

## Compact editor

Start with one garment or a preset outfit. Component tabs show one garment at a time; values in other components remain intact. Normal rows contain only the field label and value. Rename/template/reorder/removal controls, per-field changes and import/recovery are collapsed under their own details. Existing flat fields stay in a separate collapsible section.

The “Як на сайті” view uses the same renderer and stylesheet as the public product accordion; it shows the current unsaved draft without leaving the form. “Відкрити картку товару” opens the explicit local-draft preview in its original “ЗАМІРИ” accordion. Filled groups follow one another in document flow, so the accordion height expands and later sections move down. Empty rows and wholly empty groups are omitted.
