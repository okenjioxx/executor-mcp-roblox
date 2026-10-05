import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "ignore-remote",
  title: "Set a remote's Cobalt ignore state",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Sets Cobalt's ignore state for an observed remote by its captured remoteId or Luau remotePath expression, in the selected direction. Set ignored=false to undo. Calls must have been observed first. Ignored calls continue but do not enter Cobalt/MCP history.",
  input: z.object({
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    direction: cobaltDirection.optional().default("Outgoing"),
    ignored: z.boolean().optional().default(true),
    threadContext: z.number().int().optional(),
  }),
  async execute({ remotePath, remoteId, direction, ignored, threadContext }, ctx) {
    if (!remotePath && !remoteId)
      return { data: { error: "remotePath or remoteId is required" }, isError: true };
    return runCobalt(
      ctx,
      "control",
      { remotePath, remoteId, direction, control: "ignore", enabled: ignored },
      threadContext,
    );
  },
});
