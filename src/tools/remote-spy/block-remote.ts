import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "block-remote",
  title: "Set a remote's Cobalt block state",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Sets Cobalt's block state for an observed remote by its captured remoteId or Luau remotePath expression, in the selected direction. Set blocked=false to undo. Calls must have been observed first. Blocking drops calls; block only the intended direction.",
  input: z.object({
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    direction: cobaltDirection.optional().default("Outgoing"),
    blocked: z.boolean().optional().default(true),
    threadContext: z.number().int().optional(),
  }),
  async execute({ remotePath, remoteId, direction, blocked, threadContext }, ctx) {
    if (!remotePath && !remoteId)
      return { data: { error: "remotePath or remoteId is required" }, isError: true };
    return runCobalt(
      ctx,
      "control",
      { remotePath, remoteId, direction, control: "block", enabled: blocked },
      threadContext,
    );
  },
});
