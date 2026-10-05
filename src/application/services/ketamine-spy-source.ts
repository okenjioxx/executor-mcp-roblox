/** Upstream is downloaded only on an explicit start, never redistributed. */
export const KETAMINE_COMMIT = "478b27da78869316443389012eb4ef34f8037323";
export const KETAMINE_SHA256 = "31fb2c6bef8f3f740a8fc08cfc856f1ec00ba8d2ac59a5815f2cf38902daad77";
export const KETAMINE_URL = `https://raw.githubusercontent.com/InfernusScripts/Ketamine/${KETAMINE_COMMIT}/Ketamine.lua`;

/** Returns a compiled, isolated loader before the current spy is stopped. */
export const KETAMINE_PREPARE = String.raw`
local env = getgenv()
if env.__KetamineShared and not env.__polarisKetamineEngine then
  error("An external Ketamine session is running; close it before using the MCP adapter")
end
for _, name in { "hookfunction", "hookmetamethod", "getnamecallmethod", "getcallbackvalue", "loadstring", "setfenv" } do
  if type(getfenv()[name]) ~= "function" then error("Ketamine requires " .. name) end
end
local hash = crypt and crypt.hash
if type(hash) ~= "function" then error("Ketamine requires crypt.hash to verify the pinned upstream source") end
local source = game:HttpGet("${KETAMINE_URL}")
if type(source) ~= "string" or #source > 2097152 then error("Invalid Ketamine source download") end
if string.lower(hash(source, "sha256")) ~= "${KETAMINE_SHA256}" then error("Ketamine source SHA-256 mismatch; refusing to load") end
local function replaceOnce(text, before, after)
  local first, last = string.find(text, before, 1, true)
  if not first or string.find(text, before, last + 1, true) then error("Unsupported Ketamine source layout") end
  return string.sub(text, 1, first - 1) .. after .. string.sub(text, last + 1)
end
local first = assert(string.find(source, 'modules[objects["Instance11"]] = function()', 1, true))
local last = assert(string.find(source, 'modules[objects["Instance7"]] = function()', first, true))
local remoteSource = string.sub(source, first, last - 1)
remoteSource = replaceOnce(remoteSource, "local cons = shared.Connections", "local bridge = getgenv().__polarisKetamineBridge\n    local cons = shared.Connections")
remoteSource = replaceOnce(remoteSource, "local logSpeed = shared:AddObject({ })", "bridge.Bind(shared, block, ignore, logs)\n    local logSpeed = shared:AddObject({ })")
remoteSource = replaceOnce(remoteSource,
  "local function addLogToStack(event, from, args, caller, got)",
  "local function addLogToStack(event, from, args, caller, got)\n        bridge.Capture(event, from, args, caller, got)")
-- Fix upstream argument/caller ordering and preserve nil arity in forwarding.
remoteSource = remoteSource:gsub("cllr or getcaller%(%)", "cllr or (getcaller and getcaller())")
remoteSource = remoteSource:gsub("addLogToStack%(self, false, cllr or %(getcaller and getcaller%(%)%), args,", "addLogToStack(self, false, args, cllr or (getcaller and getcaller()),")
remoteSource = remoteSource:gsub("shared:AddObject%(%{ %.%.%. %}%)", "shared:AddObject(table.pack(...))")
remoteSource = remoteSource:gsub("{ old%(%.%.%.%) }", "table.pack(old(...))")
remoteSource = remoteSource:gsub("{ old%(self, unpack%(args%)%) }", "table.pack(old(self, unpack(args)))")
remoteSource = remoteSource:gsub("unpack%(args%)", "table.unpack(args, 1, args.n or #args)")
remoteSource = remoteSource:gsub("unpack%(got%[1%]%)", "table.unpack(got[1], 1, got[1].n or #got[1])")
-- MCP capture is independent of the GUI's executor-call filter and UI queue.
local callStart = assert(string.find(remoteSource, "local function callcheck()", 1, true))
local callEnd = assert(string.find(remoteSource, "\n    task.spawn(function()", callStart, true))
remoteSource = string.sub(remoteSource, 1, callStart - 1) .. "local function callcheck() return true end\n" .. string.sub(remoteSource, callEnd)
remoteSource = remoteSource:gsub("if settings.Log_executor_function_calls <= 2 then", "if true then")
remoteSource = replaceOnce(remoteSource, "hooks.HookFunction(value, function(old, ...)",
  "hooks.HookFunction(value, function(old, ...)\n                        if bridge.IncomingBlocked[instance] then\n                            bridge.Capture(instance, true, table.pack(...), nil, nil, true)\n                            return nil\n                        end")
remoteSource = remoteSource:gsub("while task.wait%(5%) do", "while not bridge.Stopped and task.wait(5) do")
remoteSource = replaceOnce(remoteSource, "if not instance or setUp[instance] then return end", "if bridge.Stopped or not instance or setUp[instance] then return end")
remoteSource = replaceOnce(remoteSource, "local fireServer = hooks.HookFunction", "if bridge.Stopped then return end\n            local fireServer = hooks.HookFunction")
remoteSource = replaceOnce(remoteSource, "            end)\n        end)\n    else", "            end)\n            bridge.Ready = true\n        end)\n    else")
source = string.sub(source, 1, first - 1) .. remoteSource .. string.sub(source, last)
-- Only initialize remote spying and its settings/home pages, not HTTP/bindable hooks or scanners.
source = replaceOnce(source, "if page then\n        task.spawn(require(v), shared, page)",
  'if page and (v.Name == "RSpy" or v.Name == "Settings" or v.Name == "Home") then\n        task.spawn(require(v), shared, page)')
source = replaceOnce(source, "local shared = require(script.Shared)", "local shared = require(script.Shared)\nshared.PolarisRoot = script.Parent.Parent")
-- Synchronous reverse-order restoration makes switching independent of event scheduling.
source = replaceOnce(source, "local hooks = shared:AddObject({ })", [[local hooks = shared:AddObject({ })
    shared.PolarisRestoreHooks = function()
        for i = #hooks, 1, -1 do
            local entry = hooks[i]
            if entry[1] == "F" then getfenv().hookfunction(entry[2], entry[3])
            else getfenv().hookmetamethod(game, entry[2], entry[3]) end
            table.remove(hooks, i)
        end
    end]])
local loader, err = loadstring(source, "@polaris/ketamine-${KETAMINE_COMMIT}")
if not loader then error("Ketamine compile failed: " .. tostring(err)) end
setfenv(loader, setmetatable({}, { __index = getfenv() }))
return loader
`;

