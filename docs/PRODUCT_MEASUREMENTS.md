# Editable product measurements

The admin shows a single list of name/value rows with direct renaming, value editing, deletion and “Додати пункт”. There are no template selectors, outfit wizards or component tabs. Structural deletion/addition can be undone. Preview and per-product JSON recovery are collapsed below the list.

Existing category fields are the initial rows for legacy products; every already filled field is included even outside the current category. Once any row is edited, category changes cannot replace the custom list. Sets can use names such as “Довжина жакета” and “Довжина спідниці”. The public list stays inside the existing “ЗАМІРИ” accordion, with two columns on wide screens and one on phones. Empty values are omitted; the accordion expands with its content.

## Data compatibility

Existing `measurement_*` columns and aliases remain unchanged by row renaming or deletion. Unchanged flat columns are omitted from product updates. No value is converted, doubled or automatically assigned to a garment. Numeric zero and raw spacing are retained. Opening a product does not create a structured update.

The optional `products.measurements_v2` JSONB field accepts both the previous grouped format `{version:1,showLegacy,groups:[{id,title,template,fields:[{id,label,value}]}]}` and the simple list with `layout:"list"`, `showLegacy:false` and one group. The list accepts up to 500 rows, enough to preserve the old maximum 480 grouped fields plus 12 legacy values. Grouped data stays unchanged until a user edits a row. In the editor, previous multi-part group titles prefix their field names so duplicate lengths remain identifiable. Legacy values still shown by that format become rows as well. The first edit stores the complete displayed list without changing the original flat columns. Deleting a row therefore hides it from public presentation without a later legacy fallback bringing it back.

Unsupported formats remain read-only for measurements while unrelated product fields remain editable. Values are strings, including units and ranges. Incomplete typed rows remain recoverable in browser drafts; a filled value needs a name before saving to the server or opening a product preview. DOM rendering uses textContent.

## Database persistence and test isolation

Admin config enables `measurementsStorage: "database"`. Vercel test hosts additionally set `measurementsSaveOnly:true`. Their existing product Save action calls the admin-only `vh_save_product_measurements` RPC and returns before the general product/gallery/cover/related-product/SEO pipeline. Even with no measurement edits, this test mode does not write other product fields or create a new product. The visible note explains that only measurements are saved. Other unsaved form fields remain on screen and retain their dirty indicator.

The RPC updates only `products.measurements_v2` and compares its previous JSONB value atomically. The receipt must confirm the product ID and exact saved measurements before the browser draft is cleared. Edits typed while a save is pending remain in a draft against the newly saved baseline. Failed setup, permission checks, network requests and stale writes preserve local recovery. Without database mode, the previous local-only workflow remains available.

The migration `supabase/migrations/202610290001_product_measurements.sql` adds the nullable field, server validation, a guard on changes to the new column and the save RPC. It changes no existing product policies or grants and does no UPDATE/backfill of existing rows. The RPC is SECURITY INVOKER, checks the existing `is_admin()` function, is executable only by authenticated users and still respects product RLS. A column guard also rejects non-admin direct writes even if old update policies are broad. Null inserts and unchanged measurement data do not affect older product editing. Unsupported changed payloads are rejected on the server.

On production hosts, the general product save may include structured measurements under the original compare-and-set filter; the same column guard validates them. Production source is not changed until this branch is explicitly merged. Older production rendering continues using legacy columns, which remain unchanged by test measurement saves.

## Activation status

The live public-schema probe on 2026-10-29 returned `42703: column products.measurements_v2 does not exist`. This environment has public API access but no Supabase management/database credentials. The SQL has been tested in isolated PostgreSQL, not applied to the shared live project. A project administrator must run the exact migration in Supabase SQL Editor to complete real activation; see [setup instructions](PRODUCT_MEASUREMENTS_SETUP_UK.md). The UI reports the missing RPC and preserves drafts until then.

Browser drafts use the unchanged `vh-measurements-preview-v1:<product-id>` key, restoring both older grouped drafts and new lists. The collapsed preview renders the current rows with the shared renderer and stylesheet. The explicit `vh-measurements-preview=<id>` URL can use browser drafts; ordinary public navigation reads server product data. Drafts belong to their browser/origin. Same-product export/import does not change the original flat columns.

## Verification

Isolated PostgreSQL tests cover repeatable setup, incompatible-column rollback, unchanged rows and existing policies, server payload validation, admin-only RPC and direct-write protection, stale JSONB writes and anonymous product reads. Browser tests cover save/reopen without local storage, retained prices/photos/SEO/legacy values, incomplete drafts, concurrent administrators, input entered during a save, setup/permission errors, old grouped drafts and mobile layout. No test sends real orders or writes live product data.
