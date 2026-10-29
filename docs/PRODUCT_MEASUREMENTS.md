# Editable product measurements

The admin shows a single list of name/value rows with direct renaming, value editing, deletion and “Додати пункт”. There are no template selectors, outfit wizards or component tabs. Structural deletion/addition can be undone. Preview and per-product JSON recovery are collapsed below the list.

Existing category fields are the initial rows for legacy products; every already filled field is included even outside the current category. Once any row is edited, category changes cannot replace the custom list. Sets can use names such as “Довжина жакета” and “Довжина спідниці”. The public list stays inside the existing “ЗАМІРИ” accordion, with two columns on wide screens and one on phones. Empty values are omitted; the accordion expands with its content.

## Data compatibility

Existing `measurement_*` columns and aliases remain unchanged by row renaming or deletion. Unchanged flat columns are omitted from product updates. No value is converted, doubled or automatically assigned to a garment. Numeric zero and raw spacing are retained. Opening a product does not create a structured update.

The optional `products.measurements_v2` JSONB field accepts both the previous grouped format `{version:1,showLegacy,groups:[{id,title,template,fields:[{id,label,value}]}]}` and the simple list with `layout:"list"`, `showLegacy:false` and one group. The list accepts up to 500 rows, enough to preserve the old maximum 480 grouped fields plus 12 legacy values. Grouped data stays unchanged until a user edits a row. In the editor, previous multi-part group titles prefix their field names so duplicate lengths remain identifiable. Legacy values still shown by that format become rows as well. The first edit stores the complete displayed list without changing the original flat columns. Deleting a row therefore hides it from public presentation without a later legacy fallback bringing it back.

Unsupported formats remain read-only for measurements while unrelated product fields remain editable. Values are strings, including units and ranges. Incomplete typed rows remain recoverable in browser drafts; a filled value needs a name before saving to the server or opening a product preview. DOM rendering uses textContent.

## Current test behavior

The migration is prepared but has **not** been applied to the shared live Supabase. Vercel review deployments always save changed measurements only in the browser. Without explicit `VH_CONFIG.measurementsStorage: "database"`, other hosts also use this behavior. General product Save stops before product/gallery/SEO writes when measurements are being saved locally and reports this. Ordinary admin actions outside this workflow still use the shared backend.

Browser drafts use the unchanged `vh-measurements-preview-v1:<product-id>` key, restoring both older grouped drafts and new lists. The collapsed preview renders the current rows with the shared product renderer and stylesheet; it updates as the fields change. “Відкрити картку товару” opens `product.html?slug=...&vh-measurements-preview=<id>` with an explicit local preview. Normal public navigation ignores browser drafts. Drafts belong to their browser and origin; export/import transfers measurements for the same product. Import never rewrites the original flat inputs. Conflicting local/server baselines require an explicit recovery choice.

## Activate database persistence later

1. Back up products/schema and verify a restore in an isolated database. Preserve local exports separately.
2. Review the actual products RLS/table/column privileges. Only administrators may update measurements; public reads remain product information. The migration changes no policies or grants.
3. Apply `supabase/migrations/202610290001_product_measurements.sql` to an isolated Supabase first. It adds nullable JSONB and reloads PostgREST, with no UPDATE/backfill. Repeated application preserves rows.
4. Verify Save/reload and anonymous rendering for legacy products, old grouped data, edited lists, deletion, ranges, failed writes and concurrent editors.
5. Enable `measurementsStorage: "database"` only after schema and privileges are ready. Vercel stays local-only. JSONB compare-and-set prevents stale overwrites. Unchanged structured and flat columns remain omitted from unrelated saves.
6. Transfer selected test drafts with per-product export/import. Existing flat values are never removed by the new list.

No production database change, activation flag or live migration is included in this test release. Product, capsule, cart and order identities remain unchanged.
