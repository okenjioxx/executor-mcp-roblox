import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "block-remote",
  title: "Set a remote's block state",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Reversibly sets the selected spy's block state for an observed remoteId or Luau remotePath, in the selected direction. blocked=false undoes it. Ketamine supports outgoing remotes and incoming RemoteFunction callbacks; incoming RemoteEvent blocking returns an explicit unsupported error. Both-direction requests are validated before changing any state.",
  input: z.object({
    engine: spyEngine,
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    direction: cobaltDirection.optional().default("Outgoing"),
    blocked: z.boolean().optional().default(true),
    threadContext: z.number().int().optional(),
  }),
  async execute({ engine, remotePath, remoteId, direction, blocked, threadContext }, ctx) {
    if (!remotePath && !remoteId)
      return { data: { error: "remotePath or remoteId is required" }, isError: true };
    return runRemoteSpy(
      ctx,
      "control",
      { engine, remotePath, remoteId, direction, control: "block", enabled: blocked },
      threadContext,
    );
  },
});
