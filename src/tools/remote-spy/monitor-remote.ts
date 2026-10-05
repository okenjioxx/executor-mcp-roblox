import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "monitor-remote",
  title: "Monitor one remote",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE on start. Starts the selected engine if needed and opens a view for one remote instance. fetch reads retained captures since the view started; stop closes the view while shared capture continues. Starting a different engine stops the previous spy on this client. No additional game hooks are installed for views.",
  input: z.object({
    engine: spyEngine,
    action: z.enum(["start", "fetch", "stop"]),
    remotePath: z.string().optional(),
    direction: cobaltDirection.optional().default("Both"),
    limit: z.number().int().optional().default(100),
    threadContext: z.number().int().optional(),
  }),
  async execute({ engine, action, remotePath, direction, limit, threadContext }, ctx) {
    if (!remotePath) return { data: { error: "remotePath is required" }, isError: true };
    if (action === "start") {
      const start = await runRemoteSpy(ctx, "start", { engine }, threadContext);
      if (start.isError) return start;
    }
    return runRemoteSpy(
      ctx,
      `view-${action}`,
      {
        engine,
        view: `monitor:${remotePath}`,
        ...(action === "start" ? { remotePath, direction } : {}),
        limit,
      },
      threadContext,
    );
  },
});
