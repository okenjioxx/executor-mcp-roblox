import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, cobaltMode, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "remote-spy",
  title: "Remote-spy controls and diagnostics",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE for start/restart/stop/clear/block/unblock/ignore/unignore. Select engine=cobalt (default) or ketamine. Starting another engine stops the previous spy on this client after preflight succeeds. Read operations never load either engine. Lists ranked remotes, filtered logs, and generates call code without replaying it. Block/ignore require observed remotes. Ketamine incoming RemoteEvent blocking is unsupported; outgoing calls and incoming function callbacks can be blocked. restart expires IDs/views; stop unloads the selected session, including an adopted Cobalt GUI/hooks.",
  input: z.object({
    engine: spyEngine,
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
      return runRemoteSpy(
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
    return runRemoteSpy(
      ctx,
      operation as "status" | "start" | "restart" | "stop" | "list" | "logs" | "clear" | "code",
      options,
      threadContext,
    );
  },
});
