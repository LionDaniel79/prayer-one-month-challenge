# Pastoral refinement implementation plan

> Execute inline with superpowers:executing-plans. No subagent is available.

**Goal:** Apply the user's ten refinement requests without losing existing reports or Calendar credentials.
**Architecture:** Existing Next.js/pg module plus additive revision sessions; shared input fields; existing role and API boundaries.
**Tech Stack:** Node22 / TypeScript / Next / PostgreSQL / Playwright.
**Spec:** ../specs/2026-09-30-pastoral-refinement-design.md

## Tasks
- [ ] Pure policy regressions: unique canonical village match, ambiguity denial, optional other field, deprecated visits removed from output, edit input and version/ownership.
- [ ] Additive revision schema and service: begin/upload/commit/cancel; owner/admin endpoints; versioned explicit submitted-report delete; preserve original author/month/legacy data.
- [ ] Shared form and editor UI, detail actions and refresh, badge restoration, collapsible admin roster and compact metadata.
- [ ] Calendar settings relocation, legacy redirect, hidden push/settings nav, 56love naming and honest domain transition documentation.
- [ ] Actual DB/E2E: ownership, admin edits, legacy data, no meeting reason, attachments/incomplete/retry/version collision, deletion count and month boundaries, settings redirects and callback.
- [ ] Review, full CI, production DB preflight/additive migration/postflight, merge and deployment verification; report domain permission blocker separately.

## Review focus
Concurrent edit/delete; stale image/chunk read after replacement; noMeeting invalid legacy rows; retired users/different-village homonyms; callbacks and unknown/new hosts. Tests use only disposable DB. No snapshots from the supplied handwritten private report.
