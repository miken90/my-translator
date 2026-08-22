# Git cleanup — screenshots deleted, plan files committed, merged branches pruned

Continuation of plans/reports/builder-260822-1056-git-cleanup.md (secret-scan gate). User decided: delete both flagged screenshots.

## Task 1 — screenshot deletion

Deleted (never committed, working-tree only):
- `plans/ui-screenshots/issue-1-sessions-popup-no-scrollbar.png`
- `plans/ui-screenshots/issue-2-toolbar.png`

`plans/ui-screenshots/` dir removed (empty after deletion, `rmdir` succeeded).

Files referencing the filenames, and disposition:
- `plans/reports/builder-260822-1056-git-cleanup.md`, `plans/reports/code-reviewer-260821-1642-uiux-plan-red-team.md`, `plans/reports/planner-260821-1640-uiux-overhaul-plan.md`, `plans/reports/thinker-260821-1837-uiux-p6.md` — under `plans/reports/`, historical record, **left as-is** per spec (do not rewrite reports).
- `plans/260821-1640-uiux-overhaul/phase-01-session-viewer-scroll-region.md` (L47), `phase-05-small-fixes.md` (L112, L177), `phase-06-reskin-concepts.md` (L31), `plan.md` (L128, L431), `concepts/README.md` (L38) — live plan dir, already committed/tracked before this task. Checked each: none instruct a reader to *open* the PNGs. All cite them in past tense to record a derivation/measurement already stated inline (pixel values, "documents the original defect", "was cited as evidence ... it is the pre-P2 toolbar"). No directive like "see the screenshot for X" without inline detail. Per spec (note only if it *instructs opening*) — **left as-is**, no edits made.

## Task 2 — commit

Staged only `plans/` (`git add plans/`). Verified `git diff --cached --name-only`:
- 36 files, all under `plans/`, none outside.
- Neither screenshot filename present (they were deleted, never tracked, so never staged).

This report file included in the same commit (written before commit, then `git add`-ed).

Commit: `docs: add remaining uiux-overhaul and card-layout-speed plan files`
SHA: **(recorded post-commit below)**

Pushed to origin/main, no force.

## Task 3 — merged branch deletion

`git branch --no-merged main` returned empty before deletion — premise confirmed.

| Branch | Tip SHA (recoverable) | Deleted |
|---|---|---|
| feat/uiux-p1-p2-session-scroll-toolbar | bc1f1435859d40dd6d95f7801a26d978b8b59c7a | -d |
| feature/meeting-features | a768e03a3ec90ecebd3236aacdc6a0d332861ed8 | -d |
| refactor/phase-1-delete-macos | f10dd1b378a9120803a2e5faeacc82878bd45b88 | -d |
| refactor/phase-2-tests | 504cd6baade79e3898873b51b7edbd2de6df167a | -d |
| refactor/phase-3-rust | a1f99c1083d36c2c54de00e6b55beb9fc8e2d1e0 | -d |
| refactor/phase-4-frontend | eaa2fce255e6e46c2ef64eb3e17dca957e2b7273 | -d |
| refactor/phase-5-render | 421965b921fd81811b91057052033920920bba6b | -d |

All local-only; nothing on origin touched, `main` untouched, no tag touched.

## Verification

- `git status` clean.
- `git branch` shows only `main`.
- local `main` == `origin/main`.
- `v0.7.0` tag present locally and on origin.
- `git log --all --oneline -- plans/ui-screenshots/` empty — screenshots never entered history.
- vitest: **(recorded below)**

## Unresolved questions
None.
