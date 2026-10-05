import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCobaltSpySource,
  COBALT_ADAPTER,
} from "../dist/application/services/cobalt-spy-source.js";
import { COBALT_BUNDLE } from "../dist/application/services/cobalt-bundle.js";

const run = (executable, args) => {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `Exited ${result.status}`);
  if (result.stdout.trim()) process.stderr.write(result.stdout);
};
const dir = mkdtempSync(join(tmpdir(), "polaris-cobalt-test-"));
try {
  const operations = [
    "start",
    "restart",
    "stop",
    "status",
    "logs",
    "list",
    "clear",
    "control",
    "configure",
    "pause",
    "resume",
    "controls",
    "reset-controls",
    "view-start",
    "view-fetch",
    "view-stop",
    "code",
  ];
  const files = operations.map((operation) => {
    const file = join(dir, `${operation}.luau`);
    writeFileSync(
      file,
      buildCobaltSpySource(operation, {
        mode: "raknet",
        remotePath: 'game["héllo\\n\\0"]',
        nameFilter: '💫\u0000\n"\\',
      }),
    );
    return file;
  });
  const bundle = join(dir, "bundle.luau");
  writeFileSync(bundle, COBALT_BUNDLE);
  files.push(bundle);
  run(process.env.LUAU_COMPILE_BIN || "luau-compile", ["--null", ...files]);
  const fixture = readFileSync(
    new URL("../test/luau/cobalt-spy.test.luau", import.meta.url),
    "utf8",
  );
  const script = fixture.replace(
    "-- ADAPTER_INSERT",
    `local function run(__operation, __options)\nlocal __bundleVersion = "2.2.5.15"\nlocal __bundle = "mock bundled loader"\n${COBALT_ADAPTER}\nend`,
  );
  const harness = join(dir, "harness.luau");
  writeFileSync(harness, script);
  run(process.env.LUAU_BIN || "luau", [harness]);
  // Exercise the actual patched release's RakNet wrapper with nil/handle APIs.
  const start = COBALT_BUNDLE.indexOf("local RakNetWrapper = {");
  const end = COBALT_BUNDLE.indexOf("return RakNetWrapper", start) + "return RakNetWrapper".length;
  if (start < 0 || end <= start) throw new Error("Bundled wrapper not found");
  const hooks = readFileSync(
    new URL("../test/luau/cobalt-hooks.test.luau", import.meta.url),
    "utf8",
  );
  const wrapper = join(dir, "hooks.luau");
  writeFileSync(
    wrapper,
    hooks.replace(
      "-- WRAPPER_INSERT",
      `local function wrapper()\n${COBALT_BUNDLE.slice(start, end)}\nend`,
    ),
  );
  run(process.env.LUAU_BIN || "luau", [wrapper]);
  process.stderr.write(
    `Compiled ${files.length} Luau sources; simulated adapter and hook cleanup passed.\n`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
