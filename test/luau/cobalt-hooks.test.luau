local raknet
-- WRAPPER_INSERT
for _, style in { "callback", "handle" } do
  local sends, receives, removed = {}, {}, 0
  raknet = {}
  local function register(set, cb)
    local token = style == "handle" and {} or cb
    set[token] = cb
    return style == "handle" and token or nil
  end
  local function remove(set, token) assert(set[token], "cleanup lost registration token"); set[token] = nil; removed += 1 end
  raknet.add_send_hook = function(cb) return register(sends, cb) end
  raknet.add_receive_hook = function(cb) return register(receives, cb) end
  raknet.remove_send_hook = function(token) remove(sends, token) end
  raknet.remove_receive_hook = function(token) remove(receives, token) end
  local w, called = wrapper(), 0
  w.add_send_hook(42, function() called += 1 end)
  w.add_receive_hook({ 42, 43 }, function() called += 1 end)
  for _, cb in sends do cb({ PacketId = 41 }); cb({ PacketId = 42 }) end
  for _, cb in receives do cb({ PacketId = 41 }); cb({ PacketId = 43 }) end
  assert(called == 2)
  w.remove_all_hooks(); assert(removed == 2); assert(next(sends) == nil and next(receives) == nil)
  w.remove_all_hooks(); assert(removed == 2)
end
print("Bundled Cobalt RakNet cleanup passed callback and handle registration APIs.")
