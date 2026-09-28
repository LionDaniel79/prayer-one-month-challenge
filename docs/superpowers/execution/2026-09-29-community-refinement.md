# Community refinement execution ledger

Base 811148d513a63043cf6eaafce257ae3a5d456da9; plan docs/superpowers/plans/2026-09-29-community-refinement.md. User requested implementation and deployment autonomously. Preserve the main merge hold and existing shared Preview URL.

- RED 073b955 / CI 36442902978: existing unit/lint/build/TLS DB passed. Four new behavior checks failed for the missing mode boundary/order/images/edit-session capabilities. An old release screenshot assertion also encountered leftover synthetic posts because its new cleanup endpoint did not yet exist. No live records were used.
- Added author-only edit authorization, dedicated administrator deletion, additive order/version/staging schema, atomic staged file changes, bounded raster decoding and image-first layout, explicit management mode and folder ordering controls.
- Local dependency-free policy checks: 8 passed after the initial missing-helper RED. Full npm dependencies are not available locally; full results come only from CI.
- Existing browser moderation calls now use the dedicated admin delete endpoint; the privacy table-count assertion includes the two new private staging tables. Other behavioral assertions retained. Release list assertion targets its own exact synthetic post.
- Candidate 8bdb0b / CI 36444907424: 355 unit checks passed, one failed because the new admin endpoint did not reuse requireAdmin. Corrected the endpoint to call the existing shared guard and project its DomainError. Did not weaken the security assertion.
- Added live-release marker verification (anonymous GET only), staging integrity/permission/cancel/concurrent-commit/cascade checks, and renamed SVG image rejection tests. Two-line image spacing is independent of stylesheet import order.

Pending: full final-candidate CI, screenshot inspection/review, additive live migration and private-role checks, shared branch integration, Vercel success and released-marker smoke. No deployment-completion claim yet.
