# SDD ledger — plan: docs/superpowers/plans/2026-09-24-56-sarang-visits-google-calendar.md

Execution mode: Native / executing-plans.
Setup Ruling: local worktree unavailable; continue on feature/prayer-one-month-challenge using GitHub Actions as RED→GREEN gate — cost if wrong: weaker local isolation.
Pre-flight Task 1→Task 2: date-policy and visit schema are consumed by availability/booking service; interfaces match plan.
Pre-flight Task 2→Task 3: CalendarProvider interface is implemented by GoogleCalendarProvider; keep provider boundary independent of googleapis types.
Pre-flight Task 2→Task 4: submitVisitRequest repository/provider compensation contract is consumed by final booking synchronization; preserve exact requested/pending/synced behavior.
Pre-flight Task 3→Task 5: live OAuth verification requires external Google OAuth credentials and is security-sensitive; code implementation may proceed before credentials are installed.

Visit Task 4: complete — admin visit list/detail/edit, confirm/complete/cancel, blocked-date CRUD, repeated blocked-weekday management, and shared weekday-conflict helper implemented. CI run 36220581305 passed all tests, lint, and production build.
Visit Task 4 Ruling: admin visit API routes follow the same requireAdmin + DomainError pattern as notices/prayer-requests and obtain the selected Google Calendar provider per action — cost if wrong: Google-disconnected admins receive a safe Calendar domain error for Calendar-mutating visit actions instead of editing calendar-visible fields offline.
