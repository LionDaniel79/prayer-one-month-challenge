# SDD ledger — plan: docs/superpowers/plans/2026-09-24-56-sarang-shell-notices-push.md

Execution mode: Native / executing-plans.

Setup Ruling: Local isolated worktree unavailable because this harness cannot clone GitHub over the container network. Continue on the existing non-main feature branch through the GitHub connector and use GitHub Actions as the RED→GREEN execution environment. Cost if wrong: weaker filesystem isolation than a native worktree; mitigated by feature-branch-only commits and per-task CI gates.

Pre-flight Task 1→Task 3: Task 1 produces MemberSidebar/MemberShell; Task 3 consumes MemberSidebar to attach unread notice badge. Interface is compatible; Task 3 must preserve the exact menu order.
Pre-flight Task 2→Task 3: Task 2 produces notice member APIs/services; Task 3 consumes published list/detail/unread-count. Interface is compatible.
Pre-flight Task 2→Task 4: Task 2 creates push_subscriptions table; Task 4 consumes it. Interface is compatible.
Pre-flight Task 2→Task 4: notice publish must distinguish first draft→published transition from later edits so Push is sent only once. Plan amended with didPublish signal.

Task 1 Ruling: The four member items are navigation tabs/routes, not four simultaneous dashboard panels. The sidebar stays visible while the main content area renders exactly one selected feature: prayer at '/', visits at '/visits', prayer requests at '/prayer-requests', notices at '/notices'. The earlier multi-panel image was a presentation collage only. Cost if wrong: the app would violate the user's core navigation expectation and become cluttered on desktop/mobile.

Task 1: complete — shared 56사랑 shell/PWA branding and one-route-per-feature navigation are implemented; CI run 36013923330 passed npm test, lint, and build.
Task 1 Ruling: Member navigation renders exactly one feature route in the main content area; the earlier multi-panel mockup is reference-only — cost if wrong: violates the user's primary navigation requirement.
Task 2: complete — notices/notice_reads/push_subscriptions schema, published-only member APIs, admin CRUD, and read statistics are implemented; current Supabase migration notices_push applied.
Task 2 Ruling: Because notices_push had already been applied before explicit anon/authenticated revokes were added, keep the fresh-install revokes in 0004 and add/apply an idempotent notices_role_revokes backfill migration — cost if wrong: current Preview and fresh installs could diverge in table privileges.
Task 3: complete — notice list/detail pages and unread sidebar badge are implemented; CI run 36013923330 passed npm test, lint, and build.

Task 4: complete — Web Push fan-out, VAPID config parsing, subscription persistence/API, service worker, opt-in UI, and first-publication push dispatch implemented; CI run 36015373124 passed 120 tests, lint, and production build.
Task 4 Ruling: WEB_PUSH_* values remain optional at process startup and are required only when push operations are attempted, so notices and the rest of the app remain available before VAPID secrets are installed — cost if wrong: push misconfiguration is detected at feature use rather than boot.
Task 4 Ruling: PushManager applicationServerKey is decoded to a real ArrayBuffer rather than Uint8Array<ArrayBufferLike> to satisfy TypeScript 6 DOM types; RED test application-key.test.ts pinned the boundary — cost if wrong: unsupported buffer typing would block production build.
Task 5 Ruling: Vercel Hobby reached a deployment build-rate limit ("retry in 24 hours") during implementation. Continue using GitHub CI as the code verification gate and defer live Preview checks until the platform limit clears — cost if wrong: newest UI cannot be visually verified on Vercel until a later deployment.
Task 5 pending: VAPID secret generation/installation and live Push verification are security-sensitive operational steps and remain for final integration.

Visit Task 1: complete — visit schema/date policy implemented; CI run 36129944679 passed tests, lint, and build; Supabase migration visits_google_calendar applied and verified with all four tables present.
Visit Task 1 Ruling: private visit/calendar tables revoke anon/authenticated privileges in the same additive migration because all access remains server-only through the existing app session model — cost if wrong: direct Data API clients cannot use these tables, which is intentional for sensitive visit/calendar data.

Visit Task 2: complete — member availability API, date calendar, right-side/mobile request panel, request API, duplicate-date recheck, and private-reason exclusion implemented; CI run 36130816886 passed tests, lint, and build.
Visit Task 2 Ruling: introduced VisitBookingClient as a small coordinator so VisitCalendar and VisitRequestPanel remain independent/testable — cost if wrong: one extra client component boundary, but no data-model impact.
Visit Task 3: complete — Google Calendar OAuth scopes/state, AES-256-GCM refresh-token encryption, connection repository, calendar list/selection endpoints, googleapis provider, and selected-calendar factory implemented; CI run 36131441468 passed tests, lint, and build.
Visit Task 3 Ruling: OAuth redirect URI is derived from request origin instead of stored as a secret/config value, allowing Preview and Production callbacks to use their actual host while Google Cloud still requires those callback URLs to be registered — cost if wrong: an unregistered host gets Google redirect_uri_mismatch rather than exposing or misrouting credentials.
