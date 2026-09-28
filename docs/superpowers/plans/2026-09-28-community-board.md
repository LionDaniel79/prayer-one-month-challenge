# Community Board Implementation Plan

> Execution: superpowers:executing-plans. User requested autonomous implementation and deployment.

**Goal:** Member folder board immediately above notices, with 2 x 6MB attachments, comments and likes.
**Architecture:** Existing sessions and database; additive private tables; bounded chunk transfer; shared authorized member/admin UI.
**Spec:** docs/superpowers/specs/2026-09-28-community-board-design.md

## Global constraints
Preserve existing records, no new secrets, no public file access. 6291456 bytes/file, 524288 bytes/chunk. Admin folders/moves; owner or admin edits/deletes. Likes are explicit desired-state writes.

## Review focus
- Streamed body without Content-Length cannot bypass limits.
- Lost responses must not duplicate posts/comments/likes.
- File mutation and publication share row lock.
- Moves preserve files/comments/likes, deletion cascades, populated/last folder deletion rejected.
- Nonmembers and different members cannot read drafts or private chunks.

## Task 1 — policies/schema
Write and run RED policy and route tests. Add six private tables and size/uniqueness constraints. GREEN pure validation and verify migration in disposable DB.

## Task 2 — services/API
Implement focused folders/posts/files/comments/likes modules. Add authenticated HTTP dispatcher, bounded stream parsing, Origin check, safe error projection. Test actual DB through browser API including concurrency and response loss.

## Task 3 — member/admin UI
Folder overview/list/search/paging, write/edit/detail, file picker/progress/download, comments, likes, management controls and draft recovery. Verify 360px UI and real browser upload/download.

## Task 4 — release
Review diff, full CI, Supabase additive migration and advisors, feature integration and PR #1 update, Vercel deploy/shared URL check. No production data content in tests or reports.
