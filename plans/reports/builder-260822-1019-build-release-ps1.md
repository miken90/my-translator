# Build: replace build-release.sh with build-release.ps1

Status: DONE
Commit: 847735f (pushed to origin/main, 25894fc..847735f)

## What changed
- Deleted `scripts/build-release.sh` (bash, ran cargo under WSL Linux toolchain, `[ -f "$EXE_PATH" ]` check silently passed on a stale Windows exe left from an earlier real build → zipped wrong binary, exit 0).
- Added `scripts/build-release.ps1`: native PowerShell, param() version arg w/ Cargo.toml fallback, `$ErrorActionPreference='Stop'`, non-zero exit on every failure path.
- `package.json`: added `build:release` script → `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1`. Verified via `npm run build:release -- 0.7.0` run through `powershell.exe` from a Windows cwd — forward-slash path resolves fine, no quoting issue.
- Updated every doc reference: `CLAUDE.md` (release script line), `docs/deployment-guide.md` (3 spots: intro note, manual trigger step, release checklist), `docs/codebase-summary.md` (file tree entry). Grepped repo (excl. node_modules/.git/plans/reports) for `build-release.sh` before and after — zero hits left except the deleted file itself and this report's own text.

## Anti-stale-artifact design (the actual point of the rewrite)
1. Before build: delete pre-existing exe if present. Nothing else writes that path, so its mere existence after cargo runs proves *this* cargo invocation created it — the wrong-toolchain bug (WSL bash targeting Linux) can never again leave a stale Windows exe passing as fresh.
2. After build: assert exe exists (exit 1 + message if not).
3. Freshness assert: exe mtime must be `>=` newest mtime among `Cargo.toml`, `Cargo.lock`, and all files under `src-tauri/src/**`.

### Why not a simple "mtime newer than before build" check (first draft, caught by my own testing)
First draft compared exe mtime to a pre-build snapshot / wall clock. Real test exposed this as wrong: cargo hardlinks an unchanged binary from its build cache and preserves the **original** compile mtime on a no-op incremental rebuild (source unchanged). Re-running the script back-to-back with zero code changes falsely failed with "mtime unchanged." Fixed by comparing exe mtime against source mtime instead (the same staleness test any build system uses) — legit no-op rebuilds now pass, and the original defect (wrong toolchain / build never touches this path) is still caught by the delete+exists step, independent of any mtime quirk. Verified both scenarios below.

## Verification (artifacts + mtimes, not exit codes)
All via `powershell.exe -NoProfile ... ` from `/mnt/d` (never `.exe` from a `/home/...` cwd).

**Success path, run 1** (real recompile, source had just changed via CLAUDE.md edits touching nothing in src but cargo still relinked):
- exe: `src-tauri\target\release\my-translator.exe`, 11,363,840 B, mtime `2026-08-22 10:25:04` (prior stale mtime was `10:11:27` — confirmed refreshed)
- zip: `dist\MyTranslator-v0.7.0-windows-x64.zip`, 3,698,837 B, mtime `2026-08-22 10:25:06`

**Success path, run 2** (deliberate immediate re-run, zero source changes — the no-op case that broke the first draft):
- cargo: `Finished ... in 0.57s` (confirms incremental no-op, not a fresh compile)
- exe mtime unchanged at `10:25:04` (cargo preserved it — correct, source didn't move) — freshness check passed because exe mtime ≥ source mtime
- zip: repackaged fresh, mtime `10:28:42`, same 3,698,837 B — proves the zip step re-ran even though the exe itself was a legitimate cache hit
- exit code: `0` (checked via `$?` immediately after the bare `powershell.exe` call, not through a pipe — piping through `tr` masks the real exit code, learned this mid-test)

**Failure path** — isolated scratch copy at `/mnt/d/WORKSPACES/PERSONAL/my-translator-failtest-scratch` (never touched the real repo):
- copied `build-release.ps1`, planted a `STALE-FAKE-BINARY` text file at the fake exe path, patched `$ManifestPath` to `src-tauri\bogus-Cargo.toml`
- ran `powershell.exe ... & '.\scripts\build-release.ps1' 0.0.0-failtest`
- result: `cargo build failed with exit code 101` → script `Write-Error` + real exit code **1** (verified directly, no pipe)
- confirmed: fake stale exe was gone (deleted pre-build, never recreated — cargo never ran successfully), `dist/` stayed empty, no zip packaged
- scratch dir fully removed after

**Test suites**, via `powershell.exe`, from repo root:
- `npm run test` (vitest): **108/108 passed**, 17 files, 16.4s
- `cargo test --manifest-path src-tauri/Cargo.toml`: **16/16 passed** (lib unit tests), 0 in main/doc-tests as expected

## Constraints honored
No version/Cargo.toml/tauri.conf.json touched. No `src/` or `src-tauri/src/` touched. No new deps. No tag, no release. gh account untouched (no gh calls made). Existing zips in `dist/` untouched except v0.7.0 (git-ignored, not part of the commit either way — confirmed `dist/` isn't tracked).

## Unresolved questions
- None blocking. Minor note: `docs/deployment-guide.md`'s release checklist still lists tag/push-with-tags steps unrelated to this script — left untouched per scope (no version/tag changes requested).
