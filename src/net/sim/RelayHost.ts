/**
 * Seams between the latency simulator and a relay implementation, so the
 * simulator (src/net) never imports the server: tests and scripts plug the
 * real RelayCore in (server/src/sim/coreRelayHost.ts).
 */

import type { ClientMessage, ServerMessage } from "../protocol";

/** The relay side of one simulated socket. */
export interface RelayEndpoint {
  /** A client message arrived at the relay. */
  receive(message: ClientMessage): void;
  /** The socket dropped. */
  close(): void;
}

/** Something that accepts simulated sockets. */
export interface RelayHost {
  /** @param toClient - Delivers relay messages towards the client. @returns The relay endpoint. */
  open(toClient: (message: ServerMessage) => void): RelayEndpoint;
}
