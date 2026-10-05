// Interactive dashboard entrypoint. MCP hosts should keep using launcher.js.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "package.json",
  "connector/connector.luau",
  "src/application/services/cobalt-bundle.ts",
  "src/application/services/cobalt-spy-source.ts",
  "src/tools/_shared/cobalt.ts",
  "src/tools/remote-spy/remote-spy.ts",
  "dist/interface/main.js",
  "dist/application/services/cobalt-bundle.js",
  "dist/application/services/cobalt-spy-source.js",
  "dist/tools/_shared/cobalt.js",
  "dist/tools/remote-spy/remote-spy.js",
];
const local = (path) => fileURLToPath(new URL(path, new URL("../", import.meta.url)));
const missing = required.filter((path) => !existsSync(local(path)));
if (missing.length) {
  process.stderr.write(
    "Project files are missing:\n" +
      missing.join("\n") +
      "\nExtract the complete repair ZIP into the project folder, accepting replacements.\n",
  );
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(local("package.json"), "utf8"));
const port = Number(process.env.ROBLOX_MCP_PORT || 16384);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("ROBLOX_MCP_PORT must be 1..65535");
const base = `http://127.0.0.1:${port}`;
const ready = (health) =>
  health?.service === "executor-mcp-roblox" &&
  health?.status === "ok" &&
  health?.version === manifest.version;

async function health() {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(750) });
    if (!response.ok) return { incompatible: true };
    return await response.json();
  } catch {
    return undefined;
  }
}

function showDashboard() {
  process.stderr.write(`Dashboard ready: ${base}/\n`);
  if (process.argv.includes("--no-open")) return;
  const [command, args] =
    process.platform === "win32"
      ? ["powershell.exe", ["-NoProfile", "-Command", `Start-Process -FilePath '${base}/'`]]
      : process.platform === "darwin"
        ? ["open", [`${base}/`]]
        : ["xdg-open", [`${base}/`]];
  const browser = spawn(command, args, { stdio: "ignore", windowsHide: true });
  browser.on("error", () => process.stderr.write(`Open ${base}/ in your browser.\n`));
}

let server;
try {
  const existing = await health();
  if (existing) {
    if (!ready(existing))
      throw new Error(
        `A different server is using port ${port}. Close that server's terminal, then run START-CobaltDashboard.cmd again. Expected build ${manifest.version}, received ${existing.version || "unknown"}.`,
      );
    showDashboard();
  } else {
    process.stderr.write(`Starting Polaris ${manifest.version} on ${base} ...\n`);
    server = spawn(
      process.execPath,
      [local("dist/interface/main.js"), "--host", "127.0.0.1", "--port", String(port)],
      { cwd: root, stdio: "inherit" },
    );
    const exited = new Promise((resolve, reject) => {
      server.once("error", reject);
      server.once("exit", (code, signal) => resolve({ code, signal }));
    });
    // Attach a rejection handler immediately, including during readiness polling.
    exited.catch(() => {});
    let stopping = false;
    const stop = () => {
      stopping = true;
      server.kill("SIGTERM");
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    let started = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (server.exitCode !== null || server.signalCode !== null) break;
      if (ready(await health())) {
        started = true;
        break;
      }
      await delay(250);
    }
    if (!started)
      throw new Error(
        "Server did not become ready. Check the error above; ensure dependencies are installed and the port is free.",
      );
    showDashboard();
    process.stderr.write(
      "Leave this window open while using Roblox. Press Ctrl+C to stop this server.\n",
    );
    const outcome = await exited;
    process.exitCode = stopping ? 0 : (outcome.code ?? 1);
  }
} catch (error) {
  if (server && server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
