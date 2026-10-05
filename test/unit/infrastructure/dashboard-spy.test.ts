import { describe, expect, it } from "vitest";
import { buildRemoteSpySource } from "../../../src/application/services/remote-spy-source.js";
import type { ExecutionGateway } from "../../../src/application/ports/execution-gateway.js";
import { ClientNotFoundError } from "../../../src/domain/errors/errors.js";
import { ClientId } from "../../../src/domain/shared/ids.js";
import { SpyService } from "../../../src/infrastructure/dashboard/dashboard-spy.js";
import { InMemoryClientDirectory, makeClient } from "../../helpers/fakes.js";

function setup() {
  const calls: { id: string; source: string; timeoutMs: number }[] = [];
  const gateway = {
    async eval(id: string, request: { source: string; timeoutMs: number }) {
      calls.push({ id, ...request });
      return { engine: "Cobalt" };
    },
  } as unknown as ExecutionGateway;
  const client = makeClient({ id: ClientId("cobalt-dashboard") });
  const clients = new InMemoryClientDirectory([client]);
  return { service: new SpyService(gateway, clients), calls, client };
}

describe("Cobalt dashboard service", () => {
  it("uses the same capture source as MCP without auto-loading", async () => {
    const { service, calls, client } = setup();
    await service.logs(client.id, 300);
    expect(calls[0]?.source).toBe(buildRemoteSpySource("cobalt", "logs", { limit: 300 }));
    expect(calls[0]?.id).toBe(client.id);
    expect(calls[0]?.source).toContain("local __bundle = nil");
    expect(calls[0]?.source.length).toBeLessThan(30000);
  });
  it("starts the pinned bundle with requested mode and clears the shared history", async () => {
    const { service, calls, client } = setup();
    await service.start(client.id, "raknet");
    expect(calls[0]?.source).toBe(buildRemoteSpySource("cobalt", "start", { mode: "raknet" }));
    expect(calls[0]?.timeoutMs).toBe(60000);
    await service.clear(client.id);
    expect(calls[1]?.source).toBe(buildRemoteSpySource("cobalt", "clear"));
  });
  it("refuses unknown clients without executing source", async () => {
    const { service, calls } = setup();
    await expect(service.start("missing", "auto")).rejects.toBeInstanceOf(ClientNotFoundError);
    expect(calls).toHaveLength(0);
  });
  it("routes dashboard start, logs, and clear to the selected Ketamine engine", async () => {
    const { service, calls, client } = setup();
    await service.start(client.id, "luau", "ketamine");
    await service.logs(client.id, 25, "ketamine");
    await service.clear(client.id, "ketamine");
    expect(calls[0]?.source).toBe(buildRemoteSpySource("ketamine", "start", { mode: "luau" }));
    expect(calls[1]?.source).toBe(buildRemoteSpySource("ketamine", "logs", { limit: 25 }));
    expect(calls[2]?.source).toBe(buildRemoteSpySource("ketamine", "clear"));
  });
});
