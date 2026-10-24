# Vintage Hedonista — Project Context

> Status: initial technical context, based on the Codex read-only audit of commit `a3cac8c`.
> This is **not** the final approved product specification. Historical design decisions and deployment details must be verified after chat export.

## Purpose
Vintage Hedonista is a vintage online store with a public storefront, an administration panel, and a visual page editor commonly called V2.

## Verified repository
- GitHub: `2kscpydzjx-gif/vintage.hedonista`
- Audit baseline: `a3cac8c5c7def5e50cd8353167925ac166db76ee`
- Architecture: static HTML, CSS, vanilla JavaScript; no root `package.json` found.
- Storefront: HTML pages, `styles.css`, `site.js`.
- Admin: `admin/admin.html`, `admin/admin.js`.
- Main editor: `admin/cms-builder.html`, `admin/cms-builder.js`, `admin/cms-studio.js`.
- Public CMS rendering: `cms-published.js`.
- Capsules: `capsules-front.js`.
- Supabase: client-side integration for content, commerce, authentication, CMS revisions and media; two Edge Functions for email.
- SEO: generated static snapshots and audit scripts.

## Editor routing and architecture
Observed navigation: `admin/admin.html` → `admin/v2-editor.html` → `admin/cms-builder.html`.

The current editor is **not** an independent completed V2 engine. `cms-builder.js` supplies core editing logic; `cms-studio.js` modifies its controls and DOM to provide a Studio interface.

Other files exist, but are not proven active on the main route:
- `admin/v2-cms-builder.html`
- `admin/cms-studio-v2.html`
- `admin/cms-v2.js`
- `admin/cms-v2-connected.html`
- `admin/v2-cms-bridge.js`
- `admin/v2-cms-builder.js`

Do not assume these alternatives cause live conflicts. Confirm references and runtime behavior before removing or changing anything.

## Content model
- Existing page sections are discovered from DOM and given positional IDs such as `existing-0`; these can shift when DOM structure changes.
- New blocks are structured records with type, text, images, design, animation, duration and visibility fields.
- Rendering supports `editorial`, `banner`, `text`, `gallery`; the current add action creates `editorial`.
- CMS revisions store new blocks in `vh_page_revisions.blocks`, existing-section overrides in `shared.cmsPageDraft.existing`, and ordering in `shared.cmsPageDraft.order`.
- Revisions have `draft` and `published` states.
- The public page uses a separate rendering implementation from editor preview.

## Findings requiring attention
1. Studio rearranges builder controls via DOM manipulation and `MutationObserver`, making the right panel fragile.
2. Positional existing-block IDs risk misapplying saved settings when page structure changes.
3. Preview and published rendering differ; visual parity is not guaranteed. Specific flickering was not reproduced in the audit.
4. Image uploads go to Supabase Storage before draft save; cancelling editing does not automatically remove uploaded files.
5. Cloud draft loading may overwrite local unsaved edits.
6. Draft/publish uses separate requests, not one transaction; shared fields are not all verified.
7. Reset may leave local new-block data; confirm with an F5 test.
8. The V2 smoke test expects old selectors and an iframe architecture, while the current route redirects to the Studio builder.
9. Browser smoke tests were **not run** due to Chromium/server restrictions.
10. The `order-email` Edge Function may permit unauthorized calls if deployed with `verify_jwt = false` and no alternative caller authentication. Treat as a priority security investigation; do not invoke against production.

## Deployment and environment uncertainties
- The audit did **not** confirm Cloudflare from repository configuration.
- GitHub Pages references and Vercel test metadata exist, but neither proves the actual production hosting.
- Supabase database schema, RLS policies and Storage policies were not fully available.
- Do not assume production and the audited commit are identical.

## Next phases
1. Confirm actual production/staging deployment, revision and safe test environment.
2. Obtain approved V2 screenshots, functionality requirements and historical decisions from ChatGPT export.
3. Produce a gap analysis: approved V2 specification vs audited code.
4. Verify Supabase security configuration without exposing secrets or making production writes.
5. Design and review a phased implementation plan.
6. Only after explicit approval: implement in an isolated branch, test, and propose a PR.

## Source and confidence
This document summarizes the user-provided Codex audit report for commit `a3cac8c`. It is a starting technical record, not independent runtime verification or authorization to refactor.
