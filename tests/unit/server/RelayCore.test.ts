import { describe, expect, it } from "vitest";
import { CLOSE_CODES } from "../../../src/net/protocol";
import {
  createCoreHarness,
  DOGFIGHT_LOADOUT,
  RecordingConnection,
} from "./relayFixtures";

describe("RelayCore handshake", () => {
  it("welcomes a matching client with a session token", () => {
    const { connect } = createCoreHarness();
    const { conn, session } = connect();
    expect(conn.last("welcome")).toMatchObject({
      playerId: session.id,
      token: session.token,
      resumed: false,
    });
  });

  it("refuses a client speaking another protocol version and closes it", () => {
    const { core } = createCoreHarness();
    const conn = new RecordingConnection();
    expect(
      core.hello(conn, { t: "hello", protocol: 999, build: "b", name: "Old" }),
    ).toBeNull();
    expect(conn.last("refused")?.reason).toBe("version_mismatch");
    expect(conn.closed?.code).toBe(CLOSE_CODES.versionMismatch);
  });

  it("resumes a session by token within the reconnection window", () => {
    const h = createCoreHarness();
    const { session, conn } = h.connect();
    h.core.disconnected(session, conn);
    h.clock.advance(h.config.reconnectWindowMs - 1);
    const again = new RecordingConnection();
    const resumed = h.core.hello(again, {
      t: "hello",
      protocol: 1,
      build: "test-build",
      name: "Ace",
      token: session.token,
    });
    expect(resumed?.id).toBe(session.id);
    expect(again.last("welcome")?.resumed).toBe(true);
  });

  it("expires the session after the reconnection window", () => {
    const h = createCoreHarness();
    const { session, conn } = h.connect();
    h.core.disconnected(session, conn);
    h.clock.advance(h.config.reconnectWindowMs + 1);
    const again = new RecordingConnection();
    expect(
      h.core.hello(again, {
        t: "hello",
        protocol: 1,
        build: "test-build",
        name: "Ace",
        token: session.token,
      }),
    ).toBeNull();
    expect(again.last("refused")?.reason).toBe("session_expired");
  });

  it("closes the old socket when the same session connects again", () => {
    const h = createCoreHarness();
    const { session, conn } = h.connect();
    h.core.hello(new RecordingConnection(), {
      t: "hello",
      protocol: 1,
      build: "test-build",
      name: "Ace",
      token: session.token,
    });
    expect(conn.closed?.code).toBe(CLOSE_CODES.replaced);
  });

  it("answers pings with the client's timestamp", () => {
    const h = createCoreHarness();
    const { session, conn } = h.connect();
    h.send(session, { t: "ping", id: 7, ct: 123 });
    expect(conn.last("pong")).toMatchObject({
      id: 7,
      ct: 123,
      st: h.clock.now(),
    });
  });
});

