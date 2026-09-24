# SDD ledger — plan: docs/superpowers/plans/2026-09-24-56-sarang-shell-notices-push.md

Execution mode: Native / executing-plans.

Setup Ruling: Local isolated worktree unavailable because this harness cannot clone GitHub over the container network. Continue on the existing non-main feature branch through the GitHub connector and use GitHub Actions as the RED→GREEN execution environment. Cost if wrong: weaker filesystem isolation than a native worktree; mitigated by feature-branch-only commits and per-task CI gates.

Pre-flight Task 1→Task 3: Task 1 produces MemberSidebar/MemberShell; Task 3 consumes MemberSidebar to attach unread notice badge. Interface is compatible; Task 3 must preserve the exact menu order.
Pre-flight Task 2→Task 3: Task 2 produces notice member APIs/services; Task 3 consumes published list/detail/unread-count. Interface is compatible.
Pre-flight Task 2→Task 4: Task 2 creates push_subscriptions table; Task 4 consumes it. Interface is compatible.
Pre-flight Task 2→Task 4: notice publish must distinguish first draft→published transition from later edits so Push is sent only once. Plan amended with didPublish signal.
