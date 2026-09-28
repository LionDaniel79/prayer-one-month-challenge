# SDD ledger — plan: docs/superpowers/plans/2026-09-28-community-board.md

Base: 8bf8f2cc2fa72cba14083bc485b671e813a8b1e8; authenticated GitHub Actions source artifact 10951582374.
Ruling: user's autonomous implementation request supersedes intermediate approval prompts. Preserve the existing main merge hold, update the existing shared Preview after testing.
Ruling: no dependency cache or DNS in local container. Use local dependency-free policy checks and GitHub Actions for full production build and disposable DB/browser tests.
Ruling: private PostgreSQL chunk storage reuses existing server-only DATABASE_URL; no additional key transfer. DB capacity remains an operational concern.
Preflight: common size constants -> DB checks -> services -> HTTP/chunk transport -> member/admin UI. Likes share post locking and database uniqueness. All interfaces remain additive.

RED evidence: CI run 36425313395 failed the new community navigation/access test, expected 401 but got 404 for the absent community API. Existing suite/build/lint passed. No product bug was hidden by skipping the test.
Policy checks: original eight cases passed locally. Added explicit likes policy test failed because parseLikeInput was absent, then all nine passed after implementation.
Implementation candidate: folder board, private bounded attachments, comments, desired-state likes, admin management and mobile UI. Full CI pending; do not treat this candidate as a completed deployment.
