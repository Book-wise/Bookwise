# Archive Note — State Management Analysis

> Archived: 2026-09-02
> Source dir: `openspec/changes/state-management-analysis/` → `openspec/changes/archive/2026-09-02-state-management-analysis/`

This was the **exploration phase** that fed the `state-management-refactor` change
(dated 2026-06-26). It is a **pure analysis document** — it has no `proposal.md`,
no `specs/`, and no `tasks.md`; it is not a full change. It analyzed Bookwise's
state-management (10 validated pain points), compared approaches, and recommended
`@ngrx/signals` (SignalStore), which directly shaped the ReferenceStore refactor.

It is archived here alongside its follow-on change
(`../2026-09-02-state-management-refactor/`) so the active `openspec/changes/`
tree is clean. Per the archive rule, nothing in this exploration was modified
(`git mv` preserved history; `diff -r` readback was empty).
