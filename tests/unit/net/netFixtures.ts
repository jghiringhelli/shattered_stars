/**
 * Test fixtures for NetClient: an in-memory transport into a RelayCore on a
 * virtual clock, with switches to cut the network or silence the server.
 */

import { decodeClientMessage, encodeMessage } from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import type {
  Transport,
  TransportFactory,
} from "../../../src/net/transport/Transport";
import { DEFAULT_CONFIG, type ServerConfig } from "../../../server/src/config";
import { createSilentLogger } from "../../../server/src/logger";
import { RelayCore } from "../../../server/src/RelayCore";
import type { Connection, Session } from "../../../server/src/types";
import { seededRandom } from "../server/relayFixtures";

/** One-way latency of the in-memory link (ms). */
export const LINK_MS = 10;

/** A relay reachable through in-memory sockets. */
export interface RelayLink {
  readonly clock: VirtualScheduler;
  readonly core: RelayCore;
  readonly factory: TransportFactory;
  /** Sockets opened so far. */
  opened: number;
  /** While true, new sockets fail to open and open ones drop. */
  down: boolean;
  /** While true, the server stops answering (a half-dead link). */
  silent: boolean;
  /** Drop every open socket abruptly (code 1006). */
  cutAll(): void;
}

/** @param overrides - Relay config overrides. @returns A relay link. */
export function createRelayLink(
  overrides: Partial<ServerConfig> = {},
): RelayLink {
  const clock = new VirtualScheduler(5_000_000);
  const core = new RelayCore({
    scheduler: clock,
    logger: createSilentLogger(),
    random: seededRandom(3),
    config: { ...DEFAULT_CONFIG, startCountdownMs: 100, ...overrides },
  });
  const cutters = new Set<() => void>();
  const link: RelayLink = {
    clock,
    core,
    opened: 0,
    down: false,
    silent: false,
    cutAll: () => [...cutters].forEach((cut) => cut()),
    factory: (_url, handlers): Transport => {
      link.opened++;
      let open = true;
      let session: Session | null = null;
      const later = (fn: () => void): void => {
        clock.setTimeout(fn, LINK_MS);
      };
      const shut = (code: number): void => {
        if (!open) return;
        open = false;
        cutters.delete(cut);
        if (session) core.disconnected(session, connection);
        later(() => handlers.onClose(code, ""));
      };
      const cut = (): void => shut(1006);
      const connection: Connection = {
        send: (m) =>
          later(() => {
            if (open && !link.silent) handlers.onMessage(encodeMessage(m));
          }),
        close: (code) => shut(code),
      };
      if (link.down) {
        later(() => handlers.onClose(1006, ""));
        return { send: () => undefined, close: () => undefined };
      }
      cutters.add(cut);
      later(() => {
        if (open) handlers.onOpen();
      });
      return {
        send: (text) =>
          later(() => {
            const decoded = decodeClientMessage(text);
            if (!open || link.silent || !decoded.ok) return;
            if (!session) {
              if (decoded.value.t === "hello")
                session = core.hello(connection, decoded.value);
              return;
            }
            core.handle(session, decoded.value);
          }),
        close: (code = 1000) => shut(code),
      };
    },
  };
  return link;
}

/** A token store in memory (sessionStorage stand-in). */
export function memoryTokenStore(): {
  load(): string | null;
  save(token: string | null): void;
  value: string | null;
} {
  const store = {
    value: null as string | null,
    load: () => store.value,
    save: (token: string | null) => {
      store.value = token;
    },
  };
  return store;
}
