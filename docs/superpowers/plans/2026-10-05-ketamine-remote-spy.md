# Selectable Remote Spies Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. The user explicitly authorized implementation in this session.

**Goal:** Let MCP choose Cobalt or Ketamine per Roblox client, capture both directions, and reversibly block supported remotes.

**Architecture:** Share the existing bounded capture adapter through a small backend interface. Ketamine is fetched from a pinned upstream commit at runtime and adapted in memory; its source is not redistributed. A per-client switching guard prevents overlapping spy ownership.

**Tech Stack:** TypeScript, Zod, Luau, Vitest, official Luau CLI.

**Spec:** The user's request: selectable engines, one at a time; prioritize logs, reversible blocking, and incoming/outgoing capture.

## Global Constraints

- Cobalt remains the default and retains RakNet support.
- No Ketamine source is vendored or committed; verify the pinned source hash before loading.
- Reads never boot an engine. Lifecycle changes affect the selected Roblox client only.
- Incoming RemoteEvent blocking is unsupported and must return an explicit error without changing outgoing block state.
- Preserve packed argument arity, nils, binary previews, bounded buffers, stable instance IDs, and polling cursors.

## Review Focus

- Failed preflight must leave the previous spy active.
- Failed unload must prevent loading the other spy.
- Duplicate remote names and expired IDs must not control the wrong instance.
- Returning false/nil and trailing nil arguments must survive capture and forwarding.
- External unadapted Ketamine sessions and overlapping lifecycle calls must fail safely.

### Task 1: Engine dispatch and bounded adapter

Files: `src/application/services/remote-spy-source.ts`, `cobalt-spy-source.ts`, `test/unit/tools/remote-spy.test.ts`.

- [ ] Add and run failing tests for explicit engine routing, default Cobalt behavior, independent namespaces, and read-only loads.
- [ ] Generalize the existing recorder using backend configuration and add preflight/switch serialization.
- [ ] Run the focused Vitest tests and the existing Cobalt Luau simulation.

### Task 2: Ketamine runtime bridge

Files: `src/application/services/ketamine-spy-source.ts`, `test/luau/ketamine-spy.test.luau`, `scripts/check-ketamine-luau.mjs`.

- [ ] Write a fixture that runs the production bridge and actual patched upstream remote-spy module.
- [ ] Add pinned/hash-checked runtime loading, observer/control exports, packed arguments, and cleanup.
- [ ] Verify incoming/outgoing capture, filters, overflow, block/unblock, unsupported event blocking, code generation, and unload in official Luau.

### Task 3: MCP and dashboard exposure

Files: `src/tools/_shared/cobalt.ts`, capture/control tools under `src/tools/remote-spy/`, dashboard spy service/routes/page, README and Ketamine setup guide.

- [ ] Add optional engine selectors to all capture/control tools and dashboard controls.
- [ ] Test engine selection across MCP and dashboard; document limitations and runtime dependency.
- [ ] Run typecheck, lint, tests, build, both Luau checks, and formatting of changed authored files.
- [ ] Obtain an independent code review, address important findings, and deliver the verified branch.
