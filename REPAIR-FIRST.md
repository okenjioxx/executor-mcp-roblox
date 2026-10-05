# Repair the existing Windows installation

The original ZIP contains the new Cobalt source files. The reported TypeScript errors mean those files are missing from the folder being built. This repair ZIP has its files directly at the ZIP root, so extraction can overlay the existing project without creating an extra nested folder.

1. Close the old Polaris server terminal, if one is running.
2. Extract **all** contents of this ZIP directly into `C:\Tools\executor-mcp-roblox`. Accept file replacements. The project root must contain `package.json`, `src`, `dist`, and `START-CobaltDashboard.cmd` together.
3. Double-click **START-CobaltDashboard.cmd**. It installs the locked dependencies, starts the included compiled server, and opens the browser dashboard after its health check succeeds. Keep its window open.
4. Execute the normal connector in Potassium, select the connected client in the dashboard, then use **Spy → RakNet → Start Cobalt**.

The helper checks for missing source and compiled Cobalt files and reports an incompatible server already using the port. It never kills a pre-existing server. MCP clients should continue to use `node C:\Tools\executor-mcp-roblox\dist\interface\launcher.js` as their configured command, rather than the interactive dashboard helper.

To verify the copy or rebuild manually, run each line separately in PowerShell:

```powershell
cd C:\Tools\executor-mcp-roblox
Test-Path .\src\application\services\cobalt-spy-source.ts
Test-Path .\src\application\services\cobalt-bundle.ts
Test-Path .\src\tools\_shared\cobalt.ts
Test-Path .\src\tools\remote-spy\remote-spy.ts
pnpm build
```

All four `Test-Path` checks should return `True`. The repaired package includes compiled output, so rebuilding is optional. The pnpm warning about ignored esbuild build scripts is unrelated to these missing-file errors; the TypeScript build uses `tsc`.

Run the launcher on its own line:

```powershell
node .\dist\interface\launcher.js
```

Use a separate PowerShell window for commands while the server is running. The earlier `launcher.jsInvoke-RestMethod` error happened because two commands were joined into one filename.
