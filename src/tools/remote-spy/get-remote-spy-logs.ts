import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runCobalt } from "../_shared/cobalt.js";

export default defineTool({
  name: "get-remote-spy-logs",
  title: "Read Cobalt captures",
  category: "Remote Spy",
  description:
    "Reads bounded Cobalt captures newest first, with direction, RakNet/actor metadata, typed argument snapshots, nil arity, and available function results/errors. afterId enables incremental polling; gap reports expired history. Reads never load Cobalt. Remote IDs distinguish same-named instances and expire on restart.",
  input: z.object({
    limit: z.number().int().optional().default(100),
    afterId: z.number().int().nonnegative().optional(),
    direction: cobaltDirection.optional().default("Both"),
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    nameFilter: z.string().optional(),
    method: z.string().optional(),
    raknetOnly: z.boolean().optional(),
    threadContext: z.number().int().optional(),
  }),
  async execute({ threadContext, ...options }, ctx) {
    return runCobalt(ctx, "logs", options, threadContext);
  },
});
