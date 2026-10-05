import { COBALT_BUNDLE, COBALT_VERSION } from "./cobalt-bundle.js";

export type CobaltOperation =
  | "start"
  | "restart"
  | "stop"
  | "status"
  | "logs"
  | "list"
  | "clear"
  | "control"
  | "view-start"
  | "view-fetch"
  | "view-stop"
  | "code";

export interface CobaltSpyOptions {
  mode?: "auto" | "luau" | "raknet";
  max?: number;
  limit?: number;
  afterId?: number;
  direction?: "Incoming" | "Outgoing" | "Both";
  remotePath?: string;
  remoteId?: string;
  nameFilter?: string;
  method?: string;
  raknetOnly?: boolean;
  summaryOnly?: boolean;
  control?: "block" | "ignore";
  enabled?: boolean;
  view?: string;
  callId?: number;
}

function literal(value: unknown): string {
  if (typeof value === "string")
    return (
      '"' +
      Array.from(value, (char) => {
        const code = char.charCodeAt(0);
        return code < 32 || char === "\\" || char === '"'
          ? "\\" + code.toString().padStart(3, "0")
          : char;
      }).join("") +
      '"'
    );
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value === undefined || value === null) return "nil";
  return `{ ${Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `[${literal(k)}] = ${literal(v)}`)
    .join(", ")} }`;
}

function longString(source: string): string {
  let equals = "=";
  while (source.includes(`]${equals}]`)) equals += "=";
  return `[${equals}[${source}]${equals}]`;
}

/** Shared bounded recorder; each backend owns its game hooks. */
export function buildCobaltSpySource(
  operation: CobaltOperation,
  options: CobaltSpyOptions = {},
): string {
  return buildCaptureSpySource(operation, options, "Cobalt", COBALT_BUNDLE, COBALT_VERSION);
}

/** Both backends expose capture observers, controls, code generation, and unload. */
export function buildCaptureSpySource(
  operation: CobaltOperation,
  options: CobaltSpyOptions,
  engineName: "Cobalt" | "Ketamine",
  bundle: string,
  version: string,
): string {
  const boot =
    operation === "start" || operation === "restart"
      ? `local __bundle = ${longString(bundle)}`
      : "local __bundle = nil";
  return `local __engineName = ${literal(engineName)}\nlocal __operation = ${literal(operation)}\nlocal __options = ${literal(options)}\nlocal __bundleVersion = ${literal(version)}\n${boot}\n${COBALT_ADAPTER}`;
}

