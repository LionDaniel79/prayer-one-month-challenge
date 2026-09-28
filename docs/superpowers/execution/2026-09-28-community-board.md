# SDD ledger — plan: docs/superpowers/plans/2026-09-28-community-board.md

Base: 8bf8f2cc2fa72cba14083bc485b671e813a8b1e8; authenticated GitHub Actions source artifact 10951582374.
Ruling: user requested autonomous implementation and deployment. Keep the existing main merge hold; integrate the tested community feature into the existing shared Preview branch.
Ruling: no local dependency cache or working npm/GitHub DNS. Dependency-free policy checks ran locally; full production build and disposable DB/browser checks ran in GitHub Actions.
Ruling: private PostgreSQL chunk storage reuses server-only DATABASE_URL. No additional key transfer/public bucket. DB capacity is an operational concern documented in docs/community-operations.md.
Preflight: shared limits -> DB constraints -> focused services -> authenticated API -> member/admin UI. Likes share post locking and database uniqueness. Existing features remain additive/unmodified except navigation.

## RED → GREEN and review

1. CI 36425313395: expected new community API 401, got 404 because not yet implemented. Existing checks passed.
2. Dependency-free validation: eight original cases passed; desired-like-state case failed before implementation, then nine passed.
3. e4a9ae6 / CI 36427379930: unit/lint/build/DB checks passed; browser 36/38 passed. Two test locators also matched Next.js route announcements; scoped them to .community without removing product assertions.
4. Inline review checked authorization/projections, file size/hash/immutability, SQL bindings, likes retries and locks, folder constraints/cascades, bounded queries, and mobile display. This session has no independent reviewer/subagent; do not label this an independent review.
5. Added behavioral regressions for missing-draft cancellation and publication racing with cancellation. 9901692 / CI 36428097086: **38/40 passed, zero skipped/flaky**. Only the two new cancellation regressions failed. Real 2x6MB browser upload/download/hash, comments/edits, likes persistence/cancellation/response loss, ownership, folders/moves/deletions and prior features passed.
6. Ref advanced to 2824e44 while preparing the fix. Respected non-fast-forward rejection, read and preserved its atomic draft-only service/route/editor/list changes; no force push or overwrite.
7. Draft-only deletion checks author and publication under the same row lock as publish/upload. Missing drafts are idempotent, other-user cancellation forbidden, published posts preserved. Explicit published-post deletion remains separate.
8. Added release checks for draft endpoint ownership/idempotency and 320/360/1280px UI screenshots with animations disabled.

## Verified release candidate

Commit **720afd0a37b6059b849c4a99bf4f2e68e94f6591**.
GitHub Actions **CI #583 / 36429544654**: npm ci, unit tests, lint, production build, TLS disposable DB setup, dedicated DB tests, and Playwright all successful.
Browser artifact **10973425305**: **42 passed / 42 total, 0 failed, 0 flaky, 0 skipped**. Read the report and inspected rendered mobile/desktop screenshots, including the selected heart button and folder/list views. No actual iPhone hardware test is claimed.
Source artifact **10972604528** identifies the exact verified source.

## Live database verification

Before applying a duplicate migration, re-read actual project state. Community migration was already recorded as **20260928133359 / community_board**. Reconciled it against the repository migration rather than executing it twice.
Verified all six community tables, required file/chunk CHECK constraints, composite likes uniqueness, cascading references, covering indexes, RLS and false restrictive policies. PUBLIC-facing anon/authenticated CRUD privileges absent.
Aggregate state: 1 folder, 0 posts/files/chunks/comments/likes; existing users 2, roster 391, notices 2, prayer/checkin/visit counts unchanged from the pre-release aggregate check. No real member content used in tests.
Security Advisor after migration: **no ERROR/WARN; only the pre-existing two INFO rls_enabled_no_policy notices** on prayer_participant_exclusions and visit_booking_settings.

## Deployment record

Release integration uses feature/prayer-one-month-challenge and its existing GitHub→Vercel shared Preview. The current ledger update changes documentation only; application code/tests match 720afd0. Actual integration commit, final CI and deployment URL/status are recorded in PR #1 after deployment checks; this avoids calling a pending deployment successful.
Vercel app management reads returned scope authorization error for ditto0310-2413. Do not bypass permissions. Use the existing GitHub integration's deployment status and ordinary public access to the already-authorized shared Preview. Never weaken app session/admin checks.

Operations, file safety, draft retention and DB capacity: docs/community-operations.md.
