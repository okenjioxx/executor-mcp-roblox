import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, remoteClass, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "get-remote-spy-logs",
  title: "Read remote-spy captures",
  category: "Remote Spy",
  description:
    "Reads bounded captures from the selected engine without loading it. Query filters by direction, remoteId/path, method, class, blocked-only, name, and afterId cursor affect this read only; use configure-remote-spy for persistent capture filters. Typed argument snapshots preserve nil arity and binary previews. Cobalt supplies available RakNet/actor metadata and results; Ketamine captures request arguments only. gap reports expired history. IDs are scoped to the engine and generation.",
  input: z.object({
    engine: spyEngine,
    limit: z.number().int().optional().default(100),
    afterId: z.number().int().nonnegative().optional(),
    direction: cobaltDirection.optional().default("Both"),
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    nameFilter: z.string().optional(),
    method: z.string().optional(),
    classFilter: remoteClass.optional(),
    blockedOnly: z.boolean().optional(),
    raknetOnly: z.boolean().optional(),
    threadContext: z.number().int().optional(),
  }),
  async execute({ threadContext, ...options }, ctx) {
    return runRemoteSpy(ctx, "logs", options, threadContext);
  },
});
