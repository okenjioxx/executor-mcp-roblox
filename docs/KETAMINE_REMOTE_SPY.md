# Selectable Cobalt and Ketamine spies

Build `2.0.0-spies.2` adds persistent capture configuration, pause/resume, active-rule inspection/reset, and Ketamine GUI controls. Select `engine: "cobalt" | "ketamine"` on capture/control tools. Cobalt remains the default. One engine runs per Roblox client; different clients can choose different engines.

## Setup and captures

Run `pnpm build`, stop your older server, restart the MCP client, and reconnect Roblox using the existing connector. No connector changes are required. To start Ketamine, call `remote-spy`:

```json
{ "operation": "start", "engine": "ketamine", "max": 500 }
```

If Ketamine was already running from the older build, use `operation: "restart"` once to load its new GUI and rule-management controls. This expires its old IDs/views and resets configuration.

Read captures using `get-remote-spy-logs`:

```json
{ "engine": "ketamine", "direction": "Both", "limit": 100 }
```

`Incoming`/`Outgoing`, `remoteId`, `remotePath`, `nameFilter`, `method`, `classFilter`, `blockedOnly`, and `afterId` filters are supported. These query filters affect only the current read. Captures preserve packed argument arity, nils, and bounded typed previews. `gap` indicates expired history. IDs distinguish duplicate instance names and expire after a restart. Supply the engine on subsequent calls; omitted selectors target Cobalt.

Inside `script`, use `mcp.remoteSpy`, `mcp.configureRemoteSpy`, `mcp.getRemoteSpyLogs`, and `mcp.blockRemote`. Inspect their schemas with `mcp.help`.

## Configure capture and the spy itself

Call `configure-remote-spy` to patch settings without restarting:

```json
{
  "engine": "ketamine",
  "max": 1000,
  "capture": { "enabled": true, "direction": "Incoming", "classFilter": "RemoteFunction" },
  "guiVisible": false,
  "guiLogging": false
}
```

This keeps incoming RemoteFunction callbacks in MCP history, hides Ketamine's window, and stops new GUI entries. Remote calls continue normally unless an existing block rule applies. Omitted settings retain their values; filters affect future MCP records and leave existing history intact. `max` accepts 10–5000 calls and preserves the newest history, IDs, and views when resized.

`capture` supports `enabled`, `direction`, `nameFilter` (a case-insensitive literal path substring), `method`, `classFilter`, and `blockedOnly`. Filters combine with AND. Use `resetFilters: true` to clear filters before applying a new patch; this preserves pause state, block/ignore rules, and history. An empty `nameFilter` also clears the name filter. Configuration resets on restart.

Use `remote-spy` with `{"engine":"ketamine","operation":"pause"}` or `"resume"` for quick recording control. These preserve hooks, filters, block/ignore rules, and GUI logging. `configure-remote-spy` can also pause/resume using `capture.enabled`. The same capture/buffer controls work with Cobalt; GUI settings are Ketamine-only.

`remote-spy` `status` returns effective `capture`, `capturing`, `gui`, `skippedCaptures`, and `capabilities`. `active` means the MCP observer is attached; `capturing` also checks whether recording is enabled. `skippedCaptures` counts captures rejected by pause or capture filters; buffer evictions appear separately in `dropped`. GUI/MCP ignore rules suppress captures before this counter.

## Block and unblock

Use a `remoteId` from a recent capture with `block-remote`:

```json
{ "engine": "ketamine", "remoteId": "<captured-id>", "direction": "Outgoing", "blocked": true }
```

Send the same request with `blocked: false` to undo it. `remotePath` is also supported; both selectors must match if supplied together. Controls require an observed remote in the requested direction.

| Capability                                                          | Ketamine support                       |
| ------------------------------------------------------------------- | -------------------------------------- |
| Outgoing RemoteEvent, UnreliableRemoteEvent, RemoteFunction capture | Yes                                    |
| Incoming RemoteEvent and UnreliableRemoteEvent capture              | Yes                                    |
| Incoming RemoteFunction callback capture                            | Callbacks present when discovered      |
| Outgoing remote blocking                                            | Reversible by instance                 |
| Incoming RemoteFunction blocking                                    | Skips the callback and returns nil     |
| Incoming RemoteEvent blocking                                       | Unsupported; returns an explicit error |
| RakNet capture                                                      | Cobalt only                            |

Unsupported incoming-event block requests, including `direction: "Both"`, do not change outgoing block state. Clear GUI name-based blocks with `reset-controls` or restart before using MCP instance controls; name rules can affect several same-named instances.

