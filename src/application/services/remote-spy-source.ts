import {
  buildCaptureSpySource,
  buildCobaltSpySource,
  type CobaltOperation,
  type CobaltSpyOptions,
} from "./cobalt-spy-source.js";
import { KETAMINE_BOOTSTRAP, KETAMINE_COMMIT, KETAMINE_PREPARE } from "./ketamine-spy-source.js";

export type SpyEngine = "cobalt" | "ketamine";

function backendSource(engine: SpyEngine, operation: CobaltOperation, options: CobaltSpyOptions) {
  return engine === "cobalt"
    ? buildCobaltSpySource(operation, options)
    : buildCaptureSpySource(operation, options, "Ketamine", KETAMINE_BOOTSTRAP, KETAMINE_COMMIT);
}

/** Serializes lifecycle changes in the selected Roblox client's environment. */
export function buildRemoteSpySource(
  engine: SpyEngine,
  operation: CobaltOperation,
  options: CobaltSpyOptions = {},
): string {
  const source = backendSource(engine, operation, options);
  if (operation !== "start" && operation !== "restart" && operation !== "stop") return source;
  const starting = operation !== "stop";
  const otherEngine = engine === "cobalt" ? "ketamine" : "cobalt";
  const prepare = starting && engine === "ketamine" ? KETAMINE_PREPARE : "return nil";
  const ketamineModeError = starting && engine === "ketamine" && options.mode === "raknet";
  return String.raw`
if type(getgenv) ~= "function" then return { error = "getgenv not available" } end
local env = getgenv()
if env.__polarisRemoteSpySwitching then return { error = "A remote-spy lifecycle change is in progress; retry status shortly" } end
if ${ketamineModeError} then return { error = "Ketamine supports Luau hooks only; choose mode=auto or luau" } end
if ${starting} and env.__KetamineShared and not env.__polarisKetamineEngine then
  return { error = "An external Ketamine session is running; close it before switching spies" }
end
if ${starting && engine === "cobalt" && options.mode === "raknet"} then
  if type(raknet) ~= "table" then return { error = "Enable RakNet before switching spies" } end
  for _, name in { "add_send_hook", "remove_send_hook", "add_receive_hook", "remove_receive_hook" } do
    if type(raknet[name]) ~= "function" then return { error = "RakNet send and receive hooks are required" } end
  end
  if type(raknet.is_enabled) == "function" and not raknet.is_enabled() then return { error = "Enable RakNet before switching spies" } end
end
local function prepare()
${prepare}
end
local function stopOther()
${backendSource(otherEngine, "stop", {})}
end
local function runSelected()
${source}
end
env.__polarisRemoteSpySwitching = true
local ok, result = pcall(function()
  if ${starting && engine === "ketamine"} and (${operation === "restart"} or not env.__polarisKetamineEngine) then
    env.__polarisKetaminePrepared = prepare()
  end
  if ${starting} then
    if env.__KetamineShared and not env.__polarisKetamineEngine then
      return { error = "An external Ketamine session started during preflight; close it before switching spies" }
    end
    local stopped = stopOther()
    if stopped.error or not stopped.stopped then return { error = "Cannot switch remote spies: " .. tostring(stopped.error or "previous engine did not stop") } end
  end
  return runSelected()
end)
env.__polarisKetaminePrepared = nil
env.__polarisRemoteSpySwitching = nil
if not ok then return { error = tostring(result) } end
return result
`;
}
