# Global prayer menu visibility implementation plan

> **For agentic workers:** Execute with superpowers:executing-plans; implementation and verification stay on the feature branch until checks pass.

**Goal:** Put notices first, prayer second, and let an administrator save one prayer-menu visibility setting for every user.

**Architecture:** A private singleton PostgreSQL setting, independent of challenge activation. The member layout supplies its current value; authenticated no-store reads refresh open clients. A standalone form at the bottom of prayer management saves through an admin-only PUT endpoint.

**Tech Stack:** Existing Next.js App Router, React, Drizzle/PostgreSQL, Vitest, Playwright. No dependency or secret changes.

**Spec:** User request of 2026-10-02: 공지 first, 기도운동 second; bottom checkbox and Save; all users; deploy.

## Global constraints

Default enabled preserves current availability. No change to prayer/check-in records, users, sessions, challenge activation, or pastoral permissions. Mobile and desktop use the same menu. Administration remains accessible when the member menu is hidden.

## Review focus

Missing settings row defaults to true; malformed boolean input must never write; unauthenticated/member/cross-origin writes fail; network failure must not display a false save confirmation; open or newly logged-in clients must not land on a hidden prayer page.

## Task 1: Navigation and persistent setting

- [x] Add rendered-navigation tests and observe expected failures on unchanged code. CI 37015842820: only the three new assertions failed; 358 passed.
- [ ] Add route/service tests for authentication, authorization, strict input, singleton upsert, no-store responses, and private schema.
- [ ] Add `prayerMenuSettings` in `src/db/prayer-menu-schema.ts` and include it in `drizzle.config.ts`, migration, `src/features/prayer-menu/service.ts`, and member/admin route handlers.
- [ ] Change `components/app/MemberSidebar.tsx`, member layout/home, and shell polling to respect the same global setting without changing other permissions.

## Task 2: Admin control and verification

- [ ] Add `components/admin/prayer/PrayerMenuSettings.tsx` below the loader in `app/admin/prayer/page.tsx`. Load current value, explicit Save, pending state, retry/error feedback.
- [ ] Add synthetic E2E coverage for Save versus draft, persistence, desktop/mobile/member/admin, live refresh, root redirect, unchanged records, and failed save.
- [ ] Update old-order assertions and README. Run complete CI: unit, pastoral, lint, build, disposable DB, browser tests.
- [ ] Review full diff, apply additive production migration, verify default and private permissions, merge, confirm deployment status and public health.

## Execution decisions

The conversation link is not a file export; available project context and current repository were used. Container DNS is unavailable; exact source was obtained from the repository's existing CI artifact and execution uses GitHub Actions. No production identities are used for browser tests. An open visible member page refreshes the boolean on navigation/menu opening/focus and every 30 seconds; offline clients retain the last known value. A hidden root page redirects to notices; this is menu control, not deletion or revocation of historical prayer APIs.
