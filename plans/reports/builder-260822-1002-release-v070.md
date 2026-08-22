# Release v0.7.0 report

Dispatch: /home/canhnguyen/WORKSPACES/AI/boom/plans/260821-1617-mytranslator-uiux/dispatch-release-v070.md
Executed directly (no subagent delegation), all preconditions verified match before acting.

## Step 1 — square .float-btn
`src/styles/main.css:791` — `width: 26px` -> `width: var(--control-h-sm)` (28px), matching `height`. `.seg-card` untouched. Diff confirmed 1-line before commit.
Commit: `4d06672` fix(ui): square .float-btn to match --control-h-sm

## Step 2 — version bump 0.6.0 -> 0.7.0
Files touched: `package.json`, `package-lock.json` (via `npm install`), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (only the `my-translator` package's own version entry, via `cargo check` after reverting an over-broad `cargo generate-lockfile` — see Concerns).
About tab verified dynamic: `src/js/app.js:503` calls `window.__TAURI__.app.getVersion()`, writes to `#about-version` (`src/index.html:668`, defaults to `—`); no hardcoded version string.
Grep for other hardcoded `0.6.0`: found only in `docs/`, `plans/`, `RELEASE_NOTES.md` — all historical references to the *previous* release (roadmap entries, past-release reports, prior plan docs). Not version-carrying build files, not in the dispatch's file list. Left unchanged — flagging per dispatch instruction to report before changing.
Commit: `bc1f143` chore: bump version to 0.7.0

## Step 3 — merge to main
`main` confirmed at `b4cdf50`, clean, before merge. `git merge --no-ff feat/uiux-p1-p2-session-scroll-toolbar` — 0 conflicts. Merge commit: `99a1145`. Branch not deleted, no rebase/squash.

## Step 4 — build and test (post-merge, on main)
- vitest (via `npx vitest run` through `powershell.exe`): **108/108 passed**, 17 files. Matches spec expectation exactly.
- cargo test (via `powershell.exe`): **16/16 passed**, 0 failed.
- Build: `cargo build --release --manifest-path src-tauri\Cargo.toml` run directly via `powershell.exe` (not `build-release.sh`, per dispatch — its known WSL flaw). Packaging (copy + `Compress-Archive`) replicated manually via `powershell.exe` since the script's `/tmp` staging step is WSL-only.
- Artifact proof (disk, not exit code):
  - `.exe`: `D:\WORKSPACES\PERSONAL\my-translator\src-tauri\target\release\my-translator.exe` — 11,363,840 bytes, LastWriteTime 2026-08-22 10:11:27.
  - `.zip`: `D:\WORKSPACES\PERSONAL\my-translator\dist\MyTranslator-v0.7.0-windows-x64.zip` — 3,698,837 bytes, LastWriteTime 2026-08-22 10:11:40.
  - Cross-verified from WSL (`ls -la`, `unzip -l`): zip contains `MyTranslator.exe`, 11,363,840 bytes — byte-identical to the built exe. Filename carries v0.7.0.
- All green — proceeded to push.

## Step 5 — tag and push
Annotated tag `v0.7.0` on merge commit `99a1145`. Pushed `main` (`b4cdf50..99a1145`) and tag `v0.7.0` to `origin`. No force used.

## Step 6 — GitHub release
`gh release create v0.7.0` (repo `miken90/my-translator`, account stayed `miken90` throughout — never switched) with the versioned zip and user-facing notes (session viewer, toolbar regroup, elapsed timer, minWidth fix, dynamic About version, focus rings, disabled/scrollbar consistency, opacity-fade-background-only + WCAG AA note, Quiet Glass reskin, float-btn square fix).
Verified independently via `gh release view --json`: url `https://github.com/miken90/my-translator/releases/tag/v0.7.0`, asset `MyTranslator-v0.7.0-windows-x64.zip`, 3,698,837 bytes — byte-for-byte match with local file.

## Concerns
`cargo generate-lockfile` (my first attempt at "refresh Cargo.lock") re-resolved all 561 packages (887 insertions/1199 deletions) — an unintended, untested mass dependency bump. Caught before committing, reverted, redid with `cargo check` (no `--locked`), which produced the correct 1-line diff (only `my-translator`'s own version entry). Net: no bad state ever committed or pushed, but worth noting for future release dispatches — say `cargo check`/`cargo build`, not `cargo generate-lockfile`, when only the local package version needs refreshing.

## Unresolved questions
1. `RELEASE_NOTES.md` still headers `# v0.6.0` at the top and was not updated — dispatch didn't list it as in-scope for this run (previous release's process shows it gets a full manual rewrite, not just a version-string bump). Want that done as a follow-up, and if so, should it replace the top section or add a new one above it?
2. `docs/project-roadmap.md` / `docs/project-changelog.md` still show v0.6.0 as latest — same question, follow-up doc pass or out of scope here?

Status: DONE
Summary: v0.7.0 shipped — float-btn squared, version bumped everywhere (verified via dynamic About tab + grep), merged --no-ff to main (99a1145, 0 conflicts), 108/108 JS + 16/16 Rust tests green, release exe/zip built and verified on disk with fresh timestamps, tagged, pushed, GitHub release created and independently verified: https://github.com/miken90/my-translator/releases/tag/v0.7.0
Concerns/Blockers: caught and reverted an over-broad Cargo.lock relock before it was committed (see Concerns above); RELEASE_NOTES.md and docs/ still reference v0.6.0 as latest, left untouched pending direction (see Unresolved questions).

## Follow-up — docs updated to record v0.7.0 as latest (commit 25894fc)

Answered both unresolved questions above by doing the doc pass. Files touched (docs only, nothing in `src/`/`src-tauri/`):

- `RELEASE_NOTES.md` — prepended a new `# v0.7.0` section (reused the GitHub release notes content, reformatted to match this file's existing per-version style incl. a Files Changed list); did not touch the existing `# v0.6.0` section.
- `docs/project-changelog.md` — prepended a `## [v0.7.0] — 2026-08-22` entry (Keep a Changelog style: Added/Changed/Fixed); updated footer "Document updated" date.
- `docs/project-roadmap.md` — Current Status table (Latest Version, Release Date) → v0.7.0/2026-08-22; added a `### v0.7.0` Version History entry; dropped the stale "(current version)" tag from v0.5.1; retitled "Near-Term Roadmap (v0.7.x)" → "Near-Term Roadmap (Backlog — Unscheduled)" since v0.7 is now a shipped version with different content than that section described (Export/Audio Normalization never shipped as v0.7.0); fixed the two Planned Features rows and the Release Schedule row that still targeted "v0.7"; fixed one Known Issues row targeting "v0.7" for an unshipped fix; added 4 rows to Completed Features table for the actual v0.7.0 features; updated footer dates.
- `docs/project-overview-pdr.md` — found during the sweep, not one of the 3 named files: its "Current Version" field said `v0.5.1` (staler than v0.6.0, predates it). Fixed to v0.7.0/2026-08-22, added a Version History row, updated footer dates.
- Swept `docs/`, `RELEASE_NOTES.md`, `README.md` for any other "latest/current version" claims — none left pointing at v0.6.0 or earlier. `docs/deployment-guide.md` has an illustrative "v0.5.x → v0.6.0" example and a stale-but-non-assertive "Next review: after first v0.6.0 release" line; left untouched — neither claims a version is current, both are a generic example / satisfied trigger, not named in the request.

Verified: `git diff --name-only` confirmed only the 4 doc files above changed before commit. Committed as `docs: record v0.7.0 as latest release` (25894fc), pushed to origin/main (99a1145..25894fc), no force, gh account unchanged (miken90).

Status: DONE
Summary: Doc paperwork closed — RELEASE_NOTES.md, project-changelog.md, project-roadmap.md, and (found via sweep) project-overview-pdr.md all now correctly show v0.7.0 as latest; committed and pushed to main.
Concerns/Blockers: none.