describe("RelayCore rooms", () => {
  it("creates a room with a code a friend can join", () => {
    const h = createCoreHarness();
    const host = h.connect("Host");
    const guest = h.connect("Guest");
    h.send(host.session, { t: "create_room", mode: "dogfight" });
    const code = host.conn.last("room")!.room.code;
    h.send(guest.session, { t: "join_room", code });
    const room = guest.conn.last("room")!.room;
    expect(room.players.map((p) => [p.name, p.seat, p.isHost])).toEqual([
      ["Host", 0, true],
      ["Guest", 1, false],
    ]);
    expect(host.conn.last("room")!.room.players).toHaveLength(2);
  });

  it("rejects unknown codes, full rooms and other builds", () => {
    const h = createCoreHarness();
    const host = h.connect("Host");
    h.send(host.session, { t: "create_room", mode: "dogfight" });
    const code = host.conn.last("room")!.room.code;
    const stranger = h.connect("X", "other-build");
    h.send(stranger.session, { t: "join_room", code });
    expect(stranger.conn.last("error")?.code).toBe("build_mismatch");
    h.send(h.connect("B").session, { t: "join_room", code });
    const late = h.connect("C");
    h.send(late.session, { t: "join_room", code });
    expect(late.conn.last("error")?.code).toBe("room_full");
    h.send(late.session, { t: "join_room", code: "ZZZZZ" });
    expect(late.conn.last("error")?.code).toBe("room_not_found");
  });

  it("refuses ready without a loadout and a dogfight loadout of two ships", () => {
    const h = createCoreHarness();
    const host = h.connect();
    h.send(host.session, { t: "create_room", mode: "dogfight" });
    h.send(host.session, { t: "set_ready", ready: true });
    expect(host.conn.last("error")?.code).toBe("invalid_loadout");
    h.send(host.session, {
      t: "set_loadout",
      loadout: { faction: "void_corsairs", ships: ["a", "b"] },
    });
    expect(host.conn.last("error")?.code).toBe("invalid_loadout");
  });

  it("starts the match after the countdown once everyone is ready", () => {
    const h = createCoreHarness();
    const { host, guest } = readyPair(h);
    expect(host.conn.last("room")!.room.phase).toBe("starting");
    expect(host.conn.last("match_start")).toBeUndefined();
    h.clock.advance(h.config.startCountdownMs);
    const a = host.conn.last("match_start")!.match;
    const b = guest.conn.last("match_start")!.match;
    expect(a).toEqual(b);
    expect(a.seats.map((s) => s.team)).toEqual([0, 1]);
    expect(a.inputDelay).toBeGreaterThanOrEqual(2);
  });

  it("cancels the countdown when a player un-readies", () => {
    const h = createCoreHarness();
    const { host, guest } = readyPair(h);
    h.send(guest.session, { t: "set_ready", ready: false });
    h.clock.advance(h.config.startCountdownMs * 2);
    expect(host.conn.last("match_start")).toBeUndefined();
    expect(host.conn.last("room")!.room.phase).toBe("lobby");
  });

  it("passes host to the next seat when the host leaves", () => {
    const h = createCoreHarness();
    const { host, guest } = readyPair(h);
    h.send(host.session, { t: "leave_room" });
    expect(host.conn.last("room_left")?.reason).toBe("left");
    expect(guest.conn.last("room")!.room.hostId).toBe(guest.session.id);
  });

  it("relays chat to the whole room", () => {
    const h = createCoreHarness();
    const { host, guest } = readyPair(h);
    h.send(guest.session, { t: "chat", text: "gl hf" });
    expect(host.conn.last("chat")).toMatchObject({
      name: "Guest",
      text: "gl hf",
    });
  });
});

describe("RelayCore quick match", () => {
  it("queues a lone player and pairs the next one into a quick-match room", () => {
    const h = createCoreHarness();
    const a = h.connect("A");
    const b = h.connect("B");
    h.send(a.session, { t: "quick_match", mode: "dogfight" });
    expect(a.conn.last("queue")).toMatchObject({
      queued: true,
      mode: "dogfight",
    });
    h.send(b.session, { t: "quick_match", mode: "dogfight" });
    const room = b.conn.last("room")!.room;
    expect(room.quickMatch).toBe(true);
    expect(room.players).toHaveLength(2);
    expect(room.readyDeadline).toBe(h.clock.now() + h.config.quickMatchReadyMs);
  });

  it("drops players who miss the ready check and re-queues the ready one", () => {
    const h = createCoreHarness();
    const a = h.connect("A");
    const b = h.connect("B");
    h.send(a.session, { t: "quick_match", mode: "dogfight" });
    h.send(b.session, { t: "quick_match", mode: "dogfight" });
    h.send(a.session, { t: "set_loadout", loadout: DOGFIGHT_LOADOUT });
    h.send(a.session, { t: "set_ready", ready: true });
    h.clock.advance(h.config.quickMatchReadyMs);
    expect(b.conn.last("room_left")?.reason).toBe("ready_timeout");
    expect(a.conn.last("queue")?.queued).toBe(true);
  });

  it("cancels the queue on request and on disconnect", () => {
    const h = createCoreHarness();
    const a = h.connect("A");
    h.send(a.session, { t: "quick_match", mode: "skirmish" });
    h.send(a.session, { t: "cancel_queue" });
    expect(a.conn.last("queue")?.queued).toBe(false);
    expect(h.core.stats().queued).toBe(0);
  });
});

/** Two players in a dogfight room, both ready (countdown running). */
function readyPair(h: ReturnType<typeof createCoreHarness>) {
  const host = h.connect("Host");
  const guest = h.connect("Guest");
  h.send(host.session, { t: "create_room", mode: "dogfight" });
  h.send(guest.session, {
    t: "join_room",
    code: host.conn.last("room")!.room.code,
  });
  for (const p of [host, guest]) {
    h.send(p.session, { t: "set_loadout", loadout: DOGFIGHT_LOADOUT });
    h.send(p.session, { t: "set_ready", ready: true });
  }
  return { host, guest };
}

export type { ServerMessage };
