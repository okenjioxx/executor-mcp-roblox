import { describe, expect, it } from "vitest";
import type { LuauOptions, ToolContext } from "../../../src/application/tool/tool.js";
import { buildRemoteSpySource } from "../../../src/application/services/remote-spy-source.js";
import ensureRemoteSpy from "../../../src/tools/remote-spy/ensure-remote-spy.js";
import getLogs from "../../../src/tools/remote-spy/get-remote-spy-logs.js";
import monitorRemote from "../../../src/tools/remote-spy/monitor-remote.js";
import traceRemote from "../../../src/tools/remote-spy/trace-remote-traffic.js";
import blockRemote from "../../../src/tools/remote-spy/block-remote.js";
import ignoreRemote from "../../../src/tools/remote-spy/ignore-remote.js";
import remoteSpy from "../../../src/tools/remote-spy/remote-spy.js";
import { remoteSpyTools } from "../../../src/tools/remote-spy/index.js";

function stubContext(canned: unknown) {
  const calls: { source: string; options?: LuauOptions }[] = [];
  const ctx = {
    async runLuau(source: string, options?: LuauOptions) {
      calls.push({ source, options });
      return canned;
    },
  } as unknown as ToolContext;
  return { ctx, calls };
}

describe("Cobalt remote-spy tools", () => {
  it("registers twelve unique tools and labels live-state changes", () => {
    expect(remoteSpyTools).toHaveLength(12);
    expect(new Set(remoteSpyTools.map((t) => t.name)).size).toBe(12);
    const readers = [
      "list-remotes",
      "get-remote-signature",
      "inspect-callbacks",
      "get-remote-spy-logs",
    ];
    for (const tool of remoteSpyTools) {
      expect(tool.category).toBe("Remote Spy");
      expect(tool.mutatesState === true).toBe(!readers.includes(tool.name));
      if (tool.mutatesState) expect(tool.description).toContain("WRITES LIVE GAME STATE");
    }
  });
  it("starts with requested mode/capacity and a cold-load timeout", async () => {
    const { ctx, calls } = stubContext({ active: true });
    await ensureRemoteSpy.execute(
      ensureRemoteSpy.input.parse({ mode: "raknet", max: 1000, threadContext: 7 }),
      ctx,
    );
    expect(calls[0]?.source).toBe(
      buildRemoteSpySource("cobalt", "start", { mode: "raknet", max: 1000 }),
    );
    expect(calls[0]?.options).toEqual({ threadContext: 7, timeoutMs: 60000 });
    expect(ensureRemoteSpy.input.parse({}).max).toBeUndefined();
  });
  it("passes capture filters through the shared adapter without bundling Cobalt on reads", async () => {
    const { ctx, calls } = stubContext({ logs: [] });
    const input = getLogs.input.parse({
      direction: "Incoming",
      remoteId: "remote-2",
      afterId: 42,
      raknetOnly: true,
    });
    await getLogs.execute(input, ctx);
    const { threadContext, engine, ...options } = input;
    expect(calls[0]?.source).toBe(buildRemoteSpySource(engine, "logs", options));
    expect(calls[0]?.source).toContain("local __bundle = nil");
    expect(calls[0]?.source.length).toBeLessThan(30000);
    expect(calls[0]?.options).toEqual({ threadContext: threadContext ?? 8, timeoutMs: 15000 });
  });
  it("flags Cobalt failures as tool errors", async () => {
    const data = { error: "RakNet disabled" };
    const { ctx } = stubContext(data);
    expect(await ensureRemoteSpy.execute(ensureRemoteSpy.input.parse({}), ctx)).toEqual({
      data,
      isError: true,
    });
  });
  it("does not start a monitoring view after a failed load", async () => {
    const { ctx, calls } = stubContext({ error: "load failed" });
    const result = await monitorRemote.execute(
      monitorRemote.input.parse({ action: "start", remotePath: "game.Remote" }),
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(1);
  });
  it("opens a Cobalt view and fetches/stops without reloading or resolving its old path", async () => {
    const { ctx, calls } = stubContext({ started: true });
    await monitorRemote.execute(
      monitorRemote.input.parse({
        action: "start",
        remotePath: "game.Remote",
        direction: "Incoming",
      }),
      ctx,
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.source).toBe(
      buildRemoteSpySource("cobalt", "view-start", {
        view: "monitor:game.Remote",
        remotePath: "game.Remote",
        direction: "Incoming",
        limit: 100,
      }),
    );
    calls.length = 0;
    await monitorRemote.execute(
      monitorRemote.input.parse({ action: "fetch", remotePath: "game.Remote" }),
      ctx,
    );
    expect(calls[0]?.source).toBe(
      buildRemoteSpySource("cobalt", "view-fetch", { view: "monitor:game.Remote", limit: 100 }),
    );
    await traceRemote.execute(traceRemote.input.parse({ action: "stop" }), ctx);
    expect(calls[1]?.source).toBe(
      buildRemoteSpySource("cobalt", "view-stop", { view: "trace", limit: 100 }),
    );
  });
  it("validates missing selectors before evaluating code", async () => {
    const { ctx, calls } = stubContext({});
    expect((await blockRemote.execute(blockRemote.input.parse({}), ctx)).isError).toBe(true);
    expect((await ignoreRemote.execute(ignoreRemote.input.parse({}), ctx)).isError).toBe(true);
    expect(
      (await remoteSpy.execute(remoteSpy.input.parse({ operation: "code" }), ctx)).isError,
    ).toBe(true);
    expect(
      (await monitorRemote.execute(monitorRemote.input.parse({ action: "start" }), ctx)).isError,
    ).toBe(true);
    expect(calls).toHaveLength(0);
  });
  it("undoes blocking and ignoring using explicit false flags", async () => {
    const { ctx, calls } = stubContext({});
    await blockRemote.execute(
      blockRemote.input.parse({ remoteId: "remote-2", blocked: false }),
      ctx,
    );
    expect(calls[0]?.source).toBe(
      buildRemoteSpySource("cobalt", "control", {
        remotePath: undefined,
        remoteId: "remote-2",
        direction: "Outgoing",
        control: "block",
        enabled: false,
      }),
    );
    await ignoreRemote.execute(
      ignoreRemote.input.parse({
        remotePath: "game.Remote",
        ignored: false,
        direction: "Incoming",
      }),
      ctx,
    );
    expect(calls[1]?.source).toContain('["enabled"] = false');
  });
});
