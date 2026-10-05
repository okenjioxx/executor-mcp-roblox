# Selectable Cobalt and Ketamine spies

Build `2.0.0-spies.1` adds `engine: "cobalt" | "ketamine"` to the existing capture/control tools. Cobalt remains the default. One engine runs per Roblox client; different clients can choose different engines.

## Setup and captures

Run `pnpm build`, stop your older server, restart the MCP client, and reconnect Roblox using the existing connector. No connector changes are required. To start Ketamine, call `remote-spy`:

```json
{ "operation": "start", "engine": "ketamine", "max": 500 }
```

Read captures using `get-remote-spy-logs`:

```json
{ "engine": "ketamine", "direction": "Both", "limit": 100 }
```

`Incoming`/`Outgoing`, `remoteId`, `remotePath`, `nameFilter`, `method`, and `afterId` filters are supported. Captures preserve packed argument arity, nils, and bounded typed previews. `gap` indicates expired history. IDs distinguish duplicate instance names and expire after a restart. Supply the engine on subsequent calls; omitted selectors target Cobalt.

Inside `script`, use `mcp.remoteSpy`, `mcp.getRemoteSpyLogs`, and `mcp.blockRemote`. Inspect their schemas with `mcp.help`.

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

Unsupported incoming-event block requests, including `direction: "Both"`, do not change outgoing block state. Clear GUI name-based blocks or restart before using MCP instance controls; name rules can affect several same-named instances.

## Additional controls and switching

- `remote-spy` supports status, ranked remote lists, filtered logs, clear, code generation, block/unblock, ignore/unignore, restart, and stop.
- `ignore-remote` suppresses Ketamine MCP captures for an instance/direction while calls continue. Ketamine GUI ignore rules are separate.
- `clear-remote-spy-logs` clears MCP/GUI history while retaining controls and capture.
- `monitor-remote` and `trace-remote-traffic` create views of the existing buffer without extra hooks.
- `code` uses Ketamine's serializer on retained raw arguments and returns Luau without replaying it. Review generated instance paths when sibling names are duplicated.

To switch back, call `remote-spy` with `{"operation":"start","engine":"cobalt","mode":"auto"}`. Use `mode: "raknet"` only for Cobalt. Closing the Ketamine GUI also ends its MCP capture session.

The dashboard Spy tab has an engine selector. Selecting an engine changes the displayed buffer; **Start spy** starts/switches engines. Ketamine uses Luau hooks, so its mode control is disabled.

## Runtime source and limits

Ketamine is fetched from [commit 478b27d](https://github.com/InfernusScripts/Ketamine/tree/478b27da78869316443389012eb4ef34f8037323) on explicit start/restart. Its SHA-256 must match `31fb2c6bef8f3f740a8fc08cfc856f1ec00ba8d2ac59a5815f2cf38902daad77` before compilation. No Ketamine source is bundled or assigned this project's MIT license; no upstream license was present when inspected.

The executor needs internet access, `crypt.hash`, `hookfunction`, `hookmetamethod`, `getnamecallmethod`, `getcallbackvalue`, `setfenv`, and `loadstring`. Close external unadapted Ketamine sessions before using this integration.

The source is adapted in memory to expose capture/control access, fix argument/caller ordering, preserve nil arity, and restore hooks synchronously in reverse order. Only the remote-spy, settings, and home pages start; HTTP/bindable spies and scanners do not. MCP history is independent of the GUI capture queue and its executor-call filter.

Preflight runs before stopping the current engine. Download/hash/capability/mode failures preserve it; failed unload prevents the replacement from starting. Failure during replacement initialization may leave both stopped; check status and retry. Overlapping lifecycle changes return a retry message.

Ketamine captures request arguments, without invocation results/errors or packet/actor metadata. Callbacks assigned/replaced after discovery may require restarting. MCP history is bounded by call count (10–5000); upstream GUI objects/connections and observed-remote control tables are separate, not a strict byte-bound cache.

## Verification

Run `pnpm verify`, `pnpm build`, and `pnpm test:luau`. Official `luau` and `luau-compile` binaries are required on PATH, or set `LUAU_BIN`/`LUAU_COMPILE_BIN`. The Ketamine checker downloads and hash-checks upstream, compiles the complete adapted source, and executes the production bridge plus actual remote-spy/hook modules against mocked Roblox surfaces. Set `KETAMINE_SOURCE` to an already-downloaded matching file for offline checks.

These checks do not run Roblox. Live executor validation is still needed for capture coverage, blocking effects, cleanup, and switching.
