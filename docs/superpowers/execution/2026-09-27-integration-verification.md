# Integration verification — 2026-09-27

## Starting state and patch provenance

- PR #1 was open, unmerged, and mergeable. Feature HEAD: `336a90727ea2aaa4a61de4091f799fe5581d93bf`; main: `27ec029be81a85d3855ec565f6908c34e892dff2`.
- The previous ChatGPT conversation described `/mnt/data/56-sarang-handoff/56-sarang-pending-fixes.patch`. The Windows task received no attachment and the file was not present in the workspace/downloads searched. Therefore the original patch was **not** applied or checked with `git apply --check`; byte-for-byte equivalence cannot be claimed.
- Reconstructed the recorded items from the branch and reproducible evidence: three Calendar handlers, authorization expectations, production-server E2E configuration, README/operations updates. All additional fixes below came from actual test failures.

## Reproduction and fixes

1. The `connect`, `status`, and `connection` Calendar handlers allowed `requireAdmin` to throw outside a DomainError response boundary. Added executable route tests (real authorization logic; mocked session/database/provider boundaries): 8 failures before the fix, all 17 passing afterward. Unauthorized users and members receive JSON `403 FORBIDDEN`; expected domain failures retain status; unexpected database failures still propagate. Best-effort Google token revocation does not swallow local deletion failures.
2. Existing CI run [36280972399](https://github.com/LionDaniel79/prayer-one-month-challenge/actions/runs/36280972399) showed dev HMR origin rejection followed by `/login?`, with no successful login request. Reproduced locally against TLS PostgreSQL 17: after authorization fixes, 3 browser tests passed and 8 login flows failed. Production server changed that result to 9 passing / 2 failing, without changing login code.
3. Those two failures were authenticated API calls returning no dashboard/unread count. Playwright 1.63 `Cookie.matches` permits Secure cookies on HTTP only for `localhost`/`.localhost`; Chromium also permits numeric loopback. Changed the production server and base URL together to `localhost`. Added an authenticated `/api/checkins` 200 assertion to the login helper to prevent false-positive member authorization tests. Preserved and asserted the production Secure cookie flag.
4. The remaining retry test matched both the app error and Next's route announcer via `role=alert`. Scoped the assertion to the main content. Kept the real POST/DB commit followed by response loss; no production behavior was weakened for the test.
5. Normalized Windows route separators during HTTP-handler enumeration, used one worker for shared synthetic fixtures, and added browser coverage for missing Calendar config, invalid OAuth state, safe disconnected status, and fail-closed visit submission.

## Verification

- Node 22.20.0, clean `npm ci` (first attempt hit a transient Windows executable lock; retry succeeded without dependency changes).
- `npm test`: 63 files / 226 tests passed.
- `npm run lint`: exit 0, 0 errors; existing warnings in MemberShell (`img`) and LogoutButton (internal location navigation).
- `npm run build`: exit 0, TypeScript and production build passed.
- `npm run test:e2e`: fresh synthetic TLS PostgreSQL 17.10, production Next server; 13 passed, 0 skipped.
- `npm audit --omit=dev`: 0 vulnerabilities. Install audit reports 4 moderate development dependency findings; no forced unrelated dependency upgrade performed.
- Independent read-only code review: no material findings. Clarified that unused optional integration variables must be unset, not empty.
- Remote CI/Preview status is recorded in PR #1 after pushing; local results above are not a substitute for that remote result.

## External checks and limits

- Supabase project `mraqwckqvxkozvzyszhv`: healthy; Security Advisor 0 findings. `anon` and `authenticated`: schema USAGE false, explicit app table grants 0. Calendar connections 0, selected Calendars 0, Push subscriptions 0. Read-only queries only.
- Vercel connector lists no accessible teams and rejects the known `ditto0310-2413` scope with 403. Do not infer missing environment variables from this authorization failure or from absent subscriptions.
- Actual Google OAuth consent, live Calendar event round trips, and device Push receipt remain user-assisted acceptance steps. No operating secrets or user consent were fabricated. Main must remain unmerged.
