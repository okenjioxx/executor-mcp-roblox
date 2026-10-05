import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, cobaltMode, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "remote-spy",
  title: "Cobalt spy controls and diagnostics",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE for start/restart/stop/clear/block/unblock/ignore/unignore. Primary Cobalt control surface: status, list ranked captured remotes, logs, code generation by callId, and reversible controls by remoteId or Luau remotePath. Read operations never auto-load. code returns Cobalt-generated Luau without executing it. Block/ignore require an observed remote in the selected direction. restart/stop unload the entire Cobalt session, including an adopted external session; restart expires IDs and views.",
  input: z.object({
    operation: z.enum([
      "status",
      "start",
      "restart",
      "stop",
      "list",
      "logs",
      "clear",
      "block",
      "unblock",
      "ignore",
      "unignore",
      "code",
    ]),
    mode: cobaltMode.optional().default("auto"),
    max: z.number().int().optional(),
    limit: z.number().int().optional().default(100),
    direction: cobaltDirection.optional().default("Both"),
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    nameFilter: z.string().optional(),
    afterId: z.number().int().nonnegative().optional(),
    summaryOnly: z.boolean().optional().default(true),
    callId: z.number().int().positive().optional(),
    threadContext: z.number().int().optional(),
  }),
  async execute({ operation, threadContext, ...options }, ctx) {
    if (["block", "unblock", "ignore", "unignore"].includes(operation)) {
      if (!options.remotePath && !options.remoteId)
        return { data: { error: "remotePath or remoteId is required" }, isError: true };
      return runCobalt(
        ctx,
        "control",
        {
          ...options,
          control: operation === "block" || operation === "unblock" ? "block" : "ignore",
          enabled: operation === "block" || operation === "ignore",
        },
        threadContext,
      );
    }
    if (operation === "code" && !options.callId)
      return { data: { error: "callId is required" }, isError: true };
    return runCobalt(
      ctx,
      operation as "status" | "start" | "restart" | "stop" | "list" | "logs" | "clear" | "code",
      options,
      threadContext,
    );
  },
});
