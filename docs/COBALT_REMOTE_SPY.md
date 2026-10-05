# Polaris MCP with Cobalt remote spy

Polaris remains the MCP server, connector, session manager, and dashboard. Cobalt owns the remote interception hooks. The MCP adapter subscribes to Cobalt's executed-call interceptor registry; it never adds a competing namecall hook. This build pins Cobalt 2.2.5.15 and embeds the release in the compiled server.

## Windows repair package

The repair ZIP stores files at its root. Extract all contents directly into `C:\Tools\executor-mcp-roblox`, accepting replacements, then run `START-CobaltDashboard.cmd`. This includes the source files reported missing by TypeScript and fresh compiled output. The shortcut opens the dashboard after checking server readiness. See [REPAIR-FIRST.md](../REPAIR-FIRST.md).

## Install on your Potassium machine

1. Extract the ZIP to a permanent folder, such as `C:\Roblox\polaris-cobalt`.
2. Install Node.js 20+ and pnpm if needed. Open a terminal in that folder and run `pnpm install --prod --frozen-lockfile`. The ZIP includes `dist/`, so a production install needs no rebuild.
3. Stop any older Polaris server and restart your MCP client. The launcher otherwise reuses an already-running server on the same bridge port.
4. Point your MCP client at this build. Example configuration (adjust the absolute path):

```json
{
  "mcpServers": {
    "polaris-cobalt": {
      "command": "node",
      "args": ["C:\\Roblox\\polaris-cobalt\\dist\\interface\\launcher.js"]
    }
  }
}
```

5. Enable RakNet in Potassium and join Roblox. If an older Polaris spy was running, rejoin once to clear its hooks. In Potassium, run the normal Polaris connector:

```lua
getgenv().BridgeURL = "127.0.0.1:16384"
loadstring(game:HttpGet("http://" .. getgenv().BridgeURL .. "/connector.luau"))()
```

6. Select the connected Roblox client using Polaris's existing client/session tools. Call `ensure-remote-spy` with `{ "mode": "raknet", "max": 1000 }`. Check that the returned `active` is true and `mode` is `raknet`. Alternatively, open `http://127.0.0.1:16384/`, select your client, and use the Spy tab's **Start Cobalt** button.

The bundled spy release requires no runtime release download. Cobalt's normal asset/plugin behavior remains intact and can still use network requests. You do not need to separately run a Cobalt loader. An already-running Cobalt session can be adopted; `cleanupCompatibility: "external-build"` indicates its unload behavior comes from that external build. To use the bundled cleanup fix, explicitly restart through `remote-spy`.

## Tools

Tool names below are MCP names; the existing `script` bridge exposes camelCase names such as `mcp.remoteSpy`.

