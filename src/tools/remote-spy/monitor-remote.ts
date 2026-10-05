import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "monitor-remote",
  title: "Monitor one remote through Cobalt",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE on start. Starts Cobalt if needed and opens a capture view for one remote instance. fetch reads captures since this view started; stop closes the view while shared Cobalt capture continues. Does not install independent hooks. Views use the shared bounded buffer.",
  input: z.object({
    action: z.enum(["start", "fetch", "stop"]),
    remotePath: z.string().optional(),
    direction: cobaltDirection.optional().default("Both"),
    limit: z.number().int().optional().default(100),
    threadContext: z.number().int().optional(),
  }),
  async execute({ action, remotePath, direction, limit, threadContext }, ctx) {
    if (!remotePath) return { data: { error: "remotePath is required" }, isError: true };
    if (action === "start") {
      const start = await runCobalt(ctx, "start", {}, threadContext);
      if (start.isError) return start;
    }
    return runCobalt(
      ctx,
      `view-${action}`,
      {
        view: `monitor:${remotePath}`,
        ...(action === "start" ? { remotePath, direction } : {}),
        limit,
      },
      threadContext,
    );
  },
});
