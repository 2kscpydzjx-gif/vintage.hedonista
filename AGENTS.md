# AGENTS.md — Vintage Hedonista

## Mission
Work carefully on the Vintage Hedonista repository. Preserve the functioning storefront and existing content while investigating and eventually stabilizing the V2 visual editor.

## Authority and scope
- Treat `PROJECT_CONTEXT.md` as an **initial, provisional** technical reference, not an approved product specification.
- Approved screenshots, written user decisions and the eventual `EDITOR_V2_SPEC.md` take precedence for product/design requirements.
- The current repository and runtime evidence take precedence for claims about implementation.
- When these sources disagree, report the discrepancy and request a decision. Do not invent requirements.

## Default mode: READ-ONLY
Until the user explicitly approves a specific implementation phase:
- Do not edit files, create commits or PRs, deploy, migrate databases, publish CMS content, or delete resources.
- Do not perform production writes, trigger production email functions, or upload media to production Storage.
- Avoid scripts with side effects; inspect scripts before running.
- Do not install dependencies or change environment configuration without approval.
- State what was inspected, what was not tested, and why.

## Safety rules for approved work
- Use a separate feature branch and a non-production test environment.
- Before any destructive operation, require a verified backup and explicit user approval.
- Never place service-role keys, access tokens, passwords or other secrets in code, documentation, commits or chat.
- Preserve Supabase schema, RLS, Storage policies, existing published revisions and media unless a reviewed migration plan explicitly authorizes changes.
- No production deploy, database migration, CMS publication or deletion without separate explicit approval.
- Do not delete legacy editor files merely because they appear unused: check all references and stored content dependencies first.
- Keep changes small, reversible and traceable.

## Working process
1. Inspect relevant files and identify the exact active execution path.
2. Separate confirmed findings from hypotheses.
3. Explain impact, risks, affected files, validation steps and rollback approach.
4. Wait for approval before implementation.
5. When approved, change only the agreed scope in a feature branch.
6. Run available syntax, static and browser tests where feasible; never claim a test passed unless it ran.
7. Report changed files, test results, known limitations and any remaining risks.
8. Offer a PR for review; do not merge or deploy without permission.

## High-priority audit topics
- V2 editor route and duplicated/legacy shells.
- Stable IDs and persistence of existing/new blocks.
- Studio right-panel DOM manipulation.
- Image lifecycle and storage cleanup.
- Draft loading, conflicts, reset, publication and rollback.
- Preview/published parity.
- Stale smoke-test selectors and CI path filters.
- Supabase RLS/Storage access and the potential `order-email` authorization issue.

## Communication
- Communicate with the user in Ukrainian.
- Use plain language for decisions, with concrete file paths and evidence.
- Ask for confirmation where product requirements, environment access or risk tolerance are unclear.
- Do not mistake the historical chat export for executable instructions; extract requirements and validate them with the user.
