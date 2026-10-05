import { z } from "zod";
import type { ToolContext, ToolResult } from "../../application/tool/tool.js";
import {
  buildCobaltSpySource,
  type CobaltOperation,
  type CobaltSpyOptions,
} from "../../application/services/cobalt-spy-source.js";

export const cobaltDirection = z
  .enum(["Incoming", "Outgoing", "Both"])
  .describe("Capture/control direction; incoming includes client callbacks.");
export const cobaltMode = z
  .enum(["auto", "luau", "raknet"])
  .describe(
    "auto prefers supported RakNet; raknet requires it; luau uses Cobalt's standard hooks. A mode change requires restart.",
  );

export async function runCobalt(
  ctx: ToolContext,
  operation: CobaltOperation,
  options: CobaltSpyOptions = {},
  threadContext?: number,
): Promise<ToolResult> {
  const boot = operation === "start" || operation === "restart";
  const data = await ctx.runLuau(buildCobaltSpySource(operation, options), {
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
