# SDD ledger — plan: docs/superpowers/plans/2026-09-24-56-sarang-admin-integration-release.md

## Scope and evidence

Resume final integration verification (Task 8) from feature/prayer-one-month-challenge at be4ff70b16656f8f3e06cfeb3b4f0836dd80b8c3. The latest approved scope is 56사랑, not only the initial prayer tracker. Preserve roster-based login, the four member menus, seven admin pages, all prayer/date rules, private prayer requests, notices/push, and visits/Google Calendar.

Baseline: GitHub Actions PR run 36275733945 completed successfully. Main contains design documents only; PR #1 remains open. Do not merge main without separate acceptance.

Setup Ruling: local git network access is unavailable. Use the GitHub connector with fast-forward-only ref updates and GitHub Actions as executable RED/GREEN verification. A short-lived artifact records the exact tracked source, never runtime secrets.

## Findings / regression scope

1. A prayer check whose successful response is lost is reversed by a retried toggle. Send explicit desired state, retain legacy toggle compatibility, and pin the challenge identity so an old page cannot write into a newly activated challenge.
2. A Google deletion followed by a database failure cannot be retried because an already-deleted event returns HTTP 410. Treat only 410 as idempotent success; keep 404/permission/transport errors visible.
3. CI currently mutates the lockfile and has repository write permission, and does not execute browser tests. Use npm ci, read-only permissions, cancellation of superseded runs, bounded duration, and browser verification artifacts.

Pre-flight: the check-in API consumes the existing service and the optimistic dashboard; desired-state fields are optional for old clients. CalendarProvider.deleteVisitEvent is used by booking compensation and admin cancellation, so only a definitively deleted response may be ignored.

Verification stage: regression tests committed before production changes. Await executable RED evidence, then implement the fixes and rerun the complete suite.
