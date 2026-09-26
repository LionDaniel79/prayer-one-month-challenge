# SDD ledger — plan: docs/superpowers/plans/2026-09-24-56-sarang-admin-integration-release.md

Execution mode: Native / executing-plans.
Setup Ruling: local worktree unavailable in this harness; continue on feature/prayer-one-month-challenge through the GitHub connector with GitHub Actions as RED→GREEN gate — cost if wrong: weaker filesystem isolation than a local worktree.

Pre-flight Task 1→Task 2: shared AdminShell/AdminSidebar wraps the hub dashboard; interface matches.
Pre-flight Task 2→Task 3: dashboard uses focused aggregate service and does not depend on the old monolithic AdminDashboard; interface matches.
Pre-flight Task 3→Tasks 4–6: split prayer/user management frees independent notice/prayer-request/visit/settings routes; no shared state contract conflict.
Pre-flight Visit plan→Task 6: admin visit APIs, blocked-date/weekday APIs, and Google Calendar admin APIs are present and consumed by the UI; interfaces match.
Pre-flight notice/prayer-request plans→Tasks 4–5: admin APIs are present and consumed by dedicated management UIs; interfaces match.

Admin Task 1: complete — shared responsive admin shell and exact seven-item navigation implemented.
Admin Task 2: complete — lightweight summary dashboard and safe recent-activity projections implemented.
Admin Task 3: complete — prayer management and user/roster management split from the legacy monolithic dashboard while preserving existing APIs.
Admin Task 4: complete — notice list/editor management with draft/published filters, read statistics, edit/delete and first-publication Push behavior implemented.
Admin Task 5: complete — prayer-request list/detail/status management implemented.
Admin Task 6: complete — visit list/detail/edit/confirm/complete/cancel UI plus Google Calendar selection, blocked date/weekday settings, and safe Push configuration status implemented; CI run 36231285182 passed all tests, lint, and production build.
Admin Task 6 Ruling: integration settings receive only safe booleans/status data; Google/VAPID secret values are never passed into client components — cost if wrong: operators see configuration health rather than raw credentials, which is intentional.
Admin Task 6 Ruling: initial client data loads update React state only from asynchronous fetch callbacks to satisfy React 19 effect rules — cost if wrong: one extra explicit initial-fetch path per screen, but no API/data-model impact.
