import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { cobaltDirection, runRemoteSpy, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "ignore-remote",
  title: "Set a remote's ignore state",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Reversibly ignores captures for an observed remoteId or Luau remotePath in the selected engine/direction. ignored=false undoes it. Calls continue executing. Ketamine suppresses MCP captures; Cobalt suppresses its engine/MCP history.",
  input: z.object({
    engine: spyEngine,
    remotePath: z.string().optional(),
    remoteId: z.string().optional(),
    direction: cobaltDirection.optional().default("Outgoing"),
    ignored: z.boolean().optional().default(true),
    threadContext: z.number().int().optional(),
  }),
  async execute({ engine, remotePath, remoteId, direction, ignored, threadContext }, ctx) {
    if (!remotePath && !remoteId)
      return { data: { error: "remotePath or remoteId is required" }, isError: true };
    return runRemoteSpy(
      ctx,
      "control",
      { engine, remotePath, remoteId, direction, control: "ignore", enabled: ignored },
      threadContext,
    );
  },
});