Inspect active block/ignore rules through `remote-spy`:

```json
{ "engine": "ketamine", "operation": "controls", "direction": "Both", "limit": 100, "offset": 0 }
```

Results include instance IDs, direction, `blocked`/`ignored`, and GUI name rules. Use `nextOffset` when `truncated` is true. `nameFilter` and `blockedOnly` can narrow this list. Instance-specific block/ignore operations still use a captured `remoteId` or observed `remotePath`.

To unblock all outgoing remotes without changing incoming controls or history:

```json
{
  "engine": "ketamine",
  "operation": "reset-controls",
  "direction": "Outgoing",
  "resetControl": "block"
}
```

`resetControl` accepts `block`, `ignore`, or `Both` (default). Resetting `direction: "Both"` also clears Ketamine's GUI ignore rules, which apply across both directions. A direction-specific ignore reset preserves these global GUI rules. Outgoing block reset clears GUI name blocks as well. The result's `changed` counts individual rules cleared. Cobalt also supports rule inspection/reset for its observed logs.

## Additional controls and switching

- `remote-spy` supports status, configure, pause/resume, active controls, reset-controls, ranked remote lists, filtered logs, clear, code generation, block/unblock, ignore/unignore, restart, and stop.
- `ignore-remote` suppresses Ketamine MCP captures for an instance/direction while calls continue. Ketamine GUI ignore rules are separate.
- `clear-remote-spy-logs` clears MCP/GUI history and queued GUI entries while retaining controls and capture configuration.
- `monitor-remote` and `trace-remote-traffic` create views of the existing buffer without extra hooks.
- `code` uses Ketamine's serializer on retained raw arguments and returns Luau without replaying it. Review generated instance paths when sibling names are duplicated.

To switch back, call `remote-spy` with `{"operation":"start","engine":"cobalt","mode":"auto"}`. Use `mode: "raknet"` only for Cobalt. Closing the Ketamine GUI also ends its MCP capture session.

The dashboard Spy tab has an engine selector. Selecting an engine changes the displayed buffer; **Start spy** starts/switches engines. Ketamine uses Luau hooks, so its mode control is disabled.

## Runtime source and limits

Ketamine is fetched from [commit 478b27d](https://github.com/InfernusScripts/Ketamine/tree/478b27da78869316443389012eb4ef34f8037323) on explicit start/restart. Its SHA-256 must match `31fb2c6bef8f3f740a8fc08cfc856f1ec00ba8d2ac59a5815f2cf38902daad77` before compilation. No Ketamine source is bundled or assigned this project's MIT license; no upstream license was present when inspected.

The executor needs internet access, `crypt.hash`, `hookfunction`, `hookmetamethod`, `getnamecallmethod`, `getcallbackvalue`, `setfenv`, and `loadstring`. Close external unadapted Ketamine sessions before using this integration.

The source is adapted in memory to expose capture/control access, fix argument/caller ordering, preserve nil arity, and restore hooks synchronously in reverse order. Incoming RemoteFunctions use per-instance callback wrappers, so sharing a callback does not share capture or blocking. Cleanup restores only callbacks still owned by the adapter. Only the remote-spy, settings, and home pages start; HTTP/bindable spies and scanners do not. MCP history is independent of the GUI capture queue and its executor-call filter.

Preflight runs before stopping the current engine. Download/hash/capability/mode failures preserve it; failed unload prevents the replacement from starting. Failure during replacement initialization may leave both stopped; check status and retry. Overlapping lifecycle changes return a retry message.

If status reports `cleanupRequired: true`, retry `operation: "stop"` for that engine before starting another spy. A backend with failed cleanup cannot be adopted as an active capture session. External Ketamine ownership is rechecked after downloading and before loading.

Ketamine captures request arguments, without invocation results/errors or packet/actor metadata. Callbacks assigned/replaced after discovery may require restarting. MCP history is bounded by call count (10–5000); upstream GUI objects/connections and observed-remote control tables are separate, not a strict byte-bound cache.

## Verification

Run `pnpm verify`, `pnpm build`, and `pnpm test:luau`. Official `luau` and `luau-compile` binaries are required on PATH, or set `LUAU_BIN`/`LUAU_COMPILE_BIN`. The Ketamine checker downloads and hash-checks upstream, compiles the complete adapted source, and executes the production bridge plus actual remote-spy/hook modules against mocked Roblox surfaces. Set `KETAMINE_SOURCE` to an already-downloaded matching file for offline checks.

These checks do not run Roblox. Live executor validation is still needed for capture coverage, blocking effects, cleanup, and switching.
