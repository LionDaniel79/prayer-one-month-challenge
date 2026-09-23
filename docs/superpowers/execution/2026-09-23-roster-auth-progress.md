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
