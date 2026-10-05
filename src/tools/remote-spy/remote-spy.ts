import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import {
  cobaltDirection,
  cobaltMode,
  remoteClass,
  remoteMethod,
  runRemoteSpy,
  spyConfiguration,
  spyEngine,
} from "../_shared/cobalt.js";

export default defineTool({
  name: "remote-spy",
  title: "Remote-spy controls and diagnostics",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Controls the selected spy: lifecycle, configure, pause/resume, clear, block/unblock, ignore/unignore, and reset-controls. Select engine=cobalt (default) or ketamine. status reports effective capture/GUI settings and capabilities; controls lists active block/ignore rules with limit/offset and direction filters. reset-controls clears block/ignore rules in the selected direction, preserving history and capture settings; Ketamine GUI ignore rules span Both and reset only with direction=Both. logs/list support query filters; code generates call code without replay. Configuration is a patch; capture filters affect future MCP records only. Pausing recording preserves blocking and GUI logging. Starting another engine stops the previous after preflight; read/configuration operations never load spies. Block/ignore require observed remotes. Ketamine cannot block incoming RemoteEvents. restart expires IDs/views and resets configuration; stop unloads the selected GUI/hooks.",
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
      "configure",
      "pause",
      "resume",
      "controls",
      "reset-controls",
    ]),
    mode: cobaltMode.optional().default("auto"),
    ...spyConfiguration.shape,
    limit: z.number().int().optional().default(100),
    offset: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Pagination offset for controls only."),
    resetControl: z
      .enum(["block", "ignore", "Both"])
      .optional()
      .describe("For reset-controls: which rules to clear; defaults to Both."),
    direction: cobaltDirection.optional().default("Both"),
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    nameFilter: z.string().optional(),
    method: remoteMethod.optional(),
    classFilter: remoteClass.optional(),
    blockedOnly: z.boolean().optional(),
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
      operation as
        | "status"
        | "start"
        | "restart"
        | "stop"
        | "list"
        | "logs"
        | "clear"
        | "code"
        | "configure"
        | "pause"
        | "resume"
        | "controls"
        | "reset-controls",
      options,
      threadContext,
    );
  },
});
