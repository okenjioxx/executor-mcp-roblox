import { z } from "zod";
import type { ToolContext, ToolResult } from "../../application/tool/tool.js";
import {
  type CobaltOperation,
  type CobaltSpyOptions,
} from "../../application/services/cobalt-spy-source.js";
import {
  buildRemoteSpySource,
  type SpyEngine,
} from "../../application/services/remote-spy-source.js";

export const spyEngine = z
  .enum(["cobalt", "ketamine"])
  .default("cobalt")
  .describe(
    "Remote-spy backend. Only one engine runs per client; starting another stops the current engine. Defaults to cobalt.",
  );

export const cobaltDirection = z
  .enum(["Incoming", "Outgoing", "Both"])
  .describe("Capture/control direction; incoming includes client callbacks.");
export const cobaltMode = z
  .enum(["auto", "luau", "raknet"])
  .describe(
    "Cobalt auto prefers supported RakNet; luau selects standard hooks. Ketamine accepts auto/luau only. Changing an active mode requires restart.",
  );

export const remoteClass = z.enum(["RemoteEvent", "UnreliableRemoteEvent", "RemoteFunction"]);
export const remoteMethod = z.enum([
  "FireServer",
  "InvokeServer",
  "OnClientEvent",
  "OnClientInvoke",
]);
export const spyConfiguration = z.object({
  max: z
    .number()
    .int()
    .min(10)
    .max(5000)
    .optional()
    .describe("Retained MCP calls; resizing preserves newest history and IDs."),
  capture: z
    .object({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "False pauses MCP recording while hooks and block/ignore controls remain installed.",
        ),
      direction: cobaltDirection.optional(),
      nameFilter: z
        .string()
        .max(256)
        .optional()
        .describe(
          "Case-insensitive literal substring of the full remote path; empty string clears it.",
        ),
      method: remoteMethod.optional(),
      classFilter: remoteClass.optional(),
      blockedOnly: z.boolean().optional().describe("Retain only calls blocked by the spy."),
    })
    .strict()
    .optional()
    .describe(
      "Persistent capture patch; omitted fields keep their current values. Filters apply only to future MCP captures.",
    ),
  resetFilters: z
    .boolean()
    .optional()
    .describe(
      "Clear persistent capture filters before applying this patch; preserve pause state, history, and network controls.",
    ),
  guiVisible: z
    .boolean()
    .optional()
    .describe("Ketamine only: show/hide its GUI without unloading the spy."),
  guiLogging: z
    .boolean()
    .optional()
    .describe(
      "Ketamine only: enable/disable new GUI log entries independently of MCP capture; disabling also clears queued GUI entries.",
    ),
});

export async function runRemoteSpy(
  ctx: ToolContext,
  operation: CobaltOperation,
  options: CobaltSpyOptions & { engine?: SpyEngine } = {},
  threadContext?: number,
): Promise<ToolResult> {
  const boot = operation === "start" || operation === "restart";
  const { engine = "cobalt", ...backendOptions } = options;
  const data = await ctx.runLuau(buildRemoteSpySource(engine, operation, backendOptions), {
    threadContext: threadContext ?? 8,
    timeoutMs: boot ? 60000 : 15000,
  });
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  )
    return { data, isError: true };
  return { data };
}
