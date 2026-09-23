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