| Tool                    | Behavior                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ensure-remote-spy`     | Start/adopt once; choose `auto`, `raknet`, or `luau`; set MCP history capacity.                                  |
| `get-remote-spy-logs`   | Newest captures, filtered by direction, remote ID/path, name substring, method, or RakNet mode.                  |
| `clear-remote-spy-logs` | Clear MCP and Cobalt call history; capture and block/ignore settings continue.                                   |
| `block-remote`          | Set `blocked: true` or undo with `false`; defaults to outgoing direction.                                        |
| `ignore-remote`         | Set `ignored: true` or undo with `false`; ignored calls still execute.                                           |
| `monitor-remote`        | Open/fetch/close a view for one instance without separate hooks.                                                 |
| `trace-remote-traffic`  | Open/fetch/close a traffic view; select direction on start.                                                      |
| `remote-spy`            | `status`, `start`, `restart`, `stop`, `list`, `logs`, `clear`, `block`, `unblock`, `ignore`, `unignore`, `code`. |

`list-remotes`, `get-remote-signature`, and `inspect-callbacks` retain their existing static inspection behavior.

Examples of MCP inputs:

```json
{ "operation": "status" }
```

```json
{ "operation": "list", "direction": "Outgoing", "limit": 20 }
```

```json
{ "operation": "logs", "direction": "Incoming", "afterId": 42, "limit": 100 }
```

```json
{ "operation": "block", "remoteId": "remote-1-2", "direction": "Outgoing" }
```

```json
{ "operation": "unblock", "remoteId": "remote-1-2", "direction": "Outgoing" }
```

```json
{ "operation": "code", "callId": 43 }
```

```json
{ "operation": "restart", "mode": "luau" }
```

Use IDs from your current captures. IDs in these examples are placeholders. A `remotePath` is a Luau expression resolving to an instance, for example `game:GetService("ReplicatedStorage"):WaitForChild("Remotes"):WaitForChild("BuyItem")`; using `remoteId` avoids path evaluation and ambiguous duplicate names. Both supplied selectors must identify the same instance. Block/ignore operate on remotes Cobalt has already observed in the selected direction.

`code` returns Cobalt-generated Luau and does not execute a replay. The dashboard's copy button copies capture JSON, including metadata and function results, rather than pretending typed JSON arguments are executable Luau.

## Capture and lifecycle details

- `auto` prefers RakNet when Cobalt's executor checks support it; `raknet` reports an error if unavailable. Repeated starts do not add observers or clear captures. Changing an active engine's mode requires explicit `restart`.
- Incoming/outgoing events and functions carry `isRakNet`, actor metadata, and available invocation results/errors. Packet interception does not supply the original calling closure or stack; missing metadata stays absent.
- Arguments/results preserve packed arity and explicit nil markers. Instance values carry paths. Tables retain typed key/value entries and cycle markers; buffers and invalid UTF-8 strings use bounded hex previews. Snapshot limits are depth 3, 24 table entries, 240 nodes per argument/result group, 64 packed values, 1024 text bytes, and 96 buffer/binary-preview bytes. Truncation flags identify incomplete previews.
- MCP history defaults to 500 calls, clamped to 10–5000. This is a call-count bound, not a strict memory-byte bound. Cobalt's own UI history and the raw call data retained for code generation are separate from the bounded previews. Use clear periodically for long sessions.
- Captures begin when the adapter attaches; pre-existing Cobalt history is not imported. Cobalt's ignore rules, rate limiting, plugins, and blocked-call logging settings determine which calls reach the observer. Enable Cobalt's **Log Blocked Remotes** setting if you want blocked calls in history.
- `list` ranks counts across the retained MCP buffer before applying the result limit. Counts describe retained history, not lifetime traffic.
- `afterId` enables incremental polling. `latestId` is the polling cursor; `gap` reports that requested history has expired. Clear retains monotonic call IDs; restarting invalidates retained calls and views. Remote IDs include a generation number to avoid selecting a different instance with an old ID after restart.
- Monitor/trace fetches return retained calls since view start. Their `stop` action only closes that view. `remote-spy` operation `stop` or `restart` unloads the whole Cobalt session, including an adopted external session and its GUI/hooks. Saved Cobalt preferences remain on disk.
- Capture failures are isolated from Cobalt via `pcall`; status exposes `captureErrors`. Unknown/expired remote or call IDs return actionable errors.
- An older Polaris spy is detected on start. Rejoin Roblox before using the new engine if that check reports legacy hooks.

## Develop and validate

For a source checkout, run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm verify`. If changing the vendored Cobalt source, run `pnpm build:cobalt` before building; the generator updates the embedded TypeScript source. Keep upstream attribution and describe every patch in `vendor/cobalt/provenance.json`.

Install official Luau CLI binaries and run `pnpm test:luau` after building. If they are not on PATH, set `LUAU_BIN` and `LUAU_COMPILE_BIN` to their executable paths. That check compiles all adapter operation sources and the full patched release, then executes the production adapter in a mocked Roblox/Cobalt environment and exercises the actual bundled RakNet wrapper with both callback-returning and handle-returning registration APIs.

Validation here covers TypeScript checks, Polaris tests, Luau compilation, and simulated capture/lifecycle/cleanup behavior. It does not run Roblox or Potassium. Confirm live capture, incoming callbacks, unload, and mode switching on your machine before relying on them.

## Upstream and licensing

- Polaris: https://github.com/PolarisHub/executor-mcp-roblox — base commit `b475ab90849c0b0edcd45a10bf3f45f391e20d51`, MIT.
- Cobalt: https://gitlab.com/upio/cobalt — version 2.2.5.15, commit `192588aa76f6c5cf8d3876d26b7b942101a10511`, Apache-2.0.
- Integration reference inspected: https://gitlab.com/upio/roblox-executor-mcp — the integration is adapted to Polaris's existing eval transport.

The bundled patches preserve callback registration tokens when Potassium returns no hook handle, fix the same capability-test cleanup, allow a launch mode override, and expose Cobalt's code generator to the adapter. See `THIRD_PARTY_NOTICES.md`, the preserved Cobalt license, and provenance metadata.
