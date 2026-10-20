import { describe, expect, it } from "vitest";
import {
  NetClient,
  INITIAL_ATTEMPTS,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
} from "../../../src/net/client/NetClient";
import {
  PROTOCOL_VERSION,
  type ServerMessage,
} from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import type { TransportFactory } from "../../../src/net/transport/Transport";
import {
  createRelayLink,
  LINK_MS,
  memoryTokenStore,
  type RelayLink,
} from "./netFixtures";

function client(
  link: RelayLink,
  tokenStore = memoryTokenStore(),
  name = "Ace",
) {
  return new NetClient({
    url: "ws://relay/ws",
    build: "b1",
    name,
    transport: link.factory,
    scheduler: link.clock,
    tokenStore,
  });
}

describe("NetClient handshake and heartbeat", () => {
  it("goes online with the server-assigned player id", () => {
    const link = createRelayLink();
    const c = client(link);
    const states: string[] = [];
    c.onState((s) => states.push(s));
    c.connect();
    link.clock.advance(100);
    expect(c.state).toBe("online");
    expect(states).toEqual(["connecting", "online"]);
    expect(c.playerId).toMatch(/^p\d+_/);
  });

  it("measures the round trip from heartbeats and reports it with jitter", () => {
    const link = createRelayLink();
    const c = client(link);
    c.connect();
    link.clock.advance(PING_INTERVAL_MS * 3);
    expect(c.rttMs).toBe(2 * LINK_MS);
    expect(c.reportedRttMs()).toBe(2 * LINK_MS);
  });

  it("delivers server messages to typed listeners", () => {
    const link = createRelayLink();
    const c = client(link);
    const rooms: Extract<ServerMessage, { t: "room" }>[] = [];
    c.on("room", (m) => rooms.push(m));
    c.connect();
    link.clock.advance(100);
    c.send({ t: "create_room", mode: "dogfight" });
    link.clock.advance(100);
    expect(rooms[0]?.room.players[0]?.id).toBe(c.playerId);
  });

  it("refuses to send while not online", () => {
    const link = createRelayLink();
    expect(client(link).send({ t: "leave_room" })).toBe(false);
  });
});

describe("NetClient reconnection", () => {
  it("does not open a second socket when connect() is called while reconnecting", () => {
    const link = createRelayLink();
    const c = client(link);
    c.connect();
    link.clock.advance(100);
    link.down = true;
    link.cutAll();
    link.clock.advance(LINK_MS);
    expect(c.state).toBe("reconnecting");
    link.down = false;
    const before = link.opened;
    c.connect();
    link.clock.advance(5_000);
    expect(c.state).toBe("online");
    expect(link.opened - before).toBe(1);
  });

  it("resumes the same session after a network drop and gets its room back", () => {
    const link = createRelayLink();
    const c = client(link);
    c.connect();
    link.clock.advance(100);
    c.send({ t: "create_room", mode: "dogfight" });
    link.clock.advance(100);
    const id = c.playerId;
    const rooms: string[] = [];
    c.on("room", (m) => rooms.push(m.room.code));
    link.cutAll();
    link.clock.advance(LINK_MS);
    expect(c.state).toBe("reconnecting");
    link.clock.advance(2_000);
    expect(c.state).toBe("online");
    expect(c.playerId).toBe(id);
    expect(rooms.length).toBeGreaterThan(0);
  });

  it("resumes after a page reload through the stored token", () => {
    const link = createRelayLink();
    const store = memoryTokenStore();
    const first = client(link, store);
    first.connect();
    link.clock.advance(100);
    const id = first.playerId;
    link.cutAll();
    const reloaded = client(link, store);
    reloaded.connect();
    link.clock.advance(100);
    expect(reloaded.state).toBe("online");
    expect(reloaded.playerId).toBe(id);
  });

  it("gives up once the server's reconnection window has passed", () => {
    const link = createRelayLink({ reconnectWindowMs: 3_000 });
    const c = client(link);
    c.connect();
    link.clock.advance(100);
    link.down = true;
    link.cutAll();
    link.clock.advance(10_000);
    expect(c.state).toBe("expired");
  });

  it("drops a silent connection after the heartbeat timeout and reconnects", () => {
    const link = createRelayLink();
    const c = client(link);
    c.connect();
    link.clock.advance(100);
    const opened = link.opened;
    link.silent = true;
    link.clock.advance(SILENCE_TIMEOUT_MS + PING_INTERVAL_MS);
    link.silent = false;
    link.clock.advance(3_000);
    expect(link.opened).toBeGreaterThan(opened);
    expect(c.state).toBe("online");
  });

  it("reports an unreachable server after the initial attempts", () => {
    const link = createRelayLink();
    link.down = true;
    const c = client(link);
    c.connect();
    link.clock.advance(30_000);
    expect(c.state).toBe("unreachable");
    expect(link.opened).toBe(INITIAL_ATTEMPTS);
  });
});

describe("NetClient refusals", () => {
  function refusingFactory(
    clock: VirtualScheduler,
    reason: "version_mismatch" | "session_expired",
    code: number,
  ): TransportFactory {
    return (_url, handlers) => {
      clock.setTimeout(() => handlers.onOpen(), 1);
      return {
        send: () =>
          clock.setTimeout(() => {
            handlers.onMessage(
              JSON.stringify({
                t: "refused",
                reason,
                serverProtocol: PROTOCOL_VERSION + 1,
              }),
            );
            handlers.onClose(code, reason);
          }, 1),
        close: () => undefined,
      };
    };
  }

  it("stops for good on a version mismatch (the page must be reloaded)", () => {
    const clock = new VirtualScheduler();
    const c = new NetClient({
      url: "x",
      build: "old",
      name: "A",
      scheduler: clock,
      transport: refusingFactory(clock, "version_mismatch", 4001),
    });
    c.connect();
    clock.advance(60_000);
    expect(c.state).toBe("refused");
    expect(c.refusal).toBe("version_mismatch");
  });

  it("forgets an expired token so the next connect starts fresh", () => {
    const clock = new VirtualScheduler();
    const store = memoryTokenStore();
    store.value = "stale";
    const c = new NetClient({
      url: "x",
      build: "b",
      name: "A",
      scheduler: clock,
      tokenStore: store,
      transport: refusingFactory(clock, "session_expired", 4004),
    });
    c.connect();
    clock.advance(1_000);
    expect(c.state).toBe("expired");
    expect(store.value).toBeNull();
  });
});
