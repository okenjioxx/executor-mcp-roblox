-- Execute the actual adapted upstream serializer, including nested enum values/keys.
local originalTypeof = typeof
local types = {}
function typeof(value) return types[value] or originalTypeof(value) end
local function enumValue(kind, label, fields)
    local value = newproxy(true)
    types[value] = kind
    local mt = getmetatable(value)
    mt.__tostring = function() return label end
    mt.__index = function(_, key)
        if fields[key] ~= nil then return fields[key] end
        error(tostring(key) .. " is not a valid member of \"Enum.HumanoidStateType\"")
    end
    return value
end
local items = {}
local stateType = enumValue("Enum", "HumanoidStateType", items)
items.Running = enumValue("EnumItem", "Enum.HumanoidStateType.Running", { Name = "Running", EnumType = stateType })
items.Jumping = enumValue("EnumItem", "Enum.HumanoidStateType.Jumping", { Name = "Jumping", EnumType = stateType })
Enum = { HumanoidStateType = stateType }
game = { GetService = function() return { JSONDecode = function() error("not JSON") end } end }
local objects = { Instance6 = {} }
-- SERIALIZER_INSERT
local serializer = serializerModule()
local count = 0
local function eq(actual, expected)
    count += 1
    assert(actual == expected, tostring(actual) .. " ~= " .. tostring(expected))
end
eq(pcall(function() return stateType.Name end), false)
eq(serializer.ToString(items.Running), "Enum.HumanoidStateType.Running")
eq(serializer.ToString(items.Jumping), "Enum.HumanoidStateType.Jumping")
eq(serializer.ToString(stateType), "Enum.HumanoidStateType")
local function evaluate(source)
    local fn = assert(loadstring("return " .. source))
    setfenv(fn, getfenv())
    return fn()
end
local nested = evaluate(serializer.ToString({ items.Running, { items.Jumping, stateType } }))
eq(nested[1], items.Running); eq(nested[2][1], items.Jumping); eq(nested[2][2], stateType)
local keyed = evaluate(serializer.ToString({ [items.Running] = items.Jumping }))
eq(keyed[items.Running], items.Jumping)
local arguments = serializer.CreateArguments({ items.Running, items.Jumping })
eq(arguments, "(Enum.HumanoidStateType.Running, Enum.HumanoidStateType.Jumping)")
eq(serializer.ToString(false), "false"); eq(serializer.ToString(nil), "nil")
eq(serializer.ToString("state"), '"state"')
print("Actual Ketamine enum serializer passed " .. count .. " assertions.")
