import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "clear-remote-spy-logs",
  title: "Clear Cobalt capture history",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Clears the MCP buffer and Cobalt UI call history while retaining block/ignore settings and continuing capture. Call IDs remain monotonic for this Cobalt session.",
  input: z.object({ threadContext: z.number().int().optional() }),
  async execute({ threadContext }, ctx) {
    return runCobalt(ctx, "clear", {}, threadContext);
  },
});
