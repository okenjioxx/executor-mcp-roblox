import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltMode, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "ensure-remote-spy",
  title: "Start the selected remote spy",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Starts the selected engine (default cobalt), stopping the other spy on this client first. Cobalt is bundled; Ketamine is downloaded from a pinned upstream commit and hash-checked before loading. Ketamine requires hookfunction, hookmetamethod, getnamecallmethod, getcallbackvalue, setfenv, and crypt.hash. Idempotently attaches one capture observer. RakNet is Cobalt-only. max bounds the MCP buffer, separate from GUI history. Use remote-spy operation=restart for mode changes.",
  input: z.object({
    engine: spyEngine,
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
  async execute({ engine, mode, max, threadContext }, ctx) {
    return runRemoteSpy(ctx, "start", { engine, mode, max }, threadContext);
  },
});
