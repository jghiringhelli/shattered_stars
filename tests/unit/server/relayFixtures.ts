/**
 * Test fixtures for the relay: a recording connection, seeded randomness,
 * and a RelayCore on a virtual clock.
 */

import type {
  ClientMessage,
  ServerMessage,
  ServerMessageType,
} from "../../../src/net/protocol";
import { PROTOCOL_VERSION } from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import { DEFAULT_CONFIG, type ServerConfig } from "../../../server/src/config";
import { createSilentLogger } from "../../../server/src/logger";
import { RelayCore } from "../../../server/src/RelayCore";
import type {
  Connection,
  RelayRandom,
  Session,
} from "../../../server/src/types";

/** A connection that records what the relay sent. */
export class RecordingConnection implements Connection {
  readonly sent: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;

  send(message: ServerMessage): void {
    this.sent.push(message);
  }

  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }

  /** @returns Every recorded message of a type. */
  all<T extends ServerMessageType>(
    type: T,
  ): Extract<ServerMessage, { t: T }>[] {
    return this.sent.filter(
      (m): m is Extract<ServerMessage, { t: T }> => m.t === type,
    );
  }

  /** @returns The newest recorded message of a type. */
  last<T extends ServerMessageType>(
    type: T,
  ): Extract<ServerMessage, { t: T }> | undefined {
    return this.all(type).at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** @returns Deterministic randomness (counter-based tokens, LCG ints). */
export function seededRandom(seed = 1): RelayRandom {
  let state = seed >>> 0;
  let tokens = 0;
  return {
    int: (n) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % n;
    },
    token: () => `token${String(++tokens).padStart(8, "0")}xyz`,
  };
}

/** A relay core on a virtual clock. */
export interface CoreHarness {
  readonly core: RelayCore;
  readonly clock: VirtualScheduler;
  readonly config: ServerConfig;
  /** Connect and say hello; returns the session and its connection. */
  connect(
    name?: string,
    build?: string,
  ): { session: Session; conn: RecordingConnection };
  send(session: Session, message: ClientMessage): void;
}

/** @param overrides - Config overrides. @returns A fresh relay core harness. */
export function createCoreHarness(
  overrides: Partial<ServerConfig> = {},
): CoreHarness {
  const clock = new VirtualScheduler(1_000_000);
  const config: ServerConfig = {
    ...DEFAULT_CONFIG,
    startCountdownMs: 1000,
    ...overrides,
  };
  const core = new RelayCore({
    scheduler: clock,
    logger: createSilentLogger(),
    config,
    random: seededRandom(),
  });
  return {
    core,
    clock,
    config,
    connect(name = "Ace", build = "test-build") {
      const conn = new RecordingConnection();
      const session = core.hello(conn, {
        t: "hello",
        protocol: PROTOCOL_VERSION,
        build,
        name,
      });
      if (!session) throw new Error("hello refused");
      return { session, conn };
    },
    send: (session, message) => core.handle(session, message),
  };
}

/** A dogfight loadout. */
export const DOGFIGHT_LOADOUT = {
  faction: "free_confederation",
  ships: ["confed_falcon"],
} as const;
