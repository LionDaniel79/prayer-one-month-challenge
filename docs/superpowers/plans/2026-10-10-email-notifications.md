# Submission email notifications implementation plan

> For agentic workers: use superpowers:executing-plans, test first and verify each boundary.

**Goal:** After a successful new pastoral report, visit request or prayer request, notify the administrator's own Gmail with one Korean sentence.
**Architecture:** A private transactional outbox captures only submission identity and optional visit time. A separate Gmail send-only consent uses the existing OAuth client/callback but never changes Calendar credentials. Next.js after plus an authenticated scheduled dispatcher deliver bounded batches.
**Tech Stack:** Existing Next.js/TypeScript/Drizzle/PostgreSQL, Google OAuth2/Gmail REST; Supabase Cron/Vault for retry wakeups.
**Spec:** ../specs/2026-10-10-email-notifications.md

## Global constraints
No new mail is sent until recipient account consent, a successful explicit verification email, and notification activation. Production-only dispatch. No historical backfill. No prayer text, visit reason, attendees, place, contact numbers or attachments in mail/outbox/logs. Calendar credentials and grants are not revoked or changed. Recipient value is deployment configuration, never source code. No production member test writes. Unknown send outcomes are held, not automatically retried.

## Review focus
- A saved upload draft or failed Calendar sync must not notify.
- Repeated completion and edits must not notify again; source cancellation removes unsent data.
- Changing recipient or disconnecting while a job is leased must not reroute or send stale work.
- OAuth state is single-use, expiring, bound to the current admin session and purpose.
- Preview/CI must never send real mail using a shared production database.

## Tasks
1. Policy/provider tests RED: exact Korean sentences, missing/non-time free text, MIME injection, strict recipient, purpose-separated authenticated encryption, OAuth claims, production scope, retry/unknown outcomes.
2. Implement src/features/email/policy.ts and provider.ts. GREEN unit/policy suite.
3. Add drizzle/20261010010000_submission_email_notifications.sql: private settings/outbox/state, unique source key, new-completion triggers, cancellation and retention. Exercise with disposable TLS DB; no changes to existing data.
4. Implement repository.ts, oauth.ts, dispatcher.ts, http.ts. Add authenticated admin actions and isolated callback dispatch. Use leases and send-attempt state; no silent fire-and-forget.
5. Add a collapsed EmailNotifications panel to the admin dashboard; existing menus remain unchanged. Explicit connect, verification email, enabled save and disconnect. No credentials returned to the browser.
6. Add post-response wakeups only to successful submission routes; scheduled protected dispatch recovers pending work.
7. Browser/DB integration tests: trigger lifecycle, cancellation, auth and production boundary, administrator panel 360/1280px. Update privacy/operations/install documents without legal-compliance claims.
8. Full CI plus manual code review. Apply additive schema and private recipient/origin configuration; schedule secure retry wakeup. Merge only exact green SHA; verify Production SHA, health/auth boundaries. Report Gmail user consent and actual delivery separately.

## Execution ledger
- Resumed existing design commit 5ac12a2; current main 49a2cba. User requested autonomous continuation.
- Vercel management returns 403 for its existing team; no credentials harvested. Existing GitHub integration is used for deployment.
- Google/Gmail profile confirms the administrator's address privately; it is not copied into this document.
- Local runtime has no external DNS. Remote CI provides full dependency/build/browser validation; pure Node tests remain independently runnable.
