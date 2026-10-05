# AI remote-spy controls

The user authorized configurable AI control of Ketamine and useful improvements to Cobalt.

Assumptions: extend the existing MCP tools and backend; one spy per client remains the rule. Pausing/filtering capture changes retained MCP history, not network delivery. Ketamine incoming events remain observable but cannot be blocked. No live Roblox session is changed during implementation.

1. Add persistent capture configuration (enabled, direction, name, method, class, blocked-only), pause/resume, and bounded buffer resizing without restarting. Verify forwarding and blocking are unchanged while capture is paused or filtered, and history/cursors survive resizing.
2. Expose active controls and reset block/ignore state with engine/direction targeting. Add Ketamine GUI visibility and logging switches. Verify explicit false values, rule identity, name rules, and cleanup.
3. Expose a focused configure-remote-spy tool and matching remote-spy operations, improve query filters, and document examples/capabilities. Verify schemas, no-loader reads/configuration, TypeScript tests, build, and production Luau fixtures for both engines.
4. Review the diff, update validation evidence, build in the original checkout, and publish commits to the existing public GitHub repository.

Configuration patches preserve omitted values; resetFilters clears only capture filters. Restart resets configuration. Controls list is paginated; reset-controls reports changed rules and never changes capture configuration or history.

Implementation and verification completed: 461 TypeScript tests, 131 Ketamine assertions, 132 Cobalt assertions, compilation, and compiled-server schema/type/dashboard smoke checks passed. Regressions were run failing before implementation; upgrade handling and GUI name-rule behavior were included during diff review. Live executor validation remains outstanding.
