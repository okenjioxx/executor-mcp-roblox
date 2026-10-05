import { z } from "zod";
import { defineTool } from "../../application/tool/define-tool.js";
import { runRemoteSpy, spyConfiguration, spyEngine } from "../_shared/cobalt.js";

export default defineTool({
  name: "configure-remote-spy",
  title: "Configure spy capture and GUI",
  category: "Remote Spy",
  mutatesState: true,
  description:
    "WRITES LIVE GAME STATE. Configures an already-running spy without restarting or expiring IDs. Use engine=ketamine for Ketamine. Patch persistent MCP capture filters, pause/resume with capture.enabled, resize bounded history, or control Ketamine GUI visibility/logging. Omitted settings are preserved; resetFilters clears capture filters. Returns effective settings and capabilities. Pausing/filtering capture does not unblock remotes or change network delivery. Reads/configuration never load a spy; start it with remote-spy first. Cobalt accepts capture/buffer settings but rejects Ketamine GUI settings.",
  input: z.object({
    engine: spyEngine,
    ...spyConfiguration.shape,
    threadContext: z.number().int().optional(),
  }),
  async execute({ threadContext, ...options }, ctx) {
    return runRemoteSpy(ctx, "configure", options, threadContext);
  },
});