/** Implements the recorder's backend interface using Ketamine's own hooks. */
export const KETAMINE_BOOTSTRAP = String.raw`
local env = getgenv()
local loader = env.__polarisKetaminePrepared
if type(loader) ~= "function" then error("Ketamine preflight is required before loading") end
local bridge = { IncomingBlocked = {}, Ignored = { Incoming = {}, Outgoing = {} }, Seen = { Incoming = {}, Outgoing = {} }, Stopped = false }
local backend = { Logs = {}, CaptureInterceptors = { All = {} }, IsUsingRakNetHooks = false,
  FunctionForClasses = { Outgoing = { RemoteEvent = "FireServer", UnreliableRemoteEvent = "FireServer", RemoteFunction = "InvokeServer" }, Incoming = { RemoteEvent = "OnClientEvent", UnreliableRemoteEvent = "OnClientEvent", RemoteFunction = "OnClientInvoke" } } }
env.__polarisKetamineBridge = bridge
local shared, outgoingBlocked, guiIgnore, guiLogs
bridge.Bind = function(s, block, ignore, logs)
  shared, outgoingBlocked, guiIgnore, guiLogs = s, block, ignore, logs
end
bridge.Capture = function(instance, incoming, args, caller, got, blocked)
  if bridge.Stopped then return end
  local direction = incoming and "Incoming" or "Outgoing"
  bridge.Seen[direction][instance] = true
  if bridge.Ignored[direction][instance] or (guiIgnore and (guiIgnore[instance] or guiIgnore[instance.Name])) then return end
  local info = { Arguments = args, CreationTime = tick(), Origin = caller,
    Blocked = blocked or (not incoming and outgoingBlocked and (outgoingBlocked[instance] or outgoingBlocked[instance.Name])) or false }
  for _, callback in backend.CaptureInterceptors.All do callback(info, instance, direction) end
end
backend.ControlRemote = function(instance, direction, control, enabled)
  if control == "block" and direction ~= "Outgoing" and instance.ClassName ~= "RemoteFunction" then
    return nil, "Ketamine cannot block incoming RemoteEvent delivery; use direction=Outgoing. Incoming events remain observable."
  end
  local directions = direction == "Both" and { "Incoming", "Outgoing" } or { direction }
  for _, selected in directions do
    if not bridge.Seen[selected][instance] then return nil, "Remote has not been captured in the selected direction yet" end
  end
  if control == "block" and direction ~= "Incoming" and outgoingBlocked[instance.Name] then
    return nil, "A GUI name-based block is active; clear it in Ketamine or restart before instance controls"
  end
  for _, selected in directions do
    if control == "ignore" then bridge.Ignored[selected][instance] = enabled or nil
    elseif selected == "Incoming" then bridge.IncomingBlocked[instance] = enabled or nil
    else
      outgoingBlocked[instance] = enabled or nil
    end
  end
  local result = { engine = "Ketamine", remote = instance:GetFullName(), direction = direction, matched = #directions, enabled = enabled }
  result[control == "block" and "blocked" or "ignored"] = enabled
  return result
end
backend.ClearLogs = function()
  if guiLogs then
    for _, logs in guiLogs do for _, log in logs do log:Destroy() end table.clear(logs) end
  end
end
backend.CodeGen = { BuildCallCode = function(_, info)
  local args = {}
  for i = 1, info.Arguments.n or #info.Arguments do args[i] = shared.ToString.ToString(info.Arguments[i]) end
  local path = shared.ToString.ToString(info.Instance)
  local arguments = table.concat(args, ", ")
  if info.Type == "Outgoing" then
    return path .. (info.Instance.ClassName == "RemoteFunction" and ":InvokeServer(" or ":FireServer(") .. arguments .. ")"
  elseif info.Instance.ClassName == "RemoteFunction" then
    return 'getcallbackvalue(' .. path .. ', "OnClientInvoke")(' .. arguments .. ')'
  end
  return "firesignal(" .. path .. ".OnClientEvent" .. (#args > 0 and ", " .. arguments or "") .. ")"
end }
backend.Unload = function(destroyRoot)
  if backend.Unloaded then return end
  bridge.Stopped = true
  if shared then
    shared.PolarisRestoreHooks()
    for _, connection in shared.Connections do if connection and connection.Connected then connection:Disconnect() end end
    shared.OnCloseEvent:Fire()
    if destroyRoot ~= false and shared.PolarisRoot then shared.PolarisRoot:Destroy() end
    if env.__KetamineShared == shared then env.__KetamineShared = nil end
  end
  backend.Unloaded = true
  env.__polarisKetamineEngine, env.__polarisKetamineBridge, env.__polarisKetamineInitialized = nil, nil, nil
end
local ok, err = pcall(function()
  loader()
  local deadline = os.clock() + 15
  while (not shared or not bridge.Ready) and os.clock() < deadline do task.wait(0.05) end
  if not shared or not bridge.Ready then error("Ketamine remote hooks did not initialize") end
end)
if not ok then
  shared = shared or env.__KetamineShared
  local cleaned, cleanupError = pcall(backend.Unload)
  if not cleaned then env.__polarisKetamineEngine = { shared = backend }; error("Ketamine cleanup failed: " .. tostring(cleanupError)) end
  error(err)
end
env.__polarisKetamineEngine = { shared = backend }
env.__polarisKetamineInitialized = true
table.insert(shared.Connections, shared.OnCloseEvent.Event:Connect(function() backend.Unload(false) end))
`;
