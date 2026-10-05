import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "trace-remote-traffic",
  title: "Trace remote traffic",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE on start. Starts/adopts the selected engine and opens a traffic view. fetch reads retained captures since start; stop closes only the view. Direction is selected on start. Shares the bounded buffer with all spy tools for this engine. Starting another engine stops the previous spy on this client.",
  input: z.object({
    engine: spyEngine,
    action: z.enum(["start", "fetch", "stop"]),
    direction: cobaltDirection.optional().default("Both"),
    limit: z.number().int().optional().default(100),
    threadContext: z.number().int().optional(),
  }),
  async execute({ engine, action, direction, limit, threadContext }, ctx) {
    if (action === "start") {
      const start = await runRemoteSpy(ctx, "start", { engine }, threadContext);
      if (start.isError) return start;
    }
    return runRemoteSpy(
      ctx,
      `view-${action}`,
      { engine, view: "trace", ...(action === "start" ? { direction } : {}), limit },
      threadContext,
    );
  },
});
