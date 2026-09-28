# SDD ledger — plan: docs/superpowers/plans/2026-09-28-community-board.md

Base: 8bf8f2cc2fa72cba14083bc485b671e813a8b1e8; authenticated GitHub Actions source artifact 10951582374.
Ruling: user's autonomous implementation request supersedes intermediate approval prompts. Preserve the existing main merge hold, update the existing shared Preview after testing.
Ruling: no dependency cache or working npm/GitHub DNS in local container. Use dependency-free policy checks locally and GitHub Actions for production build and disposable DB/browser tests.
Ruling: private PostgreSQL chunk storage reuses existing server-only DATABASE_URL; no additional key transfer. DB capacity remains an operational concern.
Preflight: shared size constants -> DB checks -> services -> HTTP/chunk transport -> member/admin UI. Likes share post locking and database uniqueness. All interfaces additive.

## Implementation and verification

- RED: CI 36425313395 failed new private community access test (expected 401, received 404 absent route). Existing build/lint/tests passed.
- Dependency-free validation: original eight policy cases passed. Added desired-like input case failed before implementation; all nine passed afterward.
- Candidate e4a9ae6 / CI 36427379930: unit/lint/build/DB tests passed; browser 36/38 passed. Two new tests used an ambiguous alert locator that also selected Next.js route announcements. Scoped the locator to .community; no product assertion removed.
- Review: checked auth and projection boundaries, file limits/hashes, SQL binding, likes uniqueness/retries and row locks, folder constraints/cascades, query bounds and mobile behavior. No independent reviewer/subagent is available in this session; this is inline self-review, not independent review.
- Review found a draft-cancel read/delete race and missing-draft cancellation failure. Added behavioral browser regressions before changing production code.
- RED: commit 9901692 / CI 36428097086: browser 38/40 passed, zero skipped/flaky. Only the two draft cancellation regressions failed. Full 2x6MB UI upload/download/hash, comments/edits, likes persistence/unlike/response loss, ownership, folders/moves/deletions and prior features passed.
- Ref changed concurrently to 2824e44 while preparing the fix. Non-fast-forward rejection was respected; no force push. Read and preserved the updated atomic draft-only service, dedicated route, editor and draft-list changes instead of overwriting them.
- The preserved fix checks author and published status under the same row lock as publication. Missing drafts are idempotent; other users' cancellation is forbidden; published posts are preserved. Both editor cancellation and unfinished-draft cleanup use it. Explicit post deletion remains separate.
- Added release checks for draft endpoint privacy/idempotency and 320/360/1280px screenshots with animations disabled.

## Release gate
Full final-candidate CI, live additive migration and shared Preview integration pending. Vercel app management reads returned scope authorization error for ditto0310-2413. Do not bypass account permissions. Existing GitHub integration may still deploy; verify its status separately and report any unverified live access.
