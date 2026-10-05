import { describe, expect, it } from "vitest";
import { buildRemoteSpySource } from "../../src/application/services/remote-spy-source.js";
import remoteSpy from "../../src/tools/remote-spy/remote-spy.js";
import getLogs from "../../src/tools/remote-spy/get-remote-spy-logs.js";
import blockRemote from "../../src/tools/remote-spy/block-remote.js";
import configureSpy from "../../src/tools/remote-spy/configure-remote-spy.js";
import type { ToolContext } from "../../src/application/tool/tool.js";

describe("selectable remote-spy engines", () => {
  it("exposes configuration patches without defaults overwriting omitted settings", async () => {
    const sources: string[] = [];
    const ctx = {
      runLuau: async (source: string) => {
        sources.push(source);
        return { capture: { enabled: false } };
      },
    } as unknown as ToolContext;
    const input = configureSpy.input.parse({
      engine: "ketamine",
      capture: { enabled: false },
      guiVisible: false,
    });
    expect(input.capture).toEqual({ enabled: false });
    await configureSpy.execute(input, ctx);
    expect(sources[0]).toBe(
      buildRemoteSpySource("ketamine", "configure", {
        capture: { enabled: false },
        guiVisible: false,
      }),
    );
    expect(sources[0]).not.toContain("raw.githubusercontent.com");
    expect(() => configureSpy.input.parse({ max: 5001 })).toThrow();
    expect(() => configureSpy.input.parse({ capture: { direction: "invalid" } })).toThrow();
    expect(() => configureSpy.input.parse({ capture: { unknownFilter: true } })).toThrow();
  });

  it("routes unified spy controls and read filters without loading either engine", async () => {
    const sources: string[] = [];
    const ctx = {
      runLuau: async (source: string) => {
        sources.push(source);
        return {};
      },
    } as unknown as ToolContext;
    for (const operation of [
      "configure",
      "pause",
      "resume",
      "controls",
      "reset-controls",
    ] as const) {
      await remoteSpy.execute(remoteSpy.input.parse({ engine: "ketamine", operation }), ctx);
      expect(sources.at(-1)).toContain(`local __operation = "${operation}"`);
      expect(sources.at(-1)).not.toContain("raw.githubusercontent.com");
    }
    const input = getLogs.input.parse({
      engine: "ketamine",
      direction: "Incoming",
      classFilter: "RemoteFunction",
      blockedOnly: true,
    });
    await getLogs.execute(input, ctx);
    expect(sources.at(-1)).toContain('["blockedOnly"] = true');
    expect(sources.at(-1)).toContain('["classFilter"] = "RemoteFunction"');
  });

  it("defaults existing calls to Cobalt and accepts an explicit Ketamine engine", () => {
    expect(remoteSpy.input.parse({ operation: "status" }).engine).toBe("cobalt");
    expect(getLogs.input.parse({ engine: "ketamine" }).engine).toBe("ketamine");
    expect(blockRemote.input.parse({ engine: "ketamine", remoteId: "x" }).engine).toBe("ketamine");
    expect(() => remoteSpy.input.parse({ operation: "start", engine: "unknown" })).toThrow();
  });

  it("routes Ketamine reads without including loaders or downloads", async () => {
    const sources: string[] = [];
    const ctx = {
      runLuau: async (source: string) => {
        sources.push(source);
        return { logs: [] };
      },
    } as unknown as ToolContext;
    await getLogs.execute(getLogs.input.parse({ engine: "ketamine", direction: "Incoming" }), ctx);
    expect(sources[0]).toContain('local __engineName = "Ketamine"');
    expect(sources[0]).not.toContain("raw.githubusercontent.com");
    expect(sources[0]).not.toContain("GENERATED WITH InfernoHub");
    expect(sources[0]).toContain("__polaris_ketamine");
  });

  it("includes preflight and exclusive switching only for lifecycle starts", () => {
    const source = buildRemoteSpySource("ketamine", "start", {});
    expect(source).toContain("478b27da78869316443389012eb4ef34f8037323");
    expect(source).toContain("31fb2c6bef8f3f740a8fc08cfc856f1ec00ba8d2ac59a5815f2cf38902daad77");
    expect(source).toContain("__polarisRemoteSpySwitching");
    expect(source).toContain("__polarisKetaminePrepared");
    expect(buildRemoteSpySource("ketamine", "status", {})).not.toContain(
      "__polarisRemoteSpySwitching",
    );
  });
});
