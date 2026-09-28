# Community refinement — design and execution plan

Base: 811148d513a63043cf6eaafce257ae3a5d456da9. The user explicitly requests autonomous implementation of nine concrete changes and deployment to the existing shared URL. Preserve main merge hold.

## Contract
Member mode, including an administrator using /community: no folder management or post move; only the author can edit/delete their own post. Admin mode: folder create/rename/delete/order and post move/delete; NO post edit, including administrator-owned posts. Server rejects other-author editing; privileged post deletion uses a dedicated admin endpoint. Both member/admin menus reflect the same saved folder order. Remove the upper duplicate all-folders link. Folder icon and name share one row.
Photo attachments are decoded into a bounded private WebP preview above the body, with two body-line heights of space like notices. Original authenticated downloads remain unchanged. Unsupported/corrupt image data has a download fallback, never raw executable inline rendering.
Post editing can retain/remove/add attachments, with final retained+new count <=2 and each <=6291456 bytes. Transfers remain 524288 bytes. Upload into separate edit-session chunks; commit validates hashes and atomically changes body/files while preserving post ID, comments and likes. Version check prevents stale overwrites. Applied edit-session receipts allow retry after response loss. Cancelling/failed uploads do not change the original.

## Steps
1. Add failing behavior tests for member/admin separation, order persistence, photo-before-body and atomic attachment editing/authorization.
2. Add additive migration: folder sort_order, post version, private edit-session and edit-chunk tables. Implement transaction-serialized reorder and author-only edit service, bounded image rendering, admin deletion endpoint.
3. Update shared UI with explicit management mode, order controls, one-line folder heading, photos, retained/new attachment editor. Keep existing login/prayer/visits/notices/likes.
4. Run full CI (unit/lint/build/TLS disposable DB/Playwright), update old assertions only where the user's authorization contract changed; inspect mobile screenshots and review race/error paths.
5. Apply reviewed migration once on Supabase, verify schema/RLS/privileges without touching member content. Integrate only the tested commit into feature/prayer-one-month-challenge, verify Vercel status and rerun anonymous shared-URL smoke after deployment. Record actual results and limitations in PR #1.

## Execution rulings
No local npm DNS or installed app dependencies; use the existing GitHub Actions disposable-database pipeline, not the live DB, for execution. Work on a separate feature/community-refinement branch. Do not claim independent review when no subagent tool is available. Vercel connector get_project currently returns an argument-validation error; existing authorized GitHub deployment integration is separate.
