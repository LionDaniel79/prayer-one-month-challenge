# Stable leader identity — approved conditional selection

The user approved name entry with automatic linking for a unique active roster match, and explicit selection only for names with more than one candidate. Match both original and login names without discarding suffixes. Count candidates across the roster; show their scope but reject assignments outside the target sam/village. Never publish production roster names/phones in this repository.

- [ ] Add pure candidate/selection and persisted-ID authorization tests, observe RED, implement.
- [ ] Add nullable roster FK + binding lock to sams/village_leaders. Backfill only globally unique in-scope matches. Locked missing IDs never automatically relink after deletion.
- [ ] Integrate server resolver into existing sam/village save and import, private admin-only candidate API (masked phone suffix only). Reconcile never-linked records after roster changes.
- [ ] Add a shared conditional picker to existing forms, unresolved indicators to lists; no new permissions menu.
- [ ] Exercise duplicate/unique/invalid/stale/inactive/import/rename/first-login cases against disposable TLS DB and browser. Preserve existing member behavior.
- [ ] Inspect full CI, apply additive migration, inspect affected assignments/security, merge, verify actual Production SHA/domain/health. Do not choose ambiguous production identities.
