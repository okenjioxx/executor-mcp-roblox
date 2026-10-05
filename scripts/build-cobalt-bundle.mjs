import { format } from "prettier";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("vendor/cobalt/Cobalt.luau", root), "utf8");
const provenance = JSON.parse(readFileSync(new URL("vendor/cobalt/provenance.json", root), "utf8"));
writeFileSync(
  new URL("src/application/services/cobalt-bundle.ts", root),
  await format(
    "// Generated from vendor/cobalt/Cobalt.luau; Apache-2.0, deivid and upio.\n" +
      "// Rebuild with node scripts/build-cobalt-bundle.mjs.\n" +
      `export const COBALT_VERSION = ${JSON.stringify(provenance.version)};\n` +
      `export const COBALT_BUNDLE = String(${JSON.stringify(source)});\n`,
    { parser: "typescript" },
  ),
);
