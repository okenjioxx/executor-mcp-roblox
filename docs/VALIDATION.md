# Validation for 2.0.0-cobalt.1

## GitHub source upload checks

Rechecked on 2026-10-05 on Windows before preparing the source upload:

- `pnpm verify`: passed typechecking, lint, and all 455 tests in 60 files.
- `pnpm build`: passed.
- Compiled tool registry: 288 tools across 22 categories.
- `pnpm exec prettier --check README.md package.json`: passed for the updated introduction, setup instructions, and repository metadata.
- Whole-repository `pnpm format:check`: failed on 20 existing source/test files and the preserved upstream Cobalt license. These files were not reformatted for the upload.
- `pnpm test:coverage`: all 455 tests passed, but the coverage gate failed. Lines and statements were 88.19% against a 90% threshold; branches were 83.98% against an 85% threshold.

The existing GitHub Actions workflow checks both formatting and coverage, so it will require follow-up work to pass those gates. No live Roblox or Potassium compatibility claim is added by these host-side checks.

## Previous distribution validation

Validated on 2026-09-30 against Polaris base commit `b475ab90849c0b0edcd45a10bf3f45f391e20d51` and the pinned Cobalt 2.2.5.15 release.

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 60 files, 455 tests passed, including the localhost bridge integration tests.
- `pnpm build`: passed; compiled server included in this distribution.
- Official Luau compilation: full patched Cobalt release and all 12 adapter operation sources passed.
- Production adapter executed in a mocked Roblox/Cobalt environment: 101 assertions passed, covering idempotent start, typed snapshots/nils/buffers/binary strings, incoming/outgoing filters, duplicate instance names, reversible controls, views, code generation, overflow, ranking, clear, restart, stale IDs, and failure isolation.
- Actual bundled RakNet wrapper: callback-based registration returning nil and opaque-handle registration both passed dispatch and idempotent cleanup tests.
- Compiled server smoke test: health/build identity, Cobalt dashboard, tool catalog, start-route input validation, and connector serving passed.
- Embedded Cobalt source matches the vendored patched source; original release SHA-256 matches provenance metadata.
- Changed authored files pass Prettier. Whole-repository formatting reports pre-existing differences in 20 unchanged files; preserved upstream license text is also left unchanged.

These checks do not execute Roblox or Potassium. Confirm live packet captures, incoming callbacks, mode switching, and unload behavior using the setup guide.

## Windows installation repair

The saved original ZIP was retrieved and checked: all four new Cobalt TypeScript files and their compiled JavaScript modules were present, and ZIP integrity passed. A clean extraction rebuilt successfully using the locked dependencies. The repair distribution flattens the archive root for extraction directly into the existing project folder.

The new Node dashboard helper passed syntax checking and localhost checks for server startup, health/build identity, dashboard readiness, reuse of an existing matching server, rejection of an older build without interrupting it, and detection of missing Cobalt files. The Windows `.cmd` wrapper and automatic browser opening have not been executed on Windows in this environment.
