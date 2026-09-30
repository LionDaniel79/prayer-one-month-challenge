# Monthly pastoral reports implementation plan

> Execute inline using superpowers:executing-plans. Supersedes the previous unshipped weekly/grant design.

**Goal:** Deliver the revised monthly-only reporting workflow in the existing app and production deployment.
**Architecture:** Reuse the private server-only reporting subsystem, derive leadership from the existing sam directory and village-leader records managed in the same user-management card. Keep uploaded bytes chunked and finalize atomically.
**Tech Stack:** Existing Next.js/React/TypeScript/Drizzle/PostgreSQL stack; no added runtime dependencies.
**Spec:** User request of 2026-09-30 and the decisions below.

## Rules
- No independent pastoral role/grant manager, weekly settings or editable submission windows.
- Add village leaders within Users > Sam Leader Management as `1마을장` + leader name. Store separately from sams to avoid fake groups in prayer/visits.
- Resolve permissions by unique active roster source-name and same sam/village; preserve A/B disambiguation. No match or duplicate fails closed.
- Only selected months in the current or next Seoul calendar year can be configured. Once saved, a request is submit-able only during its actual calendar month.
- Current-month outstanding sam obligation controls !. Past/future months do not produce a reminder. One finalized report in ANY method clears it. Additional reports in that month remain allowed.
- Reports remain readable in history after the month closes/request is deselected. Only author and admin read content, files, TXT.
- Remove community field; written date defaults to Seoul today and is editable. Submitter is server-derived. All content optional, except a reason when no-meeting is checked.
- Max 2 attachments, each 6MiB, chunks 512KiB, hashes verified. No completed status for partial transfers. Repeated finalization remains idempotent.
- Additive migration only; no operational records or keys modified by tests.

## Tasks
- [ ] 1. RED then GREEN policy tests: calendar-month boundaries, current/next year, any-method completion, optional form/no-meeting reason, authoritative leader mapping.
- [ ] 2. Change service/schema and remove grants; add village directory API/UI in existing user management.
- [ ] 3. Monthly admin and portal, simplified form, safe photo/file/TXT. Tests for privileged vs ordinary users, replay, multi-submit, current-month admission.
- [ ] 4. Whole-branch self-review, pure tests, remote CI (unit/lint/build/disposable TLS DB/E2E). Fix all failures without skipping.
- [ ] 5. Verify live migration state; apply additive migration, check privacy. Merge with expected SHA; verify deployment target, health and release marker.

## Review focus
Stale month at midnight; same-name roster collisions; admin/village submission and reminder scope; cross-site or forged submitter; response loss or half-upload must not lose/duplicate submitted data.
