# SDD ledger — plan: docs/superpowers/plans/2026-09-23-roster-auth-optimistic-checkin.md

Execution mode: Native fallback because this harness exposes no general-purpose subagent dispatch tool.

Pre-flight shared interfaces:
- Task 1 → Task 3: roster normalization/encryption helpers are consumed by the XLS importer; signatures and privacy requirements agree.
- Task 1 → Task 4: canonical name/phone normalization is consumed by allowlist login; dependency must remain one-way (auth may import roster normalization, roster normalization must not import auth). Clean after plan self-review.
- Task 2 → Task 3: member_roster schema/users.roster_id are consumed by live import/backfill; no destructive user/checkin migration is allowed. Clean.
- Task 2 → Task 4: roster repository feeds allowlist login; login must create users only after roster match. Clean.
- Task 2/3 → Task 5: roster metadata and participant links feed admin CRUD/statistics; roster-only people must stay out of participant denominators. Clean.
- Task 4 → Task 6: first-login participant creation and existing admin mapping are verified after live import; existing user id/checkins remain stable. Clean.
- Task 5 → Task 7: participant identity changes are independent of checkin persistence; optimistic helpers consume MemberDashboard shape and must preserve roster-driven identity. Clean.
- Task 7 → Task 8: optimistic UI and reduced POST response are consumed by Preview verification; no interface conflict found.

