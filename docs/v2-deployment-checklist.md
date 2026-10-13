# V2 deployment checklist

Approved UI archive: `v2work-integration-preview.zip` (local artifact, not yet committed).
Do not overwrite `admin/index.html` (existing production admin entrypoint).
Stage UI at `admin/v2-editor.html` and its bridge at `admin/v2-cms-bridge.js`.
Keep image assets in a dedicated `admin/v2-assets/` directory and update their relative paths.
Bridge currently expects same-origin `cms-builder.html`, authenticates through its existing Supabase flow, and embeds the existing preview iframe.
Before enabling production navigation:
- Validate that CMS page list loads after admin login.
- Validate that selecting a block loads its real fields.
- Verify photo upload/cropping and live preview.
- Verify save/publish with fresh revision and error paths.
- Remove demo-only controls or connect them to actual CMS functions.
- Screenshot compare to approved V2 and verify mobile layout.
Do not merge until these checks pass.
