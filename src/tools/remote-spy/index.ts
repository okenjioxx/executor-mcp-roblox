import type { Tool } from "../../application/tool/tool.js";

import listRemotes from "./list-remotes.js";
import getRemoteSignature from "./get-remote-signature.js";
import monitorRemote from "./monitor-remote.js";
import traceRemoteTraffic from "./trace-remote-traffic.js";
import inspectCallbacks from "./inspect-callbacks.js";
import ensureRemoteSpy from "./ensure-remote-spy.js";
import getRemoteSpyLogs from "./get-remote-spy-logs.js";
import clearRemoteSpyLogs from "./clear-remote-spy-logs.js";
import blockRemote from "./block-remote.js";
import ignoreRemote from "./ignore-remote.js";
import remoteSpy from "./remote-spy.js";

/** Static inspection plus Cobalt-backed capture and control tools. */
export const remoteSpyTools: Tool[] = [
  listRemotes,
  getRemoteSignature,
  monitorRemote,
  traceRemoteTraffic,
  inspectCallbacks,
  ensureRemoteSpy,
  getRemoteSpyLogs,
  clearRemoteSpyLogs,
  blockRemote,
  ignoreRemote,
  remoteSpy,
];
