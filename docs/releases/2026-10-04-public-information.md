# Public app information and privacy policy

## Approved scope
Public `/about` and `/privacy` pages, phone/desktop readability, pre-login and Calendar-settings links, existing icon download. No changes to OAuth credentials/scopes, sessions, membership, application data, or production challenge dates.

## Evidence used for the policy
- `src/db/schema.ts` and community/pastoral modules: account, request, content, attachment and role data.
- `src/features/google-calendar/oauth.ts`: `calendar.events` and `calendar.calendarlist.readonly`.
- `src/features/google-calendar/provider.ts`: existing events read only status/start/end; writes include requester/leader, attendees/location/preferred time, but not visit reason or prayer request contents.
- `src/features/google-calendar/repository.ts` and disconnect route: encrypted refresh token / selected calendar storage; revocation is best-effort then local connection deletion; existing visits/events are not automatically removed.
- `src/features/auth/session.ts`: rolling 180-day authentication lifetime, not record retention.
- `src/features/admin/roster-service.ts`: roster removal disables linked accounts; does not erase all history.
- No universal submitted-record automatic deletion, fixed backup/log retention guarantee, or end-to-end encryption is claimed.

## Policy references consulted 2026-10-04
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://support.google.com/cloud/answer/13464321
- https://developers.google.com/terms/api-services-user-data-policy
- https://www.law.go.kr/법령/개인정보보호법/제30조

## Operator checks (not established by code or this deployment)
Publishing pages is not Google verification approval or a legal-compliance certification. The operator must confirm the designated privacy officer/contact, an appropriate records-retention schedule, vendor contracts and backup/log lifetimes, exact overseas recipient/country/contact/retention/transfer basis and required notices or consent, and handling of sensitive religious/health information. These business/legal facts cannot be inferred from a repository. Do not invent them or assume this page replaces separate consent where required. Update the policy and operating procedures when confirmed.

In Google Auth Platform Branding, set Homepage to `https://prayer-one-month-challenge.vercel.app/about` and Privacy Policy to `https://prayer-one-month-challenge.vercel.app/privacy`. Domain ownership, brand/scope review and publishing remain operator actions. Existing redirect URI remains unchanged. Adding a logo may require brand review.

## Verification
RED: CI run 37183890521, three new public-route/discovery assertions failed as expected, 382 existing tests passed (three DB tests deferred until disposable DB setup). Green verification must include full CI, anonymous 360/1280px browser tests and no-JavaScript rendering. Production Readiness checks both new pages plus the existing health/auth boundaries against the exact deployed commit. All browser fixtures are synthetic, not production member data.
