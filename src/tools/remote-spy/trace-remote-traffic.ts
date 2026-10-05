import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "trace-remote-traffic",
  title: "Trace Cobalt traffic",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE on start. Starts/adopts Cobalt and opens a traffic view. fetch reads captures since start; stop closes the view while Cobalt continues. Direction is selected on start. Shares the bounded buffer with all other spy tools.",
  input: z.object({
    action: z.enum(["start", "fetch", "stop"]),
    direction: cobaltDirection.optional().default("Both"),
    limit: z.number().int().optional().default(100),
    threadContext: z.number().int().optional(),
  }),
  async execute({ action, direction, limit, threadContext }, ctx) {
    if (action === "start") {
      const start = await runCobalt(ctx, "start", {}, threadContext);
      if (start.isError) return start;
    }
    return runCobalt(
      ctx,
      `view-${action}`,
      { view: "trace", ...(action === "start" ? { direction } : {}), limit },
      threadContext,
    );
  },
});
