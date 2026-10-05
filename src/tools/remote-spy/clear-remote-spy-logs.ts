import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "clear-remote-spy-logs",
  title: "Clear remote-spy history",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Clears the selected engine's MCP buffer and GUI history while retaining block/ignore settings and continuing capture. Call IDs remain monotonic.",
  input: z.object({
    engine: spyEngine,
    threadContext: z.number().int().optional(),
  }),
  async execute({ engine, threadContext }, ctx) {
    return runRemoteSpy(ctx, "clear", { engine }, threadContext);
  },
});
