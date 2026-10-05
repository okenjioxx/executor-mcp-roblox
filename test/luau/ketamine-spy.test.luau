-- Runs the production bridge and patched upstream remote/hook modules in official Luau.
local env, slots, meta, originals = {}, {}, {}, {}
local originalTypeof, originalLoadstring = typeof, loadstring
function typeof(value) return type(value) == "table" and value.__instance and "Instance" or originalTypeof(value) end
function getgenv() return env end
function tick() return 1700000000 end
function checkcaller() return false end
function getcallingscript() return nil end
function hookfunction(target, replacement)
    local previous = slots[target] or originals[target] or target
    slots[target] = replacement
    return previous
end
function hookmetamethod(_, name, replacement)
    local previous = meta[name] or function() end
    meta[name] = replacement
    return previous
end
function getnamecallmethod() return "FireServer" end
function clonefunction(fn) return fn end
local function event()
    local listeners = {}
    return { Connect = function(_, fn)
        local connection = { Connected = true }
        connection.Disconnect = function(self) self.Connected = false end
        listeners[#listeners + 1] = { fn, connection }
        return connection
    end, Fire = function(_, ...)
        for _, entry in listeners do if entry[2].Connected then entry[1](...) end end
    end }
end
local function ui()
    return setmetatable({}, { __index = function(self, key)
        if key == "Clone" then return function() return ui() end end
        if key == "Destroy" then return function() end end
        if key == "Connect" then return function() return { Connected = true, Disconnect = function(c) c.Connected = false end } end end
        local child = ui(); rawset(self, key, child); return child
    end })
end
local function hookable(implementation)
    local target
    target = function(...) return (slots[target] or implementation)(...) end
    originals[target] = implementation
    return target
end
local sent, received, forwarded = 0, 0, nil
local fire = hookable(function(_, ...) sent += 1; forwarded = table.pack(...) end)
local invoke = hookable(function(_, ...) sent += 1; forwarded = table.pack(...); return nil, false, nil end)
local incoming = hookable(function(...) received += 1; forwarded = table.pack(...); return nil, false, nil end)
local function remote(name, class)
    return { __instance = true, Name = name, ClassName = class, OnClientEvent = event(), OnClientInvoke = incoming,
        FireServer = fire, InvokeServer = invoke,
        GetFullName = function() return "game." .. name end,
        IsA = function(self, queried) return self.ClassName == queried end }
end
local a, b, c, duplicate = remote("Remote", "RemoteEvent"), remote("Function", "RemoteFunction"), remote("Unreliable", "UnreliableRemoteEvent"), remote("Remote", "RemoteEvent")
Instance = { new = function(class) return remote("Prototype", class) end }
game = { Remote = a, Function = b, Unreliable = c, DescendantAdded = event(),
    GetDescendants = function() return { a, b, c, duplicate } end,
    GetService = function() return { RenderStepped = event() } end }
function getcallbackvalue(instance) return instance.OnClientInvoke end
task = { spawn = function(fn, ...) return fn(...) end, wait = function() return nil end }
local objects = { Instance11 = ui(), Instance7 = ui() }
-- UPSTREAM_INSERT
game.HttpGet = function() return upstreamSource end
crypt = { hash = function() return "31fb2c6bef8f3f740a8fc08cfc856f1ec00ba8d2ac59a5815f2cf38902daad77" end }
-- RSPY_INSERT
-- HOOKS_INSERT
local currentShared
local function loadUpstream()
    local shared = { Connections = {}, Settings = { Log_executor_function_calls = 2, Ignore_spammy_logs = false, Maximum_log_amount = 10 },
        ToString = { ToString = function(value)
            if typeof(value) == "Instance" then return value:GetFullName() end
            if type(value) == "string" then return string.format("%q", value) end
            return tostring(value)
        end, CreateArguments = function() return "()" end, EscapePattern = function(s) return s:gsub("([^%w])", "%%%1") end },
        AddObject = function(_, value) return value end, AddButton = function(_, button) return button end,
        CodeBox = function() return ui() end, OnCloseEvent = event(), PolarisRoot = ui(), Clipboard = function() end }
    shared.OnCloseEvent.Event = event()
    shared.HookFunction = hookModule()(shared)
    env.__KetamineShared, currentShared = shared, shared
    remoteModule()(shared, ui())
end
function loadstring(source, chunk)
    if chunk and string.find(chunk, "@polaris/ketamine-", 1, true) and string.find(source, "GENERATED WITH InfernoHub", 1, true) then return loadUpstream end
    if chunk == "@polaris/cobalt-2.2.5.15" then return function()
        env.Cobalt = { shared = { Logs = {}, IsUsingRakNetHooks = true, CobaltPluginManager = { Registry = { Interceptors = { Global = {} } } },
            Unload = function() env.Cobalt = nil end } }
    end end
    local fn, err = originalLoadstring(source, chunk)
    if fn then setfenv(fn, getfenv()) end
    return fn, err
end
-- BOOT_INSERT
-- ADAPTER_INSERT
-- SWITCH_INSERT
local count = 0
local function eq(actual, expected) count += 1; assert(actual == expected, tostring(actual) .. " ~= " .. tostring(expected)) end
local function call(target, ...) return (slots[target] or target)(...) end
eq(run("status", {}).loaded, false)
env.__polarisKetaminePrepared = loadUpstream
boot()
eq(run("start", { max = 10 }).engine, "Ketamine")
call(fire, a, 1, nil, false, nil)
local logs = run("logs", {}).logs
eq(logs[1].argCount, 4); eq(logs[1].args[2].__type, "nil"); eq(logs[1].args[3], false); eq(logs[1].args[4].__type, "nil")
eq(forwarded.n, 4)
local id = logs[1].remoteId
eq(run("control", { remoteId = id, direction = "Outgoing", control = "block", enabled = true }).blocked, true)
local before = sent; call(fire, a, "blocked"); eq(sent, before); eq(run("logs", {}).logs[1].blocked, true)
eq(run("control", { remoteId = id, direction = "Outgoing", control = "block", enabled = false }).blocked, false)
call(fire, a, "again"); eq(sent, before + 1)
meta.__namecall(a, "namecall", nil); eq(run("logs", {}).logs[1].argCount, 2); eq(sent, before + 2)
a.OnClientEvent:Fire("incoming", nil)
eq(run("logs", { direction = "Incoming" }).logs[1].argCount, 2)
eq(type(run("control", { remoteId = id, direction = "Both", control = "block", enabled = true }).error), "string")
call(fire, a, "still passes"); eq(sent, before + 3)
call(fire, duplicate, "other"); local duplicateId = run("logs", {}).logs[1].remoteId; assert(id ~= duplicateId)
eq(type(run("control", { remoteId = duplicateId, remotePath = "game.Remote", direction = "Outgoing", control = "block", enabled = true }).error), "string")
local returned = table.pack(call(invoke, b, "function", nil)); eq(returned.n, 3); eq(returned[2], false); eq(forwarded.n, 2)
call(fire, c, "unreliable", nil); eq(run("logs", {}).logs[1].argCount, 2); eq(run("logs", {}).logs[1].args[1], "unreliable")
returned = table.pack(call(b.OnClientInvoke, "callback", nil)); eq(returned.n, 3); eq(returned[2], false)
local incomingId = run("logs", { direction = "Incoming" }).logs[1].remoteId
eq(run("control", { remoteId = incomingId, direction = "Incoming", control = "block", enabled = true }).blocked, true)
before = received; call(b.OnClientInvoke, "blocked callback"); eq(received, before); eq(run("logs", { direction = "Incoming" }).logs[1].blocked, true)
run("control", { remoteId = incomingId, direction = "Incoming", control = "block", enabled = false }); call(b.OnClientInvoke, "resumed"); eq(received, before + 1)
-- Shared callbacks must retain per-instance capture and blocking.
local b2 = remote("OtherFunction", "RemoteFunction")
game.DescendantAdded:Fire(b2)
run("control", { remoteId = incomingId, direction = "Incoming", control = "block", enabled = true })
before = received
local callbackCursor = run("status", {}).latestId
call(b2.OnClientInvoke, "other callback")
eq(received, before + 1)
eq(run("status", {}).latestId, callbackCursor + 1)
eq(run("logs", { direction = "Incoming" }).logs[1].remote, "game.OtherFunction")
run("control", { remoteId = incomingId, direction = "Incoming", control = "block", enabled = false })
run("control", { remoteId = id, direction = "Outgoing", control = "ignore", enabled = true }); local cursor = run("status", {}).latestId
call(fire, a, "ignored"); eq(run("status", {}).latestId, cursor)
run("control", { remoteId = id, direction = "Outgoing", control = "ignore", enabled = false })
run("clear", {})
for i = 1, 15 do call(fire, a, i) end
logs = run("logs", { afterId = 1, limit = 20 }); eq(logs.count, 10); eq(logs.gap, true); eq(logs.logs[1].args[1], 15)
eq(run("code", { callId = logs.logs[1].id }).code, "game.Remote:FireServer(15)")
eq(run("logs", { afterId = logs.latestId }).returned, 0)
eq(run("logs", { raknetOnly = true }).returned, 0)
eq(run("list", { limit = 1 }).remotes[1].totalCalls, 10)
run("view-start", { view = "incoming", direction = "Incoming" }); a.OnClientEvent:Fire("new")
eq(#run("view-fetch", { view = "incoming" }).logs, 1)
run("view-stop", { view = "incoming" }); eq(run("status", {}).active, true)
local replacementCallback = function() return "game replaced callback" end
b2.OnClientInvoke = replacementCallback
eq(run("stop", {}).stopped, true); eq(env.__KetamineShared, nil)
eq(b.OnClientInvoke, incoming); eq(b2.OnClientInvoke, replacementCallback)
local oldCount = run("status", {}).latestId; a.OnClientEvent:Fire("after stop"); eq(run("status", {}).latestId, oldCount)
before = sent; call(fire, a, "restored"); eq(sent, before + 1)
-- Production preflight and switch preserve the previous engine on download/cleanup failure.
local unloads = 0
env.Cobalt = { shared = { Logs = {}, Unload = function() unloads += 1; env.Cobalt = nil end } }
local originalHash = crypt.hash; crypt.hash = function() return "bad hash" end
eq(type(switchKetamine().error), "string"); eq(unloads, 0); assert(env.Cobalt)
crypt.hash = originalHash
local originalHttpGet = game.HttpGet
game.HttpGet = function() env.__KetamineShared = {}; return upstreamSource end
eq(type(switchKetamine().error), "string"); eq(unloads, 0); assert(env.Cobalt)
env.__KetamineShared = nil; game.HttpGet = originalHttpGet
env.Cobalt.shared.Unload = function() error("failed unload") end
eq(type(switchKetamine().error), "string"); eq(env.__polarisKetamineEngine, nil); assert(env.Cobalt)
env.Cobalt.shared.Unload = function() unloads += 1; env.Cobalt = nil end
eq(switchKetamine().engine, "Ketamine"); eq(unloads, 1)
eq(type(switchCobalt().error), "string"); eq(run("status", {}).active, true)
raknet = { add_send_hook = function() end, add_receive_hook = function() end, remove_send_hook = function() end, remove_receive_hook = function() end, is_enabled = function() return true end }
eq(switchCobalt().engine, "Cobalt"); eq(env.__polarisKetamineEngine, nil)
eq(switchKetamine().engine, "Ketamine"); eq(env.Cobalt, nil)
eq(type(run("control", { remoteId = id, direction = "Outgoing", control = "block", enabled = true }).error), "string")
env.__polarisRemoteSpySwitching = true; eq(type(switchKetamine().error), "string"); env.__polarisRemoteSpySwitching = nil
local originalRestoreHooks = currentShared.PolarisRestoreHooks
currentShared.PolarisRestoreHooks = function() error("hook restoration failed") end
eq(type(run("stop", {}).error), "string")
eq(type(switchKetamine().error), "string"); eq(run("status", {}).active, false)
eq(run("status", {}).cleanupRequired, true)
eq(type(switchCobalt().error), "string"); eq(env.Cobalt, nil)
currentShared.PolarisRestoreHooks = originalRestoreHooks
eq(run("stop", {}).stopped, true); eq(env.__polarisKetamineEngine, nil)
eq(switchKetamine().active, true)
currentShared.OnCloseEvent.Event:Fire(); eq(env.__polarisKetamineEngine, nil); eq(run("status", {}).loaded, false)
env.__KetamineShared = {}; eq(type(switchKetamine().error), "string"); env.__KetamineShared = nil
print("Ketamine upstream capture, controls, cleanup, and switching passed " .. count .. " assertions.")