Ruling: Use the existing GitHub feature branch as the isolated workspace instead of a local git worktree — this harness has GitHub repository actions but no mounted git checkout — cost if wrong: local Superpowers helper scripts/ignored workspace cannot be used, so progress is recorded in a committed execution ledger instead.
Task 1: RED observed in GitHub Actions run 35822168409 — roster normalize/crypto modules absent and malformed roster key was not rejected.
Task 1: Ruling: ROSTER_ENCRYPTION_KEY is optional in the global environment contract during staged rollout, but requireRosterEncryptionKey() fails closed when roster encryption is actually invoked — prevents breaking the already-live Preview before the private key can be installed, while roster operations remain impossible without the key — cost if wrong: a missing key is detected at first roster operation instead of process startup.
Task 1: Ruling: defer SheetJS installation from Task 1 to Task 3 where it is first consumed — avoids an unused dependency and package-lock-only churn before importer work — cost if wrong: Task 3 owns one extra dependency setup step.
Task 1: complete (commits 725685a..bc83b57, verification: GitHub Actions run 35822508617 — 16 test files / 59 tests PASS, lint PASS, production build PASS, E2E PASS).
Task 2: RED observed in GitHub Actions run 35822662694 — member_roster export/users.rosterId/repository were absent.
Task 2: complete (commits 2d7e0ba..0cfffbb, verification: GitHub Actions run 35822834677 PASS; Supabase migration member_roster applied; users=1/checkins=1 unchanged; Security Advisor 0 findings; only pre-production unused-index INFO notices).
Task 1: Ruling: numeric village/sam components drop leading zeroes (e.g. 01마을 + 06샘 → 1-6) — actual XLS uses zero-padded sam values while the approved UI format is 1-6 — cost if wrong: display/group labels change from zero-padded source notation to human-readable numeric notation.
Task 1: complete (commits 725685a..bc83b57, verification: GitHub Actions run 35822508617 — 59 tests PASS, lint PASS, production build PASS, Playwright E2E PASS).
Task 2: complete (verified at current HEAD: member_roster schema/repository tests included in full CI; Supabase migration 20260923053408 member_roster present; users.roster_id nullable+unique; roster indexes present; Security Advisor 0 findings; Performance Advisor only unused-index INFO; users=1 and prayer_checkins=1 unchanged by this verification).
Task 1 late regression: RED observed in run 35828053043 — actual XLS-style zero-padded village/sam values produced 01-06 instead of 1-6.
Task 1 Ruling: normalize purely numeric village/sam parts through Number() after suffix removal so 01/06 render as 1/6 — matches the approved display rule and actual XLS formatting — cost if wrong: a deliberately significant leading zero in a non-numeric group code would be removed; current source uses numeric village/sam codes.
Task 3: importer code complete (GitHub Actions run 35828946837 — importer tests PASS, lint PASS, build PASS; private XLS validated locally: 411 rows, 59 suffix names, 10 duplicate canonical-name groups, 0 duplicate credentials, 9 missing phones, 0 invalid phones).
Task 3 Ruling: move live XLS import/key installation to Task 6 integration — Vercel connector still exposes no environment-variable write action, and installing a new encryption secret is security-sensitive; code can proceed with synthetic tests while live data remains untouched — cost if wrong: an integration issue in the importer is discovered later, but before main merge.
Task 4: complete (commit 93000ab, verification: GitHub Actions run 35829465738 — roster allowlist auth tests PASS, lint PASS, production build PASS).
Task 5: complete (commits 3d26beb..186fe08, verification: GitHub Actions run 35830314088 — 22 test files / 80 tests PASS, lint 0 errors, production build PASS).
Ruling: execute Task 7 before the live-data portion of Task 6 — optimistic check-in is interface-independent from roster import, while Task 6 requires installing a new security secret with user action; this keeps code progress moving without touching live PII — cost if wrong: Task 6 integration could expose a cross-feature issue after Task 7, still before main merge.
Task 3 integration RED: GitHub Actions run 35833963239 — actual-source exception test expected 관리샘 but makeSamLabel returned null.
Task 3 Ruling: preserve a nonstandard village-cell value ending in “샘” when the sam cell is blank (actual source has 20 관리샘 rows) — avoids discarding explicit source grouping while regular numeric rows stay 마을-샘 — cost if wrong: future malformed village text ending in 샘 would be treated as a valid special label.
Task 3 source exception fix: complete (commit 046eb2e; GitHub Actions run 35834123472 PASS — tests, lint, production build).
Task 7: complete (commit d47b470; GitHub Actions run 35830784282 PASS — optimistic state tests, full unit suite, lint, production build).
Ruling: keep the approved separate ROSTER_ENCRYPTION_KEY rather than moving it into Supabase Vault — Vault is available, but co-locating data access and the phone decryption secret changes the approved security boundary and adds async secret-fetch complexity — cost if wrong: one manual Vercel secret setup remains necessary before live import.
Task 6 preview-import helper RED: GitHub Actions run 35834623245 — parseRosterWorkbookBuffer absent and importRosterCandidates required raw admin phone.
Ruling: add an adminCredential canonical-name+phone-HMAC selector alongside the CLI raw credential path — lets the authenticated Preview admin import without exposing the administrator phone again; existing CLI remains compatible — cost if wrong: importer API has two equivalent admin-selection paths to maintain.
Task 6 admin-upload RED: GitHub Actions run 35846726843 — tests/admin/roster-import.test.ts failed because roster-import-service was absent.
Task 6 Ruling: use an authenticated admin-only multipart XLS upload endpoint for live import — encryption happens inside Vercel with ROSTER_ENCRYPTION_KEY, so the private XLS and raw phone values never enter GitHub or this chat; the current admin user’s existing name+phone HMAC selects the admin roster row without re-entering the phone — cost if wrong: initial import depends on the Preview admin session and one manual secret setup in Vercel.
Task 6 admin-upload helper: complete (commits b8d584c..deccd12; push CI run 35846933938 PASS; PR CI run 35846940091 PASS; Vercel Preview deployment for deccd12 succeeded).
Task 6 live import gate: blocked only on security-sensitive ROSTER_ENCRYPTION_KEY installation in Vercel; current connector exposes no env-var write action, so user must install the secret once before import.
Runtime regression: /api/health and /api/checkins both returned healthy data while / returned HTTP 500, isolating the failure to dashboard server prerendering rather than DB/session/data retrieval.
Runtime regression RED: GitHub Actions run 35991129476 — browser-only dashboard boundary test failed because PrayerDashboardNoSsr did not exist.
Runtime regression Ruling: render the interactive prayer dashboard client-only via next/dynamic({ ssr:false }) — Next.js Client Components are server-prerendered by default, and this isolates the failing prerender path while preserving server-side auth/data loading — cost if wrong: the dashboard shell shows a short loading state and loses SSR for the interactive calendar, acceptable for this authenticated app.
