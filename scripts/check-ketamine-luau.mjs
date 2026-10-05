import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  KETAMINE_URL,
  KETAMINE_SHA256,
  KETAMINE_PREPARE,
  KETAMINE_BOOTSTRAP,
} from "../dist/application/services/ketamine-spy-source.js";
import { COBALT_ADAPTER } from "../dist/application/services/cobalt-spy-source.js";
import { buildRemoteSpySource } from "../dist/application/services/remote-spy-source.js";

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `Exited ${result.status}`);
  return result.stdout;
}
function long(source) {
  let equals = "=";
  while (source.includes(`]${equals}]`)) equals += "=";
  return `[${equals}[${source}]${equals}]`;
}
const upstream = process.env.KETAMINE_SOURCE
  ? readFileSync(process.env.KETAMINE_SOURCE, "utf8")
  : await (async () => {
      const response = await fetch(KETAMINE_URL);
      if (!response.ok) throw new Error(`Ketamine download: ${response.status}`);
      return response.text();
    })();
if (createHash("sha256").update(upstream).digest("hex") !== KETAMINE_SHA256)
  throw new Error("Upstream SHA-256 mismatch");
const dir = mkdtempSync(join(tmpdir(), "polaris-ketamine-test-"));
try {
  const patchFile = join(dir, "patch.luau");
  writeFileSync(
    patchFile,
    `local env = {}\nlocal function getgenv() return env end\nlocal caps = {}\nfor _, name in { "hookfunction", "hookmetamethod", "getnamecallmethod", "getcallbackvalue", "loadstring", "setfenv" } do caps[name] = function() end end\nlocal function getfenv() return caps end\nlocal crypt = { hash = function() return "${KETAMINE_SHA256}" end }\nlocal game = { HttpGet = function() return ${long(upstream)} end }\nlocal function loadstring(source) return function() return source end end\nlocal function setfenv() end\nlocal function prepare()\n${KETAMINE_PREPARE}\nend\nprint(prepare()())`,
  );
  const patched = run(process.env.LUAU_BIN || "luau", [patchFile]);
  const patchedFile = join(dir, "Ketamine.patched.luau");
  writeFileSync(patchedFile, patched);
  process.stderr.write(
    run(process.env.LUAU_COMPILE_BIN || "luau-compile", ["--null", patchedFile]),
  );
  function moduleSource(id) {
    const marker = `modules[objects["${id}"]] = function()`;
    const start = patched.indexOf(marker);
    const body = start + marker.length;
    const end = patched.indexOf('modules[objects["', body);
    if (start < 0 || end < 0) throw new Error(`Module ${id} missing`);
    return patched.slice(body, end).replace(/end;\s*$/, "");
  }
  let fixture = readFileSync(
    new URL("../test/luau/ketamine-spy.test.luau", import.meta.url),
    "utf8",
  );
  fixture = fixture
    .replace("-- RSPY_INSERT", `local function remoteModule()\n${moduleSource("Instance11")}\nend`)
    .replace("-- HOOKS_INSERT", `local function hookModule()\n${moduleSource("Instance7")}\nend`)
    .replace("-- BOOT_INSERT", `local function boot()\n${KETAMINE_BOOTSTRAP}\nend`)
    .replace(
      "-- ADAPTER_INSERT",
      `local function run(operation, options)\nlocal __engineName = "Ketamine"\nlocal __operation, __options, __bundleVersion = operation, options, "pinned"\nlocal __bundle = nil\n${COBALT_ADAPTER}\nend`,
    )
    .replace("-- UPSTREAM_INSERT", `local upstreamSource = ${long(upstream)}`)
    .replace(
      "-- SWITCH_INSERT",
      `local function switchKetamine()\n${buildRemoteSpySource("ketamine", "start", { max: 10 })}\nend\nlocal function switchCobalt()\n${buildRemoteSpySource("cobalt", "start", { mode: "raknet" })}\nend`,
    );
  const fixtureFile = join(dir, "fixture.luau");
  writeFileSync(fixtureFile, fixture);
  process.stderr.write(run(process.env.LUAU_BIN || "luau", [fixtureFile]));
  process.stderr.write(
    "Pinned Ketamine source compiled; production bridge, upstream hooks, and switching checks passed.\n",
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