export const COBALT_ADAPTER = String.raw`
if type(getgenv) ~= "function" then return { error = "getgenv not available" } end
local env = getgenv()
local engineName = __engineName or "Cobalt"
local isKetamine = engineName == "Ketamine"
local prefix = isKetamine and "__polaris_ketamine" or "__polaris_cobalt"
local objectKey = isKetamine and "__polarisKetamineEngine" or "Cobalt"
local loadingKey = isKetamine and "__polarisKetamineLoading" or "__polarisCobaltLoading"
local modeKey = isKetamine and "__polarisKetamineMode" or "__polarisCobaltMode"
local initializedKey = isKetamine and "__polarisKetamineInitialized" or "CobaltInitialized"
local options = __options
local operation = __operation
local state = env[prefix .. "Spy"]
local cobalt = env[objectKey]
local function shared()
  return type(cobalt) == "table" and type(cobalt.shared) == "table" and cobalt.shared or nil
end
local function text(value, limit)
  local ok, result = pcall(tostring, value)
  if not ok then return "<unprintable>" end
  result = string.sub(result, 1, limit or 1024)
  local valid, length = pcall(utf8.len, result)
  return valid and length ~= nil and result or "<non-UTF8 bytes>"
end
local function path(instance)
  local ok, result = pcall(function() return instance:GetFullName() end)
  return ok and result or text(instance)
end
local function same(a, b)
  if rawequal(a, b) then return true end
  if type(compareinstances) == "function" then
    local ok, equal = pcall(compareinstances, a, b)
    return ok and equal == true
  end
  return false
end
local function detach()
  if not state then return end
  if state.registry and state.callback then
    local index = table.find(state.registry, state.callback)
    if index then table.remove(state.registry, index) end
  end
  state.active = false
end
local function ready()
  local s = shared()
  return s and not s.Unloaded and type(s.Logs) == "table"
end
local function status()
  local s = shared()
  local support = s and s.ExecutorSupport and s.ExecutorSupport.raknet
  return {
    engine = engineName, bundledVersion = __bundleVersion,
    sessionId = state and state.sessionId or nil,
    loaded = ready() == true, active = ready() == true and state ~= nil and state.active == true and same(state.cobalt, cobalt),
    mode = s and (s.IsUsingRakNetHooks and "raknet" or "luau") or nil,
    raknetSupported = support and support.IsWorking == true or false,
    raknetDetails = support and support.Details or nil,
    count = state and state.count or 0, max = state and state.max or 0,
    dropped = state and state.dropped or 0, captureErrors = state and state.errors or 0,
    latestId = state and state.nextId - 1 or 0,
    owned = state and state.owned == true or false,
    cleanupCompatibility = isKetamine and "owned-hook-cleanup" or (s and s.PolarisCobaltPatched and "callback-or-handle" or "external-build"),
  }
end

-- Values are snapshotted at capture time. No raw packet/argument object crosses
-- the connector boundary; arity, nils, binary buffers and table keys survive.
local function encode(value, depth, seen, budget)
  budget.nodes += 1
  local kind = typeof(value)
  if budget.nodes > 240 or depth > 3 then budget.truncated = true return { __type = kind, truncated = true } end
  if kind == "nil" then return { __type = "nil" } end
  if kind == "boolean" then return value end
  if kind == "number" then
    if value == value and value ~= math.huge and value ~= -math.huge then return value end
    return { __type = "number", value = text(value) }
  end
  if kind == "string" then
    local preview = string.sub(value, 1, 1024)
    local valid, length = pcall(utf8.len, preview)
    if not valid or length == nil then
      local hex = {}
      for i = 1, math.min(#value, 96) do hex[i] = string.format("%02x", string.byte(value, i)) end
      if #value > 96 then budget.truncated = true end
      return { __type = "string", binary = true, hex = table.concat(hex), bytes = #value, truncated = #value > 96 }
    end
    if #value > 1024 then budget.truncated = true return { __type = "string", value = string.sub(value, 1, 1024), bytes = #value, truncated = true } end
    return value
  end
  if kind == "Instance" then return { __type = "Instance", path = path(value) } end
  if kind == "buffer" then
    local bytes = buffer.len(value)
    local hex = {}
    for i = 0, math.min(bytes, 96) - 1 do hex[#hex + 1] = string.format("%02x", buffer.readu8(value, i)) end
    if bytes > 96 then budget.truncated = true end
    return { __type = "buffer", bytes = bytes, hex = table.concat(hex), truncated = bytes > 96 }
  end
  if kind == "table" then
    if seen[value] then return { __type = "table", cycle = true } end
    seen[value] = true
    local entries = {}
    local key, child = next(value)
    while key ~= nil and #entries < 24 and budget.nodes <= 240 do
      entries[#entries + 1] = { key = encode(key, depth + 1, seen, budget), value = encode(child, depth + 1, seen, budget) }
      key, child = next(value, key)
    end
    seen[value] = nil
    if key ~= nil then budget.truncated = true end
    return { __type = "table", entries = entries, truncated = key ~= nil }
  end
  return { __type = kind, value = text(value) }
end
local function packed(values)
  local budget = { nodes = 0, truncated = false }
  if type(values) ~= "table" then return {}, 0, false end
  local count = math.max(0, math.floor(tonumber(rawget(values, "n")) or #values))
  local out = {}
  for i = 1, math.min(count, 64) do out[i] = encode(rawget(values, i), 0, {}, budget) end
  return out, count, budget.truncated or count > 64
end
local function resolve(expression)
  if type(expression) ~= "string" then return nil, "remotePath is required" end
  local loader, err = loadstring("return " .. expression)
  if not loader then return nil, "Invalid remotePath: " .. text(err) end
  local ok, instance = pcall(loader)
  if not ok or typeof(instance) ~= "Instance" then return nil, "remotePath must resolve to an Instance" end
  return instance
end
local function remoteId(instance)
  local id = state.ids[instance]
  if not id then
    for candidate, ref in pairs(state.remotes) do
      if same(ref, instance) then id = candidate break end
    end
  end
  if not id then
    id = "remote-" .. (isKetamine and "ketamine-" or "") .. state.sessionId .. "-" .. state.nextRemote
    state.nextRemote += 1
  end
  state.ids[instance] = id
  state.remotes[id] = instance
  return id
end
local function push(info, instance, direction)
  if not state.active then return end
  local args, count, truncated = packed(info.Arguments)
  local results, resultCount, resultsTruncated = packed(info.InvokeResult)
  local s = shared()
  local methods = s.FunctionForClasses or {}
  local record = {
    id = state.nextId, remoteId = remoteId(instance), remote = path(instance), class = instance.ClassName,
    direction = direction, method = methods[direction] and methods[direction][instance.ClassName] or "?",
    args = args, argCount = count, argsTruncated = truncated,
    t = tonumber(info.CreationTime) or tick(), blocked = info.Blocked == true,
    isRakNet = info.IsRakNet == true, isActor = info.IsActor == true, isExecutor = info.IsExecutor,
    origin = typeof(info.Origin) == "Instance" and path(info.Origin) or nil,
    actor = typeof(info.Actor) == "Instance" and path(info.Actor) or nil,
    source = type(info.Source) == "string" and text(info.Source) or nil,
    line = info.Line, error = info.Error and text(info.Error) or nil, invokeKind = info.InvokeKind,
    results = info.InvokeResult ~= nil and results or nil,
    resultCount = info.InvokeResult ~= nil and resultCount or nil,
    resultsTruncated = info.InvokeResult ~= nil and resultsTruncated or nil,
  }
  state.nextId += 1
  env[prefix .. "NextId"] = state.nextId
  local slot
  if state.count == state.max then
    slot = state.head
    state.head = state.head % state.max + 1
    state.dropped += 1
  else
    slot = (state.head + state.count - 1) % state.max + 1
    state.count += 1
  end
  state.slots[slot] = { record = record, raw = info, instance = instance, direction = direction }
end
local function attach(max)
  local s = shared()
  local manager = s and s.CobaltPluginManager
  local globals = s and s.CaptureInterceptors or (manager and manager.Registry and manager.Registry.Interceptors and manager.Registry.Interceptors.Global)
  if not globals then return nil, "Cobalt capture API is unavailable; load the bundled build" end
  if not state or not same(state.cobalt, cobalt) then
    detach()
    env[prefix .. "Generation"] = (env[prefix .. "Generation"] or 0) + 1
    state = { sessionId = env[prefix .. "Generation"], cobalt = cobalt, active = false, max = max, count = 0, head = 1, slots = {}, dropped = 0, errors = 0,
      nextId = env[prefix .. "NextId"] or 1, nextRemote = 1, ids = setmetatable({}, { __mode = "k" }), remotes = setmetatable({}, { __mode = "v" }), views = {} }
    env[prefix .. "Spy"] = state
  end
  if state.max ~= max then
    local keep = math.min(state.count, max)
    local slots = {}
    for i = 1, keep do slots[i] = state.slots[(state.head + state.count - keep + i - 2) % state.max + 1] end
    state.dropped += state.count - keep
    state.slots, state.head, state.count, state.max = slots, 1, keep, max
  end
  if not state.active or not state.callback or not table.find(state.registry or {}, state.callback) then
    detach()
    globals.All = globals.All or {}
    state.registry = globals.All
    state.callback = function(info, instance, direction)
      local ok = pcall(push, info, instance, direction)
      if not ok then state.errors += 1 end
      -- Returning nil preserves Cobalt's own log and UI behavior.
    end
    table.insert(state.registry, state.callback)
    if manager then manager.HasInterceptors = true end
    state.active = true
  end
  return true
end
local function validateRaknet()
  if type(raknet) ~= "table" then return false end
  for _, name in { "add_send_hook", "remove_send_hook", "add_receive_hook", "remove_receive_hook" } do
    if type(raknet[name]) ~= "function" then return false end
  end
  if type(raknet.is_enabled) == "function" then
    local ok, enabled = pcall(raknet.is_enabled)
    if not ok or not enabled then return false end
  end
  return true
end
local function legacyHooks()
  if type(env.__mcp_remoteSpy) == "table" and env.__mcp_remoteSpy.active then return true end
  if type(env.__mcp_remoteTrace) == "table" and env.__mcp_remoteTrace.hook then return true end
  if type(env.__mcp_monitorRemote) == "table" then
    for _, monitor in pairs(env.__mcp_monitorRemote) do
      if type(monitor) == "table" and monitor.active and monitor.hook then return true end
    end
  end
  return false
end
if (operation == "start" or operation == "restart") and legacyHooks() then
  return { error = "Legacy Polaris spy hooks are active; rejoin Roblox and execute the updated connector before starting Cobalt" }
end
if operation == "status" then return status() end
if operation == "restart" and options.mode == "raknet" and not validateRaknet() then return { error = "Enable RakNet in the executor UI before restarting" } end
if operation == "stop" or operation == "restart" then
  if ready() and type(shared().Unload) ~= "function" then return { error = "Cobalt cannot be unloaded by this build" } end
  detach()
  if ready() then
    local ok, err = pcall(shared().Unload)
    if not ok then return { error = "Cobalt unload failed: " .. text(err) } end
    cobalt = env[objectKey]
    if ready() then return { error = "Cobalt is still running after unload" } end
  end
  if operation == "stop" then
    env[prefix .. "Spy"], state = nil, nil
    return { stopped = true, engine = engineName }
  end
end
if operation == "start" or operation == "restart" then
  local mode = options.mode or "auto"
  if mode == "raknet" and not validateRaknet() then return { error = "Enable RakNet in the executor UI; send and receive hooks are required" } end
  local adopted = ready() == true
  if adopted and mode ~= "auto" and mode ~= (shared().IsUsingRakNetHooks and "raknet" or "luau") then
    return { error = "Capture mode differs; use remote-spy operation=restart with the requested mode", restartRequired = true }
  end
  if not adopted then
    if env[loadingKey] then return { error = engineName .. " is already loading; retry status shortly" } end
    if env[initializedKey] then return { error = "A previous spy load has not completed; rejoin before loading again" } end
    env[loadingKey] = true
    env[modeKey] = mode
    local ok, err = pcall(function()
      local loader, compileError = loadstring(__bundle, "@polaris/" .. string.lower(engineName) .. "-" .. __bundleVersion)
      if not loader then error(compileError) end
      loader()
      local deadline = os.clock() + 15
      while not env[objectKey] and os.clock() < deadline do task.wait(0.1) end
    end)
    env[modeKey] = nil
    env[loadingKey] = nil
    cobalt = env[objectKey]
    if not ok or not ready() then return { error = engineName .. " failed to initialize: " .. text(err or "timeout") } end
  end
  local ok, err = attach(math.clamp(math.floor(options.max or (state and state.max) or 500), 10, 5000))
  if not ok then return { error = err } end
  state.owned = not adopted or state.owned == true
  local result = status()
  result.installed, result.alreadyActive = not adopted, adopted
  result.adoptedExisting = adopted
  if mode == "raknet" and result.mode ~= "raknet" then result.error = "Cobalt could not enable RakNet; see raknetDetails" end
  return result
end
if not ready() or not state or not same(state.cobalt, cobalt) or not state.active then
  return { notRunning = true, engine = engineName, count = 0, returned = 0, logs = {}, error = operation == "control" and "Call ensure-remote-spy first" or nil }
end
local s = shared()
local target
if options.remotePath then
  local err
  target, err = resolve(options.remotePath)
  if not target then return { error = err } end
end
if options.remoteId then
  local identified = state.remotes[options.remoteId]
  if not identified then return { error = "Remote ID expired or unknown; fetch captures again" } end
  if target and not same(target, identified) then return { error = "remotePath and remoteId identify different instances" } end
  target = identified
end
if operation == "control" then
  if not target then return { error = "remotePath or remoteId is required" } end
  if type(s.ControlRemote) == "function" then
    local result, err = s.ControlRemote(target, options.direction or "Both", options.control, options.enabled)
    if not result then return { error = err } end
    result.remoteId = remoteId(target)
    return result
  end
  local matches = 0
  for direction, category in pairs(s.Logs) do
    if options.direction == nil or options.direction == "Both" or options.direction == direction then
      for _, log in pairs(category) do
        if same(log.Instance, target) then
          local property = options.control == "block" and "Blocked" or "Ignored"
          local method = options.control == "block" and "Block" or "Ignore"
          if log[property] ~= options.enabled then log[method](log) end
          matches += 1
        end
      end
    end
  end
  if matches == 0 then return { error = "Remote has not been captured in the selected direction yet" } end
  local result = { remote = path(target), remoteId = remoteId(target), direction = options.direction or "Both", matched = matches, enabled = options.enabled }
  result[options.control == "block" and "blocked" or "ignored"] = options.enabled
  return result
end
if operation == "clear" then
  local removed = state.count
  state.slots, state.count, state.head = {}, 0, 1
  if type(s.ClearLogs) == "function" then s.ClearLogs() end
  return { cleared = true, removed = removed, engine = engineName }
end
local view
if string.sub(operation, 1, 5) == "view-" then
  local key = options.view or "trace"
  if operation == "view-start" then
    if state.views[key] then return { alreadyRunning = true, key = key } end
    state.views[key] = { afterId = state.nextId - 1, target = target, direction = options.direction or "Both" }
    return { started = true, key = key, remote = target and path(target), max = state.max, engine = engineName }
  elseif operation == "view-stop" then
    local existed = state.views[key] ~= nil
    state.views[key] = nil
    return { stopped = true, wasActive = existed, key = key, engine = engineName, captureContinues = true }
  end
  view = state.views[key]
  if not view then return { notRunning = true, key = key, calls = {}, entries = {}, count = 0 } end
  target = view.target
end
if operation == "code" then
  for i = state.count - 1, 0, -1 do
    local item = state.slots[(state.head + i - 1) % state.max + 1]
    if item.record.id == options.callId then
      local codeGen = s.PolarisCodeGen or s.CodeGen
      if not codeGen or type(codeGen.BuildCallCode) ~= "function" then return { error = "Cobalt code generation unavailable; restart with the bundled build" } end
      local info = table.clone(item.raw)
      info.Instance, info.Type = item.instance, item.direction
      local ok, result = pcall(codeGen.BuildCallCode, codeGen, info)
      return ok and { callId = options.callId, code = result, isRakNet = item.record.isRakNet } or { error = text(result) }
    end
  end
  return { error = "Call expired from the bounded buffer; fetch a recent call ID" }
end
local limit = math.clamp(math.floor(options.limit or 100), 1, 5000)
local direction = options.direction or (view and view.direction) or "Both"
local afterId = math.max(options.afterId or 0, view and view.afterId or 0)
local logs, matching = {}, 0
local summaries, grouped = {}, {}
for i = state.count - 1, 0, -1 do
  local item = state.slots[(state.head + i - 1) % state.max + 1]
  local record = item.record
  if record.id <= afterId then break end
  if direction ~= "Both" and record.direction ~= direction then continue end
  if target and not same(item.instance, target) then continue end
  if options.method and record.method ~= options.method then continue end
  if options.raknetOnly and not record.isRakNet then continue end
  if options.nameFilter and not string.find(string.lower(record.remote), string.lower(options.nameFilter), 1, true) then continue end
  matching += 1
  if operation == "list" then
    local key = record.remoteId .. ":" .. record.direction
    local summary = grouped[key]
    if not summary then
      summary = { remoteId = record.remoteId, remote = record.remote, class = record.class, direction = record.direction,
        method = record.method, totalCalls = 0, latestId = record.id, isRakNet = record.isRakNet, recentCalls = {} }
      grouped[key] = summary
      summaries[#summaries + 1] = summary
    end
    summary.totalCalls += 1
    if not options.summaryOnly and #summary.recentCalls < 3 then summary.recentCalls[#summary.recentCalls + 1] = record end
  elseif #logs < limit then logs[#logs + 1] = record end
end
if operation == "list" then
  table.sort(summaries, function(a, b) return a.totalCalls == b.totalCalls and a.latestId > b.latestId or a.totalCalls > b.totalCalls end)
  local total = #summaries
  while #summaries > limit do table.remove(summaries) end
  return { engine = engineName, count = total, returned = #summaries, truncated = #summaries < total, remotes = summaries, retention = "bounded MCP buffer" }
end
local result = status()
result.returned, result.matching, result.truncated, result.logs = #logs, matching, #logs < matching, logs
result.oldestId = state.count > 0 and state.slots[state.head].record.id or state.nextId
result.gap = options.afterId ~= nil and options.afterId > 0 and options.afterId < result.oldestId - 1
if view then result.calls, result.entries, result.key = logs, logs, options.view end
return result
`;
