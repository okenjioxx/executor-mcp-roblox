import { ClientNotFoundError } from "../../domain/errors/errors.js";
import { ClientId } from "../../domain/shared/ids.js";
import type { ClientDirectory } from "../../application/ports/client-directory.js";
import type { ExecutionGateway } from "../../application/ports/execution-gateway.js";
import {
  buildCobaltSpySource,
  type CobaltOperation,
  type CobaltSpyOptions,
} from "../../application/services/cobalt-spy-source.js";

/** Dashboard and MCP read/control the same Cobalt adapter. */
export class SpyService {
  constructor(
    private readonly gateway: ExecutionGateway,
    private readonly clients: ClientDirectory,
  ) {}
  private run(
    clientId: string,
    operation: CobaltOperation,
    options: CobaltSpyOptions = {},
  ): Promise<unknown> {
    const id = ClientId(clientId);
    if (!this.clients.get(id))
      return Promise.reject(new ClientNotFoundError(`Client "${clientId}" is not connected.`));
    return this.gateway.eval(id, {
      source: buildCobaltSpySource(operation, options),
      threadContext: 8,
      timeoutMs: operation === "start" ? 60000 : 15000,
    });
  }
  logs(clientId: string, limit: number): Promise<unknown> {
    return this.run(clientId, "logs", { limit });
  }
  clear(clientId: string): Promise<unknown> {
    return this.run(clientId, "clear");
  }
  start(clientId: string, mode: "auto" | "luau" | "raknet"): Promise<unknown> {
    return this.run(clientId, "start", { mode });
  }
}
