import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltMode, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "ensure-remote-spy",
  title: "Start Cobalt remote capture",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Loads bundled Cobalt 2.2.5.15 or attaches to an existing Cobalt session. Idempotently subscribes to its incoming/outgoing captures without adding separate game hooks. auto prefers RakNet when supported. max bounds the MCP capture buffer; Cobalt's own UI history is separate. A mode change requires remote-spy operation=restart. Returns status or error.",
  input: z.object({
    mode: cobaltMode.optional().default("auto"),
    max: z
      .number()
      .int()
      .describe(
        "MCP buffer capacity, clamped to 10..5000. Omit to retain the current capacity (500 on first start).",
      )
      .optional(),
    threadContext: z.number().int().optional(),
  }),
  async execute({ mode, max, threadContext }, ctx) {
    return runCobalt(ctx, "start", { mode, max }, threadContext);
  },
});
