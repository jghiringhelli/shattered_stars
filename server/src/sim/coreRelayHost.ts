/**
 * Plugs the real RelayCore into the latency simulator: each simulated socket
 * gets a Connection whose hello goes through the same handshake as the
 * WebSocket layer, and whose close triggers the reconnection window.
 */

import type { ClientMessage, ServerMessage } from "../../../src/net/protocol";
import type { RelayEndpoint, RelayHost } from "../../../src/net/sim/RelayHost";
import type { RelayCore } from "../RelayCore";
import type { Connection, Session } from "../types";

/**
 * @param core - The relay logic.
 * @returns A host the simulator can open sockets on.
 */
export function createCoreRelayHost(core: RelayCore): RelayHost {
  return {
    open(toClient: (message: ServerMessage) => void): RelayEndpoint {
      let session: Session | null = null;
      let open = true;
      const connection: Connection = {
        send: (message) => {
          if (open) toClient(message);
        },
        close: () => {
          open = false;
        },
      };
      return {
        receive(message: ClientMessage): void {
          if (!open) return;
          if (!session) {
            if (message.t === "hello")
              session = core.hello(connection, message);
            return;
          }
          core.handle(session, message);
        },
        close(): void {
          open = false;
          if (session) core.disconnected(session, connection);
        },
      };
    },
  };
}
