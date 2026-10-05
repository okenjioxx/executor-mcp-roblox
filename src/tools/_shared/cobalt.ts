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
